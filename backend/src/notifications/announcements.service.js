/**
 * Vexora Esports Tournament Platform — Announcements Service
 *
 * Phase 30: Push Notifications, Inbox & Announcements
 * PDF refs: Sections 20, 39 (Phase 7)
 *
 * Implements:
 * - Organiser announcement creation with moderation queue
 * - Admin announcement approval/rejection/flagging
 * - Delivery to tournament-specific, organiser, and public channels
 * - Announcement pinning and expiry management
 * - View count tracking
 */

import { query } from '../common/database.js';
import { logger } from '../common/logger.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { NotificationsService } from './notifications.service.js';

export class AnnouncementsService {

  // ═══════════════════════════════════════════════════════════════════════
  // 1. CREATE ANNOUNCEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Create an announcement. Organiser announcements go to moderation queue.
   * Admin announcements are auto-approved.
   */
  static async createAnnouncement({
    authorId,
    authorRole,
    channel,
    targetTournamentId = null,
    title,
    body,
    richContent = {},
    isPinned = false,
    expiresAt = null,
  }) {
    // Admin announcements are auto-approved; organiser ones need moderation
    const isAdminRole = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(authorRole);
    const moderationStatus = isAdminRole ? 'APPROVED' : 'PENDING';

    // Tournament-channel announcements must specify a tournament
    if (channel === 'TOURNAMENT' && !targetTournamentId) {
      throw Object.assign(
        new Error('Tournament channel announcements require a target_tournament_id'),
        { statusCode: 400, code: 'TOURNAMENT_ID_REQUIRED' }
      );
    }

    const result = await query(
      `INSERT INTO announcements
         (author_id, author_role, channel, target_tournament_id, title, body,
          rich_content, moderation_status, is_pinned, expires_at,
          moderated_by, moderated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        authorId, authorRole, channel, targetTournamentId,
        title, body, JSON.stringify(richContent), moderationStatus,
        isPinned, expiresAt,
        isAdminRole ? authorId : null,
        isAdminRole ? new Date() : null,
      ]
    );

    const announcement = result.rows[0];

    await appendAuditLog({
      actor_id: authorId,
      actor_role: authorRole,
      action: 'ANNOUNCEMENT_CREATED',
      resource_type: 'announcement',
      resource_id: announcement.id,
      details: { channel, moderationStatus, title },
    });

    // If auto-approved, immediately deliver to subscribers
    if (moderationStatus === 'APPROVED') {
      await AnnouncementsService.deliverAnnouncement(announcement);
    }

    return announcement;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. MODERATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Approve a pending announcement (admin/moderator only).
   */
  static async approveAnnouncement(announcementId, moderatorId, notes = null) {
    const result = await query(
      `UPDATE announcements
       SET moderation_status = 'APPROVED', moderated_by = $1,
           moderated_at = NOW(), moderation_reason = $2
       WHERE id = $3 AND moderation_status = 'PENDING'
       RETURNING *`,
      [moderatorId, notes, announcementId]
    );

    if (result.rows.length === 0) {
      throw Object.assign(
        new Error('Announcement not found or already moderated'),
        { statusCode: 404, code: 'ANNOUNCEMENT_NOT_FOUND' }
      );
    }

    const announcement = result.rows[0];

    await appendAuditLog({
      actor_id: moderatorId,
      actor_role: 'MODERATOR',
      action: 'ANNOUNCEMENT_APPROVED',
      resource_type: 'announcement',
      resource_id: announcementId,
      details: { title: announcement.title, notes },
    });

    // Deliver to subscribers after approval
    await AnnouncementsService.deliverAnnouncement(announcement);

    return announcement;
  }

  /**
   * Reject a pending announcement.
   */
  static async rejectAnnouncement(announcementId, moderatorId, reason) {
    if (!reason || reason.length < 5) {
      throw Object.assign(
        new Error('Rejection reason must be at least 5 characters'),
        { statusCode: 400, code: 'REASON_REQUIRED' }
      );
    }

    const result = await query(
      `UPDATE announcements
       SET moderation_status = 'REJECTED', moderated_by = $1,
           moderated_at = NOW(), moderation_reason = $2
       WHERE id = $3 AND moderation_status = 'PENDING'
       RETURNING *`,
      [moderatorId, reason, announcementId]
    );

    if (result.rows.length === 0) {
      throw Object.assign(
        new Error('Announcement not found or already moderated'),
        { statusCode: 404, code: 'ANNOUNCEMENT_NOT_FOUND' }
      );
    }

    await appendAuditLog({
      actor_id: moderatorId,
      actor_role: 'MODERATOR',
      action: 'ANNOUNCEMENT_REJECTED',
      resource_type: 'announcement',
      resource_id: announcementId,
      details: { reason },
    });

    return result.rows[0];
  }

  /**
   * Flag an announcement for further review.
   */
  static async flagAnnouncement(announcementId, moderatorId, reason) {
    const result = await query(
      `UPDATE announcements
       SET moderation_status = 'FLAGGED', moderated_by = $1,
           moderated_at = NOW(), moderation_reason = $2
       WHERE id = $3
       RETURNING *`,
      [moderatorId, reason, announcementId]
    );

    if (result.rows.length === 0) {
      throw Object.assign(
        new Error('Announcement not found'),
        { statusCode: 404, code: 'ANNOUNCEMENT_NOT_FOUND' }
      );
    }

    await appendAuditLog({
      actor_id: moderatorId,
      actor_role: 'MODERATOR',
      action: 'ANNOUNCEMENT_FLAGGED',
      resource_type: 'announcement',
      resource_id: announcementId,
      details: { reason },
    });

    return result.rows[0];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. DELIVERY — Push announcements to affected users' inboxes
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Deliver an approved announcement to all relevant users.
   */
  static async deliverAnnouncement(announcement) {
    try {
      let targetUserIds = [];

      switch (announcement.channel) {
        case 'PUBLIC': {
          // Deliver to all active users (batched in production)
          const users = await query(
            `SELECT id FROM users WHERE status = 'ACTIVE' LIMIT 10000`
          );
          targetUserIds = users.rows.map(u => u.id);
          break;
        }

        case 'TOURNAMENT': {
          // Deliver to all participants of the tournament
          if (announcement.target_tournament_id) {
            const participants = await query(
              `SELECT DISTINCT user_id FROM tournament_registrations
               WHERE tournament_id = $1 AND status IN ('CONFIRMED', 'CHECKED_IN')`,
              [announcement.target_tournament_id]
            );
            targetUserIds = participants.rows.map(p => p.user_id);
          }
          break;
        }

        case 'ORGANISER': {
          // Deliver to all verified organisers
          const organisers = await query(
            `SELECT user_id FROM organiser_profiles WHERE verification_status = 'VERIFIED'`
          );
          targetUserIds = organisers.rows.map(o => o.user_id);
          break;
        }
      }

      if (targetUserIds.length === 0) {
        logger.info('No target users for announcement delivery', {
          announcementId: announcement.id,
          channel: announcement.channel,
        });
        return { delivered: 0 };
      }

      // Send to each user's inbox
      const results = await NotificationsService.sendBulkNotification({
        userIds: targetUserIds,
        category: 'ANNOUNCEMENT',
        title: announcement.title,
        body: announcement.body,
        deepLink: `vexora://announcements/${announcement.id}`,
        deepLinkWeb: `/announcements/${announcement.id}`,
        metadata: {
          announcement_id: announcement.id,
          channel: announcement.channel,
          author_role: announcement.author_role,
          is_pinned: announcement.is_pinned,
        },
      });

      const successCount = results.filter(r => r.success).length;

      logger.info('Announcement delivered', {
        announcementId: announcement.id,
        channel: announcement.channel,
        targetUsers: targetUserIds.length,
        successCount,
      });

      return { delivered: successCount, total: targetUserIds.length };
    } catch (err) {
      logger.error('Announcement delivery failed', {
        announcementId: announcement.id,
        error: err.message,
      });
      return { delivered: 0, error: err.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. QUERY ANNOUNCEMENTS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get public approved announcements.
   */
  static async getPublicAnnouncements({ limit = 20, offset = 0, channel = null } = {}) {
    let whereClause = `WHERE a.moderation_status = 'APPROVED'
                        AND (a.expires_at IS NULL OR a.expires_at > NOW())`;
    const params = [];

    if (channel) {
      params.push(channel);
      whereClause += ` AND a.channel = $${params.length}`;
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT a.id, a.channel, a.target_tournament_id, a.title, a.body,
              a.rich_content, a.is_pinned, a.expires_at, a.view_count, a.created_at,
              a.author_role
       FROM announcements a
       ${whereClause}
       ORDER BY a.is_pinned DESC, a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return result.rows;
  }

  /**
   * Get announcements for a specific tournament.
   */
  static async getTournamentAnnouncements(tournamentId, { limit = 20, offset = 0 } = {}) {
    const result = await query(
      `SELECT id, title, body, rich_content, is_pinned, view_count, created_at, author_role
       FROM announcements
       WHERE target_tournament_id = $1 AND moderation_status = 'APPROVED'
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY is_pinned DESC, created_at DESC
       LIMIT $2 OFFSET $3`,
      [tournamentId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get moderation queue (admin only).
   */
  static async getModerationQueue({ limit = 50, offset = 0, status = 'PENDING' } = {}) {
    const result = await query(
      `SELECT a.id, a.author_id, a.author_role, a.channel, a.target_tournament_id,
              a.title, a.body, a.moderation_status, a.moderated_by,
              a.moderation_reason, a.moderated_at, a.is_pinned, a.created_at
       FROM announcements a
       WHERE a.moderation_status = $1
       ORDER BY a.created_at ASC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int AS count FROM announcements WHERE moderation_status = $1`,
      [status]
    );

    return {
      items: result.rows,
      total: countResult.rows[0].count,
    };
  }

  /**
   * Increment view count for an announcement.
   */
  static async incrementViewCount(announcementId) {
    await query(
      `UPDATE announcements SET view_count = view_count + 1 WHERE id = $1`,
      [announcementId]
    );
  }
}

export default AnnouncementsService;
