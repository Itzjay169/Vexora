/**
 * Vexora Esports Tournament Platform — Notifications & Announcements Routes
 *
 * Phase 30: Push Notifications, Inbox & Announcements
 * PDF refs: Sections 20, 39 (Phase 7)
 *
 * Endpoints:
 *   GET    /                    — User inbox (paginated, filterable)
 *   GET    /unread-count        — Unread counts by category
 *   GET    /preferences         — Get user notification preferences
 *   PUT    /preferences/:cat    — Update preferences for a category
 *   PATCH  /:id/read            — Mark single notification as read
 *   POST   /read-all            — Mark all as read (optional category filter)
 *   DELETE /:id                 — Archive/soft-delete notification
 *   GET    /banners             — Get active system banners
 *   POST   /banners             — Create system banner (admin)
 *   DELETE /banners/:id         — Deactivate banner (admin)
 *   GET    /announcements       — Public approved announcements
 *   POST   /announcements       — Create announcement
 *   GET    /announcements/queue — Moderation queue (admin)
 *   POST   /announcements/:id/approve  — Approve announcement (admin)
 *   POST   /announcements/:id/reject   — Reject announcement (admin)
 *   POST   /announcements/:id/flag     — Flag announcement (admin)
 *   GET    /admin/deliveries    — FCM delivery logs (admin)
 *   GET    /admin/dead-letter   — Dead-letter queue (admin)
 *   POST   /admin/retry-failed  — Retry failed deliveries (admin)
 *   POST   /admin/send          — Admin send notification to user (admin)
 */

import { Router } from 'express';
import { authenticate } from '../common/auth.middleware.js';
import { requirePermission } from '../common/rbac.middleware.js';
import { NotificationsService, NOTIFICATION_CATEGORIES } from './notifications.service.js';
import { AnnouncementsService } from './announcements.service.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { logger } from '../common/logger.js';

export const notificationsRouter = Router();

// All notification endpoints require auth
notificationsRouter.use(authenticate);

// ═══════════════════════════════════════════════════════════════════════════
// USER INBOX ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET / — User inbox (paginated) ─────────────────────────────────────
notificationsRouter.get('/', async (req, res, next) => {
  try {
    const { cursor, limit = '20', category, unread } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    const result = await NotificationsService.getInbox(req.user.id, {
      cursor: cursor || null,
      limit: parsedLimit,
      category: category && NOTIFICATION_CATEGORIES.includes(category) ? category : null,
      unreadOnly: unread === 'true',
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /unread-count — Unread notification count by category ───────────
notificationsRouter.get('/unread-count', async (req, res, next) => {
  try {
    const counts = await NotificationsService.getUnreadCounts(req.user.id);
    res.json({ success: true, data: counts });
  } catch (err) {
    next(err);
  }
});

// ─── GET /preferences — Get user notification preferences ────────────────
notificationsRouter.get('/preferences', async (req, res, next) => {
  try {
    const prefs = await NotificationsService.getUserPreferences(req.user.id);
    res.json({ success: true, data: prefs });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /preferences/:category — Update notification preferences ────────
notificationsRouter.put('/preferences/:category', async (req, res, next) => {
  try {
    const { category } = req.params;

    if (!NOTIFICATION_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CATEGORY', message: `Invalid category. Must be one of: ${NOTIFICATION_CATEGORIES.join(', ')}` },
      });
    }

    const result = await NotificationsService.updateUserPreferences(
      req.user.id,
      category,
      req.body
    );

    res.json({ success: true, data: result });
  } catch (err) {
    if (err.code === 'SECURITY_ALERTS_NON_MUTABLE') {
      return res.status(403).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    next(err);
  }
});

// ─── PATCH /:id/read — Mark notification as read ─────────────────────────
notificationsRouter.patch('/:id/read', async (req, res, next) => {
  try {
    const result = await NotificationsService.markAsRead(req.user.id, req.params.id);
    if (!result) {
      return res.json({ success: true, message: 'Already read or not found' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── POST /read-all — Mark all notifications as read ─────────────────────
notificationsRouter.post('/read-all', async (req, res, next) => {
  try {
    const { category } = req.body || {};
    const validCategory = category && NOTIFICATION_CATEGORIES.includes(category) ? category : null;
    const result = await NotificationsService.markAllAsRead(req.user.id, validCategory);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id — Archive notification ──────────────────────────────────
notificationsRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await NotificationsService.archiveNotification(req.user.id, req.params.id);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM BANNERS ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /banners — Active system banners ────────────────────────────────
notificationsRouter.get('/banners', async (req, res, next) => {
  try {
    const { platform } = req.query;
    const banners = await NotificationsService.getActiveBanners(platform || null);
    res.json({ success: true, data: banners });
  } catch (err) {
    next(err);
  }
});

// ─── POST /banners — Create system banner (admin) ────────────────────────
notificationsRouter.post('/banners',
  requirePermission('NOTIFICATIONS_MANAGE'),
  async (req, res, next) => {
    try {
      const { title, message, severity, isDismissible, startsAt, endsAt, targetPlatforms } = req.body;

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'title and message are required' },
        });
      }

      const banner = await NotificationsService.createBanner({
        title, message, severity, isDismissible, startsAt, endsAt, targetPlatforms,
        createdBy: req.user.id,
      });

      res.status(201).json({ success: true, data: banner });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /banners/:id — Deactivate banner (admin) ─────────────────────
notificationsRouter.delete('/banners/:id',
  requirePermission('NOTIFICATIONS_MANAGE'),
  async (req, res, next) => {
    try {
      const banner = await NotificationsService.deactivateBanner(req.params.id, req.user.id);
      if (!banner) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Banner not found' },
        });
      }
      res.json({ success: true, data: banner });
    } catch (err) {
      next(err);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /announcements — Public approved announcements ──────────────────
notificationsRouter.get('/announcements', async (req, res, next) => {
  try {
    const { limit = '20', offset = '0', channel } = req.query;
    const announcements = await AnnouncementsService.getPublicAnnouncements({
      limit: Math.min(parseInt(limit) || 20, 100),
      offset: parseInt(offset) || 0,
      channel: channel || null,
    });
    res.json({ success: true, data: announcements });
  } catch (err) {
    next(err);
  }
});

// ─── POST /announcements — Create announcement ──────────────────────────
notificationsRouter.post('/announcements', async (req, res, next) => {
  try {
    const { channel, targetTournamentId, title, body, richContent, isPinned, expiresAt } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'title and body are required' },
      });
    }

    const announcement = await AnnouncementsService.createAnnouncement({
      authorId: req.user.id,
      authorRole: req.user.role || 'ORGANISER',
      channel: channel || 'PUBLIC',
      targetTournamentId,
      title,
      body,
      richContent,
      isPinned: isPinned || false,
      expiresAt,
    });

    res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    if (err.code === 'TOURNAMENT_ID_REQUIRED') {
      return res.status(400).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    next(err);
  }
});

// ─── GET /announcements/queue — Moderation queue (admin) ─────────────────
notificationsRouter.get('/announcements/queue',
  requirePermission('NOTIFICATIONS_MANAGE'),
  async (req, res, next) => {
    try {
      const { limit = '50', offset = '0', status = 'PENDING' } = req.query;
      const queue = await AnnouncementsService.getModerationQueue({
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
        status,
      });
      res.json({ success: true, data: queue });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /announcements/:id/approve — Approve (admin) ──────────────────
notificationsRouter.post('/announcements/:id/approve',
  requirePermission('NOTIFICATIONS_MANAGE'),
  async (req, res, next) => {
    try {
      const { notes } = req.body || {};
      const announcement = await AnnouncementsService.approveAnnouncement(
        req.params.id, req.user.id, notes
      );
      res.json({ success: true, data: announcement });
    } catch (err) {
      if (err.code === 'ANNOUNCEMENT_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      next(err);
    }
  }
);

// ─── POST /announcements/:id/reject — Reject (admin) ────────────────────
notificationsRouter.post('/announcements/:id/reject',
  requirePermission('NOTIFICATIONS_MANAGE'),
  async (req, res, next) => {
    try {
      const { reason } = req.body || {};
      const announcement = await AnnouncementsService.rejectAnnouncement(
        req.params.id, req.user.id, reason
      );
      res.json({ success: true, data: announcement });
    } catch (err) {
      if (err.code === 'REASON_REQUIRED' || err.code === 'ANNOUNCEMENT_NOT_FOUND') {
        return res.status(err.statusCode || 400).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      next(err);
    }
  }
);

// ─── POST /announcements/:id/flag — Flag (admin) ────────────────────────
notificationsRouter.post('/announcements/:id/flag',
  requirePermission('NOTIFICATIONS_MANAGE'),
  async (req, res, next) => {
    try {
      const { reason } = req.body || {};
      const announcement = await AnnouncementsService.flagAnnouncement(
        req.params.id, req.user.id, reason || 'Flagged for review'
      );
      res.json({ success: true, data: announcement });
    } catch (err) {
      if (err.code === 'ANNOUNCEMENT_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      next(err);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS — Delivery Logs, Dead-Letter Queue, Retry
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /admin/deliveries — FCM delivery logs ──────────────────────────
notificationsRouter.get('/admin/deliveries',
  requirePermission('NOTIFICATIONS_MANAGE'),
  async (req, res, next) => {
    try {
      const { limit = '50', offset = '0', status } = req.query;
      const logs = await NotificationsService.getDeliveryLogs({
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
        status: status || null,
      });
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /admin/dead-letter — Dead-letter queue ─────────────────────────
notificationsRouter.get('/admin/dead-letter',
  requirePermission('NOTIFICATIONS_MANAGE'),
  async (req, res, next) => {
    try {
      const { limit = '50', offset = '0' } = req.query;
      const dlq = await NotificationsService.getDeadLetterQueue({
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
      });
      res.json({ success: true, data: dlq });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /admin/retry-failed — Retry failed deliveries ─────────────────
notificationsRouter.post('/admin/retry-failed',
  requirePermission('NOTIFICATIONS_MANAGE'),
  async (req, res, next) => {
    try {
      const result = await NotificationsService.retryFailedDeliveries();

      await appendAuditLog({
        actor_id: req.user.id,
        actor_role: req.user.role || 'ADMIN',
        action: 'NOTIFICATION_RETRY_TRIGGERED',
        resource_type: 'notification_deliveries',
        details: result,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /admin/send — Admin send notification to user ─────────────────
notificationsRouter.post('/admin/send',
  requirePermission('NOTIFICATIONS_MANAGE'),
  async (req, res, next) => {
    try {
      const { userId, category, title, body, deepLink, deepLinkWeb, metadata } = req.body;

      if (!userId || !title || !body) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'userId, title, and body are required' },
        });
      }

      const result = await NotificationsService.sendNotification({
        userId,
        category: category || 'SYSTEM',
        title,
        body,
        deepLink,
        deepLinkWeb,
        metadata: metadata || {},
      });

      await appendAuditLog({
        actor_id: req.user.id,
        actor_role: req.user.role || 'ADMIN',
        action: 'ADMIN_NOTIFICATION_SENT',
        resource_type: 'notification',
        details: { targetUserId: userId, category, title },
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);
