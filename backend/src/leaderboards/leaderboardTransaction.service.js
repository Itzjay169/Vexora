// ============================================================================
// Vexora Single-Transaction Scoring & Leaderboard Engine
// Specifications: Blueprint Section 5, 7, 16, 39; ADR-002, ADR-015
// ============================================================================

import { query, withTransaction } from '../common/database.js';
import { AppError } from '../common/errorHandler.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { cacheGet, cacheSet, cacheInvalidatePrefix } from '../common/cache.js';
import {
  calculateScore,
  calculateFormulaScore,
  calculateCodmScore,
  sortStandings,
  computeStandingsDigest,
  reproduceMatchScore,
} from '@vexora/scoring-engine';

/**
 * Single Database Transaction: Process Match Result -> Update Season Stats ->
 * Deterministic Leaderboard Standings -> Snapshot -> Cache Invalidation.
 *
 * Guaranteed atomic: All steps commit together, or all roll back.
 *
 * @param {Object} params
 * @param {string} params.matchId
 * @param {string} [params.seasonId]
 * @param {boolean} [params.forceRecalculate=false]
 * @param {Object} [params.actor]
 * @param {import('pg').PoolClient} [params.client]
 * @returns {Promise<Object>} Leaderboard processing outcome
 */
export async function processMatchResult({
  matchId,
  seasonId = null,
  forceRecalculate = false,
  actor = null,
  client = null,
}) {
  const runner = async (tx) => {
    // 1. Fetch match details, tournament, and scoring schema
    const matchRes = await tx.query(
      `SELECT m.id, m.tournament_id, m.status AS match_status, m.round,
              t.game_id, t.scoring_schema_id, g.slug AS game_slug, g.name AS game_name,
              t.season_id AS tournament_season_id
       FROM matches m
       JOIN tournaments t ON m.tournament_id = t.id
       JOIN games g ON t.game_id = g.id
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchRes.rows.length === 0) {
      throw new AppError('Match not found', 404);
    }

    const match = matchRes.rows[0];

    // Determine target season: explicit param > tournament season > active game season
    let targetSeasonId = seasonId || match.tournament_season_id;
    if (!targetSeasonId) {
      const seasonRes = await tx.query(
        `SELECT id FROM seasons WHERE game_id = $1 AND is_active = TRUE LIMIT 1`,
        [match.game_id]
      );
      if (seasonRes.rows.length > 0) {
        targetSeasonId = seasonRes.rows[0].id;
      }
    }

    // 2. Fetch formula from scoring schema
    let formula = null;
    if (match.scoring_schema_id) {
      const schemaRes = await tx.query(
        `SELECT formula FROM scoring_schemas WHERE id = $1`,
        [match.scoring_schema_id]
      );
      if (schemaRes.rows.length > 0) {
        formula = schemaRes.rows[0].formula;
      }
    }

    // 3. Fetch match participants and scores
    const participantsRes = await tx.query(
      `SELECT mp.id, mp.match_id, mp.registration_id, mp.placement, mp.kills,
              mp.deaths, mp.assists, mp.is_winner, mp.calculated_points, mp.raw_score,
              tr.participant_type, tr.user_id, tr.team_id
       FROM match_participants mp
       LEFT JOIN tournament_registrations tr ON mp.registration_id = tr.id
       WHERE mp.match_id = $1`,
      [matchId]
    );

    if (participantsRes.rows.length === 0) {
      throw new AppError('No participants found for this match', 400);
    }

    const scoredParticipants = [];

    // 4. Calculate deterministic scores using @vexora/scoring-engine
    for (const p of participantsRes.rows) {
      let score;
      const rawInput = {
        placement: p.placement,
        kills: p.kills || 0,
        deaths: p.deaths || 0,
        assists: p.assists || 0,
        is_winner: Boolean(p.is_winner),
        ...(p.raw_score || {}),
      };

      if (formula && typeof formula === 'object') {
        score = calculateFormulaScore(formula, rawInput);
      } else if (match.game_slug === 'freefire') {
        score = calculateScore('freefire', { placement: p.placement || 99, kills: p.kills || 0 });
      } else if (match.game_slug === 'codm') {
        score = calculateCodmScore({
          is_winner: Boolean(p.is_winner),
          rounds_won: rawInput.rounds_won,
          rounds_lost: rawInput.rounds_lost,
          score: rawInput.score,
          kills: rawInput.kills,
        });
      } else {
        score = calculateScore('bgmi', { placement: p.placement || 99, kills: p.kills || 0 });
      }

      // Update match_participant with calculated points
      await tx.query(
        `UPDATE match_participants
         SET calculated_points = $1
         WHERE id = $2`,
        [score.totalPoints, p.id]
      );

      scoredParticipants.push({
        ...p,
        placementPoints: score.placementPoints,
        killPoints: score.killPoints,
        bonusPoints: score.bonusPoints,
        totalPoints: score.totalPoints,
      });

      // 5. If season exists and participant is a user, update season_stats
      const userId = p.user_id;
      if (targetSeasonId && userId) {
        const isWinner = p.placement === 1 || Boolean(p.is_winner);
        const isPodium = (p.placement && p.placement <= 3) || isWinner;
        const kills = Math.max(0, p.kills || 0);
        const placementPts = score.placementPoints;
        const killPts = score.killPoints;
        const totalPts = score.totalPoints;
        const placementVal = p.placement || 10;

        await tx.query(
          `INSERT INTO season_stats (
             season_id, game_id, user_id, matches_played, wins, podiums,
             total_kills, total_placement_points, total_kill_points, total_points,
             average_placement, win_rate, updated_at
           )
           VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
           ON CONFLICT (season_id, user_id) DO UPDATE SET
             matches_played = season_stats.matches_played + 1,
             wins = season_stats.wins + EXCLUDED.wins,
             podiums = season_stats.podiums + EXCLUDED.podiums,
             total_kills = season_stats.total_kills + EXCLUDED.total_kills,
             total_placement_points = season_stats.total_placement_points + EXCLUDED.total_placement_points,
             total_kill_points = season_stats.total_kill_points + EXCLUDED.total_kill_points,
             total_points = season_stats.total_points + EXCLUDED.total_points,
             average_placement = ROUND(
               ((season_stats.average_placement * season_stats.matches_played) + EXCLUDED.average_placement) /
               (season_stats.matches_played + 1), 2
             ),
             win_rate = ROUND(
               ((season_stats.wins + EXCLUDED.wins)::numeric / (season_stats.matches_played + 1)::numeric) * 100, 2
             ),
             updated_at = NOW()`,
          [
            targetSeasonId,
            match.game_id,
            userId,
            isWinner ? 1 : 0,
            isPodium ? 1 : 0,
            kills,
            placementPts,
            killPts,
            totalPts,
            placementVal,
            isWinner ? 100.00 : 0.00,
          ]
        );
      }
    }

    // 6. Recalculate deterministic season leaderboard
    let updatedStandings = [];
    if (targetSeasonId) {
      const seasonStatsRes = await tx.query(
        `SELECT ss.user_id, ss.total_points AS "totalPoints",
                ss.total_placement_points AS "placementPoints",
                ss.total_kill_points AS "killPoints",
                ss.total_kills AS kills,
                ss.wins AS first_place_finishes,
                ss.matches_played,
                ss.win_rate,
                ss.average_placement,
                u.username, u.display_name, u.avatar_url
         FROM season_stats ss
         JOIN users u ON ss.user_id = u.id
         WHERE ss.season_id = $1`,
        [targetSeasonId]
      );

      // Sort deterministically with ADR-015 game-specific tie-breakers
      updatedStandings = sortStandings(seasonStatsRes.rows, match.game_slug);

      // Upsert into leaderboard_entries
      for (const entry of updatedStandings) {
        await tx.query(
          `INSERT INTO leaderboard_entries (
             game_id, season_id, participant_id, participant_type,
             rank_position, total_points, placement_points, kill_points,
             bonus_points, kills, matches_played, wins, win_rate,
             average_placement, first_place_finishes, updated_at
           )
           VALUES ($1, $2, $3, 'USER', $4, $5, $6, $7, 0, $8, $9, $10, $11, $12, $13, NOW())
           ON CONFLICT (game_id, season_id, participant_id) DO UPDATE SET
             rank_position = EXCLUDED.rank_position,
             total_points = EXCLUDED.total_points,
             placement_points = EXCLUDED.placement_points,
             kill_points = EXCLUDED.kill_points,
             kills = EXCLUDED.kills,
             matches_played = EXCLUDED.matches_played,
             wins = EXCLUDED.wins,
             win_rate = EXCLUDED.win_rate,
             average_placement = EXCLUDED.average_placement,
             first_place_finishes = EXCLUDED.first_place_finishes,
             updated_at = NOW()`,
          [
            match.game_id,
            targetSeasonId,
            entry.user_id,
            entry.rank,
            entry.totalPoints,
            entry.placementPoints,
            entry.killPoints,
            entry.kills,
            entry.matches_played,
            entry.first_place_finishes,
            entry.win_rate,
            entry.average_placement,
            entry.first_place_finishes,
          ]
        );

        // Update rank in season_stats
        await tx.query(
          `UPDATE season_stats
           SET current_rank = $1,
               highest_rank = CASE WHEN highest_rank = 0 OR $1 < highest_rank THEN $1 ELSE highest_rank END
           WHERE season_id = $2 AND user_id = $3`,
          [entry.rank, targetSeasonId, entry.user_id]
        );
      }

      // 7. Create immutable historical snapshot with SHA-256 Merkle root
      const merkleRoot = computeStandingsDigest(updatedStandings);
      await tx.query(
        `INSERT INTO leaderboard_snapshots (
           game_id, season_id, snapshot_type, total_participants, rankings_payload, merkle_root
         )
         VALUES ($1, $2, 'POST_MATCH', $3, $4, $5)`,
        [
          match.game_id,
          targetSeasonId,
          updatedStandings.length,
          JSON.stringify(updatedStandings.slice(0, 50)), // Top 50 snapshot
          merkleRoot,
        ]
      );
    }

    // 8. Append audit log in the same transaction
    await appendAuditLog({
      actorId: actor?.id || null,
      actorRole: actor?.role || 'SYSTEM',
      action: 'MATCH_RESULT_PROCESSED_TO_LEADERBOARD',
      entityType: 'MATCH',
      entityId: matchId,
      payload: {
        gameId: match.game_id,
        gameSlug: match.game_slug,
        seasonId: targetSeasonId,
        participantsCount: scoredParticipants.length,
        topRankId: updatedStandings[0]?.user_id || null,
      },
      client: tx,
    });

    return {
      matchId,
      gameId: match.game_id,
      gameSlug: match.game_slug,
      seasonId: targetSeasonId,
      participantsScored: scoredParticipants.length,
      standingsCount: updatedStandings.length,
      topStandings: updatedStandings.slice(0, 10),
    };
  };

  // Execute in single transaction
  let outcome;
  if (client) {
    outcome = await runner(client);
  } else {
    outcome = await withTransaction(runner);
  }

  // Post-commit: invalidate Redis cache for this game and season
  if (outcome.gameId) {
    await cacheInvalidatePrefix(`vexora:leaderboard:${outcome.gameId}`);
    await cacheInvalidatePrefix(`vexora:leaderboard:slug:${outcome.gameSlug}`);
  }

  return outcome;
}

/**
 * Get Leaderboard with Redis Caching and In-Memory Fallback
 */
export async function getLeaderboard({
  gameId = null,
  gameSlug = null,
  seasonId = null,
  timeframe = 'SEASON',
  participantType = 'USER',
  limit = 50,
  cursor = null,
}) {
  const cacheKey = `vexora:leaderboard:${gameId || gameSlug}:${seasonId || 'active'}:${timeframe}:${limit}`;
  const cached = await cacheGet(cacheKey);
  if (cached && !cursor) {
    return { ...cached, fromCache: true };
  }

  // Resolve gameId if gameSlug was provided
  let resolvedGameId = gameId;
  let resolvedGameSlug = gameSlug;
  if (!resolvedGameId && gameSlug) {
    const gameRes = await query(`SELECT id, slug, name FROM games WHERE slug = $1`, [gameSlug]);
    if (gameRes.rows.length === 0) {
      throw new AppError('Game not found', 404);
    }
    resolvedGameId = gameRes.rows[0].id;
    resolvedGameSlug = gameRes.rows[0].slug;
  }

  // Resolve active season if not specified
  let resolvedSeasonId = seasonId;
  if (!resolvedSeasonId && resolvedGameId) {
    const seasonRes = await query(
      `SELECT id, name, slug FROM seasons WHERE game_id = $1 AND is_active = TRUE LIMIT 1`,
      [resolvedGameId]
    );
    if (seasonRes.rows.length > 0) {
      resolvedSeasonId = seasonRes.rows[0].id;
    }
  }

  let whereClause = 'WHERE 1=1';
  const params = [];
  let paramIdx = 0;

  if (resolvedGameId) {
    paramIdx++;
    params.push(resolvedGameId);
    whereClause += ` AND lb.game_id = $${paramIdx}`;
  }

  if (resolvedSeasonId) {
    paramIdx++;
    params.push(resolvedSeasonId);
    whereClause += ` AND lb.season_id = $${paramIdx}`;
  }

  paramIdx++;
  params.push(participantType);
  whereClause += ` AND lb.participant_type = $${paramIdx}`;

  if (cursor) {
    paramIdx++;
    params.push(parseInt(cursor, 10));
    whereClause += ` AND lb.rank_position > $${paramIdx}`;
  }

  paramIdx++;
  params.push(limit + 1);

  const sql = `
    SELECT lb.id, lb.game_id, lb.season_id, lb.participant_id, lb.participant_type,
           lb.rank_position, lb.total_points, lb.placement_points, lb.kill_points,
           lb.bonus_points, lb.kills, lb.matches_played, lb.wins, lb.win_rate,
           lb.average_placement, lb.first_place_finishes, lb.updated_at,
           g.name AS game_name, g.slug AS game_slug,
           s.name AS season_name,
           u.username, u.display_name, u.avatar_url
    FROM leaderboard_entries lb
    JOIN games g ON lb.game_id = g.id
    LEFT JOIN seasons s ON lb.season_id = s.id
    LEFT JOIN users u ON lb.participant_id = u.id AND lb.participant_type = 'USER'
    ${whereClause}
    ORDER BY lb.rank_position ASC, lb.total_points DESC
    LIMIT $${paramIdx}
  `;

  const result = await query(sql, params);
  const rows = result.rows;
  const hasMore = rows.length > limit;
  const entries = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? entries[entries.length - 1].rank_position : null;

  const podium = entries.slice(0, 3);

  const responsePayload = {
    gameId: resolvedGameId,
    gameSlug: resolvedGameSlug,
    seasonId: resolvedSeasonId,
    totalEntries: entries.length,
    podium,
    entries,
    nextCursor,
    fromCache: false,
  };

  // Cache top results for 60s
  if (!cursor && entries.length > 0) {
    await cacheSet(cacheKey, responsePayload, 60);
  }

  return responsePayload;
}

/**
 * Get User's Rank Across All Games and Active Seasons
 */
export async function getUserRanks(userId) {
  const sql = `
    SELECT lb.id, lb.game_id, lb.season_id, lb.rank_position, lb.total_points,
           lb.placement_points, lb.kill_points, lb.kills, lb.matches_played,
           lb.wins, lb.win_rate, lb.average_placement,
           g.name AS game_name, g.slug AS game_slug,
           s.name AS season_name, s.slug AS season_slug
    FROM leaderboard_entries lb
    JOIN games g ON lb.game_id = g.id
    LEFT JOIN seasons s ON lb.season_id = s.id
    WHERE lb.participant_id = $1 AND lb.participant_type = 'USER'
    ORDER BY lb.rank_position ASC
  `;

  const result = await query(sql, [userId]);
  return result.rows;
}

/**
 * Get Historical Leaderboard Snapshots (Immutable Audit Record)
 */
export async function getSnapshots(gameId, seasonId = null, limit = 20) {
  let where = 'WHERE game_id = $1';
  const params = [gameId];
  if (seasonId) {
    params.push(seasonId);
    where += ` AND season_id = $2`;
  }
  params.push(limit);

  const sql = `
    SELECT id, game_id, season_id, snapshot_type, snapshot_date,
           total_participants, rankings_payload, merkle_root, created_at
    FROM leaderboard_snapshots
    ${where}
    ORDER BY created_at DESC
    LIMIT $${params.length}
  `;

  const result = await query(sql, params);
  return result.rows;
}

/**
 * Create Manual Leaderboard Snapshot (Daily/Weekly/Season-End)
 */
export async function createManualSnapshot({
  gameId,
  seasonId = null,
  snapshotType = 'DAILY',
  notes = '',
  actor = null,
}) {
  const standingsRes = await query(
    `SELECT lb.participant_id AS user_id, lb.rank_position AS rank,
            lb.total_points AS "totalPoints", lb.placement_points AS "placementPoints",
            lb.kill_points AS "killPoints", lb.kills, lb.wins AS first_place_finishes,
            u.username, u.display_name
     FROM leaderboard_entries lb
     JOIN users u ON lb.participant_id = u.id
     WHERE lb.game_id = $1 AND ($2::uuid IS NULL OR lb.season_id = $2)
     ORDER BY lb.rank_position ASC
     LIMIT 100`,
    [gameId, seasonId]
  );

  const standings = standingsRes.rows;
  const merkleRoot = computeStandingsDigest(standings);

  const insertRes = await query(
    `INSERT INTO leaderboard_snapshots (
       game_id, season_id, snapshot_type, total_participants, rankings_payload, merkle_root
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, game_id, season_id, snapshot_type, snapshot_date, total_participants, merkle_root, created_at`,
    [
      gameId,
      seasonId,
      snapshotType,
      standings.length,
      JSON.stringify(standings),
      merkleRoot,
    ]
  );

  await appendAuditLog({
    actorId: actor?.id || null,
    actorRole: actor?.role || 'ADMIN',
    action: 'LEADERBOARD_SNAPSHOT_CREATED',
    entityType: 'LEADERBOARD_SNAPSHOT',
    entityId: insertRes.rows[0].id,
    payload: { gameId, seasonId, snapshotType, notes, merkleRoot },
  });

  return insertRes.rows[0];
}
