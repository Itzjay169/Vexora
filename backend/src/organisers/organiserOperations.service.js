/**
 * Vexora Esports Tournament Platform - Organiser Operations & Admin Review Service
 * Phase 18: Organiser Dashboard, Matchday Operations & Admin Approval Queue
 *
 * Source of truth: Vexora Blueprint (Sections 4, 12, 39, 43)
 * Invariants:
 *  - Organiser cannot publish public tournaments without admin approval
 *  - Approval/rejection actions are immutably audit-logged with reason and reviewer ID
 *  - Anti-IDOR: organisers can manage only their own tournaments (404 on mismatch)
 *  - Match-day checklist tracks the 5 canonical tournament milestones
 *  - Incident log provides auditable record of tournament interruptions
 */

import { query, withTransaction } from '../common/database.js';
import { AppError } from '../common/errorHandler.js';
import { appendAuditLog, hashIP } from '../common/auditLog.js';
import { TournamentService, canTransition } from '../tournaments/tournaments.service.js';

export const CANONICAL_CHECKLIST_ITEMS = [
  { item_key: 'LOBBY_CREATED', label: 'In-Game Custom Lobby Created' },
  { item_key: 'ROOM_DETAILS_RELEASED', label: 'Room ID & Password Scheduled/Released' },
  { item_key: 'CHECK_IN_VERIFIED', label: 'Participant Check-in & Roster Lock Verified' },
  { item_key: 'EVIDENCE_COLLECTED', label: 'Match Screenshots / OCR Evidence Collected' },
  { item_key: 'RESULT_SUBMITTED', label: 'Official Match Results Recorded & Signed' },
];

export class OrganiserOperationsService {
  /**
   * Helper: check tournament ownership or admin authorization (Anti-IDOR)
   */
  static async verifyTournamentOwnership(tournamentId, userId, userRole) {
    const res = await query('SELECT id, organiser_id, status, title FROM tournaments WHERE id = $1', [tournamentId]);
    if (res.rows.length === 0) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }
    const tournament = res.rows[0];
    const isOwner = tournament.organiser_id === userId;
    const isStaff = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
    if (!isOwner && !isStaff) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }
    return tournament;
  }

  /**
   * 1. Organiser Dashboard Aggregator
   */
  static async getOrganiserDashboard(organiserId) {
    // Aggregated metrics for this organiser
    const metricsRes = await query(
      `SELECT
        COUNT(*)::int AS total_tournaments,
        COUNT(*) FILTER (WHERE status IN ('LIVE', 'CHECK_IN', 'REGISTRATION_OPEN'))::int AS active_tournaments,
        COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW')::int AS pending_review_count,
        COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'SETTLED'))::int AS completed_tournaments,
        COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS draft_count
       FROM tournaments
       WHERE organiser_id = $1`,
      [organiserId]
    );

    // Count participants across organiser tournaments
    const participantsRes = await query(
      `SELECT
        COUNT(tr.id)::int AS total_participants,
        COUNT(tr.id) FILTER (WHERE tr.status = 'CHECKED_IN')::int AS checked_in_count
       FROM tournament_registrations tr
       JOIN tournaments t ON t.id = tr.tournament_id
       WHERE t.organiser_id = $1 AND tr.status IN ('CONFIRMED', 'CHECKED_IN')`,
      [organiserId]
    );

    // Open incidents across organiser tournaments
    const incidentsRes = await query(
      `SELECT COUNT(til.id)::int AS open_incidents
       FROM tournament_incident_logs til
       JOIN tournaments t ON t.id = til.tournament_id
       WHERE t.organiser_id = $1 AND til.status IN ('LOGGED', 'UNDER_INVESTIGATION')`,
      [organiserId]
    );

    // Recent tournaments
    const tournamentsRes = await query(
      `SELECT
        t.id, t.title, t.slug, t.status, t.format, t.start_time,
        t.min_participants, t.max_participants, t.rules_version,
        g.name AS game_name,
        COUNT(tr.id) FILTER (WHERE tr.status IN ('CONFIRMED', 'CHECKED_IN'))::int AS confirmed_participants,
        COUNT(til.id) FILTER (WHERE til.status IN ('LOGGED', 'UNDER_INVESTIGATION'))::int AS open_incidents
       FROM tournaments t
       JOIN games g ON g.id = t.game_id
       LEFT JOIN tournament_registrations tr ON tr.tournament_id = t.id
       LEFT JOIN tournament_incident_logs til ON til.tournament_id = t.id
       WHERE t.organiser_id = $1
       GROUP BY t.id, g.name
       ORDER BY t.created_at DESC
       LIMIT 10`,
      [organiserId]
    );

    return {
      metrics: {
        total_tournaments: metricsRes.rows[0]?.total_tournaments || 0,
        active_tournaments: metricsRes.rows[0]?.active_tournaments || 0,
        pending_review_count: metricsRes.rows[0]?.pending_review_count || 0,
        completed_tournaments: metricsRes.rows[0]?.completed_tournaments || 0,
        draft_count: metricsRes.rows[0]?.draft_count || 0,
        total_participants: participantsRes.rows[0]?.total_participants || 0,
        checked_in_count: participantsRes.rows[0]?.checked_in_count || 0,
        open_incidents: incidentsRes.rows[0]?.open_incidents || 0,
      },
      tournaments: tournamentsRes.rows,
    };
  }

  /**
   * 2. Tournament Detailed Operations Center
   */
  static async getTournamentOperations(tournamentId, userId, userRole) {
    const tournament = await this.verifyTournamentOwnership(tournamentId, userId, userRole);

    // Fetch tournament with game details
    const tournDetailRes = await query(
      `SELECT t.*, g.name AS game_name
       FROM tournaments t
       JOIN games g ON g.id = t.game_id
       WHERE t.id = $1`,
      [tournamentId]
    );
    const detail = tournDetailRes.rows[0];

    // Fetch participant counts
    const countsRes = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed_count,
        COUNT(*) FILTER (WHERE status = 'CHECKED_IN')::int AS checked_in_count,
        COUNT(*) FILTER (WHERE status = 'WAITLISTED')::int AS waitlisted_count
       FROM tournament_registrations
       WHERE tournament_id = $1`,
      [tournamentId]
    );
    const counts = countsRes.rows[0];
    const totalConfirmed = (counts.confirmed_count || 0) + (counts.checked_in_count || 0);

    // Fetch or initialize matchday checklist
    const checklist = await this.getOrInitChecklist(tournamentId);

    // Fetch announcements
    const announcementsRes = await query(
      `SELECT a.*, u.username AS author_username
       FROM tournament_announcements a
       JOIN users u ON u.id = a.organiser_id
       WHERE a.tournament_id = $1
       ORDER BY a.is_pinned DESC, a.created_at DESC`,
      [tournamentId]
    );

    // Fetch incidents
    const incidentsRes = await query(
      `SELECT il.*, u.username AS reporter_username, ru.username AS resolver_username
       FROM tournament_incident_logs il
       JOIN users u ON u.id = il.reported_by
       LEFT JOIN users ru ON ru.id = il.resolved_by
       WHERE il.tournament_id = $1
       ORDER BY il.created_at DESC`,
      [tournamentId]
    );

    // Fetch match progression count
    const matchesRes = await query(
      `SELECT
        COUNT(*)::int AS total_matches,
        COUNT(*) FILTER (WHERE status = 'FINAL')::int AS final_matches,
        COUNT(*) FILTER (WHERE status IN ('LIVE', 'LOBBY_READY'))::int AS live_matches
       FROM matches
       WHERE tournament_id = $1`,
      [tournamentId]
    );

    return {
      tournament: detail,
      stats: {
        confirmed_count: counts.confirmed_count || 0,
        checked_in_count: counts.checked_in_count || 0,
        waitlisted_count: counts.waitlisted_count || 0,
        remaining_slots: Math.max(0, detail.max_participants - totalConfirmed),
        check_in_rate: totalConfirmed > 0
          ? Math.round(((counts.checked_in_count || 0) / totalConfirmed) * 100)
          : 0,
      },
      checklist,
      announcements: announcementsRes.rows,
      incidents: incidentsRes.rows,
      matches_summary: matchesRes.rows[0] || { total_matches: 0, final_matches: 0, live_matches: 0 },
    };
  }

  /**
   * 3. Match-Day Checklist Helper: Get or Auto-Seed Canonical 5 items
   */
  static async getOrInitChecklist(tournamentId) {
    const existing = await query(
      `SELECT id, tournament_id, item_key, is_completed, completed_by, completed_at, notes, created_at, updated_at
       FROM tournament_matchday_checklists
       WHERE tournament_id = $1
       ORDER BY created_at ASC`,
      [tournamentId]
    );

    if (existing.rows.length >= CANONICAL_CHECKLIST_ITEMS.length) {
      return existing.rows;
    }

    // Auto-seed missing canonical items
    for (const item of CANONICAL_CHECKLIST_ITEMS) {
      await query(
        `INSERT INTO tournament_matchday_checklists (tournament_id, item_key, is_completed)
         VALUES ($1, $2, FALSE)
         ON CONFLICT (tournament_id, item_key) DO NOTHING`,
        [tournamentId, item.item_key]
      );
    }

    const seeded = await query(
      `SELECT id, tournament_id, item_key, is_completed, completed_by, completed_at, notes, created_at, updated_at
       FROM tournament_matchday_checklists
       WHERE tournament_id = $1
       ORDER BY created_at ASC`,
      [tournamentId]
    );
    return seeded.rows;
  }

  /**
   * 4. Update Checklist Item
   */
  static async updateChecklistItem(tournamentId, userId, userRole, data, ip = '127.0.0.1') {
    await this.verifyTournamentOwnership(tournamentId, userId, userRole);

    const completedAt = data.is_completed ? new Date() : null;
    const completedBy = data.is_completed ? userId : null;

    const res = await query(
      `INSERT INTO tournament_matchday_checklists (
        tournament_id, item_key, is_completed, completed_by, completed_at, notes, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (tournament_id, item_key) DO UPDATE
       SET is_completed = EXCLUDED.is_completed,
           completed_by = EXCLUDED.completed_by,
           completed_at = EXCLUDED.completed_at,
           notes = COALESCE(EXCLUDED.notes, tournament_matchday_checklists.notes),
           updated_at = NOW()
       RETURNING *`,
      [tournamentId, data.item_key, data.is_completed, completedBy, completedAt, data.notes || null]
    );

    // Audit log checklist update
    await appendAuditLog({
      actorId: userId,
      actorRole: userRole,
      action: 'TOURNAMENT_CHECKLIST_UPDATED',
      entityType: 'tournament_matchday_checklist',
      entityId: res.rows[0].id,
      payload: {
        tournamentId,
        itemKey: data.item_key,
        isCompleted: data.is_completed,
        notes: data.notes,
      },
      ipHash: hashIP(ip),
    });

    return res.rows[0];
  }

  /**
   * 5. Post Tournament Announcement
   */
  static async createAnnouncement(tournamentId, userId, userRole, data, ip = '127.0.0.1') {
    await this.verifyTournamentOwnership(tournamentId, userId, userRole);

    const res = await query(
      `INSERT INTO tournament_announcements (
        tournament_id, organiser_id, title, content, is_pinned, moderation_status
       ) VALUES ($1, $2, $3, $4, $5, 'APPROVED')
       RETURNING *`,
      [tournamentId, userId, data.title, data.content, data.is_pinned ?? false]
    );

    const announcement = res.rows[0];

    await appendAuditLog({
      actorId: userId,
      actorRole: userRole,
      action: 'TOURNAMENT_ANNOUNCEMENT_CREATED',
      entityType: 'tournament_announcement',
      entityId: announcement.id,
      payload: {
        tournamentId,
        title: data.title,
        isPinned: data.is_pinned,
      },
      ipHash: hashIP(ip),
    });

    return announcement;
  }

  /**
   * 6. List Public Announcements for Tournament
   */
  static async listAnnouncements(tournamentId) {
    const res = await query(
      `SELECT a.*, u.username AS author_username
       FROM tournament_announcements a
       JOIN users u ON u.id = a.organiser_id
       WHERE a.tournament_id = $1 AND a.moderation_status = 'APPROVED'
       ORDER BY a.is_pinned DESC, a.created_at DESC`,
      [tournamentId]
    );
    return res.rows;
  }

  /**
   * 7. Log Incident (Late Start, Disconnects, Cheating Suspicions, etc.)
   */
  static async logIncident(tournamentId, reporterId, userRole, data, ip = '127.0.0.1') {
    // Check tournament exists
    const tRes = await query('SELECT id FROM tournaments WHERE id = $1', [tournamentId]);
    if (tRes.rows.length === 0) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const res = await query(
      `INSERT INTO tournament_incident_logs (
        tournament_id, match_id, reported_by, incident_type, severity, description, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'LOGGED')
       RETURNING *`,
      [tournamentId, data.match_id || null, reporterId, data.incident_type, data.severity || 'LOW', data.description]
    );

    const incident = res.rows[0];

    await appendAuditLog({
      actorId: reporterId,
      actorRole: userRole,
      action: 'TOURNAMENT_INCIDENT_LOGGED',
      entityType: 'tournament_incident_log',
      entityId: incident.id,
      payload: {
        tournamentId,
        matchId: data.match_id,
        incidentType: data.incident_type,
        severity: data.severity,
      },
      reason: data.description,
      ipHash: hashIP(ip),
    });

    return incident;
  }

  /**
   * 8. Resolve Incident (Organiser / Moderator / Admin)
   */
  static async resolveIncident(incidentId, resolverId, userRole, data, ip = '127.0.0.1') {
    const incRes = await query(
      `SELECT il.*, t.organiser_id
       FROM tournament_incident_logs il
       JOIN tournaments t ON t.id = il.tournament_id
       WHERE il.id = $1`,
      [incidentId]
    );

    if (incRes.rows.length === 0) {
      throw new AppError('Incident log not found', 404, 'INCIDENT_NOT_FOUND');
    }

    const incident = incRes.rows[0];
    const isOwner = incident.organiser_id === resolverId;
    const isStaff = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(userRole);

    if (!isOwner && !isStaff) {
      throw new AppError('Not authorized to resolve this incident', 403, 'FORBIDDEN');
    }

    const res = await query(
      `UPDATE tournament_incident_logs
       SET resolution = $1, status = $2, resolved_by = $3, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [data.resolution, data.status || 'RESOLVED', resolverId, incidentId]
    );

    const resolved = res.rows[0];

    await appendAuditLog({
      actorId: resolverId,
      actorRole: userRole,
      action: 'TOURNAMENT_INCIDENT_RESOLVED',
      entityType: 'tournament_incident_log',
      entityId: incidentId,
      payload: {
        resolution: data.resolution,
        status: resolved.status,
      },
      reason: data.resolution,
      ipHash: hashIP(ip),
    });

    return resolved;
  }

  /**
   * 9. List Incidents for Tournament (Organiser, Moderator, Admin)
   */
  static async listIncidents(tournamentId, userId, userRole) {
    const tRes = await query('SELECT organiser_id FROM tournaments WHERE id = $1', [tournamentId]);
    if (tRes.rows.length === 0) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }
    const isOwner = tRes.rows[0].organiser_id === userId;
    const isStaff = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(userRole);

    if (!isOwner && !isStaff) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }

    const res = await query(
      `SELECT il.*, u.username AS reporter_username, ru.username AS resolver_username
       FROM tournament_incident_logs il
       JOIN users u ON u.id = il.reported_by
       LEFT JOIN users ru ON ru.id = il.resolved_by
       WHERE il.tournament_id = $1
       ORDER BY il.created_at DESC`,
      [tournamentId]
    );
    return res.rows;
  }

  /**
   * 10. Admin Review Queue: List tournaments pending review
   */
  static async getPendingReviewQueue(adminId, userRole) {
    if (!['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      throw new AppError('Admin credentials required to view review queue', 403, 'FORBIDDEN');
    }

    const res = await query(
      `SELECT
        t.id, t.title, t.slug, t.status, t.format, t.start_time,
        t.min_participants, t.max_participants, t.rules_version,
        t.created_at, t.region, t.entry_fee_credits, t.prize_pool_credits,
        g.name AS game_name,
        u.username AS organiser_username,
        u.id AS organiser_id,
        COALESCE(op.verification_status, 'UNVERIFIED') AS organiser_status,
        COALESCE(op.tier, 'STARTER') AS organiser_tier
       FROM tournaments t
       JOIN games g ON g.id = t.game_id
       JOIN users u ON u.id = t.organiser_id
       LEFT JOIN organiser_profiles op ON op.user_id = u.id
       WHERE t.status = 'PENDING_REVIEW'
       ORDER BY t.created_at ASC`
    );

    return res.rows;
  }

  /**
   * 11. Admin Review Action (Approve or Reject with Mandatory Reason)
   *
   * SECURITY GATE:
   *   - Approval actions are audit-logged with reviewer ID and reason
   *   - Organisers cannot publish public tournaments without admin approval
   */
  static async reviewTournament(tournamentId, adminId, userRole, data, ip = '127.0.0.1') {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      throw new AppError('Only administrators can approve or reject tournaments', 403, 'ADMIN_REQUIRED');
    }

    if (!data.reason || data.reason.trim().length < 5) {
      throw new AppError('A valid reason (minimum 5 characters) is required for admin review decisions', 400, 'REASON_REQUIRED');
    }

    const tRes = await query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    if (tRes.rows.length === 0) {
      throw new AppError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
    }
    const tournament = tRes.rows[0];

    if (tournament.status !== 'PENDING_REVIEW') {
      throw new AppError(
        `Cannot review tournament in status '${tournament.status}'. Must be 'PENDING_REVIEW'.`,
        400,
        'INVALID_STATUS_FOR_REVIEW'
      );
    }

    if (data.decision === 'APPROVE') {
      // Transition PENDING_REVIEW -> SCHEDULED
      const updated = await TournamentService.transitionStatus(
        tournamentId,
        'SCHEDULED',
        adminId,
        userRole,
        { reason: data.reason },
        ip
      );

      // Audit log the approval
      await appendAuditLog({
        actorId: adminId,
        actorRole: userRole,
        action: 'TOURNAMENT_ADMIN_APPROVED',
        entityType: 'tournament',
        entityId: tournamentId,
        payload: {
          decision: 'APPROVE',
          previousStatus: 'PENDING_REVIEW',
          newStatus: 'SCHEDULED',
        },
        reason: data.reason,
        ipHash: hashIP(ip),
      });

      return {
        success: true,
        decision: 'APPROVE',
        status: 'SCHEDULED',
        tournament: updated,
      };
    } else if (data.decision === 'REJECT') {
      // Transition PENDING_REVIEW -> DRAFT
      const updated = await TournamentService.transitionStatus(
        tournamentId,
        'DRAFT',
        adminId,
        userRole,
        { reason: `Rejected by admin: ${data.reason}` },
        ip
      );

      // Audit log the rejection
      await appendAuditLog({
        actorId: adminId,
        actorRole: userRole,
        action: 'TOURNAMENT_ADMIN_REJECTED',
        entityType: 'tournament',
        entityId: tournamentId,
        payload: {
          decision: 'REJECT',
          previousStatus: 'PENDING_REVIEW',
          newStatus: 'DRAFT',
        },
        reason: data.reason,
        ipHash: hashIP(ip),
      });

      return {
        success: true,
        decision: 'REJECT',
        status: 'DRAFT',
        tournament: updated,
      };
    } else {
      throw new AppError('Decision must be either APPROVE or REJECT', 400, 'INVALID_DECISION');
    }
  }
}
