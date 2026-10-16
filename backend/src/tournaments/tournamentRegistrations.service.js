/**
 * Vexora Esports Tournament Platform - Registration & Discovery Service
 * Phase 16: Discovery & Registration with Concurrency Safety (Last-Slot Race)
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 3, 4, 26, 39)
 * Invariant: Concurrency Safety via SERIALIZABLE / FOR UPDATE row locks
 * Invariant: Last-Slot Race — exactly N winners for N slots; loser is waitlisted, not charged
 * Invariant: Zero slot collisions (uq_tourn_slot_active)
 * Invariant: Zero double registrations per user or per team
 * Invariant: Auto-promotion from waitlist on confirmed participant cancellation
 * Invariant: Server-time authority for registration and check-in windows
 * Invariant: Anti-bot rate limiting on registration mutations
 */

import { query, withTransaction } from '../common/database.js';
import { AppError } from '../common/errorHandler.js';
import { appendAuditLog, hashIP } from '../common/auditLog.js';

// Anti-bot rate limiting in-memory store (5 registrations per minute per user)
const registrationRateLimits = new Map();

export function checkRegistrationRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxAttempts = 5;

  const timestamps = registrationRateLimits.get(userId) || [];
  const validTimestamps = timestamps.filter(t => now - t < windowMs);

  if (validTimestamps.length >= maxAttempts) {
    throw new AppError(
      'Too many registration attempts. Please wait before trying again.',
      429,
      'REGISTRATION_RATE_LIMITED'
    );
  }

  validTimestamps.push(now);
  registrationRateLimits.set(userId, validTimestamps);
}

export class TournamentRegistrationService {
  /**
   * Register a player (Solo) or a team for a tournament with concurrency safety
   * Uses SELECT ... FOR UPDATE to serialize last-slot race conditions
   */
  static async registerParticipant(
    tournamentId,
    userId,
    userRole,
    payload,
    idempotencyKey = null,
    ip = '127.0.0.1'
  ) {
    checkRegistrationRateLimit(userId);

    return await withTransaction(async (client) => {
      // 1. Lock tournament row for concurrency safety (Last-Slot Race)
      const tournRes = await client.query(
        `SELECT id, title, slug, status, format, min_participants, max_participants,
                team_size, registration_open, registration_close, check_in_open,
                entry_fee_credits, rules_version
         FROM tournaments
         WHERE id = $1
         FOR UPDATE`,
        [tournamentId]
      );

      if (tournRes.rows.length === 0) {
        throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
      }

      const t = tournRes.rows[0];

      // 2. Lifecycle status check: must be REGISTRATION_OPEN
      if (t.status !== 'REGISTRATION_OPEN') {
        throw new AppError(
          `Cannot register for tournament in '${t.status}' state. Registrations must be open.`,
          400,
          'REGISTRATION_NOT_OPEN'
        );
      }

      // 3. Server-time authority check (client clock is never trusted)
      const now = new Date();
      if (t.registration_open && new Date(t.registration_open) > now) {
        throw new AppError(
          `Registration does not open until ${t.registration_open}.`,
          400,
          'REGISTRATION_NOT_YET_OPEN'
        );
      }
      if (t.registration_close && new Date(t.registration_close) < now) {
        throw new AppError(
          `Registration closed at ${t.registration_close}.`,
          400,
          'REGISTRATION_CLOSED'
        );
      }

      const isTeam = payload.participant_type === 'TEAM';
      const teamId = isTeam ? payload.team_id : null;

      // 4. Check for duplicate registration for this user
      const existingUserReg = await client.query(
        `SELECT id, status, slot_number, waitlist_position
         FROM tournament_registrations
         WHERE tournament_id = $1 AND user_id = $2
           AND status IN ('CONFIRMED', 'WAITLISTED', 'CHECKED_IN')`,
        [tournamentId, userId]
      );

      if (existingUserReg.rows.length > 0) {
        throw new AppError(
          'User is already registered for this tournament.',
          409,
          'ALREADY_REGISTERED'
        );
      }

      // 5. Team validation if team registration
      if (isTeam) {
        if (!teamId) {
          throw new AppError('team_id is required for team registration.', 400, 'TEAM_ID_REQUIRED');
        }

        const existingTeamReg = await client.query(
          `SELECT id, status
           FROM tournament_registrations
           WHERE tournament_id = $1 AND team_id = $2
             AND status IN ('CONFIRMED', 'WAITLISTED', 'CHECKED_IN')`,
          [tournamentId, teamId]
        );

        if (existingTeamReg.rows.length > 0) {
          throw new AppError(
            'This team is already registered for this tournament.',
            409,
            'TEAM_ALREADY_REGISTERED'
          );
        }
      }

      // 6. Capacity Calculation & Last-Slot Race Resolution
      const countRes = await client.query(
        `SELECT COUNT(*)::int AS confirmed_count
         FROM tournament_registrations
         WHERE tournament_id = $1 AND status IN ('CONFIRMED', 'CHECKED_IN')`,
        [tournamentId]
      );
      const confirmedCount = countRes.rows[0].confirmed_count;

      let assignedStatus = 'CONFIRMED';
      let assignedSlot = null;
      let assignedWaitlistPos = null;

      if (confirmedCount < t.max_participants) {
        // Winner of the slot!
        assignedSlot = confirmedCount + 1;
        assignedStatus = 'CONFIRMED';
      } else {
        // Loser of the last-slot race -> auto-waitlisted, never charged!
        const waitlistRes = await client.query(
          `SELECT COALESCE(MAX(waitlist_position), 0)::int + 1 AS next_pos
           FROM tournament_registrations
           WHERE tournament_id = $1 AND status = 'WAITLISTED'`,
          [tournamentId]
        );
        assignedWaitlistPos = waitlistRes.rows[0].next_pos;
        assignedStatus = 'WAITLISTED';
      }

      // 7. Insert registration row
      const insertRes = await client.query(
        `INSERT INTO tournament_registrations (
          tournament_id, user_id, team_id, participant_type,
          status, slot_number, waitlist_position, roster,
          roster_locked, idempotency_key
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          FALSE, $9
        ) RETURNING *`,
        [
          tournamentId,
          userId,
          teamId,
          payload.participant_type,
          assignedStatus,
          assignedSlot,
          assignedWaitlistPos,
          JSON.stringify(payload.roster || []),
          idempotencyKey || null,
        ]
      );

      const registration = insertRes.rows[0];

      // 8. Tamper-evident audit log
      await appendAuditLog({
        actorId: userId,
        actorRole: userRole,
        action: assignedStatus === 'CONFIRMED' ? 'TOURNAMENT_REGISTERED' : 'TOURNAMENT_WAITLISTED',
        entityType: 'tournament_registration',
        entityId: registration.id,
        payload: {
          tournamentId,
          status: assignedStatus,
          slotNumber: assignedSlot,
          waitlistPosition: assignedWaitlistPos,
          participantType: payload.participant_type,
        },
        ipHash: hashIP(ip),
      });

      return {
        ...registration,
        is_waitlisted: assignedStatus === 'WAITLISTED',
        message:
          assignedStatus === 'CONFIRMED'
            ? `Successfully registered! Assigned slot #${assignedSlot}.`
            : `Tournament capacity reached. You are waitlisted at position #${assignedWaitlistPos}.`,
      };
    });
  }

  /**
   * Cancel an active registration with automatic waitlist promotion
   */
  static async cancelRegistration(
    tournamentId,
    registrationId,
    userId,
    userRole,
    ip = '127.0.0.1'
  ) {
    return await withTransaction(async (client) => {
      // Lock tournament and registration rows
      await client.query('SELECT id FROM tournaments WHERE id = $1 FOR UPDATE', [tournamentId]);

      const regRes = await client.query(
        `SELECT * FROM tournament_registrations
         WHERE id = $1 AND tournament_id = $2
         FOR UPDATE`,
        [registrationId, tournamentId]
      );

      if (regRes.rows.length === 0) {
        throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
      }

      const reg = regRes.rows[0];

      // Anti-IDOR: only registrant or admin can cancel
      const isOwner = reg.user_id === userId;
      const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
      if (!isOwner && !isAdmin) {
        throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
      }

      if (reg.status === 'CANCELLED') {
        throw new AppError('Registration is already cancelled.', 400, 'ALREADY_CANCELLED');
      }

      const wasConfirmed = ['CONFIRMED', 'CHECKED_IN'].includes(reg.status);
      const freedSlot = reg.slot_number;

      // Mark cancelled
      await client.query(
        `UPDATE tournament_registrations
         SET status = 'CANCELLED', slot_number = NULL, waitlist_position = NULL,
             cancelled_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [registrationId]
      );

      let promotedCandidate = null;

      // Auto-promotion: if a confirmed slot was freed, promote #1 on waitlist
      if (wasConfirmed && freedSlot !== null) {
        const nextWaitlistedRes = await client.query(
          `SELECT * FROM tournament_registrations
           WHERE tournament_id = $1 AND status = 'WAITLISTED'
           ORDER BY waitlist_position ASC
           LIMIT 1
           FOR UPDATE`,
          [tournamentId]
        );

        if (nextWaitlistedRes.rows.length > 0) {
          const candidate = nextWaitlistedRes.rows[0];
          const promotedWaitlistPos = candidate.waitlist_position;

          // Promote candidate into freed slot
          const promoRes = await client.query(
            `UPDATE tournament_registrations
             SET status = 'CONFIRMED', slot_number = $1, waitlist_position = NULL, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [freedSlot, candidate.id]
          );
          promotedCandidate = promoRes.rows[0];

          // Shift remaining waitlist queue forward
          await client.query(
            `UPDATE tournament_registrations
             SET waitlist_position = waitlist_position - 1, updated_at = NOW()
             WHERE tournament_id = $1 AND status = 'WAITLISTED' AND waitlist_position > $2`,
            [tournamentId, promotedWaitlistPos]
          );

          await appendAuditLog({
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            action: 'TOURNAMENT_WAITLIST_PROMOTED',
            entityType: 'tournament_registration',
            entityId: candidate.id,
            payload: { tournamentId, promotedSlot: freedSlot },
            ipHash: hashIP(ip),
          });
        }
      }

      await appendAuditLog({
        actorId: userId,
        actorRole: userRole,
        action: 'TOURNAMENT_REGISTRATION_CANCELLED',
        entityType: 'tournament_registration',
        entityId: registrationId,
        payload: { tournamentId, wasConfirmed, freedSlot },
        ipHash: hashIP(ip),
      });

      return {
        message: 'Registration successfully cancelled.',
        promotedParticipantId: promotedCandidate ? promotedCandidate.id : null,
      };
    });
  }

  /**
   * Check in a confirmed participant during the check-in window
   */
  static async checkInParticipant(
    tournamentId,
    registrationId,
    userId,
    userRole,
    ip = '127.0.0.1'
  ) {
    const tournRes = await query(
      `SELECT id, status, check_in_open, check_in_close, start_time
       FROM tournaments
       WHERE id = $1`,
      [tournamentId]
    );

    if (tournRes.rows.length === 0) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const t = tournRes.rows[0];

    // Must be in CHECK_IN status
    if (t.status !== 'CHECK_IN') {
      throw new AppError(
        `Tournament is in '${t.status}' state. Check-in is not open.`,
        400,
        'CHECK_IN_NOT_OPEN'
      );
    }

    // Server-time validation
    const now = new Date();
    if (t.check_in_open && new Date(t.check_in_open) > now) {
      throw new AppError(
        `Check-in opens at ${t.check_in_open}.`,
        400,
        'CHECK_IN_NOT_YET_OPEN'
      );
    }
    const checkInEnd = t.check_in_close || t.start_time;
    if (checkInEnd && new Date(checkInEnd) < now) {
      throw new AppError(
        `Check-in window closed at ${checkInEnd}.`,
        400,
        'CHECK_IN_WINDOW_CLOSED'
      );
    }

    const regRes = await query(
      `SELECT * FROM tournament_registrations
       WHERE id = $1 AND tournament_id = $2`,
      [registrationId, tournamentId]
    );

    if (regRes.rows.length === 0) {
      throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
    }

    const reg = regRes.rows[0];

    // Anti-IDOR check
    const isOwner = reg.user_id === userId;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
    if (!isOwner && !isAdmin) {
      throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
    }

    if (reg.status !== 'CONFIRMED') {
      throw new AppError(
        `Cannot check in registration with status '${reg.status}'. Must be CONFIRMED.`,
        400,
        'CANNOT_CHECK_IN'
      );
    }

    // Update status to CHECKED_IN and lock roster
    const updatedRes = await query(
      `UPDATE tournament_registrations
       SET status = 'CHECKED_IN', checked_in_at = NOW(), roster_locked = TRUE, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [registrationId]
    );

    await appendAuditLog({
      actorId: userId,
      actorRole: userRole,
      action: 'TOURNAMENT_CHECKED_IN',
      entityType: 'tournament_registration',
      entityId: registrationId,
      payload: { tournamentId, slotNumber: reg.slot_number },
      ipHash: hashIP(ip),
    });

    return updatedRes.rows[0];
  }

  /**
   * Multi-filter tournament discovery with deep links and QR join link data
   */
  static async discoverTournaments(filters = {}) {
    const conditions = ["t.visibility = 'PUBLIC'"];
    const values = [];
    let idx = 1;

    // Filter by game
    if (filters.game_id) {
      conditions.push(`t.game_id = $${idx++}`);
      values.push(filters.game_id);
    }

    // Filter by status (default to open/upcoming states if not specified)
    if (filters.status) {
      conditions.push(`t.status = $${idx++}`);
      values.push(filters.status);
    } else {
      conditions.push(`t.status IN ('REGISTRATION_OPEN', 'CHECK_IN', 'SCHEDULED')`);
    }

    // Filter by format
    if (filters.format) {
      conditions.push(`t.format = $${idx++}`);
      values.push(filters.format);
    }

    // Filter by region
    if (filters.region) {
      conditions.push(`t.region = $${idx++}`);
      values.push(filters.region);
    }

    // Filter by date
    if (filters.start_after) {
      conditions.push(`t.start_time >= $${idx++}`);
      values.push(filters.start_after);
    }
    if (filters.start_before) {
      conditions.push(`t.start_time <= $${idx++}`);
      values.push(filters.start_before);
    }

    const page = Math.max(1, parseInt(filters.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '20', 10)));
    const offset = (page - 1) * limit;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortCol = ['start_time', 'created_at', 'title', 'max_participants'].includes(filters.sort_by)
      ? `t.${filters.sort_by}`
      : 't.start_time';
    const sortOrder = filters.sort_order === 'desc' ? 'DESC' : 'ASC';

    const sql = `
      SELECT t.*,
             g.name AS game_name, g.slug AS game_slug,
             gm.name AS mode_name,
             u.username AS organiser_name,
             (SELECT COUNT(*)::int FROM tournament_registrations tr WHERE tr.tournament_id = t.id AND tr.status IN ('CONFIRMED', 'CHECKED_IN')) AS confirmed_count,
             (SELECT COUNT(*)::int FROM tournament_registrations tr WHERE tr.tournament_id = t.id AND tr.status = 'WAITLISTED') AS waitlist_count
      FROM tournaments t
      LEFT JOIN games g ON t.game_id = g.id
      LEFT JOIN game_modes gm ON t.mode_id = gm.id
      LEFT JOIN users u ON t.organiser_id = u.id
      ${whereClause}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    values.push(limit, offset);

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM tournaments t
      ${whereClause}
    `;

    const [dataRes, countRes] = await Promise.all([
      query(sql, values),
      query(countSql, values.slice(0, values.length - 2)),
    ]);

    const items = dataRes.rows.map((row) => {
      const remainingSlots = Math.max(0, row.max_participants - (row.confirmed_count || 0));
      return {
        ...row,
        remaining_slots: remainingSlots,
        is_full: remainingSlots === 0,
        deep_link: `vexora://tournaments/${row.slug}`,
        web_url: `https://vexora.gg/t/${row.slug}`,
        qr_join_payload: `https://vexora.gg/t/${row.slug}?ref=qr`,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total: countRes.rows[0]?.total || 0,
        pages: Math.ceil((countRes.rows[0]?.total || 0) / limit),
      },
    };
  }

  /**
   * Get active registration for a user in a tournament
   */
  static async getMyRegistration(tournamentId, userId) {
    const res = await query(
      `SELECT tr.*, t.title AS tournament_title, t.status AS tournament_status
       FROM tournament_registrations tr
       JOIN tournaments t ON tr.tournament_id = t.id
       WHERE tr.tournament_id = $1 AND tr.user_id = $2
         AND tr.status IN ('CONFIRMED', 'WAITLISTED', 'CHECKED_IN')
       LIMIT 1`,
      [tournamentId, userId]
    );

    return res.rows[0] || null;
  }

  /**
   * Get tournament participant roster (Confirmed and Waitlisted)
   */
  static async getParticipants(tournamentId) {
    const res = await query(
      `SELECT tr.id, tr.tournament_id, tr.user_id, tr.team_id, tr.participant_type,
              tr.status, tr.slot_number, tr.waitlist_position, tr.roster, tr.roster_locked,
              tr.registered_at, tr.checked_in_at,
              u.username AS player_username,
              tm.name AS team_name, tm.tag AS team_tag
       FROM tournament_registrations tr
       LEFT JOIN users u ON tr.user_id = u.id
       LEFT JOIN teams tm ON tr.team_id = tm.id
       WHERE tr.tournament_id = $1 AND tr.status IN ('CONFIRMED', 'WAITLISTED', 'CHECKED_IN')
       ORDER BY
         CASE WHEN tr.status IN ('CONFIRMED', 'CHECKED_IN') THEN 1 ELSE 2 END,
         tr.slot_number ASC,
         tr.waitlist_position ASC`,
      [tournamentId]
    );

    const confirmed = res.rows.filter(r => ['CONFIRMED', 'CHECKED_IN'].includes(r.status));
    const waitlisted = res.rows.filter(r => r.status === 'WAITLISTED');

    return {
      confirmed,
      waitlisted,
      total_confirmed: confirmed.length,
      total_waitlisted: waitlisted.length,
    };
  }
}
