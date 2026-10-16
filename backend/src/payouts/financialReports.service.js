/**
 * Vexora Esports Tournament Platform — Financial Reports & Watermarked Exports Service
 *
 * Phase 28: Payouts, Reconciliation & Financial Reports
 * PDF refs: Sections 8, 9, 47 (Phase 6)
 *
 * Implements:
 * - Aggregated financial metrics (Deposits, Payouts, Escrow liability, Platform revenue)
 * - Cryptographically watermarked and hashed exports (SHA-256)
 * - Immutable export audit log (financial_report_exports)
 * - Support for GST/Tax reporting and Auditor verification
 */

import crypto from 'crypto';
import { query } from '../common/database.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { logger } from '../common/logger.js';

export class FinancialReportsService {

  /**
   * Generate an aggregated financial summary for a date range.
   *
   * @param {Object} params
   * @param {string} params.startDate - 'YYYY-MM-DD'
   * @param {string} params.endDate - 'YYYY-MM-DD'
   * @returns {Promise<Object>}
   */
  static async generateSummary({ startDate, endDate }) {
    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    // 1. Deposits summary
    const depRes = await query(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_volume,
        COUNT(CASE WHEN status = 'CAPTURED' THEN 1 END) as captured_count,
        COALESCE(SUM(CASE WHEN status = 'CAPTURED' THEN amount ELSE 0 END), 0) as captured_volume
       FROM payment_orders
       WHERE DATE(created_at) BETWEEN $1 AND $2`,
      [start, end]
    );

    // 2. Payouts summary
    const payRes = await query(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_volume,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_count,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) as paid_volume,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN status = 'REQUESTED' OR status = 'UNDER_REVIEW' THEN 1 END) as pending_count
       FROM payout_requests
       WHERE DATE(created_at) BETWEEN $1 AND $2`,
      [start, end]
    );

    // 3. Current active escrow liability
    const escrowRes = await query(
      `SELECT COALESCE(SUM(escrow_amount), 0) as active_escrow_liability, COUNT(*) as locked_tournaments
       FROM prize_escrow_locks
       WHERE status = 'LOCKED'`
    );

    // 4. Ledger transaction volume
    const ledgerRes = await query(
      `SELECT 
        COUNT(*) as transaction_count,
        COALESCE(SUM(CASE WHEN transaction_type = 'CREDIT' THEN amount ELSE 0 END), 0) as total_credits,
        COALESCE(SUM(CASE WHEN transaction_type = 'DEBIT' THEN amount ELSE 0 END), 0) as total_debits
       FROM ledger_transactions
       WHERE DATE(created_at) BETWEEN $1 AND $2`,
      [start, end]
    );

    const deposits = {
      totalCount: Number(depRes.rows[0].total_count),
      totalVolume: Number(depRes.rows[0].total_volume),
      capturedCount: Number(depRes.rows[0].captured_count),
      capturedVolume: Number(depRes.rows[0].captured_volume),
    };

    const payouts = {
      totalCount: Number(payRes.rows[0].total_count),
      totalVolume: Number(payRes.rows[0].total_volume),
      paidCount: Number(payRes.rows[0].paid_count),
      paidVolume: Number(payRes.rows[0].paid_volume),
      rejectedCount: Number(payRes.rows[0].rejected_count),
      pendingCount: Number(payRes.rows[0].pending_count),
    };

    const escrow = {
      activeLiability: Number(escrowRes.rows[0].active_escrow_liability),
      lockedTournamentsCount: Number(escrowRes.rows[0].locked_tournaments),
    };

    const ledger = {
      transactionCount: Number(ledgerRes.rows[0].transaction_count),
      totalCredits: Number(ledgerRes.rows[0].total_credits),
      totalDebits: Number(ledgerRes.rows[0].total_debits),
      isConserved: Number(ledgerRes.rows[0].total_credits) === Number(ledgerRes.rows[0].total_debits),
    };

    return {
      period: { startDate: start, endDate: end },
      deposits,
      payouts,
      escrow,
      ledger,
      platformRevenue: 0.00, // Launch principle: 0 fees in v1
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Export financial report with mandatory cryptographic watermark and audit trail.
   *
   * @param {Object} params
   * @param {'DAILY_RECONCILIATION'|'MONTHLY_SUMMARY'|'TAX_GST_REPORT'|'ESCROW_LIABILITY'|'AUDIT_LEDGER'} params.reportType
   * @param {string} params.startDate
   * @param {string} params.endDate
   * @param {string} params.adminId
   * @param {string} [params.customWatermark]
   * @param {string} [params.ipAddress]
   * @returns {Promise<Object>} Export metadata and payload
   */
  static async exportReport({
    reportType,
    startDate,
    endDate,
    adminId,
    customWatermark,
    ipAddress = '0.0.0.0',
  }) {
    const summary = await this.generateSummary({ startDate, endDate });

    const timestamp = new Date().toISOString();
    const watermarkText = customWatermark
      ? `${customWatermark} | EXPORTED_BY_${adminId}_${timestamp}`
      : `CONFIDENTIAL // VEXORA ESPORTS // EXPORTED_BY_${adminId} // ${timestamp} // FOR INTERNAL AUDIT ONLY`;

    const exportPayload = {
      watermark: watermarkText,
      exportMetadata: {
        reportType,
        period: { startDate, endDate },
        exportedBy: adminId,
        timestamp,
      },
      data: summary,
    };

    const rawString = JSON.stringify(exportPayload, null, 2);
    const exportHash = crypto.createHash('sha256').update(rawString).digest('hex');

    const res = await query(
      `INSERT INTO financial_report_exports (
        report_type, start_date, end_date, exported_by_admin_id,
        watermark_text, export_hash_sha256, row_count, file_size_bytes, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        reportType,
        startDate,
        endDate,
        adminId,
        watermarkText,
        exportHash,
        summary.ledger.transactionCount || 1,
        Buffer.byteLength(rawString, 'utf8'),
        ipAddress,
      ]
    );

    const exportRecord = res.rows[0];

    await appendAuditLog({
      userId: adminId,
      role: 'FINANCE',
      ipAddress,
      action: 'FINANCIAL_REPORT_EXPORTED',
      entity: 'financial_report_exports',
      entityId: exportRecord.id,
      reason: `Watermarked ${reportType} report exported (Hash: ${exportHash.substring(0, 12)}...)`,
      payload: { exportId: exportRecord.id, reportType, exportHash, rowCount: exportRecord.row_count },
    });

    logger.info('Financial report exported with cryptographic watermark', {
      reportType,
      adminId,
      exportHash,
    });

    return {
      exportRecord,
      exportHash,
      watermarkText,
      payload: exportPayload,
    };
  }

  /**
   * List recent report exports for compliance review.
   *
   * @param {number} [limit=20]
   * @returns {Promise<Array>}
   */
  static async listExports(limit = 20) {
    const res = await query(
      `SELECT * FROM financial_report_exports
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }
}
