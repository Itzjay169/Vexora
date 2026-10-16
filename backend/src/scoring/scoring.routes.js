import { Router } from 'express';
import { query } from '../common/database.js';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { AppError } from '../common/errorHandler.js';

export const scoringRouter = Router();

/**
 * Deterministic scoring engine.
 * Computes total points based on the scoring schema formula and raw match data.
 *
 * @param {Object} formula - Scoring formula from scoring_schemas.formula
 * @param {Object} rawScore - Raw match stats { placement, kills, assists, deaths, rounds_won }
 * @returns {number} Total calculated points
 */
export function calculateScore(formula, rawScore) {
  let total = 0;

  // Placement points
  if (formula.placement_points && rawScore.placement) {
    const placementStr = String(rawScore.placement);
    total += formula.placement_points[placementStr] || 0;
  }

  // Kill points
  if (formula.kill_points && rawScore.kills) {
    total += formula.kill_points * rawScore.kills;
  }

  // Assist points
  if (formula.assist_points && rawScore.assists) {
    total += formula.assist_points * rawScore.assists;
  }

  // Win bonus
  if (formula.win_points && rawScore.is_winner) {
    total += formula.win_points;
  }

  // Round wins (for FPS modes like S&D)
  if (formula.round_points && rawScore.rounds_won) {
    total += formula.round_points * rawScore.rounds_won;
  }

  return Math.floor(total); // ADR-015 Invariant: strict integer arithmetic (no fractional points)
}

// ─── POST /calculate — Calculate scores for a match ──────────────────
scoringRouter.post('/calculate', authenticate, async (req, res, next) => {
  try {
    const { match_id } = req.body;
    if (!match_id) throw new AppError('match_id required', 400);

    // Get match and tournament scoring schema
    const matchResult = await query(
      `SELECT m.id, m.tournament_id, t.scoring_schema_id
       FROM matches m JOIN tournaments t ON m.tournament_id = t.id
       WHERE m.id = $1`,
      [match_id]
    );
    if (matchResult.rows.length === 0) throw new AppError('Match not found', 404);

    const schema = await query(
      'SELECT formula FROM scoring_schemas WHERE id = $1',
      [matchResult.rows[0].scoring_schema_id]
    );
    if (schema.rows.length === 0) throw new AppError('Scoring schema not found', 404);

    const formula = schema.rows[0].formula;

    // Get participants
    const participants = await query(
      'SELECT * FROM match_participants WHERE match_id = $1',
      [match_id]
    );

    const scored = [];
    for (const p of participants.rows) {
      const rawScore = {
        placement: p.placement,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        is_winner: p.is_winner,
        ...(p.raw_score || {}),
      };

      const points = calculateScore(formula, rawScore);

      await query(
        'UPDATE match_participants SET calculated_points = $1 WHERE id = $2',
        [points, p.id]
      );

      scored.push({ ...p, calculated_points: points });
    }

    res.json({ success: true, data: scored });
  } catch (err) { next(err); }
});

// ─── GET /schemas/:gameId — Get scoring schemas for a game ──────────
scoringRouter.get('/schemas/:gameId', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM scoring_schemas WHERE game_id = $1 ORDER BY mode_slug, version',
      [req.params.gameId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});
