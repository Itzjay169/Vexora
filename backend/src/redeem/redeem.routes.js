/**
 * Vexora Esports Tournament Platform — Redeem Codes Router
 *
 * Implements Section 8, Phase 26 of Vexora Specification:
 * - Admin batches creation, listing, dual-approval adjudications, and watermarked export.
 * - Player code redemption with client/server checksum checks, rate-limiting, and double-entry credits.
 * - Code blocking for compromised codes.
 */

import { Router } from 'express';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { validateBody } from '../common/validation.middleware.js';
import {
  CreateRedeemBatchSchema,
  ApproveRedeemBatchSchema,
  RedeemCodeInputSchema,
  ExportRedeemBatchSchema,
  BlockRedeemCodeSchema,
} from '../../../packages/validation/src/index.ts';
import { RedeemService } from './redeem.service.js';

export const redeemRouter = Router();

// ─── Player Endpoints ────────────────────────────────────────────────────────

/**
 * POST /api/v1/redeem/verify-checksum
 * Pre-flight validation of code checksum without database queries.
 */
redeemRouter.post('/verify-checksum', (req, res) => {
  const { code } = req.body;
  const isValid = RedeemService.validateCodeChecksum(code);
  res.json({
    code,
    valid: isValid,
    normalized: isValid ? RedeemService.normalizeCode(code) : null,
  });
});

/**
 * POST /api/v1/redeem/use
 * Redeem a promotional or voucher code into user's wallet via Double-Entry Ledger.
 */
redeemRouter.post(
  '/use',
  authenticate,
  validateBody(RedeemCodeInputSchema),
  async (req, res, next) => {
    try {
      const result = await RedeemService.redeemCode(
        req.user.id,
        req.body.code,
        {
          ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'VexoraClient/1.0',
        }
      );
      res.status(200).json({
        message: 'Code successfully redeemed',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/redeem/history
 * Get redemption history for authenticated user.
 */
redeemRouter.get('/history', authenticate, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const history = await RedeemService.getUserRedemptions(req.user.id, limit);
    res.json({ data: history });
  } catch (err) {
    next(err);
  }
});

// ─── Admin Endpoints (Maker-Checker & Batch Management) ──────────────────────

/**
 * POST /api/v1/redeem/batches
 * Create a new redeem code batch (Status: PENDING_APPROVAL).
 */
redeemRouter.post(
  '/batches',
  authenticate,
  authorize('FINANCE_ADMIN', 'SUPER_ADMIN'),
  validateBody(CreateRedeemBatchSchema),
  async (req, res, next) => {
    try {
      const result = await RedeemService.createBatch(req.user.id, req.body);
      res.status(201).json({
        message: 'Redeem code batch created and pending second-admin approval',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/redeem/batches
 * List batches with optional status filter.
 */
redeemRouter.get(
  '/batches',
  authenticate,
  authorize('FINANCE_ADMIN', 'SUPER_ADMIN', 'AUDITOR'),
  async (req, res, next) => {
    try {
      const batches = await RedeemService.getBatches(req.query);
      res.json({ data: batches });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/redeem/batches/:id
 * Get details and breakdown statistics of a specific batch.
 */
redeemRouter.get(
  '/batches/:id',
  authenticate,
  authorize('FINANCE_ADMIN', 'SUPER_ADMIN', 'AUDITOR'),
  async (req, res, next) => {
    try {
      const result = await RedeemService.getBatchById(req.params.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/redeem/batches/:id/adjudicate
 * Dual authorization approval/rejection (Maker != Checker).
 */
redeemRouter.post(
  '/batches/:id/adjudicate',
  authenticate,
  authorize('FINANCE_ADMIN', 'SUPER_ADMIN'),
  validateBody(ApproveRedeemBatchSchema),
  async (req, res, next) => {
    try {
      const result = await RedeemService.adjudicateBatch(
        req.user.id,
        req.params.id,
        req.body
      );
      res.json({
        message: `Batch successfully ${req.body.decision === 'APPROVE' ? 'approved and activated' : 'rejected and cancelled'}`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/redeem/batches/:id/export
 * Encrypted, watermarked batch export with audit logging.
 */
redeemRouter.post(
  '/batches/:id/export',
  authenticate,
  authorize('FINANCE_ADMIN', 'SUPER_ADMIN'),
  validateBody(ExportRedeemBatchSchema),
  async (req, res, next) => {
    try {
      const result = await RedeemService.exportBatch(
        req.user.id,
        req.params.id,
        req.body
      );
      res.json({
        message: 'Batch export generated and audit-logged',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/redeem/codes/:id/block
 * Emergency block on compromised code.
 */
redeemRouter.post(
  '/codes/:id/block',
  authenticate,
  authorize('FINANCE_ADMIN', 'SUPER_ADMIN', 'MODERATOR'),
  validateBody(BlockRedeemCodeSchema),
  async (req, res, next) => {
    try {
      const result = await RedeemService.blockCode(
        req.user.id,
        req.params.id,
        req.body.reason
      );
      res.json({
        message: 'Redeem code blocked',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);
