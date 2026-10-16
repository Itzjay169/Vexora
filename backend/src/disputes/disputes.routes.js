import { Router } from 'express';
import { authenticate } from '../common/auth.middleware.js';
import { AppError } from '../common/errorHandler.js';
import { query } from '../common/database.js';
import { parsePagination, paginatedResponse } from '../common/pagination.js';
import { DisputeModerationService } from '../moderation/disputeModeration.service.js';
import {
  DisputeCreateSchema,
  DisputeAppealSchema,
} from '../../../packages/validation/src/index.ts';

export const disputesRouter = Router();

// All dispute endpoints require authentication
disputesRouter.use(authenticate);

// ─── GET /api/v1/disputes — List user's disputes ────────────────────────────
disputesRouter.get('/', async (req, res, next) => {
  try {
    const { cursor, limit } = parsePagination(req.query);
    const status = req.query.status;

    let whereClause = 'WHERE (d.raised_by = $1)';
    const params = [req.user.id];

    if (status) {
      params.push(status.toUpperCase());
      whereClause += ` AND d.status = $${params.length}`;
    }

    if (cursor) {
      params.push(cursor.ts, cursor.id);
      whereClause += ` AND (d.created_at, d.id) < ($${params.length - 1}, $${params.length})`;
    }

    params.push(limit + 1);

    const result = await query(
      `SELECT d.id, d.case_id, d.match_id, d.raised_by, d.reason,
              d.description, d.status, d.settlement_frozen, d.sla_deadline,
              d.ruling_type, d.appeal_status, d.created_at
       FROM disputes d
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ success: true, ...paginatedResponse(result.rows, limit) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/disputes — Create a new dispute (Settlement Freeze) ───────
disputesRouter.post('/', async (req, res, next) => {
  try {
    const data = DisputeCreateSchema.parse(req.body);
    const dispute = await DisputeModerationService.createDispute(req.user.id, data, req.ip);
    res.status(201).json({ success: true, data: dispute });
  } catch (err) {
    next(err.name === 'ZodError'
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});

// ─── GET /api/v1/disputes/:id — Get dispute case details ───────────────────
disputesRouter.get('/:id', async (req, res, next) => {
  try {
    const dispute = await DisputeModerationService.getDispute(req.params.id, req.user);
    res.json({ success: true, data: dispute });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/disputes/:id/appeal — Submit dispute appeal (48h window) ──
disputesRouter.post('/:id/appeal', async (req, res, next) => {
  try {
    const payload = DisputeAppealSchema.parse(req.body);
    const data = await DisputeModerationService.submitAppeal(
      req.params.id,
      req.user.id,
      payload,
      req.ip
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err.name === 'ZodError'
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});
