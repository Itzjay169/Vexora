import { Router } from 'express';
import { authenticate } from '../common/auth.middleware.js';
import { adminGate } from '../common/rbac.middleware.js';
import { AppError } from '../common/errorHandler.js';
import { SeasonCreateSchema, SeasonUpdateSchema } from '../../../packages/validation/src/index.ts';
import * as seasonsService from './seasons.service.js';

export const seasonsRouter = Router();

// ─── Public Endpoints ───────────────────────────────────────────────────────

/**
 * GET / — List seasons with filtering and pagination
 */
seasonsRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const seasons = await seasonsService.getSeasons({
      gameId: req.query.game_id,
      status: req.query.status,
      limit,
      offset,
    });
    res.json({ success: true, data: seasons });
  } catch (err) { next(err); }
});

/**
 * GET /active/:gameId — Get currently active season for a game
 */
seasonsRouter.get('/active/:gameId', async (req, res, next) => {
  try {
    const season = await seasonsService.getActiveSeason(req.params.gameId);
    res.json({ success: true, data: season });
  } catch (err) { next(err); }
});

/**
 * GET /:id — Get season by ID
 */
seasonsRouter.get('/:id', async (req, res, next) => {
  try {
    const season = await seasonsService.getSeasonById(req.params.id);
    res.json({ success: true, data: season });
  } catch (err) { next(err); }
});

// ─── Admin Management Endpoints ─────────────────────────────────────────────

/**
 * POST / — Create season (Admin only)
 */
seasonsRouter.post('/', authenticate, adminGate, async (req, res, next) => {
  try {
    const data = SeasonCreateSchema.parse(req.body);
    const season = await seasonsService.createSeason(
      data,
      req.user.id,
      { role: req.user.role, requestId: req.correlationId }
    );
    res.status(201).json({ success: true, data: season });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

/**
 * PATCH /:id — Update season metadata (Admin only)
 */
seasonsRouter.patch('/:id', authenticate, adminGate, async (req, res, next) => {
  try {
    const data = SeasonUpdateSchema.parse(req.body);
    const season = await seasonsService.updateSeason(
      req.params.id,
      data,
      req.user.id,
      { role: req.user.role, requestId: req.correlationId }
    );
    res.json({ success: true, data: season });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

/**
 * POST /:id/activate — Set season as active (Admin only)
 */
seasonsRouter.post('/:id/activate', authenticate, adminGate, async (req, res, next) => {
  try {
    const season = await seasonsService.activateSeason(
      req.params.id,
      req.user.id,
      { role: req.user.role, requestId: req.correlationId }
    );
    res.json({ success: true, data: season });
  } catch (err) { next(err); }
});

/**
 * POST /:id/archive — Archive season (Admin only)
 */
seasonsRouter.post('/:id/archive', authenticate, adminGate, async (req, res, next) => {
  try {
    const season = await seasonsService.archiveSeason(
      req.params.id,
      req.user.id,
      { role: req.user.role, requestId: req.correlationId }
    );
    res.json({ success: true, data: season });
  } catch (err) { next(err); }
});
