/**
 * Vexora Esports Tournament Platform - Tournament State Machine & Service
 * Phase 15: Safe, Validated Tournament Lifecycle & Versioned Rules Engine
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 4, 16, 39, 47)
 * Invariant: Canonical 11-State Sequence
 * Invariant: Organiser edits only own tournaments (Anti-IDOR)
 * Invariant: Server-time authority (client time is never trusted)
 * Invariant: Launch Principle - v1 is 100% FREE tournaments only
 * Invariant: Versioned, append-only tournament rules
 */

import { query, withTransaction } from '../common/database.js';
import { AppError } from '../common/errorHandler.js';
import { appendAuditLog, hashIP } from '../common/auditLog.js';

// ─── Canonical 11 Tournament States (Section 4) ─────────────────────────────
export const TOURNAMENT_STATES = [
  'DRAFT',
  'PENDING_REVIEW',
  'SCHEDULED',
  'REGISTRATION_OPEN',
  'CHECK_IN',
  'LIVE',
  'RESULT_PENDING',
  'DISPUTED',
  'COMPLETED',
  'SETTLED',
  'ARCHIVED',
];

// ─── Valid State Transitions Graph ──────────────────────────────────────────
export const VALID_TRANSITIONS = {
  DRAFT:                ['PENDING_REVIEW', 'ARCHIVED'],
  PENDING_REVIEW:       ['SCHEDULED', 'DRAFT', 'ARCHIVED'],
  SCHEDULED:            ['REGISTRATION_OPEN', 'ARCHIVED'],
  REGISTRATION_OPEN:    ['CHECK_IN', 'ARCHIVED'],
  CHECK_IN:             ['LIVE', 'ARCHIVED'],
  LIVE:                 ['RESULT_PENDING'],
  RESULT_PENDING:       ['COMPLETED', 'DISPUTED'],
  DISPUTED:             ['COMPLETED'],
  COMPLETED:            ['SETTLED'],
  SETTLED:              ['ARCHIVED'],
  ARCHIVED:             [],
};

/**
 * Check whether a status transition is permitted by the state machine
 */
export function canTransition(currentStatus, nextStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

/**
 * Generate URL-friendly slug
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36);
}

// ─── Tournament Service Class ───────────────────────────────────────────────
export class TournamentService {
  /**
   * Create a new tournament draft with initial Version 1 rules
   */
  static async createDraft(organiserId, data, idempotencyKey, ip = '127.0.0.1') {
    // 1. Launch principle: v1 Public Launch = 100% FREE tournaments only
    if (data.entry_fee_credits > 0 || data.prize_pool_credits > 0) {
      throw new AppError(
        'Real-money tournaments are disabled for v1 launch. Entry fee and cash prize pool must be 0.',
        400,
        'FREE_TOURNAMENTS_ONLY'
      );
    }

    // 2. Server-time authority: start_time must be strictly in the future
    const now = new Date();
    const startTime = new Date(data.start_time);
    if (startTime <= now) {
      throw new AppError(
        'Tournament start_time must be in the future (server time enforced).',
        400,
        'INVALID_SCHEDULE_PAST_START_TIME'
      );
    }

    // 3. Verify game exists
    const gameResult = await query('SELECT id, status FROM games WHERE id = $1', [data.game_id]);
    if (gameResult.rows.length === 0) {
      throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
    }
    if (gameResult.rows[0].status !== 'ACTIVE') {
      throw new AppError('Cannot create tournaments for inactive games', 400, 'GAME_INACTIVE');
    }

    const slug = generateSlug(data.title);

    return await withTransaction(async (client) => {
      // Insert into tournaments with rules_version = 1
      const tournamentResult = await client.query(
        `INSERT INTO tournaments (
          organiser_id, game_id, mode_id, scoring_schema_id, title, slug,
          description, rules_text, format, team_size, min_participants, max_participants,
          entry_fee_credits, prize_pool_credits, prize_text, prize_distribution,
          start_time, registration_open, registration_close, check_in_open, check_in_close,
          disconnect_policy, evidence_requirements, region, tags, banner_url,
          visibility, status, rules_version, idempotency_key
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26,
          $27, 'DRAFT', 1, $28
        ) RETURNING *`,
        [
          organiserId,
          data.game_id,
          data.mode_id || null,
          data.scoring_schema_id,
          data.title,
          slug,
          data.description || null,
          data.rules_text || null,
          data.format,
          data.team_size || 1,
          data.min_participants || 4,
          data.max_participants || 64,
          0, // entry_fee_credits
          0, // prize_pool_credits
          data.prize_text || 'Pride & Leaderboard Points',
          data.prize_distribution ? JSON.stringify(data.prize_distribution) : null,
          data.start_time,
          data.registration_open || null,
          data.registration_close || null,
          data.check_in_open || null,
          data.check_in_close || null,
          data.disconnect_policy || 'Standard disconnect rule applies.',
          JSON.stringify(data.evidence_requirements || {}),
          data.region || 'INDIA',
          data.tags || [],
          data.banner_url || null,
          data.visibility || 'PUBLIC',
          idempotencyKey || null,
        ]
      );

      const tournament = tournamentResult.rows[0];

      // Create initial Version 1 rules record
      const rulesResult = await client.query(
        `INSERT INTO tournament_rules (
          tournament_id, version, rule_json, rules_text, evidence_policy,
          disconnect_policy, tie_breaker_policy, change_summary, changed_by
        ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          tournament.id,
          JSON.stringify(data.rule_json || {}),
          data.rules_text || null,
          JSON.stringify(data.evidence_requirements || {}),
          data.disconnect_policy || 'Standard disconnect rule applies.',
          JSON.stringify(data.tie_breaker_policy || {}),
          'Initial tournament rules version 1',
          organiserId,
        ]
      );

      // Audit log the creation
      await appendAuditLog({
        actorId: organiserId,
        actorRole: 'ORGANISER',
        action: 'TOURNAMENT_CREATED',
        entityType: 'tournament',
        entityId: tournament.id,
        payload: {
          title: tournament.title,
          format: tournament.format,
          status: 'DRAFT',
          rules_version: 1,
        },
        ipHash: hashIP(ip),
      });

      return {
        ...tournament,
        rules: rulesResult.rows[0],
      };
    });
  }

  /**
   * Update a tournament draft (allowed only in DRAFT or PENDING_REVIEW)
   */
  static async updateDraft(tournamentId, userId, userRole, updateData, ip = '127.0.0.1') {
    const existing = await query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    if (existing.rows.length === 0) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const t = existing.rows[0];

    // Anti-IDOR: only organiser or admin can edit
    const isOwner = t.organiser_id === userId;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
    if (!isOwner && !isAdmin) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    // Must be in editable status
    if (!['DRAFT', 'PENDING_REVIEW'].includes(t.status)) {
      throw new AppError(
        `Cannot edit draft fields in '${t.status}' state. Post-publish changes require versioned rules update.`,
        400,
        'TOURNAMENT_NOT_EDITABLE'
      );
    }

    // Schedule validation if start_time updated
    if (updateData.start_time) {
      const now = new Date();
      if (new Date(updateData.start_time) <= now) {
        throw new AppError('start_time must be in the future', 400, 'INVALID_SCHEDULE');
      }
    }

    const fields = [];
    const values = [];
    let idx = 1;

    const allowedFields = [
      'title', 'description', 'rules_text', 'min_participants', 'max_participants',
      'start_time', 'registration_open', 'registration_close', 'check_in_open',
      'check_in_close', 'prize_text', 'region', 'tags', 'banner_url', 'visibility'
    ];

    for (const key of allowedFields) {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(updateData[key]);
      }
    }

    if (fields.length === 0) {
      return t;
    }

    values.push(tournamentId);
    const updateQuery = `
      UPDATE tournaments
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${idx}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    await appendAuditLog({
      actorId: userId,
      actorRole: userRole,
      action: 'TOURNAMENT_DRAFT_UPDATED',
      entityType: 'tournament',
      entityId: tournamentId,
      payload: { changedFields: Object.keys(updateData) },
      ipHash: hashIP(ip),
    });

    return result.rows[0];
  }

  /**
   * Versioned tournament rules update (Section 4 & 47)
   * Post-publish modifications require incrementing version and mandatory audit summary.
   */
  static async updateRules(tournamentId, userId, userRole, rulesData, ip = '127.0.0.1') {
    const existing = await query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    if (existing.rows.length === 0) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const t = existing.rows[0];

    // Anti-IDOR check
    const isOwner = t.organiser_id === userId;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
    if (!isOwner && !isAdmin) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    // Terminal states cannot be edited
    if (['COMPLETED', 'SETTLED', 'ARCHIVED'].includes(t.status)) {
      throw new AppError(
        `Cannot update rules for tournament in final state '${t.status}'.`,
        400,
        'CANNOT_UPDATE_RULES_IN_FINAL_STATE'
      );
    }

    if (!rulesData.change_summary || rulesData.change_summary.trim().length < 5) {
      throw new AppError(
        'A descriptive change_summary (at least 5 characters) is required when updating rules.',
        400,
        'RULE_CHANGE_SUMMARY_REQUIRED'
      );
    }

    return await withTransaction(async (client) => {
      const nextVersion = t.rules_version + 1;

      // Insert new version into append-only tournament_rules table
      const newRuleResult = await client.query(
        `INSERT INTO tournament_rules (
          tournament_id, version, rule_json, rules_text, evidence_policy,
          disconnect_policy, tie_breaker_policy, change_summary, changed_by, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *`,
        [
          tournamentId,
          nextVersion,
          JSON.stringify(rulesData.rule_json || {}),
          rulesData.rules_text || t.rules_text,
          JSON.stringify(rulesData.evidence_policy || t.evidence_requirements || {}),
          rulesData.disconnect_policy || t.disconnect_policy,
          JSON.stringify(rulesData.tie_breaker_policy || {}),
          rulesData.change_summary,
          userId,
        ]
      );

      // Update tournament rules_version and rules_text
      await client.query(
        `UPDATE tournaments
         SET rules_version = $1, rules_text = $2, updated_at = NOW()
         WHERE id = $3`,
        [nextVersion, rulesData.rules_text || t.rules_text, tournamentId]
      );

      // Audit log the version increment
      await appendAuditLog({
        actorId: userId,
        actorRole: userRole,
        action: 'TOURNAMENT_RULES_VERSION_INCREMENTED',
        entityType: 'tournament',
        entityId: tournamentId,
        payload: {
          previousVersion: t.rules_version,
          newVersion: nextVersion,
          changeSummary: rulesData.change_summary,
        },
        ipHash: hashIP(ip),
      });

      return newRuleResult.rows[0];
    });
  }

  /**
   * Transition tournament status according to the 11-state state machine
   */
  static async transitionStatus(tournamentId, newStatus, actorId, actorRole, options = {}, ip = '127.0.0.1') {
    const existing = await query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    if (existing.rows.length === 0) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const t = existing.rows[0];
    const currentStatus = t.status;

    // 1. Validate state transition in state machine graph
    if (!canTransition(currentStatus, newStatus)) {
      throw new AppError(
        `Invalid state transition: '${currentStatus}' -> '${newStatus}'.`,
        400,
        'INVALID_STATE_TRANSITION'
      );
    }

    // 2. Authorization checks per transition
    const isOwner = t.organiser_id === actorId;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(actorRole);
    const isModerator = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(actorRole);

    if (newStatus === 'PENDING_REVIEW') {
      if (!isOwner && !isAdmin) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }
    } else if (newStatus === 'SCHEDULED') {
      // Only Admin review queue can approve a tournament from PENDING_REVIEW to SCHEDULED
      if (!isAdmin) {
        throw new AppError(
          'Admin approval required to transition tournament from PENDING_REVIEW to SCHEDULED.',
          403,
          'ADMIN_APPROVAL_REQUIRED'
        );
      }
    } else if (newStatus === 'DISPUTED') {
      if (!isModerator && !isOwner) {
        throw new AppError('Not authorized to move tournament to DISPUTED.', 403, 'FORBIDDEN');
      }
    } else if (newStatus === 'COMPLETED' && currentStatus === 'DISPUTED') {
      // Resolving dispute requires Moderator or Admin
      if (!isModerator) {
        throw new AppError('Moderator or Admin resolution required to clear DISPUTED status.', 403, 'FORBIDDEN');
      }
    } else {
      // General transitions: Owner or Admin
      if (!isOwner && !isAdmin) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }
    }

    // 3. Server-time authority checks
    const now = new Date();
    if (newStatus === 'REGISTRATION_OPEN' && t.registration_open) {
      if (new Date(t.registration_open) > now) {
        throw new AppError(
          `Cannot open registration before server time reaches registration_open (${t.registration_open}).`,
          400,
          'REGISTRATION_NOT_YET_OPEN'
        );
      }
    }

    if (newStatus === 'CHECK_IN' && t.check_in_open) {
      if (new Date(t.check_in_open) > now) {
        throw new AppError(
          `Cannot open check-in before server time reaches check_in_open (${t.check_in_open}).`,
          400,
          'CHECK_IN_NOT_YET_OPEN'
        );
      }
    }

    const reason = options.reason || null;

    const result = await query(
      `UPDATE tournaments
       SET status = $1, last_status_change_at = NOW(), status_reason = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newStatus, reason, tournamentId]
    );

    // Audit log the status transition
    await appendAuditLog({
      actorId,
      actorRole,
      action: 'TOURNAMENT_STATUS_CHANGED',
      entityType: 'tournament',
      entityId: tournamentId,
      payload: {
        from: currentStatus,
        to: newStatus,
        reason,
      },
      ipHash: hashIP(ip),
    });

    return result.rows[0];
  }

  /**
   * Get single tournament with game details, organiser profile, and current rules
   */
  static async getById(tournamentId) {
    const result = await query(
      `SELECT t.*,
              g.name AS game_name, g.slug AS game_slug, g.icon_url AS game_icon,
              gm.name AS mode_name, gm.format AS mode_format,
              u.username AS organiser_username, u.display_name AS organiser_display_name,
              op.tier AS organiser_tier, op.trust_score, op.total_tournaments, op.completed_tournaments,
              tr.rule_json, tr.rules_text AS active_rules_text, tr.evidence_policy,
              tr.disconnect_policy AS active_disconnect_policy, tr.tie_breaker_policy,
              tr.published_at AS rules_published_at
       FROM tournaments t
       JOIN games g ON t.game_id = g.id
       LEFT JOIN game_modes gm ON t.mode_id = gm.id
       JOIN users u ON t.organiser_id = u.id
       LEFT JOIN organiser_profiles op ON op.user_id = u.id
       LEFT JOIN tournament_rules tr ON tr.tournament_id = t.id AND tr.version = t.rules_version
       WHERE t.id = $1`,
      [tournamentId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    return result.rows[0];
  }

  /**
   * Get complete historical version log for tournament rules (transparency requirement)
   */
  static async getRulesHistory(tournamentId) {
    const tournamentCheck = await query('SELECT id FROM tournaments WHERE id = $1', [tournamentId]);
    if (tournamentCheck.rows.length === 0) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const result = await query(
      `SELECT tr.*, u.username AS changed_by_username
       FROM tournament_rules tr
       LEFT JOIN users u ON tr.changed_by = u.id
       WHERE tr.tournament_id = $1
       ORDER BY tr.version ASC`,
      [tournamentId]
    );

    return result.rows;
  }

  /**
   * Discover and list tournaments with filtering and pagination
   */
  static async listTournaments(filters = {}) {
    const {
      game_id,
      status,
      format,
      region,
      organiser_id,
      limit = 20,
      offset = 0,
    } = filters;

    const conditions = ["t.visibility = 'PUBLIC'"];
    const params = [];
    let idx = 1;

    if (game_id) {
      conditions.push(`t.game_id = $${idx++}`);
      params.push(game_id);
    }
    if (status) {
      conditions.push(`t.status = $${idx++}`);
      params.push(status);
    }
    if (format) {
      conditions.push(`t.format = $${idx++}`);
      params.push(format);
    }
    if (region) {
      conditions.push(`t.region = $${idx++}`);
      params.push(region);
    }
    if (organiser_id) {
      conditions.push(`t.organiser_id = $${idx++}`);
      params.push(organiser_id);
    }

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

    params.push(safeLimit, safeOffset);

    const result = await query(
      `SELECT t.*,
              g.name AS game_name, g.slug AS game_slug, g.icon_url AS game_icon,
              u.username AS organiser_username, u.display_name AS organiser_name,
              op.tier AS organiser_tier, op.trust_score
       FROM tournaments t
       JOIN games g ON t.game_id = g.id
       JOIN users u ON t.organiser_id = u.id
       LEFT JOIN organiser_profiles op ON op.user_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.is_featured DESC, t.start_time ASC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    return result.rows;
  }
}
