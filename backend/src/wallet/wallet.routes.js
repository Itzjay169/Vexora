/**
 * Vexora Esports Tournament Platform — Double-Entry Ledger & Wallet Routes
 */

import { Router } from 'express';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { requireIdempotencyKey } from '../common/idempotency.js';
import { validateBody } from '../common/validation.middleware.js';
import {
  WalletHoldSchema,
  WalletReleaseSchema,
  WalletAdjustmentRequestSchema,
  WalletAdjustmentAdjudicateSchema,
} from '../../../packages/validation/src/index.ts';
import { WalletLedgerService } from './walletLedger.service.js';

export const walletRouter = Router();

// All wallet endpoints require authentication
walletRouter.use(authenticate);

// ─── GET /balance — User's wallet balance & consistency ─────────────────────
walletRouter.get('/balance', async (req, res, next) => {
  try {
    const data = await WalletLedgerService.getWalletBalance(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /transactions — User's immutable ledger transaction history ─────────
walletRouter.get('/transactions', async (req, res, next) => {
  try {
    const data = await WalletLedgerService.getTransactionHistory(req.user.id, {
      limit: req.query.limit,
      offset: req.query.offset,
      entryType: req.query.type,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /holds — Reserve credits for tournament registration ───────────────
walletRouter.post(
  '/holds',
  requireIdempotencyKey,
  validateBody(WalletHoldSchema),
  async (req, res, next) => {
    try {
      const idempotencyKey = req.header('Idempotency-Key') || `hold-${req.user.id}-${Date.now()}`;
      const result = await WalletLedgerService.holdFunds(
        req.user.id,
        req.body.amount,
        req.body.tournament_id,
        idempotencyKey
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /releases — Release held credits back to available ─────────────────
walletRouter.post(
  '/releases',
  requireIdempotencyKey,
  validateBody(WalletReleaseSchema),
  async (req, res, next) => {
    try {
      const idempotencyKey = req.header('Idempotency-Key') || `rel-${req.user.id}-${Date.now()}`;
      const result = await WalletLedgerService.releaseHold(
        req.user.id,
        req.body.amount,
        req.body.tournament_id,
        req.body.reason,
        idempotencyKey
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /adjustments/request — Request balance adjustment (Maker-Checker 1) ─
walletRouter.post(
  '/adjustments/request',
  authorize('ADMIN', 'SUPER_ADMIN', 'FINANCE'),
  validateBody(WalletAdjustmentRequestSchema),
  async (req, res, next) => {
    try {
      const adjustment = await WalletLedgerService.requestAdjustment(
        req.user.id,
        req.body
      );
      res.status(201).json({ success: true, data: adjustment });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /adjustments/:id/adjudicate — Dual-Approval (Maker-Checker 2) ──────
walletRouter.post(
  '/adjustments/:id/adjudicate',
  authorize('SUPER_ADMIN', 'FINANCE'),
  validateBody(WalletAdjustmentAdjudicateSchema),
  async (req, res, next) => {
    try {
      const idempotencyKey = req.header('Idempotency-Key') || null;
      const result = await WalletLedgerService.adjudicateAdjustment(
        req.user.id,
        req.params.id,
        req.body,
        idempotencyKey
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /verify-invariants — Platform double-entry invariant check ──────────
walletRouter.get(
  '/verify-invariants',
  authorize('ADMIN', 'SUPER_ADMIN', 'FINANCE', 'AUDITOR'),
  async (_req, res, next) => {
    try {
      const report = await WalletLedgerService.verifyLedgerInvariants();
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
);
