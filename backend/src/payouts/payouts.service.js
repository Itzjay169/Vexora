/**
 * Vexora Esports Tournament Platform — Payouts Service
 *
 * Phase 28: Payouts, Reconciliation & Financial Reports
 * PDF refs: Sections 8, 9, 47 (Phase 6)
 *
 * Implements:
 * - Payout queue lifecycle: REQUESTED → UNDER_REVIEW → APPROVED → PROCESSING → PAID / FAILED / REJECTED
 * - Maker-Checker controls: Creator strictly forbidden from self-approval
 * - High-value dual approvals: Threshold (₹10,000) mandates two separate admins + step-up auth
 * - Cooling-off period: 24-hour mandatory delay on new or modified destinations
 * - Payout marked PAID only after bank UTR / provider reconciliation
 * - Double-entry wallet hold during review and debit upon settlement
 */

import crypto from 'crypto';
import { query, withTransaction } from '../common/database.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { logger } from '../common/logger.js';
import {
  WalletLedgerService,
  PLATFORM_ESCROW_WALLET_ID,
  PLATFORM_REVENUE_WALLET_ID,
} from '../wallet/walletLedger.service.js';
import { PaymentService } from '../payments/payment.service.js';

// ─── Constants ──────────────────────────────────────────────────────────
export const HIGH_VALUE_THRESHOLD = 10000.00; // ₹10,000 threshold for dual approval
export const COOLING_OFF_HOURS = 24;          // 24-hour delay on new payout destinations

export class PayoutsService {

  // ─── Destination Management ───────────────────────────────────────────
  /**
   * Register a new payout destination (Bank account or UPI ID).
   * Enforces 24-hour cooling-off delay to protect against account takeover drain.
   *
   * @param {Object} params
   * @param {string} params.userId - User UUID
   * @param {'UPI'|'BANK_ACCOUNT'} params.destinationType
   * @param {string} [params.upiId]
   * @param {string} [params.bankAccountNumber]
   * @param {string} [params.bankIfsc]
   * @param {string} params.accountHolderName
   * @param {string} [params.ipAddress]
   * @returns {Promise<Object>} Created destination
   */
  static async addPayoutDestination({
    userId,
    destinationType,
    upiId,
    bankAccountNumber,
    bankIfsc,
    accountHolderName,
    ipAddress = '0.0.0.0',
  }) {
    if (!accountHolderName || accountHolderName.trim().length < 2) {
      const err = new Error('Account holder name must be at least 2 characters');
      err.code = 'INVALID_ACCOUNT_NAME';
      err.status = 400;
      throw err;
    }

    if (destinationType === 'UPI') {
      if (!upiId || !upiId.includes('@')) {
        const err = new Error('Valid UPI ID is required (e.g. user@okaxis)');
        err.code = 'INVALID_UPI_ID';
        err.status = 400;
        throw err;
      }
    } else if (destinationType === 'BANK_ACCOUNT') {
      if (!bankAccountNumber || bankAccountNumber.length < 8) {
        const err = new Error('Valid bank account number is required');
        err.code = 'INVALID_BANK_ACCOUNT';
        err.status = 400;
        throw err;
      }
      if (!bankIfsc || bankIfsc.length !== 11) {
        const err = new Error('Valid 11-character IFSC code is required');
        err.code = 'INVALID_IFSC';
        err.status = 400;
        throw err;
      }
    } else {
      const err = new Error('Unsupported destination type. Must be UPI or BANK_ACCOUNT.');
      err.code = 'INVALID_DESTINATION_TYPE';
      err.status = 400;
      throw err;
    }

    const coolingOffUntil = new Date(Date.now() + COOLING_OFF_HOURS * 60 * 60 * 1000);

    const res = await query(
      `INSERT INTO payout_destinations (
        user_id, destination_type, upi_id, bank_account_number, bank_ifsc,
        account_holder_name, is_verified, cooling_off_until, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
      RETURNING *`,
      [
        userId,
        destinationType,
        upiId ? upiId.trim() : null,
        bankAccountNumber ? bankAccountNumber.trim() : null,
        bankIfsc ? bankIfsc.toUpperCase().trim() : null,
        accountHolderName.trim(),
        coolingOffUntil.toISOString(),
        JSON.stringify({ created_from_ip: ipAddress }),
      ]
    );

    const destination = res.rows[0];

    // Log security audit for destination addition
    await appendAuditLog({
      userId,
      role: 'PLAYER',
      ipAddress,
      action: 'PAYOUT_DESTINATION_ADDED',
      entity: 'payout_destinations',
      entityId: destination.id,
      reason: `New ${destinationType} payout destination registered with ${COOLING_OFF_HOURS}h cooling-off`,
      payload: { destinationId: destination.id, destinationType, coolingOffUntil },
    });

    return destination;
  }

  /**
   * List user's active payout destinations with cooling-off status.
   *
   * @param {string} userId - User UUID
   * @returns {Promise<Array>}
   */
  static async listPayoutDestinations(userId) {
    const res = await query(
      `SELECT id, destination_type, upi_id, 
              CASE 
                WHEN bank_account_number IS NOT NULL THEN '••••' || RIGHT(bank_account_number, 4)
                ELSE NULL 
              END as masked_account_number,
              bank_ifsc, account_holder_name, is_verified, cooling_off_until,
              (cooling_off_until > NOW()) as is_cooling_off_active,
              created_at
       FROM payout_destinations
       WHERE user_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.rows.map((row) => ({
      ...row,
      cooling_off_remaining_seconds: row.is_cooling_off_active
        ? Math.max(0, Math.floor((new Date(row.cooling_off_until) - Date.now()) / 1000))
        : 0,
    }));
  }

  // ─── Payout Request Creation ──────────────────────────────────────────
  /**
   * Request a cash-out payout.
   * Enforces wallet balance check, destination cooling-off, and places amount on HOLD.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.destinationId
   * @param {number} params.amount - Amount in INR/VXC
   * @param {string} [params.idempotencyKey]
   * @param {string} [params.ipAddress]
   * @returns {Promise<Object>}
   */
  static async requestPayout({
    userId,
    destinationId,
    amount,
    idempotencyKey,
    ipAddress = '0.0.0.0',
  }) {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      const err = new Error('Payout amount must be a positive number');
      err.code = 'INVALID_PAYOUT_AMOUNT';
      err.status = 400;
      throw err;
    }

    if (idempotencyKey) {
      const existing = await query(
        `SELECT * FROM payout_requests WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (existing.rows.length > 0) {
        return { payout: existing.rows[0], isReplay: true };
      }
    }

    return withTransaction(async (client) => {
      // 1. Fetch and validate destination
      const destRes = await client.query(
        `SELECT * FROM payout_destinations WHERE id = $1 AND user_id = $2 AND is_active = true`,
        [destinationId, userId]
      );

      if (destRes.rows.length === 0) {
        const err = new Error('Payout destination not found or not active');
        err.code = 'DESTINATION_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const dest = destRes.rows[0];

      // 2. Check cooling-off period
      if (new Date(dest.cooling_off_until) > new Date()) {
        const remainingMinutes = Math.ceil((new Date(dest.cooling_off_until) - Date.now()) / 60000);
        const err = new Error(
          `Destination is in security cooling-off period. Available in ${remainingMinutes} minutes.`
        );
        err.code = 'COOLING_OFF_ACTIVE';
        err.status = 403;
        err.remainingMinutes = remainingMinutes;
        throw err;
      }

      // 3. Check wallet balance
      const balanceRes = await client.query(
        `SELECT available_balance, is_frozen FROM wallet_accounts WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      if (balanceRes.rows.length === 0) {
        const err = new Error('Wallet account not found');
        err.code = 'WALLET_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const wallet = balanceRes.rows[0];
      if (wallet.is_frozen) {
        const err = new Error('Wallet is frozen due to security investigation');
        err.code = 'WALLET_FROZEN';
        err.status = 403;
        throw err;
      }

      if (Number(wallet.available_balance) < numAmount) {
        const err = new Error(`Insufficient available balance. Available: ₹${wallet.available_balance}`);
        err.code = 'INSUFFICIENT_BALANCE';
        err.status = 400;
        throw err;
      }

      // 4. Place amount on hold in wallet ledger
      const holdResult = await WalletLedgerService.holdFunds({
        userId,
        amount: numAmount,
        reason: 'Payout withdrawal request hold',
        referenceType: 'PAYOUT_REQUEST',
        referenceId: destinationId,
        idempotencyKey: idempotencyKey ? `hold-${idempotencyKey}` : `hold-po-${Date.now()}`,
      });

      const isHighValue = numAmount >= HIGH_VALUE_THRESHOLD;

      // 5. Create payout request in queue
      const reqRes = await client.query(
        `INSERT INTO payout_requests (
          user_id, destination_id, amount, fee_amount, net_payout_amount,
          currency, status, is_high_value, hold_ledger_tx_id, idempotency_key, metadata
        ) VALUES ($1, $2, $3, 0.00, $3, 'INR', 'REQUESTED', $4, $5, $6, $7)
        RETURNING *`,
        [
          userId,
          destinationId,
          numAmount,
          isHighValue,
          holdResult.transactionId || null,
          idempotencyKey || null,
          JSON.stringify({ requested_ip: ipAddress, destination_type: dest.destination_type }),
        ]
      );

      const payout = reqRes.rows[0];

      await appendAuditLog({
        userId,
        role: 'PLAYER',
        ipAddress,
        action: 'PAYOUT_REQUESTED',
        entity: 'payout_requests',
        entityId: payout.id,
        reason: `Payout of ₹${numAmount} requested (High Value: ${isHighValue})`,
        payload: { payoutId: payout.id, amount: numAmount, isHighValue },
      });

      logger.info('Payout request created', { payoutId: payout.id, amount: numAmount, isHighValue });

      return { payout, isReplay: false };
    });
  }

  // ─── Maker-Checker Approval (Primary Approver) ───────────────────────
  /**
   * Primary admin approval for payout requests.
   * Creator/user cannot approve own payout (Maker-Checker invariant).
   *
   * @param {Object} params
   * @param {string} params.payoutId
   * @param {string} params.adminId
   * @param {string} [params.notes]
   * @param {string} [params.ipAddress]
   * @returns {Promise<Object>}
   */
  static async approvePrimary({ payoutId, adminId, notes = '', ipAddress = '0.0.0.0' }) {
    return withTransaction(async (client) => {
      const res = await client.query(
        `SELECT * FROM payout_requests WHERE id = $1 FOR UPDATE`,
        [payoutId]
      );

      if (res.rows.length === 0) {
        const err = new Error('Payout request not found');
        err.code = 'PAYOUT_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const payout = res.rows[0];

      // Maker-Checker Invariant: User cannot approve their own payout
      if (payout.user_id === adminId) {
        const err = new Error('MAKER-CHECKER VIOLATION: Creator cannot approve their own payout request');
        err.code = 'SELF_APPROVAL_FORBIDDEN';
        err.status = 403;
        throw err;
      }

      if (!['REQUESTED', 'UNDER_REVIEW'].includes(payout.status)) {
        const err = new Error(`Cannot approve payout in status: ${payout.status}`);
        err.code = 'INVALID_PAYOUT_STATUS';
        err.status = 400;
        throw err;
      }

      // If high-value, status remains UNDER_REVIEW awaiting second approver
      const nextStatus = payout.is_high_value ? 'UNDER_REVIEW' : 'APPROVED';

      const updateRes = await client.query(
        `UPDATE payout_requests
         SET status = $1,
             primary_approver_id = $2,
             primary_approved_at = NOW(),
             primary_approval_notes = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [nextStatus, adminId, notes, payoutId]
      );

      const updated = updateRes.rows[0];

      await appendAuditLog({
        userId: adminId,
        role: 'ADMIN',
        ipAddress,
        action: 'PAYOUT_PRIMARY_APPROVED',
        entity: 'payout_requests',
        entityId: payoutId,
        reason: `Primary approval granted by admin ${adminId}. Awaiting secondary: ${payout.is_high_value}`,
        payload: { payoutId, isHighValue: payout.is_high_value, nextStatus },
      });

      return updated;
    });
  }

  // ─── Dual Approval for High-Value Payouts (Secondary Approver) ────────
  /**
   * Secondary admin approval for high-value payouts (> ₹10,000).
   * Mandates two distinct administrators + step-up authentication.
   *
   * @param {Object} params
   * @param {string} params.payoutId
   * @param {string} params.adminId - Secondary approver UUID
   * @param {boolean} params.stepUpAuthVerified - Verification of TOTP/biometric step-up
   * @param {string} [params.notes]
   * @param {string} [params.ipAddress]
   * @returns {Promise<Object>}
   */
  static async approveSecondaryHighValue({
    payoutId,
    adminId,
    stepUpAuthVerified = false,
    notes = '',
    ipAddress = '0.0.0.0',
  }) {
    if (!stepUpAuthVerified) {
      const err = new Error('Step-up authentication (MFA) required for high-value payout approval');
      err.code = 'STEP_UP_AUTH_REQUIRED';
      err.status = 403;
      throw err;
    }

    return withTransaction(async (client) => {
      const res = await client.query(
        `SELECT * FROM payout_requests WHERE id = $1 FOR UPDATE`,
        [payoutId]
      );

      if (res.rows.length === 0) {
        const err = new Error('Payout request not found');
        err.code = 'PAYOUT_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const payout = res.rows[0];

      if (!payout.is_high_value) {
        const err = new Error('Secondary approval is only applicable to high-value payout requests');
        err.code = 'NOT_HIGH_VALUE_PAYOUT';
        err.status = 400;
        throw err;
      }

      if (!payout.primary_approver_id) {
        const err = new Error('Primary approval must be completed before secondary approval');
        err.code = 'PRIMARY_APPROVAL_PENDING';
        err.status = 400;
        throw err;
      }

      // Maker-Checker Dual Approver Rule: Secondary approver CANNOT match primary approver
      if (payout.primary_approver_id === adminId) {
        const err = new Error(
          'DUAL APPROVAL VIOLATION: Secondary approver cannot be the same administrator as the primary approver'
        );
        err.code = 'DUAL_APPROVER_SAME_ADMIN_FORBIDDEN';
        err.status = 403;
        throw err;
      }

      // User cannot approve own payout
      if (payout.user_id === adminId) {
        const err = new Error('MAKER-CHECKER VIOLATION: Creator cannot approve own payout');
        err.code = 'SELF_APPROVAL_FORBIDDEN';
        err.status = 403;
        throw err;
      }

      const updateRes = await client.query(
        `UPDATE payout_requests
         SET status = 'APPROVED',
             secondary_approver_id = $1,
             secondary_approved_at = NOW(),
             secondary_approval_notes = $2,
             step_up_auth_verified = true,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [adminId, notes, payoutId]
      );

      const updated = updateRes.rows[0];

      await appendAuditLog({
        userId: adminId,
        role: 'SUPER_ADMIN',
        ipAddress,
        action: 'PAYOUT_SECONDARY_APPROVED',
        entity: 'payout_requests',
        entityId: payoutId,
        reason: `High-value secondary approval granted by admin ${adminId}`,
        payload: { payoutId, primaryApprover: payout.primary_approver_id, secondaryApprover: adminId },
      });

      return updated;
    });
  }

  // ─── Payout Rejection & Hold Release ──────────────────────────────────
  /**
   * Reject a payout request and automatically release the wallet hold.
   *
   * @param {Object} params
   * @param {string} params.payoutId
   * @param {string} params.adminId
   * @param {string} params.reason
   * @param {string} [params.ipAddress]
   * @returns {Promise<Object>}
   */
  static async rejectPayout({ payoutId, adminId, reason, ipAddress = '0.0.0.0' }) {
    if (!reason || reason.trim().length < 5) {
      const err = new Error('Rejection reason must be at least 5 characters');
      err.code = 'INVALID_REJECTION_REASON';
      err.status = 400;
      throw err;
    }

    return withTransaction(async (client) => {
      const res = await client.query(
        `SELECT * FROM payout_requests WHERE id = $1 FOR UPDATE`,
        [payoutId]
      );

      if (res.rows.length === 0) {
        const err = new Error('Payout request not found');
        err.code = 'PAYOUT_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const payout = res.rows[0];

      if (['PAID', 'REJECTED'].includes(payout.status)) {
        const err = new Error(`Cannot reject payout in terminal status: ${payout.status}`);
        err.code = 'TERMINAL_PAYOUT_STATUS';
        err.status = 400;
        throw err;
      }

      // Release wallet hold
      await WalletLedgerService.releaseHold({
        userId: payout.user_id,
        amount: Number(payout.amount),
        reason: `Payout rejected: ${reason}`,
        referenceType: 'PAYOUT_REJECTION',
        referenceId: payoutId,
        idempotencyKey: `rel-payout-rej-${payoutId}`,
      });

      const updateRes = await client.query(
        `UPDATE payout_requests
         SET status = 'REJECTED',
             rejection_reason = $1,
             rejected_by_id = $2,
             rejected_at = NOW(),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [reason, adminId, payoutId]
      );

      const updated = updateRes.rows[0];

      await appendAuditLog({
        userId: adminId,
        role: 'ADMIN',
        ipAddress,
        action: 'PAYOUT_REJECTED',
        entity: 'payout_requests',
        entityId: payoutId,
        reason: `Payout rejected: ${reason}`,
        payload: { payoutId, reason, rejectedBy: adminId },
      });

      return updated;
    });
  }

  // ─── Mark Payout as Paid (Post-Reconciliation) ────────────────────────
  /**
   * Transition approved payout to PAID after bank/provider execution.
   * Debits user wallet and records Bank UTR reference.
   *
   * @param {Object} params
   * @param {string} params.payoutId
   * @param {string} params.bankUtr - Bank Unique Transaction Reference
   * @param {string} [params.provider] - e.g. 'RAZORPAYX', 'BANK_NEFT_IMPS'
   * @param {string} [params.providerPayoutId]
   * @param {string} [params.adminId]
   * @returns {Promise<Object>}
   */
  static async markPayoutPaid({
    payoutId,
    bankUtr,
    provider = 'BANK_NEFT_IMPS',
    providerPayoutId,
    adminId,
  }) {
    if (!bankUtr || bankUtr.trim().length < 6) {
      const err = new Error('Valid Bank UTR reference is mandatory to mark payout as PAID');
      err.code = 'INVALID_BANK_UTR';
      err.status = 400;
      throw err;
    }

    return withTransaction(async (client) => {
      const res = await client.query(
        `SELECT * FROM payout_requests WHERE id = $1 FOR UPDATE`,
        [payoutId]
      );

      if (res.rows.length === 0) {
        const err = new Error('Payout request not found');
        err.code = 'PAYOUT_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const payout = res.rows[0];

      if (payout.status !== 'APPROVED' && payout.status !== 'PROCESSING') {
        const err = new Error(`Payout must be in APPROVED or PROCESSING status to mark PAID. Current: ${payout.status}`);
        err.code = 'PAYOUT_NOT_APPROVED';
        err.status = 400;
        throw err;
      }

      // First release the hold, then execute atomic double-entry transfer to PLATFORM_ESCROW/REVENUE
      await WalletLedgerService.releaseHold({
        userId: payout.user_id,
        amount: Number(payout.amount),
        reason: 'Hold released for final payout execution',
        referenceType: 'PAYOUT_EXECUTION',
        referenceId: payoutId,
        idempotencyKey: `rel-exec-${payoutId}`,
      });

      // Debit user wallet to platform escrow
      const userWalletRes = await client.query(
        `SELECT id FROM wallet_accounts WHERE user_id = $1`,
        [payout.user_id]
      );
      const userWalletId = userWalletRes.rows[0].id;

      const ledgerResult = await WalletLedgerService.executeLedgerTransfer({
        debitAccountId: userWalletId,
        creditAccountId: PLATFORM_ESCROW_WALLET_ID,
        amount: Number(payout.amount),
        transactionType: 'DEBIT',
        description: `Cash-out payout settled (UTR: ${bankUtr})`,
        referenceType: 'PAYOUT_SETTLEMENT',
        referenceId: payoutId,
        idempotencyKey: `payout-settle-${payoutId}`,
      });

      const updateRes = await client.query(
        `UPDATE payout_requests
         SET status = 'PAID',
             provider = $1,
             provider_payout_id = $2,
             bank_utr = $3,
             paid_at = NOW(),
             debit_ledger_tx_id = $4,
             reconciled = true,
             reconciled_at = NOW(),
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [provider, providerPayoutId || null, bankUtr.trim(), ledgerResult.transactionId || null, payoutId]
      );

      const updated = updateRes.rows[0];

      await appendAuditLog({
        userId: adminId || payout.user_id,
        role: adminId ? 'FINANCE' : 'SYSTEM',
        ipAddress: '0.0.0.0',
        action: 'PAYOUT_SETTLED_PAID',
        entity: 'payout_requests',
        entityId: payoutId,
        reason: `Payout settled and marked PAID with Bank UTR: ${bankUtr}`,
        payload: { payoutId, bankUtr, provider, amount: payout.amount },
      });

      logger.info('Payout marked as paid and reconciled', { payoutId, bankUtr });

      return updated;
    });
  }

  // ─── Querying ─────────────────────────────────────────────────────────
  /**
   * List payouts for user or admin with filtering.
   *
   * @param {Object} filter
   * @param {string} [filter.userId]
   * @param {string} [filter.status]
   * @param {boolean} [filter.isHighValue]
   * @param {number} [filter.limit=50]
   * @returns {Promise<Array>}
   */
  static async listPayouts({ userId, status, isHighValue, limit = 50 }) {
    let sql = `
      SELECT p.*, d.destination_type, d.upi_id, 
             CASE 
               WHEN d.bank_account_number IS NOT NULL THEN '••••' || RIGHT(d.bank_account_number, 4)
               ELSE NULL 
             END as masked_account_number,
             d.account_holder_name
      FROM payout_requests p
      JOIN payout_destinations d ON p.destination_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      params.push(userId);
      sql += ` AND p.user_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND p.status = $${params.length}`;
    }
    if (isHighValue !== undefined) {
      params.push(isHighValue);
      sql += ` AND p.is_high_value = $${params.length}`;
    }

    sql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await query(sql, params);
    return res.rows;
  }
}
