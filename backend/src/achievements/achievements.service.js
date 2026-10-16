/**
 * Vexora Esports Tournament Platform — Achievements & Gamification Service
 *
 * Phase 32: Achievements, Gamification & Retention
 * PDF refs: Sections 41, 42
 *
 * Security Gate:
 * - Badges CANNOT be granted by client calls (server-only)
 * - Badges only awarded from verified, finalised results
 * - No pay-to-win items
 * - Responsible design: no dark patterns, self-exclusion tools
 */

import { query } from '../common/database.js';
import { logger } from '../common/logger.js';
import { appendAuditLog } from '../audit/audit.service.js';

// ─── Achievement Criteria Types (server-evaluated only) ─────────────────
export const CRITERIA_TYPES = [
  'tournaments_joined', 'matches_won', 'total_kills', 'fair_play_score_min',
  'matches_no_disputes', 'teams_joined', 'login_streak', 'match_played',
];

export class AchievementsService {

  // ═══════════════════════════════════════════════════════════════════════
  // 1. BADGE ENGINE — Server-only award (NEVER from client calls)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Evaluate and award eligible achievements for a user.
   * Called ONLY by server-side triggers after verified, finalised results.
   */
  static async evaluateAndAward(userId, context = {}) {
    const achievements = await query(
      `SELECT a.* FROM achievements a
       WHERE a.is_active = TRUE
         AND a.id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = $1)`,
      [userId]
    );

    const awarded = [];
    for (const ach of achievements.rows) {
      const met = await AchievementsService.checkCriteria(userId, ach, context);
      if (met) {
        const result = await AchievementsService.awardBadge(userId, ach.id, {
          sourceTournamentId: context.tournamentId || null,
          sourceMatchId: context.matchId || null,
          sourceSeasonId: context.seasonId || null,
          reason: `Criteria met: ${ach.criteria_type} >= ${ach.criteria_value}`,
        });
        if (result) awarded.push(result);
      }
    }

    if (awarded.length > 0) {
      logger.info('Achievements awarded', { userId, count: awarded.length, slugs: awarded.map(a => a.slug) });
    }
    return awarded;
  }

  /**
   * Check if a user meets the criteria for an achievement.
   */
  static async checkCriteria(userId, achievement, context = {}) {
    const { criteria_type, criteria_value } = achievement;

    switch (criteria_type) {
      case 'tournaments_joined': {
        const r = await query(
          `SELECT COUNT(*)::INT AS c FROM tournament_registrations
           WHERE user_id = $1 AND status IN ('CONFIRMED', 'CHECKED_IN')`,
          [userId]
        );
        return r.rows[0].c >= criteria_value;
      }
      case 'matches_won': {
        const r = await query(
          `SELECT COUNT(*)::INT AS c FROM match_participants
           WHERE user_id = $1 AND is_winner = TRUE`,
          [userId]
        );
        return r.rows[0].c >= criteria_value;
      }
      case 'total_kills': {
        const r = await query(
          `SELECT COALESCE(SUM(kills), 0)::INT AS c FROM match_participants WHERE user_id = $1`,
          [userId]
        );
        return r.rows[0].c >= criteria_value;
      }
      case 'fair_play_score_min': {
        const r = await query(
          `SELECT COALESCE(fair_play_score, 0) AS score FROM users WHERE id = $1`,
          [userId]
        );
        return r.rows.length > 0 && r.rows[0].score >= criteria_value;
      }
      case 'matches_no_disputes': {
        const r = await query(
          `SELECT COUNT(*)::INT AS c FROM match_participants mp
           WHERE mp.user_id = $1
             AND NOT EXISTS (
               SELECT 1 FROM disputes d WHERE d.match_id = mp.match_id AND d.reporter_id = $1
             )`,
          [userId]
        );
        return r.rows[0].c >= criteria_value;
      }
      case 'login_streak': {
        const streak = await AchievementsService.getUserStreak(userId, 'daily_login');
        return streak && streak.current_count >= criteria_value;
      }
      default:
        return false;
    }
  }

  /**
   * Award a badge to a user. Server-only — NEVER exposed to client API.
   */
  static async awardBadge(userId, achievementId, { sourceTournamentId, sourceMatchId, sourceSeasonId, reason }) {
    try {
      const result = await query(
        `INSERT INTO user_achievements
           (user_id, achievement_id, source_tournament_id, source_match_id, source_season_id, awarded_reason)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, achievement_id) DO NOTHING
         RETURNING *`,
        [userId, achievementId, sourceTournamentId, sourceMatchId, sourceSeasonId, reason]
      );

      if (result.rows.length === 0) return null;

      const ach = await query(`SELECT slug, title, xp_reward FROM achievements WHERE id = $1`, [achievementId]);

      await appendAuditLog({
        actor_id: 'SYSTEM',
        actor_role: 'SYSTEM',
        action: 'ACHIEVEMENT_AWARDED',
        resource_type: 'user_achievement',
        resource_id: result.rows[0].id,
        details: { userId, achievementSlug: ach.rows[0]?.slug, reason },
      });

      return { ...result.rows[0], slug: ach.rows[0]?.slug, title: ach.rows[0]?.title };
    } catch (err) {
      logger.error('Failed to award badge', { userId, achievementId, error: err.message });
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. USER ACHIEVEMENTS
  // ═══════════════════════════════════════════════════════════════════════

  static async getUserAchievements(userId) {
    const result = await query(
      `SELECT ua.id, ua.awarded_at, ua.source_tournament_id, ua.source_match_id,
              ua.is_displayed, ua.awarded_reason,
              a.slug, a.title, a.description, a.icon_url, a.category,
              a.rarity, a.xp_reward, a.criteria_type, a.criteria_value
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.id
       WHERE ua.user_id = $1
       ORDER BY ua.awarded_at DESC`,
      [userId]
    );
    return result.rows;
  }

  static async getAchievementCatalogue(category = null) {
    let sql = `SELECT * FROM achievements WHERE is_active = TRUE`;
    const params = [];
    if (category) { params.push(category); sql += ` AND category = $${params.length}`; }
    sql += ' ORDER BY sort_order, rarity, title';
    const result = await query(sql, params);
    return result.rows;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. MISSIONS
  // ═══════════════════════════════════════════════════════════════════════

  static async getActiveMissions(missionType = null) {
    let sql = `SELECT * FROM missions WHERE is_active = TRUE
               AND (starts_at IS NULL OR starts_at <= NOW())
               AND (expires_at IS NULL OR expires_at > NOW())`;
    const params = [];
    if (missionType) { params.push(missionType); sql += ` AND mission_type = $${params.length}`; }
    sql += ' ORDER BY mission_type, sort_order';
    const result = await query(sql, params);
    return result.rows;
  }

  static async getUserMissionProgress(userId) {
    const result = await query(
      `SELECT ump.*, m.slug, m.title, m.description, m.mission_type,
              m.target_action, m.target_count, m.xp_reward, m.category
       FROM user_mission_progress ump
       JOIN missions m ON ump.mission_id = m.id
       WHERE ump.user_id = $1 AND m.is_active = TRUE
       ORDER BY ump.is_completed, m.mission_type`,
      [userId]
    );
    return result.rows;
  }

  static async incrementMissionProgress(userId, actionType, count = 1) {
    const result = await query(
      `UPDATE user_mission_progress ump
       SET current_count = LEAST(current_count + $3, m.target_count),
           is_completed = CASE WHEN current_count + $3 >= m.target_count THEN TRUE ELSE FALSE END,
           completed_at = CASE WHEN current_count + $3 >= m.target_count THEN NOW() ELSE NULL END,
           updated_at = NOW()
       FROM missions m
       WHERE ump.mission_id = m.id
         AND ump.user_id = $1
         AND m.target_action = $2
         AND ump.is_completed = FALSE
       RETURNING ump.*, m.slug, m.title, m.xp_reward`,
      [userId, actionType, count]
    );
    return result.rows;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. STREAKS
  // ═══════════════════════════════════════════════════════════════════════

  static async getUserStreak(userId, streakSlug) {
    const result = await query(
      `SELECT us.*, s.slug, s.title, s.milestones, s.xp_per_day
       FROM user_streaks us
       JOIN streaks s ON us.streak_id = s.id
       WHERE us.user_id = $1 AND s.slug = $2`,
      [userId, streakSlug]
    );
    return result.rows[0] || null;
  }

  static async getUserStreaks(userId) {
    const result = await query(
      `SELECT us.*, s.slug, s.title, s.description, s.milestones, s.xp_per_day
       FROM user_streaks us
       JOIN streaks s ON us.streak_id = s.id
       WHERE us.user_id = $1 AND us.is_active = TRUE
       ORDER BY us.current_count DESC`,
      [userId]
    );
    return result.rows;
  }

  static async recordStreakAction(userId, actionType) {
    const streak = await query(
      `SELECT s.*, us.id AS user_streak_id, us.current_count, us.longest_count, us.last_action_at
       FROM streaks s
       LEFT JOIN user_streaks us ON us.streak_id = s.id AND us.user_id = $1
       WHERE s.action_type = $2 AND s.is_active = TRUE`,
      [userId, actionType]
    );

    if (streak.rows.length === 0) return null;
    const s = streak.rows[0];
    const now = new Date();
    const lastAction = s.last_action_at ? new Date(s.last_action_at) : null;
    const daysDiff = lastAction ? Math.floor((now - lastAction) / 86400000) : 999;

    if (s.user_streak_id) {
      const newCount = daysDiff <= 1 ? s.current_count + 1 : 1;
      const newLongest = Math.max(newCount, s.longest_count);

      await query(
        `UPDATE user_streaks SET current_count = $1, longest_count = $2, last_action_at = NOW(), updated_at = NOW()
         WHERE id = $3`,
        [newCount, newLongest, s.user_streak_id]
      );
      return { current: newCount, longest: newLongest, continued: daysDiff <= 1 };
    } else {
      await query(
        `INSERT INTO user_streaks (user_id, streak_id, current_count, longest_count, last_action_at)
         VALUES ($1, $2, 1, 1, NOW())`,
        [userId, s.id]
      );
      return { current: 1, longest: 1, continued: false };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. SEASON SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════════════

  static async getSeasonSnapshots(userId) {
    const result = await query(
      `SELECT ss.*, s.title AS season_title, g.title AS game_title
       FROM season_snapshots ss
       JOIN seasons s ON ss.season_id = s.id
       LEFT JOIN games g ON ss.game_id = g.id
       WHERE ss.user_id = $1
       ORDER BY ss.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. SELF-EXCLUSION / RESPONSIBLE GAMING
  // ═══════════════════════════════════════════════════════════════════════

  static async getSelfExclusionSettings(userId) {
    const result = await query(
      `SELECT * FROM self_exclusion_settings WHERE user_id = $1`, [userId]
    );
    return result.rows[0] || null;
  }

  static async updateSelfExclusionSettings(userId, settings) {
    const result = await query(
      `INSERT INTO self_exclusion_settings
         (user_id, daily_play_limit_minutes, weekly_play_limit_minutes,
          cooldown_between_tournaments_minutes, self_excluded_until, age_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id)
       DO UPDATE SET
         daily_play_limit_minutes = EXCLUDED.daily_play_limit_minutes,
         weekly_play_limit_minutes = EXCLUDED.weekly_play_limit_minutes,
         cooldown_between_tournaments_minutes = EXCLUDED.cooldown_between_tournaments_minutes,
         self_excluded_until = EXCLUDED.self_excluded_until,
         age_verified = EXCLUDED.age_verified,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        settings.dailyPlayLimitMinutes || null,
        settings.weeklyPlayLimitMinutes || null,
        settings.cooldownMinutes || null,
        settings.selfExcludedUntil || null,
        settings.ageVerified ?? false,
      ]
    );

    await appendAuditLog({
      actor_id: userId,
      actor_role: 'PLAYER',
      action: 'SELF_EXCLUSION_UPDATED',
      resource_type: 'self_exclusion',
      details: settings,
    });

    return result.rows[0];
  }
}

export default AchievementsService;
