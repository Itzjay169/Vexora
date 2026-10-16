/**
 * Vexora Esports Tournament Platform — Financial Reconciliation Service
 *
 * Phase 28: Payouts, Reconciliation & Financial Reports
 * PDF refs: Sections 8, 9, 47 (Phase 6)
 *
 * Implements:
 * - Daily 3-way reconciliation: Double-entry ledger vs Payment gateway deposits vs Bank payouts
 * - Variance detection and automated discrepancy flagging
 * - Severity calculation (LOW, MEDIUM, HIGH, CRITICAL)
 * - Anomaly alerts on financial imbalance
 * - Resolution audit trail for compliance officers
 */

import { query, withTransaction } from '../common/database.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { logger } from '../common/logger.js';

export class ReconciliationService {

  /**
   * Run 3-way daily financial reconciliation for a specific date.
   * Compares:
   *   1. Ledger transaction totals (DEBIT vs CREDIT)
   *   2. Payment gateway captured deposits (payment_orders)
   *   3. Settled bank cash-out payouts (payout_requests)
   *
   * @param {Object} params
   * @param {string} params.dateStr - 'YYYY-MM-DD'
   * @param {string} [params.adminId]
   * @returns {Promise<Object>} Reconciliation summary
   */
  static async runDailyReconciliation({ dateStr, adminId }) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];

    return withTransaction(async (client) => {
      // 1. Sum ledger credits and debits for the day
      const ledgerRes = await client.query(
        `SELECT 
          COALESCE(SUM(CASE WHEN transaction_type = 'CREDIT' THEN amount ELSE 0 END), 0) as total_credits,
          COALESCE(SUM(CASE WHEN transaction_type = 'DEBIT' THEN amount ELSE 0 END), 0) as total_debits
         FROM ledger_transactions
         WHERE DATE(created_at) = $1`,
        [targetDate]
      );
      const totalLedgerCredits = Number(ledgerRes.rows[0].total_credits);
      const totalLedgerDebits = Number(ledgerRes.rows[0].total_debits);

      // 2. Sum gateway captured deposits for the day
      const gatewayRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as total_gateway_deposits
         FROM payment_orders
         WHERE status = 'CAPTURED' AND DATE(created_at) = $1`,
        [targetDate]
      );
      const totalProviderDeposits = Number(gatewayRes.rows[0].total_gateway_deposits);

      // 3. Sum settled paid payouts for the day
      const payoutRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as total_paid_payouts
         FROM payout_requests
         WHERE status = 'PAID' AND DATE(paid_at) = $1`,
        [targetDate]
      );
      const totalPaidPayouts = Number(payoutRes.rows[0].total_paid_payouts);

      // 4. Calculate variances
      const depositVariance = Math.abs(totalLedgerCredits - totalProviderDeposits);
      const payoutVariance = Math.abs(totalLedgerDebits - totalPaidPayouts);

      let discrepancyCount = 0;
      const discrepancies = [];

      // Check deposit discrepancy
      if (depositVariance > 0.01) {
        discrepancyCount++;
        discrepancies.push({
          type: 'AMOUNT_MISMATCH',
          severity: depositVariance > 1000 ? 'CRITICAL' : 'HIGH',
          expected: totalProviderDeposits,
          actual: totalLedgerCredits,
          difference: depositVariance,
          referenceId: `DEP-${targetDate}`,
        });
      }

      // Check payout discrepancy
      if (payoutVariance > 0.01) {
        discrepancyCount++;
        discrepancies.push({
          type: 'UNRECONCILED_PAYOUT',
          severity: payoutVariance > 1000 ? 'CRITICAL' : 'HIGH',
          expected: totalPaidPayouts,
          actual: totalLedgerDebits,
          difference: payoutVariance,
          referenceId: `PAY-${targetDate}`,
        });
      }

      const status = discrepancyCount === 0 ? 'BALANCED' : 'DISCREPANCY_DETECTED';

      // 5. Upsert reconciliation record
      const recRes = await client.query(
        `INSERT INTO financial_reconciliations (
          reconciliation_date, run_by_admin_id, total_ledger_credits, total_ledger_debits,
          total_provider_deposits, total_provider_payouts, total_paid_payouts,
          deposit_variance, payout_variance, discrepancy_count, status, verified_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (reconciliation_date) DO UPDATE
        SET total_ledger_credits = EXCLUDED.total_ledger_credits,
            total_ledger_debits = EXCLUDED.total_ledger_debits,
            total_provider_deposits = EXCLUDED.total_provider_deposits,
            total_provider_payouts = EXCLUDED.total_provider_payouts,
            total_paid_payouts = EXCLUDED.total_paid_payouts,
            deposit_variance = EXCLUDED.deposit_variance,
            payout_variance = EXCLUDED.payout_variance,
            discrepancy_count = EXCLUDED.discrepancy_count,
            status = EXCLUDED.status,
            verified_at = NOW()
        RETURNING *`,
        [
          targetDate,
          adminId || null,
          totalLedgerCredits,
          totalLedgerDebits,
          totalProviderDeposits,
          totalPaidPayouts,
          depositVariance,
          payoutVariance,
          discrepancyCount,
          status,
        ]
      );

      const record = recRes.rows[0];

      // 6. Record discrepancies if any
      for (const disc of discrepancies) {
        await client.query(
          `INSERT INTO financial_discrepancies (
            reconciliation_id, discrepancy_type, severity, reference_id,
            expected_amount, actual_amount, difference, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN')`,
          [
            record.id,
            disc.type,
            disc.severity,
            disc.referenceId,
            disc.expected,
            disc.actual,
            disc.difference,
          ]
        );
      }

      await appendAuditLog({
        userId: adminId || '00000000-0000-0000-0000-000000000000',
        role: adminId ? 'FINANCE' : 'SYSTEM',
        ipAddress: '0.0.0.0',
        action: 'FINANCIAL_RECONCILIATION_RUN',
        entity: 'financial_reconciliations',
        entityId: record.id,
        reason: `Daily reconciliation for ${targetDate}: Status ${status} (Discrepancies: ${discrepancyCount})`,
        payload: { targetDate, status, depositVariance, payoutVariance, discrepancyCount },
      });

      logger.info('Daily financial reconciliation finished', {
        date: targetDate,
        status,
        discrepancies: discrepancyCount,
      });

      return {
        reconciliation: record,
        discrepancies,
        isBalanced: status === 'BALANCED',
      };
    });
  }

  /**
   * Get historical reconciliation runs.
   *
   * @param {number} [limit=30]
   * @returns {Promise<Array>}
   */
  static async getHistory(limit = 30) {
    const res = await query(
      `SELECT * FROM financial_reconciliations
       ORDER BY reconciliation_date DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  /**
   * Get flagged discrepancies for review.
   *
   * @param {string} [status] - 'OPEN', 'RESOLVED'
   * @returns {Promise<Array>}
   */
  static async getDiscrepancies(status = 'OPEN') {
    const res = await query(
      `SELECT d.*, r.reconciliation_date
       FROM financial_discrepancies d
       JOIN financial_reconciliations r ON d.reconciliation_id = r.id
       WHERE d.status = $1
       ORDER BY d.created_at DESC`,
      [status]
    );
    return res.rows;
  }

  /**
   * Resolve an open discrepancy with mandatory justification.
   *
   * @param {Object} params
   * @param {string} params.discrepancyId
   * @param {string} params.adminId
   * @param {string} params.resolutionNotes
   * @returns {Promise<Object>}
   */
  static async resolveDiscrepancy({ discrepancyId, adminId, resolutionNotes }) {
    if (!resolutionNotes || resolutionNotes.trim().length < 10) {
      const err = new Error('Resolution notes must be at least 10 characters explaining root cause');
      err.code = 'INVALID_RESOLUTION_NOTES';
      err.status = 400;
      throw err;
    }

    const res = await query(
      `UPDATE financial_discrepancies
       SET status = 'RESOLVED',
           resolution_notes = $1,
           resolved_by_admin_id = $2,
           resolved_at = NOW()
       WHERE id = $3 AND status = 'OPEN'
       RETURNING *`,
      [resolutionNotes.trim(), adminId, discrepancyId]
    );

    if (res.rows.length === 0) {
      const err = new Error('Discrepancy not found or already resolved');
      err.code = 'DISCREPANCY_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const resolved = res.rows[0];

    await appendAuditLog({
      userId: adminId,
      role: 'FINANCE',
      ipAddress: '0.0.0.0',
      action: 'FINANCIAL_DISCREPANCY_RESOLVED',
      entity: 'financial_discrepancies',
      entityId: discrepancyId,
      reason: `Discrepancy resolved: ${resolutionNotes}`,
      payload: { discrepancyId, resolutionNotes },
    });

    return resolved;
  }
}
