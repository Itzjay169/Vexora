// ============================================================================
// Vexora Leaderboards Routes
// Specifications: Blueprint Section 7, 16, 17, 39; ADR-002, ADR-015
// ============================================================================

import { Router } from 'express';
import { authenticate } from '../common/auth.middleware.js';
import { requirePermission } from '../common/rbac.middleware.js';
import { AppError } from '../common/errorHandler.js';
import {
  getLeaderboard,
  getUserRanks,
  processMatchResult,
  getSnapshots,
  createManualSnapshot,
} from './leaderboardTransaction.service.js';
import {
  LeaderboardQuerySchema,
  ProcessMatchResultSchema,
  LeaderboardSnapshotCreateSchema,
} from '@vexora/validation';

export const leaderboardsRouter = Router();

// ─── GET / — Global / Seasonal Leaderboard (Public) ─────────────────────────
leaderboardsRouter.get('/', async (req, res, next) => {
  try {
    const parsed = LeaderboardQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Invalid query parameters', 400);
    }

    const { game, game_id, season_id, timeframe, participant_type, limit, cursor } = parsed.data;

    const data = await getLeaderboard({
      gameSlug: game,
      gameId: game_id,
      seasonId: season_id,
      timeframe,
      participantType: participant_type,
      limit,
      cursor,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /me — Authenticated User's Ranks Across Games ──────────────────────
leaderboardsRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const ranks = await getUserRanks(req.user.id);
    res.json({ success: true, data: ranks });
  } catch (err) {
    next(err);
  }
});

// ─── GET /snapshots/:gameId — Historical Snapshots ──────────────────────────
leaderboardsRouter.get('/snapshots/:gameId', async (req, res, next) => {
  try {
    const { seasonId, limit } = req.query;
    const snapshots = await getSnapshots(
      req.params.gameId,
      seasonId || null,
      parseInt(limit || '20', 10)
    );
    res.json({ success: true, data: snapshots });
  } catch (err) {
    next(err);
  }
});

// ─── POST /process-match-result — Single DB Transaction Processing ──────────
leaderboardsRouter.post('/process-match-result', authenticate, async (req, res, next) => {
  try {
    const parsed = ProcessMatchResultSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Invalid payload', 400);
    }

    const result = await processMatchResult({
      matchId: parsed.data.match_id,
      seasonId: parsed.data.season_id,
      forceRecalculate: parsed.data.force_recalculate,
      actor: { id: req.user.id, role: req.user.role },
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── POST /snapshots — Create Manual Point-in-Time Snapshot ─────────────────
leaderboardsRouter.post('/snapshots', authenticate, async (req, res, next) => {
  try {
    const parsed = LeaderboardSnapshotCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Invalid snapshot request', 400);
    }

    const snapshot = await createManualSnapshot({
      gameId: parsed.data.game_id,
      seasonId: parsed.data.season_id,
      snapshotType: parsed.data.snapshot_type,
      notes: parsed.data.notes,
      actor: { id: req.user.id, role: req.user.role },
    });

    res.status(201).json({ success: true, data: snapshot });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:gameSlug — Per-Game Current Season Leaderboard ───────────────────
leaderboardsRouter.get('/:gameSlug', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const cursor = req.query.cursor;
    const data = await getLeaderboard({
      gameSlug: req.params.gameSlug,
      limit,
      cursor,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:gameSlug/seasons/:seasonId — Per-Game, Specific Season ───────────
leaderboardsRouter.get('/:gameSlug/seasons/:seasonId', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const cursor = req.query.cursor;
    const data = await getLeaderboard({
      gameSlug: req.params.gameSlug,
      seasonId: req.params.seasonId,
      limit,
      cursor,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
