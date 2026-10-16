/**
 * Vexora Esports Tournament Platform — Payment & Escrow Routes
 *
 * Phase 27: Payments, Prize Escrow & Paid Tournament Flow
 * PDF refs: Sections 9, 26, 39 (Phase 6)
 *
 * Endpoints:
 *   POST   /api/v1/payments/orders                 - Create payment order
 *   GET    /api/v1/payments/orders                  - List user's payment orders
 *   GET    /api/v1/payments/orders/:id              - Get payment order details
 *   POST   /api/v1/payments/refund/:orderId         - Process refund (admin)
 *   GET    /api/v1/payments/refund-policy            - Published refund rules
 *   POST   /api/v1/payments/escrow/lock             - Lock prize escrow
 *   GET    /api/v1/payments/escrow/:tournamentId    - Get escrow status
 *   POST   /api/v1/payments/escrow/:tournamentId/settle - Settle tournament prizes
 *   POST   /api/v1/payments/entry                   - Process tournament entry payment
 *   POST   /api/v1/payments/entry/:registrationId/refund - Refund entry fee
 *   GET    /api/v1/payments/entry/:tournamentId     - Get tournament entry payments
 *   GET    /api/v1/payments/admin/webhooks           - Webhook event history (admin)
 *   GET    /api/v1/payments/admin/regional-config    - Get regional payment config
 *   PATCH  /api/v1/payments/admin/regional-config    - Update regional payment config
 */

import { Router } from 'express';
import { PaymentService } from './payment.service.js';
import { PrizeEscrowService } from './prizeEscrow.service.js';
import { AppError } from '../common/errorHandler.js';
import { logger } from '../common/logger.js';

export const paymentsRouter = Router();

// ─── Player: Create payment order ───────────────────────────────────
paymentsRouter.post('/orders', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    const { provider, amount, purpose, referenceType, referenceId } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || `po-${userId}-${Date.now()}`;

    const result = await PaymentService.createPaymentOrder({
      userId,
      provider: provider || 'RAZORPAY',
      amount,
      purpose: purpose || 'DEPOSIT',
      referenceType,
      referenceId,
      idempotencyKey,
    });

    res.status(result.isReplay ? 200 : 201).json({
      success: true,
      data: result.order,
      isReplay: result.isReplay,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Player: List payment orders ────────────────────────────────────
paymentsRouter.get('/orders', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    const result = await PaymentService.getUserPaymentOrders(userId, {
      limit: req.query.limit,
      offset: req.query.offset,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Player: Get payment order detail ───────────────────────────────
paymentsRouter.get('/orders/:id', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    const { query: dbQuery } = await import('../common/database.js');
    const result = await dbQuery(
      `SELECT id, provider, provider_order_id, amount, currency, purpose, status,
              reference_type, reference_id, failure_reason, refund_amount, refund_reason,
              created_at, updated_at
       FROM payment_orders
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'ORDER_NOT_FOUND' } });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── Admin: Process refund ──────────────────────────────────────────
paymentsRouter.post('/refund/:orderId', async (req, res, next) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    if (!adminId || !['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(adminRole)) {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_REQUIRED' } });
    }

    const { amount, reason } = req.body;
    if (!amount || !reason) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_REQUIRED_FIELDS' } });
    }

    const result = await PaymentService.processRefund(
      req.params.orderId,
      amount,
      reason,
      adminId,
      req.headers['idempotency-key']
    );

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Public: Refund policy ──────────────────────────────────────────
paymentsRouter.get('/refund-policy', (_req, res) => {
  res.json({ success: true, data: PrizeEscrowService.getRefundPolicy() });
});

// ─── Organiser: Lock prize escrow ───────────────────────────────────
paymentsRouter.post('/escrow/lock', async (req, res, next) => {
  try {
    const organiserId = req.user?.id;
    if (!organiserId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    const { tournamentId, escrowAmount } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || `escrow-${tournamentId}-${Date.now()}`;

    const result = await PrizeEscrowService.lockPrizeEscrow({
      tournamentId,
      organiserId,
      escrowAmount,
      idempotencyKey,
    });

    res.status(result.isReplay ? 200 : 201).json({
      success: true,
      data: result.escrow,
      isReplay: result.isReplay || false,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Public: Get escrow status ──────────────────────────────────────
paymentsRouter.get('/escrow/:tournamentId', async (req, res, next) => {
  try {
    const escrow = await PrizeEscrowService.getEscrowStatus(req.params.tournamentId);
    if (!escrow) {
      return res.status(404).json({ success: false, error: { code: 'ESCROW_NOT_FOUND' } });
    }
    res.json({ success: true, data: escrow });
  } catch (err) {
    next(err);
  }
});

// ─── Admin: Settle tournament prizes ────────────────────────────────
paymentsRouter.post('/escrow/:tournamentId/settle', async (req, res, next) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    if (!adminId || !['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(adminRole)) {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_REQUIRED' } });
    }

    const { prizeBreakdown } = req.body;
    if (!prizeBreakdown || !Array.isArray(prizeBreakdown)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PRIZE_BREAKDOWN' } });
    }

    const result = await PrizeEscrowService.settleTournament({
      tournamentId: req.params.tournamentId,
      prizeBreakdown,
      settledBy: adminId,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Player: Process tournament entry payment ───────────────────────
paymentsRouter.post('/entry', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

    const { tournamentId, registrationId, entryFee } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || `entry-${registrationId}-${Date.now()}`;

    const result = await PrizeEscrowService.processEntryPayment({
      tournamentId,
      registrationId,
      userId,
      entryFee: entryFee || 0,
      idempotencyKey,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Refund entry fee ───────────────────────────────────────────────
paymentsRouter.post('/entry/:registrationId/refund', async (req, res, next) => {
  try {
    const initiatedBy = req.user?.id || 'SYSTEM';
    const { reason } = req.body;

    const result = await PrizeEscrowService.refundEntryFee(
      req.params.registrationId,
      reason || 'Player cancellation',
      initiatedBy
    );

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Get tournament entry payments ──────────────────────────────────
paymentsRouter.get('/entry/:tournamentId', async (req, res, next) => {
  try {
    const entries = await PrizeEscrowService.getTournamentEntryPayments(req.params.tournamentId);
    res.json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
});

// ─── Admin: Webhook event history ───────────────────────────────────
paymentsRouter.get('/admin/webhooks', async (req, res, next) => {
  try {
    const adminRole = req.user?.role;
    if (!['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(adminRole)) {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_REQUIRED' } });
    }

    const events = await PaymentService.getWebhookEvents({
      provider: req.query.provider,
      status: req.query.status,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
});

// ─── Admin: Get regional payment config ─────────────────────────────
paymentsRouter.get('/admin/regional-config', async (req, res, next) => {
  try {
    const { query: dbQuery } = await import('../common/database.js');
    const result = await dbQuery(`SELECT * FROM regional_payment_config ORDER BY region_code`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─── Admin: Update regional payment config ──────────────────────────
paymentsRouter.patch('/admin/regional-config', async (req, res, next) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    if (!adminId || !['ADMIN', 'SUPER_ADMIN'].includes(adminRole)) {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_REQUIRED' } });
    }

    const { regionCode, countryCode, ...updates } = req.body;
    const result = await PaymentService.updateRegionalConfig(
      adminId,
      regionCode || 'IN-ALL',
      countryCode || 'IN',
      updates
    );

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
