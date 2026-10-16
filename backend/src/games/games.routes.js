import { Router } from 'express';
import { authenticate } from '../common/auth.middleware.js';
import { requirePermission, requireAnyPermission, adminGate } from '../common/rbac.middleware.js';
import { PERMISSIONS } from '../common/rbac.js';
import { AppError } from '../common/errorHandler.js';
import {
  GameCreateSchema,
  GameUpdateSchema,
  GameModeCreateSchema,
  GameModeUpdateSchema,
  RuleTemplateCreateSchema,
  RuleTemplateUpdateSchema,
  ScoringSchemaCreateSchema,
  ScoringSchemaNewVersionSchema,
  ScoringSimulationInputSchema,
} from '../../../packages/validation/src/index.ts';
import * as gamesService from './games.service.js';

export const gamesRouter = Router();

// ─── Public Catalog Read Endpoints ──────────────────────────────────────────

/**
 * GET / — List active games with modes and scoring schemas
 */
gamesRouter.get('/', async (req, res, next) => {
  try {
    const { status, platform } = req.query;
    const games = await gamesService.listGames({ status, platform });
    res.json({ success: true, data: games });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:slug — Detailed game profile with modes, rule templates, scoring schemas
 */
gamesRouter.get('/:slug', async (req, res, next) => {
  try {
    const game = await gamesService.getGameBySlug(req.params.slug);
    res.json({ success: true, data: game });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:slug/modes — List modes for a game
 */
gamesRouter.get('/:slug/modes', async (req, res, next) => {
  try {
    const game = await gamesService.getGameBySlug(req.params.slug);
    const modes = await gamesService.listGameModes(game.id);
    res.json({ success: true, data: modes });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:slug/scoring-schemas — List scoring schemas for a game
 */
gamesRouter.get('/:slug/scoring-schemas', async (req, res, next) => {
  try {
    const game = await gamesService.getGameBySlug(req.params.slug);
    const schemas = await gamesService.listScoringSchemas(game.id, req.query.mode_slug);
    res.json({ success: true, data: schemas });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:slug/rule-templates — List rule templates for a game
 */
gamesRouter.get('/:slug/rule-templates', async (req, res, next) => {
  try {
    const game = await gamesService.getGameBySlug(req.params.slug);
    const templates = await gamesService.listRuleTemplates(game.id);
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
});

// ─── Scoring Simulator Endpoint ─────────────────────────────────────────────

/**
 * POST /scoring/simulate — Test tournament scoring formula on sample inputs
 * Accessible to Organisers and Admins (requires SCORING_SIMULATE)
 */
gamesRouter.post(
  '/scoring/simulate',
  authenticate,
  requireAnyPermission([PERMISSIONS.SCORING_SIMULATE, PERMISSIONS.GAMES_SCORING_MANAGE]),
  async (req, res, next) => {
    try {
      const validated = ScoringSimulationInputSchema.parse(req.body);
      const simulation = gamesService.simulateTournamentResults(validated);
      res.json({ success: true, data: simulation });
    } catch (err) {
      next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
    }
  }
);

// ─── Admin Mutating Endpoints (Strict RBAC & Audit Logging) ─────────────────

/**
 * POST / — Create game (Admin)
 */
gamesRouter.post(
  '/',
  authenticate,
  adminGate,
  requirePermission(PERMISSIONS.GAMES_CREATE),
  async (req, res, next) => {
    try {
      const data = GameCreateSchema.parse(req.body);
      const actor = {
        id: req.user?.id,
        role: req.user?.role,
        requestId: req.correlationId || req.id,
      };
      const game = await gamesService.createGame(data, actor);
      res.status(201).json({ success: true, data: game });
    } catch (err) {
      next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
    }
  }
);

/**
 * PUT /:id — Update game details (Admin)
 */
gamesRouter.put(
  '/:id',
  authenticate,
  adminGate,
  requirePermission(PERMISSIONS.GAMES_EDIT),
  async (req, res, next) => {
    try {
      const data = GameUpdateSchema.parse(req.body);
      const actor = {
        id: req.user?.id,
        role: req.user?.role,
        reason: req.body.reason,
        requestId: req.correlationId || req.id,
      };
      const updated = await gamesService.updateGame(req.params.id, data, actor);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
    }
  }
);

/**
 * DELETE /:id — Deprecate/Soft-delete game (Super Admin)
 */
gamesRouter.delete(
  '/:id',
  authenticate,
  adminGate,
  requirePermission(PERMISSIONS.GAMES_DELETE),
  async (req, res, next) => {
    try {
      const actor = {
        id: req.user?.id,
        role: req.user?.role,
        reason: req.body.reason || 'Admin soft-deleted game catalog entry',
        requestId: req.correlationId || req.id,
      };
      const deprecated = await gamesService.deleteGame(req.params.id, actor);
      res.json({ success: true, data: deprecated });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /:gameId/modes — Create game mode (Admin)
 */
gamesRouter.post(
  '/:gameId/modes',
  authenticate,
  adminGate,
  requirePermission(PERMISSIONS.GAMES_EDIT),
  async (req, res, next) => {
    try {
      const data = GameModeCreateSchema.parse(req.body);
      const actor = {
        id: req.user?.id,
        role: req.user?.role,
        requestId: req.correlationId || req.id,
      };
      const mode = await gamesService.createGameMode(req.params.gameId, data, actor);
      res.status(201).json({ success: true, data: mode });
    } catch (err) {
      next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
    }
  }
);

/**
 * PUT /modes/:modeId — Update game mode (Admin)
 */
gamesRouter.put(
  '/modes/:modeId',
  authenticate,
  adminGate,
  requirePermission(PERMISSIONS.GAMES_EDIT),
  async (req, res, next) => {
    try {
      const data = GameModeUpdateSchema.parse(req.body);
      const actor = {
        id: req.user?.id,
        role: req.user?.role,
        reason: req.body.reason,
        requestId: req.correlationId || req.id,
      };
      const updated = await gamesService.updateGameMode(req.params.modeId, data, actor);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
    }
  }
);

/**
 * POST /rule-templates — Create rule template (Admin)
 */
gamesRouter.post(
  '/rule-templates',
  authenticate,
  adminGate,
  requirePermission(PERMISSIONS.GAMES_EDIT),
  async (req, res, next) => {
    try {
      const data = RuleTemplateCreateSchema.parse(req.body);
      const actor = {
        id: req.user?.id,
        role: req.user?.role,
        requestId: req.correlationId || req.id,
      };
      const template = await gamesService.createRuleTemplate(data, actor);
      res.status(201).json({ success: true, data: template });
    } catch (err) {
      next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
    }
  }
);

/**
 * PUT /rule-templates/:id — Update rule template (Admin)
 */
gamesRouter.put(
  '/rule-templates/:id',
  authenticate,
  adminGate,
  requirePermission(PERMISSIONS.GAMES_EDIT),
  async (req, res, next) => {
    try {
      const data = RuleTemplateUpdateSchema.parse(req.body);
      const actor = {
        id: req.user?.id,
        role: req.user?.role,
        reason: req.body.reason,
        requestId: req.correlationId || req.id,
      };
      const updated = await gamesService.updateRuleTemplate(req.params.id, data, actor);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
    }
  }
);

/**
 * POST /scoring-schemas — Create initial scoring schema version (Admin)
 */
gamesRouter.post(
  '/scoring-schemas',
  authenticate,
  adminGate,
  requirePermission(PERMISSIONS.GAMES_SCORING_MANAGE),
  async (req, res, next) => {
    try {
      const data = ScoringSchemaCreateSchema.parse(req.body);
      const actor = {
        id: req.user?.id,
        role: req.user?.role,
        requestId: req.correlationId || req.id,
      };
      const schema = await gamesService.createScoringSchema(data, actor);
      res.status(201).json({ success: true, data: schema });
    } catch (err) {
      next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
    }
  }
);

/**
 * POST /scoring-schemas/:id/version — Increment scoring formula version (Admin)
 * Invariant: Never silently overwrite an existing formula. Creates a new immutable version row.
 */
gamesRouter.post(
  '/scoring-schemas/:id/version',
  authenticate,
  adminGate,
  requirePermission(PERMISSIONS.GAMES_SCORING_MANAGE),
  async (req, res, next) => {
    try {
      const data = ScoringSchemaNewVersionSchema.parse(req.body);
      const actor = {
        id: req.user?.id,
        role: req.user?.role,
        requestId: req.correlationId || req.id,
      };
      const newVersion = await gamesService.createNewScoringVersion(req.params.id, data, actor);
      res.status(201).json({ success: true, data: newVersion });
    } catch (err) {
      next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
    }
  }
);
