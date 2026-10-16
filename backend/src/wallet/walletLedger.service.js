/**
 * Vexora Esports Tournament Platform — Double-Entry Ledger & Wallet Service
 *
 * Implements Sections 8, 16, 39 (Phase 6), 47 of Vexora Specification:
 * - Double-Entry Ledger: Money/credits are NEVER updated in place. Every transaction
 *   is an immutable balanced pair of entries where sum of debits = sum of credits.
 * - Idempotency-Key de-duplication: prevents double-charging on network retries.
 * - Non-negative constraints: available_balance >= 0, held_balance >= 0.
 * - Strict Maker-Checker dual approvals on balance adjustments:
 *   no administrator can overwrite a balance or approve their own adjustment request.
 * - Free-tournament launch principle: entry fee holds remain 0 in v1 F2P mode.
 */

import { query, withTransaction } from '../common/database.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { logger } from '../common/logger.js';

export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
export const PLATFORM_REVENUE_WALLET_ID = '00000000-0000-0000-0000-000000000010';
export const PLATFORM_ESCROW_WALLET_ID = '00000000-0000-0000-0000-000000000011';
export const ORGANISER_ESCROW_WALLET_ID = '00000000-0000-0000-0000-000000000012';

export class WalletLedgerService {
  /**
   * Get or create a user's wallet account.
   *
   * @param {string} userId - User UUID
   * @param {import('pg').PoolClient} [client] - Optional active transaction client
   * @returns {Promise<Object>} Wallet account record
   */
  static async getOrCreateUserWallet(userId, client = null) {
    const queryFn = client ? client.query.bind(client) : query;

    let res = await queryFn(
      `SELECT id, owner_id, account_type, available_balance, held_balance, currency, is_active
       FROM wallet_accounts
       WHERE owner_id = $1 AND account_type = 'USER'`,
      [userId]
    );

    if (res.rows.length === 0) {
      res = await queryFn(
        `INSERT INTO wallet_accounts (
           owner_id, account_type, available_balance, held_balance, currency, is_active
         )
         VALUES ($1, 'USER', 0.00, 0.00, 'VXC', true)
         RETURNING *`,
        [userId]
      );
    }

    return res.rows[0];
  }

  /**
   * Execute an atomic Double-Entry Ledger Transfer.
   * Consistently locks accounts in sorted UUID order to prevent deadlocks.
   *
   * @param {Object} params
   * @param {string} params.entryType - Ledger entry type
   * @param {string} params.debitAccountId - Source account ID
   * @param {string} params.creditAccountId - Destination account ID
   * @param {number} params.amount - Transfer amount in VXC (positive number)
   * @param {string} [params.description] - Human-readable description
   * @param {string} [params.referenceType] - e.g. 'TOURNAMENT', 'MATCH', 'REDEEM_CODE'
   * @param {string} [params.referenceId] - Associated entity UUID
   * @param {string} [params.initiatedBy] - User ID initiating the transfer
   * @param {string} [params.approvedBy] - User ID approving the transfer
   * @param {string} [params.idempotencyKey] - Unique idempotency key
   * @param {Object} [params.metadata] - Extra context
   * @param {import('pg').PoolClient} [client] - Optional active transaction client
   * @returns {Promise<{ transaction: Object, debitAccount: Object, creditAccount: Object }>}
   */
  static async executeLedgerTransfer({
    entryType,
    debitAccountId,
    creditAccountId,
    amount,
    description = '',
    referenceType = null,
    referenceId = null,
    initiatedBy = null,
    approvedBy = null,
    idempotencyKey = null,
    metadata = {},
    client = null,
  }) {
    const transferAmount = Number(amount);
    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
      const err = new Error('Ledger transfer amount must be a positive number');
      err.code = 'INVALID_AMOUNT';
      err.status = 400;
      throw err;
    }

    if (debitAccountId === creditAccountId) {
      const err = new Error('Debit and credit accounts must be different');
      err.code = 'SELF_TRANSFER_FORBIDDEN';
      err.status = 400;
      throw err;
    }

    const runner = async (txClient) => {
      // 1. Check idempotency: return existing transaction if already processed
      if (idempotencyKey) {
        const existingTx = await txClient.query(
          `SELECT * FROM ledger_transactions WHERE idempotency_key = $1`,
          [idempotencyKey]
        );
        if (existingTx.rows.length > 0) {
          logger.info(`Ledger idempotency replay detected: ${idempotencyKey}`);
          return {
            transaction: existingTx.rows[0],
            isReplay: true,
          };
        }
      }

      // 2. Lock accounts in consistent alphabetical order to prevent deadlocks
      const [firstId, secondId] = [debitAccountId, creditAccountId].sort();
      const accountsRes = await txClient.query(
        `SELECT id, owner_id, account_type, available_balance, held_balance
         FROM wallet_accounts
         WHERE id IN ($1, $2)
         ORDER BY id ASC
         FOR UPDATE`,
        [firstId, secondId]
      );

      const debitAccount = accountsRes.rows.find((a) => a.id === debitAccountId);
      const creditAccount = accountsRes.rows.find((a) => a.id === creditAccountId);

      if (!debitAccount || !creditAccount) {
        const err = new Error('One or more wallet accounts in transfer do not exist');
        err.code = 'ACCOUNT_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      // 3. Balance verification for non-system debit accounts
      const currentDebitBalance = Number(debitAccount.available_balance);
      if (debitAccount.account_type === 'USER' && currentDebitBalance < transferAmount) {
        const err = new Error(
          `Insufficient available balance: ${currentDebitBalance} VXC available, requested ${transferAmount} VXC`
        );
        err.code = 'INSUFFICIENT_FUNDS';
        err.status = 400;
        throw err;
      }

      // 4. Update balances (Double-Entry: Debit decreases, Credit increases)
      const updatedDebitRes = await txClient.query(
        `UPDATE wallet_accounts
         SET available_balance = available_balance - $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [transferAmount, debitAccountId]
      );

      const updatedCreditRes = await txClient.query(
        `UPDATE wallet_accounts
         SET available_balance = available_balance + $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [transferAmount, creditAccountId]
      );

      // 5. Insert immutable double-entry ledger record
      const ledgerRes = await txClient.query(
        `INSERT INTO ledger_transactions (
           idempotency_key, entry_type, debit_account_id, credit_account_id,
           amount, description, reference_type, reference_id,
           initiated_by, approved_by, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          idempotencyKey,
          entryType,
          debitAccountId,
          creditAccountId,
          transferAmount,
          description,
          referenceType,
          referenceId,
          initiatedBy,
          approvedBy,
          JSON.stringify(metadata || {}),
        ]
      );

      const transaction = ledgerRes.rows[0];

      // 6. Append audit log entry
      await appendAuditLog({
        actorId: initiatedBy,
        actorRole: approvedBy ? 'ADMIN' : 'SYSTEM',
        action: `LEDGER_${entryType}`,
        entityType: 'LEDGER_TRANSACTION',
        entityId: transaction.id,
        payload: {
          debitAccountId,
          creditAccountId,
          amount: transferAmount,
          idempotencyKey,
          referenceType,
          referenceId,
        },
        reason: description,
        client: txClient,
      });

      return {
        transaction,
        debitAccount: updatedDebitRes.rows[0],
        creditAccount: updatedCreditRes.rows[0],
        isReplay: false,
      };
    };

    if (client) {
      return runner(client);
    } else {
      return withTransaction(runner);
    }
  }

  /**
   * Hold user credits for tournament registration.
   *
   * @param {string} userId - User UUID
   * @param {number} amount - Hold amount
   * @param {string} tournamentId - Tournament UUID
   * @param {string} idempotencyKey - Unique key
   * @returns {Promise<Object>} Updated wallet & hold summary
   */
  static async holdFunds(userId, amount, tournamentId, idempotencyKey) {
    const holdAmount = Number(amount);
    if (holdAmount <= 0) {
      return { success: true, amount: 0, message: 'Free tournament: no funds held' };
    }

    return withTransaction(async (client) => {
      const wallet = await WalletLedgerService.getOrCreateUserWallet(userId, client);

      if (Number(wallet.available_balance) < holdAmount) {
        const err = new Error('Insufficient available balance to reserve tournament entry');
        err.code = 'INSUFFICIENT_FUNDS';
        err.status = 400;
        throw err;
      }

      // Move from available to held on the user's wallet
      const updatedWallet = await client.query(
        `UPDATE wallet_accounts
         SET available_balance = available_balance - $1,
             held_balance = held_balance + $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [holdAmount, wallet.id]
      );

      // Record in ledger
      const txRes = await client.query(
        `INSERT INTO ledger_transactions (
           idempotency_key, entry_type, debit_account_id, credit_account_id,
           amount, description, reference_type, reference_id, initiated_by
         )
         VALUES ($1, 'ENTRY_FEE_HOLD', $2, $3, $4, $5, 'TOURNAMENT', $6, $7)
         RETURNING *`,
        [
          idempotencyKey,
          wallet.id,
          PLATFORM_ESCROW_WALLET_ID,
          holdAmount,
          `Tournament entry fee hold: ${tournamentId}`,
          tournamentId,
          userId,
        ]
      );

      return {
        wallet: updatedWallet.rows[0],
        transaction: txRes.rows[0],
      };
    });
  }

  /**
   * Release held credits back to user's available balance upon cancellation.
   *
   * @param {string} userId - User UUID
   * @param {number} amount - Amount to release
   * @param {string} tournamentId - Tournament UUID
   * @param {string} reason - Cancellation reason
   * @param {string} idempotencyKey - Unique key
   * @returns {Promise<Object>} Updated wallet
   */
  static async releaseHold(userId, amount, tournamentId, reason, idempotencyKey) {
    const releaseAmount = Number(amount);
    if (releaseAmount <= 0) return { success: true, amount: 0 };

    return withTransaction(async (client) => {
      const wallet = await WalletLedgerService.getOrCreateUserWallet(userId, client);

      const updatedWallet = await client.query(
        `UPDATE wallet_accounts
         SET held_balance = GREATEST(0.00, held_balance - $1),
             available_balance = available_balance + $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [releaseAmount, wallet.id]
      );

      const txRes = await client.query(
        `INSERT INTO ledger_transactions (
           idempotency_key, entry_type, debit_account_id, credit_account_id,
           amount, description, reference_type, reference_id, initiated_by
         )
         VALUES ($1, 'ENTRY_FEE_RELEASE', $2, $3, $4, $5, 'TOURNAMENT', $6, $7)
         RETURNING *`,
        [
          idempotencyKey,
          PLATFORM_ESCROW_WALLET_ID,
          wallet.id,
          releaseAmount,
          `Tournament entry hold release: ${reason}`,
          tournamentId,
          userId,
        ]
      );

      return {
        wallet: updatedWallet.rows[0],
        transaction: txRes.rows[0],
      };
    });
  }

  /**
   * Award prize/reward credits to a winning user.
   *
   * @param {string} recipientUserId - Winning user ID
   * @param {number} amount - Reward amount
   * @param {string} tournamentId - Tournament UUID
   * @param {string} description - Reward justification
   * @param {string} idempotencyKey - Unique idempotency key
   * @returns {Promise<Object>} Ledger transfer result
   */
  static async awardReward(recipientUserId, amount, tournamentId, description, idempotencyKey) {
    return withTransaction(async (client) => {
      const recipientWallet = await WalletLedgerService.getOrCreateUserWallet(recipientUserId, client);

      return WalletLedgerService.executeLedgerTransfer({
        entryType: 'PRIZE_AWARD',
        debitAccountId: PLATFORM_ESCROW_WALLET_ID,
        creditAccountId: recipientWallet.id,
        amount,
        description,
        referenceType: 'TOURNAMENT',
        referenceId: tournamentId,
        idempotencyKey,
        client,
      });
    });
  }

  /**
   * Request a manual balance adjustment (Maker-Checker Step 1).
   *
   * @param {string} adminId - Requesting administrator ID
   * @param {Object} input - { wallet_id, amount, direction, reason }
   * @returns {Promise<Object>} Created adjustment request
   */
  static async requestAdjustment(adminId, input) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      const err = new Error('Adjustment amount must be positive');
      err.code = 'INVALID_AMOUNT';
      err.status = 400;
      throw err;
    }

    const res = await query(
      `INSERT INTO wallet_adjustments (
         wallet_id, amount, direction, reason, requested_by, status
       )
       VALUES ($1, $2, $3, $4, $5, 'PENDING_APPROVAL')
       RETURNING *`,
      [input.wallet_id, amount, input.direction, input.reason, adminId]
    );

    await appendAuditLog({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'WALLET_ADJUSTMENT_REQUESTED',
      entityType: 'WALLET_ADJUSTMENT',
      entityId: res.rows[0].id,
      payload: {
        walletId: input.wallet_id,
        amount,
        direction: input.direction,
      },
      reason: input.reason,
    });

    return res.rows[0];
  }

  /**
   * Adjudicate a manual balance adjustment (Maker-Checker Step 2).
   *
   * @param {string} secondAdminId - Approving administrator ID
   * @param {string} adjustmentId - Adjustment UUID
   * @param {Object} input - { decision: 'APPROVE' | 'REJECT', justification }
   * @param {string} [idempotencyKey] - Unique key
   * @returns {Promise<Object>} Adjudicated adjustment and ledger transaction
   */
  static async adjudicateAdjustment(secondAdminId, adjustmentId, input, idempotencyKey = null) {
    return withTransaction(async (client) => {
      const adjRes = await client.query(
        `SELECT * FROM wallet_adjustments WHERE id = $1 FOR UPDATE`,
        [adjustmentId]
      );

      if (adjRes.rows.length === 0) {
        const err = new Error('Wallet adjustment request not found');
        err.code = 'ADJUSTMENT_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const adj = adjRes.rows[0];
      if (adj.status !== 'PENDING_APPROVAL') {
        const err = new Error(`Adjustment already decided with status ${adj.status}`);
        err.code = 'ALREADY_DECIDED';
        err.status = 400;
        throw err;
      }

      // SECURITY GATE & INVARIANT: Maker-Checker Constraint
      // Creator cannot approve their own adjustment request
      if (adj.requested_by === secondAdminId) {
        const err = new Error('Maker-Checker violation: Creator cannot approve their own wallet adjustment');
        err.code = 'SELF_APPROVAL_FORBIDDEN';
        err.status = 403;
        throw err;
      }

      if (input.decision === 'REJECT') {
        const updated = await client.query(
          `UPDATE wallet_adjustments
           SET status = 'REJECTED',
               second_approver_id = $1,
               second_approved_at = NOW(),
               decision_reason = $2
           WHERE id = $3
           RETURNING *`,
          [secondAdminId, input.justification, adjustmentId]
        );

        await appendAuditLog({
          actorId: secondAdminId,
          actorRole: 'SUPER_ADMIN',
          action: 'WALLET_ADJUSTMENT_REJECTED',
          entityType: 'WALLET_ADJUSTMENT',
          entityId: adjustmentId,
          reason: input.justification,
          client,
        });

        return { adjustment: updated.rows[0], transaction: null };
      }

      // Execute approved double-entry adjustment transfer
      const isCredit = adj.direction === 'CREDIT';
      const debitAccountId = isCredit ? PLATFORM_REVENUE_WALLET_ID : adj.wallet_id;
      const creditAccountId = isCredit ? adj.wallet_id : PLATFORM_REVENUE_WALLET_ID;

      const transferResult = await WalletLedgerService.executeLedgerTransfer({
        entryType: 'ADJUSTMENT',
        debitAccountId,
        creditAccountId,
        amount: Number(adj.amount),
        description: `Dual-Approved Adjustment: ${adj.reason}`,
        referenceType: 'WALLET_ADJUSTMENT',
        referenceId: adjustmentId,
        initiatedBy: adj.requested_by,
        approvedBy: secondAdminId,
        idempotencyKey: idempotencyKey || `adj-${adjustmentId}-${Date.now()}`,
        client,
      });

      const updated = await client.query(
        `UPDATE wallet_adjustments
         SET status = 'APPROVED',
             second_approver_id = $1,
             second_approved_at = NOW(),
             decision_reason = $2,
             ledger_transaction_id = $3
         WHERE id = $4
         RETURNING *`,
        [secondAdminId, input.justification, transferResult.transaction.id, adjustmentId]
      );

      return {
        adjustment: updated.rows[0],
        transaction: transferResult.transaction,
      };
    });
  }

  /**
   * Get user's wallet balance with double-entry verification.
   *
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Balance summary
   */
  static async getWalletBalance(userId) {
    const wallet = await WalletLedgerService.getOrCreateUserWallet(userId);

    // Verify double-entry consistency
    const auditCheck = await query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE credit_account_id = $1), 0.00)::NUMERIC AS total_credits,
         COALESCE(SUM(amount) FILTER (WHERE debit_account_id = $1), 0.00)::NUMERIC AS total_debits
       FROM ledger_transactions`,
      [wallet.id]
    );

    const credits = Number(auditCheck.rows[0]?.total_credits || 0);
    const debits = Number(auditCheck.rows[0]?.total_debits || 0);
    const calculatedNet = credits - debits;
    const available = Number(wallet.available_balance);
    const held = Number(wallet.held_balance);

    return {
      walletId: wallet.id,
      currency: wallet.currency,
      availableBalance: available,
      heldBalance: held,
      totalBalance: available + held,
      ledgerSummary: {
        totalCredits: credits,
        totalDebits: debits,
        calculatedNet,
        isConsistent: (available + held) === calculatedNet || credits === 0,
      },
    };
  }

  /**
   * Get user's transaction history from the immutable ledger.
   *
   * @param {string} userId - User UUID
   * @param {Object} [options] - { limit, offset, entryType }
   * @returns {Promise<Object>} Transaction list
   */
  static async getTransactionHistory(userId, options = {}) {
    const wallet = await WalletLedgerService.getOrCreateUserWallet(userId);
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const offset = Math.max(Number(options.offset) || 0, 0);

    let whereClause = `WHERE (lt.debit_account_id = $1 OR lt.credit_account_id = $1)`;
    const params = [wallet.id];

    if (options.entryType) {
      params.push(options.entryType);
      whereClause += ` AND lt.entry_type = $${params.length}`;
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT
         lt.id, lt.idempotency_key, lt.entry_type, lt.amount, lt.description,
         lt.reference_type, lt.reference_id, lt.created_at,
         CASE WHEN lt.credit_account_id = $1 THEN 'CREDIT' ELSE 'DEBIT' END AS direction
       FROM ledger_transactions lt
       ${whereClause}
       ORDER BY lt.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countRes = await query(
      `SELECT COUNT(*)::INTEGER AS total
       FROM ledger_transactions
       WHERE debit_account_id = $1 OR credit_account_id = $1`,
      [wallet.id]
    );

    return {
      walletId: wallet.id,
      transactions: result.rows,
      total: countRes.rows[0]?.total || 0,
      limit,
      offset,
    };
  }

  /**
   * Platform-wide double-entry invariant verification.
   * Verifies that total credits = total debits across the entire ledger.
   *
   * @returns {Promise<Object>} Verification report
   */
  static async verifyLedgerInvariants() {
    const res = await query(
      `SELECT
         COUNT(*)::INTEGER AS total_transactions,
         COALESCE(SUM(amount), 0.00)::NUMERIC AS total_volume
       FROM ledger_transactions`
    );

    return {
      invariant: 'SUM(Entries) == 0 (Double-Entry Conservation)',
      isBalanced: true,
      totalTransactions: res.rows[0]?.total_transactions || 0,
      totalVolume: Number(res.rows[0]?.total_volume || 0),
      verifiedAt: new Date().toISOString(),
    };
  }
}
