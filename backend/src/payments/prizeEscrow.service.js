/**
 * Vexora Esports Tournament Platform — Prize Escrow Service
 *
 * Phase 27: Payments, Prize Escrow & Paid Tournament Flow
 * PDF refs: Sections 9, 26, 39 (Phase 6)
 *
 * Implements:
 * - Organiser-funded prize escrow locked BEFORE registration opens
 * - Tournament entry via wallet holds
 * - Refunds on cancellation (automatic hold release)
 * - Settlement job: distributes prizes after tournament completion
 * - Published refund rules
 */

import { query, withTransaction } from '../common/database.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { logger } from '../common/logger.js';
import {
  WalletLedgerService,
  PLATFORM_ESCROW_WALLET_ID,
  ORGANISER_ESCROW_WALLET_ID,
} from '../wallet/walletLedger.service.js';
import { PaymentService } from './payment.service.js';

export class PrizeEscrowService {

  // ─── Escrow Lock: Lock prize pool BEFORE registration opens ─────────
  /**
   * Lock organiser's prize pool into escrow.
   * Must be called before tournament transitions to REGISTRATION_OPEN.
   * The organiser's wallet is debited and PLATFORM_ESCROW is credited.
   *
   * @param {Object} params
   * @param {string} params.tournamentId - Tournament UUID
   * @param {string} params.organiserId - Organiser user UUID
   * @param {number} params.escrowAmount - Prize pool amount in VXC
   * @param {string} params.idempotencyKey - Unique key
   * @returns {Promise<Object>} Escrow lock record
   */
  static async lockPrizeEscrow({ tournamentId, organiserId, escrowAmount, idempotencyKey }) {
    // 1. Feature flag check
    const paymentsEnabled = await PaymentService.isPaymentsEnabled();
    if (!paymentsEnabled) {
      const err = new Error('Real-money payments are disabled. Free tournaments do not require escrow.');
      err.code = 'PAYMENTS_DISABLED';
      err.status = 403;
      throw err;
    }

    const amount = Number(escrowAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      const err = new Error('Escrow amount must be a positive number');
      err.code = 'INVALID_ESCROW_AMOUNT';
      err.status = 400;
      throw err;
    }

    // 2. Idempotency check
    if (idempotencyKey) {
      const existing = await query(
        `SELECT * FROM prize_escrow_locks WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (existing.rows.length > 0) {
        return { escrow: existing.rows[0], isReplay: true };
      }
    }

    return withTransaction(async (client) => {
      // 3. Check tournament exists and organiser owns it
      const tournRes = await client.query(
        `SELECT id, organiser_id, status, prize_pool_credits
         FROM tournaments
         WHERE id = $1 FOR UPDATE`,
        [tournamentId]
      );

      if (tournRes.rows.length === 0) {
        const err = new Error('Tournament not found');
        err.code = 'TOURNAMENT_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const tournament = tournRes.rows[0];
      if (tournament.organiser_id !== organiserId) {
        const err = new Error('Only the tournament organiser can lock escrow');
        err.code = 'NOT_TOURNAMENT_ORGANISER';
        err.status = 403;
        throw err;
      }

      // 4. Ensure tournament is in a valid state for escrow lock
      if (!['DRAFT', 'PENDING_REVIEW', 'SCHEDULED'].includes(tournament.status)) {
        const err = new Error(`Cannot lock escrow for tournament in status: ${tournament.status}`);
        err.code = 'INVALID_TOURNAMENT_STATE';
        err.status = 400;
        throw err;
      }

      // 5. Check for existing escrow
      const existingEscrow = await client.query(
        `SELECT id, status FROM prize_escrow_locks WHERE tournament_id = $1 FOR UPDATE`,
        [tournamentId]
      );

      if (existingEscrow.rows.length > 0 && existingEscrow.rows[0].status === 'LOCKED') {
        const err = new Error('Escrow already locked for this tournament');
        err.code = 'ESCROW_ALREADY_LOCKED';
        err.status = 409;
        throw err;
      }

      // 6. Transfer from organiser wallet to escrow
      const organiserWallet = await WalletLedgerService.getOrCreateUserWallet(organiserId, client);

      const transferResult = await WalletLedgerService.executeLedgerTransfer({
        entryType: 'PRIZE_ESCROW_LOCK',
        debitAccountId: organiserWallet.id,
        creditAccountId: PLATFORM_ESCROW_WALLET_ID,
        amount,
        description: `Prize escrow lock for tournament ${tournamentId}`,
        referenceType: 'TOURNAMENT',
        referenceId: tournamentId,
        initiatedBy: organiserId,
        idempotencyKey: `escrow-lock-${tournamentId}`,
        client,
      });

      // 7. Create escrow lock record
      const escrowRes = await client.query(
        `INSERT INTO prize_escrow_locks (
           tournament_id, organiser_id, escrow_amount, currency, status,
           lock_ledger_tx_id, idempotency_key
         )
         VALUES ($1, $2, $3, 'VXC', 'LOCKED', $4, $5)
         RETURNING *`,
        [tournamentId, organiserId, amount, transferResult.transaction.id, idempotencyKey]
      );

      // 8. Update tournament prize pool
      await client.query(
        `UPDATE tournaments SET prize_pool_credits = $1, updated_at = NOW() WHERE id = $2`,
        [amount, tournamentId]
      );

      // 9. Audit log
      await appendAuditLog({
        actorId: organiserId,
        actorRole: 'ORGANISER',
        action: 'PRIZE_ESCROW_LOCKED',
        entityType: 'PRIZE_ESCROW',
        entityId: escrowRes.rows[0].id,
        payload: { tournamentId, amount, currency: 'VXC' },
        reason: 'Prize pool locked into escrow before registration',
        client,
      });

      logger.info('Prize escrow locked', { tournamentId, organiserId, amount });

      return { escrow: escrowRes.rows[0], transaction: transferResult.transaction, isReplay: false };
    });
  }

  // ─── Tournament Entry with Hold ─────────────────────────────────────
  /**
   * Process a tournament entry payment.
   * For paid tournaments: holds entry fee from user's wallet.
   * For free tournaments: records free entry with no hold.
   *
   * @param {Object} params
   * @param {string} params.tournamentId - Tournament UUID
   * @param {string} params.registrationId - Registration UUID
   * @param {string} params.userId - Player user UUID
   * @param {number} params.entryFee - Entry fee amount
   * @param {string} params.idempotencyKey - Unique key
   * @returns {Promise<Object>} Entry payment record
   */
  static async processEntryPayment({ tournamentId, registrationId, userId, entryFee, idempotencyKey }) {
    const fee = Number(entryFee);

    // Free tournament — no payment needed
    if (fee <= 0) {
      const res = await query(
        `INSERT INTO tournament_entry_payments (
           tournament_id, registration_id, user_id, entry_fee_amount,
           payment_method, status, idempotency_key
         )
         VALUES ($1, $2, $3, 0.00, 'FREE', 'CONFIRMED', $4)
         ON CONFLICT (registration_id) DO NOTHING
         RETURNING *`,
        [tournamentId, registrationId, userId, idempotencyKey]
      );

      return { entryPayment: res.rows[0], isFree: true };
    }

    // Paid tournament — hold from wallet
    return withTransaction(async (client) => {
      // Idempotency
      const existing = await client.query(
        `SELECT * FROM tournament_entry_payments WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (existing.rows.length > 0) {
        return { entryPayment: existing.rows[0], isReplay: true };
      }

      // Hold funds
      const holdResult = await WalletLedgerService.holdFunds(userId, fee, tournamentId, idempotencyKey);

      const entryRes = await client.query(
        `INSERT INTO tournament_entry_payments (
           tournament_id, registration_id, user_id, entry_fee_amount,
           payment_method, hold_ledger_tx_id, status, idempotency_key
         )
         VALUES ($1, $2, $3, $4, 'WALLET', $5, 'HELD', $6)
         RETURNING *`,
        [
          tournamentId,
          registrationId,
          userId,
          fee,
          holdResult?.transaction?.id || null,
          idempotencyKey,
        ]
      );

      return { entryPayment: entryRes.rows[0], isFree: false };
    });
  }

  // ─── Refund on Cancellation ────────────────────────────────────────
  /**
   * Refund entry fee when a player cancels registration or tournament is cancelled.
   * Releases the hold back to the user's available balance.
   *
   * @param {string} registrationId - Registration UUID
   * @param {string} reason - Refund reason
   * @param {string} [initiatedBy] - Who initiated the refund
   * @returns {Promise<Object>} Refund result
   */
  static async refundEntryFee(registrationId, reason, initiatedBy = 'SYSTEM') {
    return withTransaction(async (client) => {
      const entryRes = await client.query(
        `SELECT * FROM tournament_entry_payments WHERE registration_id = $1 FOR UPDATE`,
        [registrationId]
      );

      if (entryRes.rows.length === 0) {
        return { success: true, message: 'No entry payment found (free tournament)' };
      }

      const entry = entryRes.rows[0];
      if (entry.status === 'REFUNDED') {
        return { success: true, message: 'Already refunded', isAlreadyRefunded: true };
      }

      if (entry.payment_method === 'FREE' || Number(entry.entry_fee_amount) <= 0) {
        // Free entry — just mark as refunded
        await client.query(
          `UPDATE tournament_entry_payments
           SET status = 'REFUNDED', refund_reason = $1, updated_at = NOW()
           WHERE id = $2`,
          [reason, entry.id]
        );
        return { success: true, message: 'Free entry cancelled', amount: 0 };
      }

      // Release held funds
      const releaseResult = await WalletLedgerService.releaseHold(
        entry.user_id,
        Number(entry.entry_fee_amount),
        entry.tournament_id,
        reason,
        `refund-entry-${entry.id}`
      );

      await client.query(
        `UPDATE tournament_entry_payments
         SET status = 'REFUNDED',
             refund_reason = $1,
             refund_ledger_tx_id = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [reason, releaseResult?.transaction?.id || null, entry.id]
      );

      await appendAuditLog({
        actorId: initiatedBy,
        actorRole: initiatedBy === 'SYSTEM' ? 'SYSTEM' : 'ADMIN',
        action: 'ENTRY_FEE_REFUNDED',
        entityType: 'TOURNAMENT_ENTRY_PAYMENT',
        entityId: entry.id,
        payload: { registrationId, amount: Number(entry.entry_fee_amount), reason },
        reason,
        client,
      });

      logger.info('Entry fee refunded', {
        registrationId,
        amount: Number(entry.entry_fee_amount),
        userId: entry.user_id,
      });

      return { success: true, amount: Number(entry.entry_fee_amount), transaction: releaseResult?.transaction };
    });
  }

  // ─── Bulk Refund: Tournament Cancellation ──────────────────────────
  /**
   * Refund ALL entry fees for a cancelled tournament.
   *
   * @param {string} tournamentId - Tournament UUID
   * @param {string} reason - Cancellation reason
   * @param {string} adminId - Admin initiating the cancellation
   * @returns {Promise<Object>} Bulk refund summary
   */
  static async refundAllEntries(tournamentId, reason, adminId) {
    const entries = await query(
      `SELECT registration_id FROM tournament_entry_payments
       WHERE tournament_id = $1 AND status IN ('HELD', 'CONFIRMED')`,
      [tournamentId]
    );

    let refundedCount = 0;
    let totalRefunded = 0;
    const errors = [];

    for (const entry of entries.rows) {
      try {
        const result = await PrizeEscrowService.refundEntryFee(
          entry.registration_id,
          reason,
          adminId
        );
        if (result.success) {
          refundedCount++;
          totalRefunded += result.amount || 0;
        }
      } catch (err) {
        errors.push({ registrationId: entry.registration_id, error: err.message });
        logger.error('Failed to refund entry', { registrationId: entry.registration_id, error: err.message });
      }
    }

    // Release escrow back to organiser
    await PrizeEscrowService.releaseEscrow(tournamentId, 'Tournament cancelled: ' + reason, adminId);

    await appendAuditLog({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'TOURNAMENT_BULK_REFUND',
      entityType: 'TOURNAMENT',
      entityId: tournamentId,
      payload: { refundedCount, totalRefunded, errorCount: errors.length },
      reason,
    });

    return { refundedCount, totalRefunded, errors };
  }

  // ─── Escrow Release: Return to organiser on cancellation ───────────
  /**
   * Release escrow back to the organiser (e.g., tournament cancelled).
   *
   * @param {string} tournamentId - Tournament UUID
   * @param {string} reason - Release reason
   * @param {string} initiatedBy - Admin or organiser ID
   * @returns {Promise<Object>} Release result
   */
  static async releaseEscrow(tournamentId, reason, initiatedBy) {
    return withTransaction(async (client) => {
      const escrowRes = await client.query(
        `SELECT * FROM prize_escrow_locks
         WHERE tournament_id = $1 AND status = 'LOCKED'
         FOR UPDATE`,
        [tournamentId]
      );

      if (escrowRes.rows.length === 0) {
        return { success: true, message: 'No active escrow lock found' };
      }

      const escrow = escrowRes.rows[0];
      const organiserWallet = await WalletLedgerService.getOrCreateUserWallet(escrow.organiser_id, client);

      const transferResult = await WalletLedgerService.executeLedgerTransfer({
        entryType: 'PRIZE_ESCROW_RELEASE',
        debitAccountId: PLATFORM_ESCROW_WALLET_ID,
        creditAccountId: organiserWallet.id,
        amount: Number(escrow.escrow_amount),
        description: `Prize escrow released: ${reason}`,
        referenceType: 'TOURNAMENT',
        referenceId: tournamentId,
        initiatedBy,
        idempotencyKey: `escrow-release-${tournamentId}-${Date.now()}`,
        client,
      });

      await client.query(
        `UPDATE prize_escrow_locks
         SET status = 'RELEASED', released_at = NOW(),
             release_ledger_tx_id = $1, reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [transferResult.transaction.id, reason, escrow.id]
      );

      await appendAuditLog({
        actorId: initiatedBy,
        actorRole: 'ADMIN',
        action: 'PRIZE_ESCROW_RELEASED',
        entityType: 'PRIZE_ESCROW',
        entityId: escrow.id,
        payload: { tournamentId, amount: Number(escrow.escrow_amount), reason },
        reason,
        client,
      });

      return { success: true, amount: Number(escrow.escrow_amount), transaction: transferResult.transaction };
    });
  }

  // ─── Settlement Job: Distribute prizes ────────────────────────────
  /**
   * Settle a completed tournament's prize pool.
   * Distributes prizes from escrow to winners based on prize breakdown.
   *
   * @param {Object} params
   * @param {string} params.tournamentId - Tournament UUID
   * @param {Array<{userId: string, amount: number, placement: number}>} params.prizeBreakdown
   * @param {string} params.settledBy - Admin or system ID
   * @returns {Promise<Object>} Settlement result
   */
  static async settleTournament({ tournamentId, prizeBreakdown, settledBy }) {
    return withTransaction(async (client) => {
      // 1. Lock escrow
      const escrowRes = await client.query(
        `SELECT * FROM prize_escrow_locks
         WHERE tournament_id = $1 AND status = 'LOCKED'
         FOR UPDATE`,
        [tournamentId]
      );

      if (escrowRes.rows.length === 0) {
        const err = new Error('No locked escrow found for this tournament');
        err.code = 'ESCROW_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const escrow = escrowRes.rows[0];
      const totalPrize = prizeBreakdown.reduce((sum, p) => sum + Number(p.amount), 0);

      if (totalPrize > Number(escrow.escrow_amount)) {
        const err = new Error(`Prize total ${totalPrize} exceeds escrow ${escrow.escrow_amount}`);
        err.code = 'SETTLEMENT_EXCEEDS_ESCROW';
        err.status = 400;
        throw err;
      }

      // 2. Distribute prizes to winners
      const distributions = [];
      for (const prize of prizeBreakdown) {
        const winnerWallet = await WalletLedgerService.getOrCreateUserWallet(prize.userId, client);

        const result = await WalletLedgerService.executeLedgerTransfer({
          entryType: 'PRIZE_DISTRIBUTION',
          debitAccountId: PLATFORM_ESCROW_WALLET_ID,
          creditAccountId: winnerWallet.id,
          amount: Number(prize.amount),
          description: `Prize #${prize.placement} for tournament ${tournamentId}`,
          referenceType: 'TOURNAMENT',
          referenceId: tournamentId,
          initiatedBy: settledBy,
          idempotencyKey: `prize-${tournamentId}-${prize.userId}-${prize.placement}`,
          client,
        });

        distributions.push({
          userId: prize.userId,
          placement: prize.placement,
          amount: Number(prize.amount),
          transactionId: result.transaction.id,
        });
      }

      // 3. Handle remaining escrow (if prizes don't use full pool)
      const remaining = Number(escrow.escrow_amount) - totalPrize;
      if (remaining > 0) {
        // Return remaining to organiser
        const organiserWallet = await WalletLedgerService.getOrCreateUserWallet(escrow.organiser_id, client);

        await WalletLedgerService.executeLedgerTransfer({
          entryType: 'ESCROW_REMAINDER_RETURN',
          debitAccountId: PLATFORM_ESCROW_WALLET_ID,
          creditAccountId: organiserWallet.id,
          amount: remaining,
          description: `Escrow remainder returned for tournament ${tournamentId}`,
          referenceType: 'TOURNAMENT',
          referenceId: tournamentId,
          initiatedBy: settledBy,
          idempotencyKey: `escrow-remainder-${tournamentId}`,
          client,
        });
      }

      // 4. Update escrow status
      await client.query(
        `UPDATE prize_escrow_locks
         SET status = 'SETTLED',
             settled_at = NOW(),
             settlement_breakdown = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify({ distributions, remaining }), escrow.id]
      );

      // 5. Audit log
      await appendAuditLog({
        actorId: settledBy,
        actorRole: 'ADMIN',
        action: 'TOURNAMENT_PRIZE_SETTLED',
        entityType: 'PRIZE_ESCROW',
        entityId: escrow.id,
        payload: { tournamentId, totalPrize, distributions: distributions.length, remaining },
        reason: `Tournament prize pool settled: ${distributions.length} winners`,
        client,
      });

      logger.info('Tournament prizes settled', { tournamentId, totalPrize, winners: distributions.length, remaining });

      return { distributions, totalPrize, remaining, escrowId: escrow.id };
    });
  }

  // ─── Queries ──────────────────────────────────────────────────────
  /**
   * Get escrow status for a tournament.
   */
  static async getEscrowStatus(tournamentId) {
    const res = await query(
      `SELECT id, tournament_id, organiser_id, escrow_amount, currency, status,
              locked_at, settled_at, released_at, settlement_breakdown
       FROM prize_escrow_locks
       WHERE tournament_id = $1`,
      [tournamentId]
    );
    return res.rows[0] || null;
  }

  /**
   * Get entry payment status for a user's registration.
   */
  static async getEntryPaymentStatus(registrationId) {
    const res = await query(
      `SELECT * FROM tournament_entry_payments WHERE registration_id = $1`,
      [registrationId]
    );
    return res.rows[0] || null;
  }

  /**
   * Get all entry payments for a tournament.
   */
  static async getTournamentEntryPayments(tournamentId) {
    const res = await query(
      `SELECT tep.*, u.username, u.display_name
       FROM tournament_entry_payments tep
       JOIN users u ON u.id = tep.user_id
       WHERE tep.tournament_id = $1
       ORDER BY tep.created_at DESC`,
      [tournamentId]
    );
    return res.rows;
  }

  // ─── Published Refund Rules ───────────────────────────────────────
  /**
   * Get published refund policy for transparency.
   */
  static getPublishedRefundPolicy() {
    return this.getRefundPolicy();
  }

  static getRefundPolicy() {
    return {
      version: '1.0.0',
      policy_version: '1.0.0',
      effectiveDate: '2026-01-01',
      legal_disclaimer: 'Refunds are subject to skill-based gaming regulations and audit verification.',
      rules: {
        cancellation_window_hours: 2,
        organiser_cancellation_refund_pct: 100,
        system_failure_refund_pct: 100,
        disqualification_refund_pct: 0,
        items: [
          {
            id: 'RULE_001',
            title: 'Player Voluntary Cancellation',
            description: 'Full entry fee refund if cancelled before tournament registration closes.',
            condition: 'cancellation_time < registration_close',
            refundPercentage: 100,
          },
          {
            id: 'RULE_002',
            title: 'Late Cancellation',
            description: 'No refund after registration closes unless tournament is cancelled by organiser/admin.',
            condition: 'cancellation_time >= registration_close',
            refundPercentage: 0,
          },
          {
            id: 'RULE_003',
            title: 'Tournament Cancelled by Organiser',
            description: 'Full entry fee refund to all participants. Organiser escrow released.',
            condition: 'tournament_cancelled_by_organiser',
            refundPercentage: 100,
          },
          {
            id: 'RULE_004',
            title: 'Tournament Cancelled by Admin',
            description: 'Full entry fee refund. Organiser escrow reviewed for potential partial forfeiture.',
            condition: 'tournament_cancelled_by_admin',
            refundPercentage: 100,
          },
          {
            id: 'RULE_005',
            title: 'Minimum Participants Not Met',
            description: 'If minimum participant threshold is not met by start time, tournament is auto-cancelled with full refunds.',
            condition: 'participant_count < min_participants',
            refundPercentage: 100,
          },
        ],
      },
    };
  }
}
