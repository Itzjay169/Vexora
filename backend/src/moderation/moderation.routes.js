import { Router } from 'express';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { AppError } from '../common/errorHandler.js';
import { DisputeModerationService } from './disputeModeration.service.js';
import {
  ReportCreateSchema,
  DisputeRulingSchema,
  AppealDecisionSchema,
  SanctionCreateSchema,
  RiskSignalCreateSchema,
} from '../../../packages/validation/src/index.ts';

const moderationRouter = Router();

// ─── POST /api/v1/moderation/reports — Submit an incident/violation report ───
moderationRouter.post('/reports',
  authenticate,
  async (req, res, next) => {
    try {
      const payload = ReportCreateSchema.parse(req.body);
      const data = await DisputeModerationService.createReport(req.user.id, payload, req.ip);
      res.status(201).json({
        success: true,
        message: 'Report submitted for moderation review',
        data,
      });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── GET /api/v1/moderation/queue — Moderator Review Queue with SLA ─────────
moderationRouter.get('/queue',
  authenticate,
  authorize('MODERATOR', 'ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const data = await DisputeModerationService.listModerationQueue(req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/moderation/disputes/:id/ruling — Adjudicate Dispute ───────
moderationRouter.post('/disputes/:id/ruling',
  authenticate,
  authorize('MODERATOR', 'ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const payload = DisputeRulingSchema.parse(req.body);
      const data = await DisputeModerationService.ruleDispute(
        req.params.id,
        req.user,
        payload,
        req.ip
      );
      res.json({
        success: true,
        message: 'Dispute ruling recorded; 48-hour appeal window opened',
        data,
      });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── POST /api/v1/moderation/disputes/:id/appeal-decision — Maker-Checker ────
moderationRouter.post('/disputes/:id/appeal-decision',
  authenticate,
  authorize('MODERATOR', 'ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const payload = AppealDecisionSchema.parse(req.body);
      const data = await DisputeModerationService.decideAppeal(
        req.params.id,
        req.user,
        payload,
        req.ip
      );
      res.json({
        success: true,
        message: 'Appeal adjudication recorded; match settlement unfrozen',
        data,
      });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── POST /api/v1/moderation/sanctions — Apply Disciplinary Sanction ─────────
moderationRouter.post('/sanctions',
  authenticate,
  authorize('MODERATOR', 'ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const payload = SanctionCreateSchema.parse(req.body);
      const data = await DisputeModerationService.applySanction(req.user, payload, req.ip);
      res.status(201).json({
        success: true,
        message: 'Sanction issued and logged to audit journal',
        data,
      });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── POST /api/v1/moderation/risk-signals — Ingest Risk Signal ──────────────
moderationRouter.post('/risk-signals',
  authenticate,
  async (req, res, next) => {
    try {
      const payload = RiskSignalCreateSchema.parse(req.body);
      const data = await DisputeModerationService.ingestRiskSignal(payload);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── Legacy cases endpoint for backwards compatibility ──────────────────────
moderationRouter.get('/cases', (req, res) => {
  res.json({
    success: true,
    data: {
      cases: [],
      sanctionLadder: ['WARNING', 'RESTRICTION', 'SUSPENSION', 'PERMANENT_BAN'],
    },
  });
});

export { moderationRouter };
