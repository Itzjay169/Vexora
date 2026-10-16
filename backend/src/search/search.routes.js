import { Router } from 'express';
import { AppError } from '../common/errorHandler.js';
import { SearchQuerySchema } from '../../../packages/validation/src/index.ts';
import * as searchService from './search.service.js';

export const searchRouter = Router();

/**
 * GET / — Unified search across all esports entities
 * Query parameters:
 *   q: string (required)
 *   type: 'ALL' | 'GAMES' | 'TEAMS' | 'PLAYERS' | 'TOURNAMENTS' | 'SEASONS'
 *   game_id: UUID (optional filter)
 *   limit: integer (1-100, default 20)
 *   offset: integer (default 0)
 *   sort: 'RELEVANCE' | 'NEWEST' | 'NAME'
 */
searchRouter.get('/', async (req, res, next) => {
  try {
    const queryData = SearchQuerySchema.parse({
      q: req.query.q,
      type: req.query.type || 'ALL',
      game_id: req.query.game_id,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
      sort: req.query.sort || 'RELEVANCE',
    });

    const results = await searchService.searchAll(queryData);
    res.json({
      success: true,
      data: results,
      meta: {
        query: queryData.q,
        type: queryData.type,
        limit: queryData.limit,
        offset: queryData.offset,
      },
    });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

/**
 * GET /games — Search games
 */
searchRouter.get('/games', async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.json({ success: true, data: [] });
    }
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const games = await searchService.searchGames(q.trim(), { limit, offset });
    res.json({ success: true, data: games });
  } catch (err) { next(err); }
});

/**
 * GET /teams — Search teams
 */
searchRouter.get('/teams', async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.json({ success: true, data: [] });
    }
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const teams = await searchService.searchTeams(q.trim(), {
      gameId: req.query.game_id,
      region: req.query.region,
      limit,
      offset,
    });
    res.json({ success: true, data: teams });
  } catch (err) { next(err); }
});

/**
 * GET /players — Search players (Security: Zero private fields)
 */
searchRouter.get('/players', async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.json({ success: true, data: [] });
    }
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const players = await searchService.searchPlayers(q.trim(), { limit, offset });
    res.json({ success: true, data: players });
  } catch (err) { next(err); }
});

/**
 * GET /tournaments — Search tournaments
 */
searchRouter.get('/tournaments', async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.json({ success: true, data: [] });
    }
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const tournaments = await searchService.searchTournaments(q.trim(), {
      gameId: req.query.game_id,
      status: req.query.status,
      limit,
      offset,
    });
    res.json({ success: true, data: tournaments });
  } catch (err) { next(err); }
});

/**
 * GET /seasons — Search seasons
 */
searchRouter.get('/seasons', async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.json({ success: true, data: [] });
    }
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const seasons = await searchService.searchSeasons(q.trim(), {
      gameId: req.query.game_id,
      status: req.query.status,
      limit,
      offset,
    });
    res.json({ success: true, data: seasons });
  } catch (err) { next(err); }
});
