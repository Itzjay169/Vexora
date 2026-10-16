/**
 * Vexora Esports Tournament Platform — Payouts & Reconciliation Routes
 *
 * Phase 28: Payouts, Reconciliation & Financial Reports
 * PDF refs: Sections 8, 9, 47 (Phase 6)
 *
 * Endpoints:
 *   POST   /api/v1/payouts/destinations                       - Register payout destination (24h cooling-off)
 *   GET    /api/v1/payouts/destinations                       - List active destinations with cooling-off status
 *   POST   /api/v1/payouts/request                            - Request cash-out payout (enforces hold)
 *   GET    /api/v1/payouts                                    - List user's or admin's payouts
 *   POST   /api/v1/payouts/:id/approve-primary                - Primary admin approval (Maker-Checker enforced)
 *   POST   /api/v1/payouts/:id/approve-secondary              - High-value secondary admin approval
 *   POST   /api/v1/payouts/:id/reject                         - Reject payout and release wallet hold
 *   POST   /api/v1/payouts/:id/mark-paid                      - Finalize settlement with Bank UTR
 *   POST   /api/v1/payouts/admin/reconcile                    - Trigger daily 3-way reconciliation job
 *   GET    /api/v1/payouts/admin/reconcile/history            - History of reconciliation runs
 *   GET    /api/v1/payouts/admin/reconcile/discrepancies      - List flagged discrepancies
 *   POST   /api/v1/payouts/admin/reconcile/discrepancies/:id/resolve - Resolve discrepancy
 *   GET    /api/v1/payouts/admin/reports/summary              - Aggregated financial summary
 *   POST   /api/v1/payouts/admin/reports/export               - Cryptographically watermarked report export
 *   GET    /api/v1/payouts/admin/reports/exports              - List past watermarked exports
 */

import { Router } from 'express';
import { PayoutsService } from './payouts.service.js';
import { ReconciliationService } from './reconciliation.service.js';
import { FinancialReportsService } from './financialReports.service.js';
import { AppError } from '../common/errorHandler.js';
import { logger } from '../common/logger.js';

export const payoutsRouter = Router();

// ─── Destination Routes ─────────────────────────────────────────────────
payoutsRouter.post('/destinations', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    const { destinationType, upiId, bankAccountNumber, bankIfsc, accountHolderName } = req.body;

    const result = await PayoutsService.addPayoutDestination({
      userId,
      destinationType,
      upiId,
      bankAccountNumber,
      bankIfsc,
      accountHolderName,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

payoutsRouter.get('/destinations', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    const result = await PayoutsService.listPayoutDestinations(userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Payout Request ─────────────────────────────────────────────────────
payoutsRouter.post('/request', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    const { destinationId, amount } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || `payout-${userId}-${Date.now()}`;

    const result = await PayoutsService.requestPayout({
      userId,
      destinationId,
      amount,
      idempotencyKey,
      ipAddress: req.ip,
    });

    res.status(result.isReplay ? 200 : 201).json({
      success: true,
      data: result.payout,
      isReplay: result.isReplay,
    });
  } catch (err) {
    next(err);
  }
});

payoutsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'AUDITOR'].includes(userRole);

    const { status, isHighValue, limit } = req.query;

    const result = await PayoutsService.listPayouts({
      userId: isAdmin ? (req.query.userId || undefined) : userId,
      status,
      isHighValue: isHighValue !== undefined ? isHighValue === 'true' : undefined,
      limit: limit ? Number(limit) : 50,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Maker-Checker Approval (Primary) ───────────────────────────────────
payoutsRouter.post('/:id/approve-primary', async (req, res, next) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    if (!adminId || !['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(adminRole)) {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_REQUIRED' } });
    }

    const { notes } = req.body;
    const result = await PayoutsService.approvePrimary({
      payoutId: req.params.id,
      adminId,
      notes,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── High-Value Dual Approval (Secondary) ───────────────────────────────
payoutsRouter.post('/:id/approve-secondary', async (req, res, next) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    if (!adminId || !['SUPER_ADMIN', 'FINANCE'].includes(adminRole)) {
      return res.status(403).json({ success: false, error: { code: 'FINANCE_OR_SUPER_ADMIN_REQUIRED' } });
    }

    const { stepUpAuthVerified, notes } = req.body;
    const result = await PayoutsService.approveSecondaryHighValue({
      payoutId: req.params.id,
      adminId,
      stepUpAuthVerified: Boolean(stepUpAuthVerified),
      notes,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Rejection ──────────────────────────────────────────────────────────
payoutsRouter.post('/:id/reject', async (req, res, next) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    if (!adminId || !['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(adminRole)) {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_REQUIRED' } });
    }

    const { reason } = req.body;
    const result = await PayoutsService.rejectPayout({
      payoutId: req.params.id,
      adminId,
      reason,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Mark Paid with Bank UTR ────────────────────────────────────────────
payoutsRouter.post('/:id/mark-paid', async (req, res, next) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    if (!adminId || !['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(adminRole)) {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_REQUIRED' } });
    }

    const { bankUtr, provider, providerPayoutId } = req.body;
    const result = await PayoutsService.markPayoutPaid({
      payoutId: req.params.id,
      bankUtr,
      provider,
      providerPayoutId,
      adminId,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Reconciliation Endpoints ───────────────────────────────────────────
payoutsRouter.post('/admin/reconcile', async (req, res, next) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    if (!adminId || !['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'AUDITOR'].includes(adminRole)) {
      return res.status(403).json({ success: false, error: { code: 'FINANCE_OR_AUDITOR_REQUIRED' } });
    }

    const { dateStr } = req.body;
    const result = await ReconciliationService.runDailyReconciliation({
      dateStr,
      adminId,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

payoutsRouter.get('/admin/reconcile/history', async (_req, res, next) => {
  try {
    const history = await ReconciliationService.getHistory();
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

payoutsRouter.get('/admin/reconcile/discrepancies', async (req, res, next) => {
  try {
    const { status } = req.query;
    const list = await ReconciliationService.getDiscrepancies(status || 'OPEN');
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

payoutsRouter.post('/admin/reconcile/discrepancies/:id/resolve', async (req, res, next) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    if (!adminId || !['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(adminRole)) {
      return res.status(403).json({ success: false, error: { code: 'FINANCE_REQUIRED' } });
    }

    const { resolutionNotes } = req.body;
    const resolved = await ReconciliationService.resolveDiscrepancy({
      discrepancyId: req.params.id,
      adminId,
      resolutionNotes,
    });

    res.json({ success: true, data: resolved });
  } catch (err) {
    next(err);
  }
});

// ─── Financial Reports Endpoints ────────────────────────────────────────
payoutsRouter.get('/admin/reports/summary', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await FinancialReportsService.generateSummary({ startDate, endDate });
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

payoutsRouter.post('/admin/reports/export', async (req, res, next) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    if (!adminId || !['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'AUDITOR'].includes(adminRole)) {
      return res.status(403).json({ success: false, error: { code: 'FINANCE_OR_AUDITOR_REQUIRED' } });
    }

    const { reportType, startDate, endDate, customWatermark } = req.body;
    const exportResult = await FinancialReportsService.exportReport({
      reportType: reportType || 'DAILY_RECONCILIATION',
      startDate,
      endDate,
      adminId,
      customWatermark,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: exportResult });
  } catch (err) {
    next(err);
  }
});

payoutsRouter.get('/admin/reports/exports', async (_req, res, next) => {
  try {
    const exportsList = await FinancialReportsService.listExports();
    res.json({ success: true, data: exportsList });
  } catch (err) {
    next(err);
  }
});
