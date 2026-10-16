/**
 * Vexora Esports Tournament Platform — Notifications Service
 *
 * Phase 30: Push Notifications, Inbox & Announcements
 * PDF refs: Sections 20, 39 (Phase 7)
 *
 * Implements:
 * - FCM dispatch with payload sanitization (no balances, KYC, room codes)
 * - Per-category user preferences with quiet hours evaluation
 * - Mandatory non-mutable security alerts (cannot be disabled)
 * - In-app inbox management with deep links
 * - Delivery tracking with retry and dead-letter queue
 * - Email dispatch for security events
 *
 * Security Gate:
 * - NEVER include wallet balances, KYC details, or room codes/passwords in push payloads
 * - Send identifiers only; fetch securely on-device
 * - Security notifications (login from new device, password change, payout destination,
 *   KYC update) cannot be disabled by user preferences
 * - Quiet hours bypassed for SECURITY category alerts
 */

import { query, withTransaction } from '../common/database.js';
import { logger } from '../common/logger.js';
import { appendAuditLog } from '../audit/audit.service.js';

// ─── Sensitive Data Patterns (MUST be stripped from push payloads) ───────
const SENSITIVE_FIELDS = [
  'balance', 'available_balance', 'pending_balance', 'total_balance',
  'wallet_balance', 'credits', 'amount', 'prize_amount', 'entry_fee',
  'room_code', 'room_password', 'room_id', 'lobby_code', 'lobby_password',
  'kyc_status', 'kyc_document', 'pan_number', 'aadhaar', 'bank_account',
  'ifsc_code', 'upi_id', 'phone', 'email', 'password', 'token',
  'refresh_token', 'access_token', 'firebase_uid', 'device_token',
  'otp', 'secret', 'private_key', 'api_key',
];

// ─── Non-Mutable Security Alert Types ───────────────────────────────────
const SECURITY_ALERT_TYPES = [
  'NEW_DEVICE_LOGIN',
  'PASSWORD_CHANGED',
  'EMAIL_CHANGED',
  'PHONE_CHANGED',
  'PAYOUT_DESTINATION_ADDED',
  'PAYOUT_DESTINATION_CHANGED',
  'KYC_STATUS_UPDATED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'ACCOUNT_SUSPENDED',
  'SUSPICIOUS_ACTIVITY',
  'SESSION_REVOKED',
  'FORCED_LOGOUT',
];

// ─── Notification Categories ────────────────────────────────────────────
export const NOTIFICATION_CATEGORIES = [
  'SECURITY', 'TOURNAMENT', 'MATCH', 'DISPUTE',
  'WALLET', 'ANNOUNCEMENT', 'SOCIAL', 'SYSTEM',
];

export class NotificationsService {

  // ═══════════════════════════════════════════════════════════════════════
  // 1. PAYLOAD SANITIZATION — Strip sensitive data from push payloads
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Sanitize a notification payload, removing all sensitive fields.
   * This is the PRIMARY security gate for push notifications.
   *
   * @param {Object} payload - Raw notification data
   * @returns {Object} Sanitized payload safe for push delivery
   */
  static sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') return {};

    const sanitized = {};

    for (const [key, value] of Object.entries(payload)) {
      const keyLower = key.toLowerCase();

      // Block any key that matches sensitive field patterns
      if (SENSITIVE_FIELDS.some(field => keyLower.includes(field.toLowerCase()))) {
        logger.warn('Stripped sensitive field from push payload', {
          field: key,
          action: 'PAYLOAD_SANITIZATION',
        });
        continue;
      }

      // Recursively sanitize nested objects (one level deep only)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = NotificationsService.sanitizePayload(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Validate that a payload contains NO sensitive data.
   * Returns { safe: boolean, violations: string[] }
   */
  static validatePayloadSafety(payload) {
    const violations = [];

    const checkObject = (obj, path = '') => {
      if (!obj || typeof obj !== 'object') return;

      for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();
        const fullPath = path ? `${path}.${key}` : key;

        for (const field of SENSITIVE_FIELDS) {
          if (keyLower.includes(field.toLowerCase())) {
            violations.push(`Sensitive field "${fullPath}" detected (matches "${field}")`);
          }
        }

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          checkObject(value, fullPath);
        }
      }
    };

    checkObject(payload);
    return { safe: violations.length === 0, violations };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. USER PREFERENCES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get user notification preferences for all categories.
   * Returns default preferences for categories without explicit settings.
   */
  static async getUserPreferences(userId) {
    const result = await query(
      `SELECT category, push_enabled, email_enabled, in_app_enabled,
              quiet_hours_start, quiet_hours_end, quiet_hours_tz
       FROM notification_preferences
       WHERE user_id = $1
       ORDER BY category`,
      [userId]
    );

    // Build complete preferences map with defaults
    const prefsMap = {};
    for (const cat of NOTIFICATION_CATEGORIES) {
      prefsMap[cat] = {
        category: cat,
        push_enabled: true,
        email_enabled: cat === 'SECURITY', // Email enabled by default only for security
        in_app_enabled: true,
        quiet_hours_start: null,
        quiet_hours_end: null,
        quiet_hours_tz: 'Asia/Kolkata',
      };
    }

    // Override with user-set preferences
    for (const pref of result.rows) {
      prefsMap[pref.category] = { ...prefsMap[pref.category], ...pref };
    }

    // SECURITY category is ALWAYS enabled — non-mutable
    prefsMap['SECURITY'].push_enabled = true;
    prefsMap['SECURITY'].in_app_enabled = true;
    prefsMap['SECURITY'].email_enabled = true;

    return prefsMap;
  }

  /**
   * Update user notification preferences for a specific category.
   * SECURITY category push_enabled and in_app_enabled cannot be set to false.
   */
  static async updateUserPreferences(userId, category, preferences) {
    // Security gate: SECURITY category is non-mutable
    if (category === 'SECURITY') {
      if (preferences.push_enabled === false || preferences.in_app_enabled === false) {
        throw Object.assign(
          new Error('SECURITY notifications cannot be disabled. These alerts are mandatory for account safety.'),
          { statusCode: 403, code: 'SECURITY_ALERTS_NON_MUTABLE' }
        );
      }
      // Force security alerts to stay enabled
      preferences.push_enabled = true;
      preferences.in_app_enabled = true;
      preferences.email_enabled = true;
    }

    const result = await query(
      `INSERT INTO notification_preferences
         (user_id, category, push_enabled, email_enabled, in_app_enabled,
          quiet_hours_start, quiet_hours_end, quiet_hours_tz)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, category)
       DO UPDATE SET
         push_enabled = EXCLUDED.push_enabled,
         email_enabled = EXCLUDED.email_enabled,
         in_app_enabled = EXCLUDED.in_app_enabled,
         quiet_hours_start = EXCLUDED.quiet_hours_start,
         quiet_hours_end = EXCLUDED.quiet_hours_end,
         quiet_hours_tz = EXCLUDED.quiet_hours_tz,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        category,
        preferences.push_enabled ?? true,
        preferences.email_enabled ?? false,
        preferences.in_app_enabled ?? true,
        preferences.quiet_hours_start || null,
        preferences.quiet_hours_end || null,
        preferences.quiet_hours_tz || 'Asia/Kolkata',
      ]
    );

    return result.rows[0];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. QUIET HOURS EVALUATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Check if current time falls within user's quiet hours for a category.
   * SECURITY category ALWAYS bypasses quiet hours.
   *
   * @returns {boolean} true if in quiet hours (should defer notification)
   */
  static isInQuietHours(category, quietHoursStart, quietHoursEnd, timezone = 'Asia/Kolkata') {
    // Security alerts ALWAYS bypass quiet hours
    if (category === 'SECURITY') return false;

    if (!quietHoursStart || !quietHoursEnd) return false;

    try {
      const now = new Date();
      // Get current time in user's timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const currentHour = parseInt(parts.find(p => p.type === 'hour').value);
      const currentMinute = parseInt(parts.find(p => p.type === 'minute').value);
      const currentMinutes = currentHour * 60 + currentMinute;

      const [startH, startM] = quietHoursStart.split(':').map(Number);
      const [endH, endM] = quietHoursEnd.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      // Handle overnight quiet hours (e.g., 22:00 - 07:00)
      if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } catch {
      return false; // If timezone parsing fails, don't block
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. SEND NOTIFICATION — Core dispatch pipeline
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Send a notification through the full pipeline:
   * 1. Sanitize payload (strip sensitive data)
   * 2. Check user preferences
   * 3. Evaluate quiet hours
   * 4. Insert into user_inbox (in-app)
   * 5. Dispatch FCM push if enabled
   * 6. Track delivery status
   *
   * @param {Object} params
   * @param {string} params.userId - Target user UUID
   * @param {string} params.category - Notification category
   * @param {string} params.title - Notification title
   * @param {string} params.body - Notification body text
   * @param {string} [params.deepLink] - Mobile deep link
   * @param {string} [params.deepLinkWeb] - Web deep link
   * @param {Object} [params.metadata] - Additional data (will be sanitized)
   * @param {string} [params.sourceEventId] - Link to event_outbox
   * @returns {Object} Result with inbox entry and delivery status
   */
  static async sendNotification({
    userId,
    category,
    title,
    body,
    deepLink = null,
    deepLinkWeb = null,
    metadata = {},
    sourceEventId = null,
  }) {
    // Step 1: Sanitize payload
    const sanitizedMetadata = NotificationsService.sanitizePayload(metadata);
    const safetyCheck = NotificationsService.validatePayloadSafety(sanitizedMetadata);
    if (!safetyCheck.safe) {
      logger.error('Push payload safety violation after sanitization', {
        violations: safetyCheck.violations,
        userId,
        category,
      });
      throw Object.assign(
        new Error('Push payload contains sensitive data even after sanitization'),
        { statusCode: 500, code: 'PAYLOAD_SAFETY_VIOLATION' }
      );
    }

    // Step 2: Get user preferences
    const prefs = await NotificationsService.getUserPreferences(userId);
    const categoryPref = prefs[category] || {
      push_enabled: true,
      email_enabled: false,
      in_app_enabled: true,
    };

    // Step 3: Check quiet hours (SECURITY always bypasses)
    const inQuietHours = NotificationsService.isInQuietHours(
      category,
      categoryPref.quiet_hours_start,
      categoryPref.quiet_hours_end,
      categoryPref.quiet_hours_tz
    );

    const isMutable = category !== 'SECURITY';
    let inboxEntry = null;
    let deliveryRecord = null;

    // Step 4: Insert into inbox if in_app is enabled
    if (categoryPref.in_app_enabled || !isMutable) {
      const inboxResult = await query(
        `INSERT INTO user_inbox
           (user_id, category, title, body, deep_link, deep_link_web,
            metadata, is_mutable, source_event_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          userId, category, title, body, deepLink, deepLinkWeb,
          JSON.stringify(sanitizedMetadata), isMutable, sourceEventId,
        ]
      );
      inboxEntry = inboxResult.rows[0];
    }

    // Step 5: Dispatch FCM push if enabled and not in quiet hours
    const shouldPush = (categoryPref.push_enabled || !isMutable) && !inQuietHours;
    if (shouldPush) {
      deliveryRecord = await NotificationsService.dispatchFCMPush({
        userId,
        inboxId: inboxEntry?.id,
        title,
        body,
        category,
        deepLink,
        metadata: sanitizedMetadata,
      });
    }

    // Step 6: Dispatch email for security events
    if ((categoryPref.email_enabled || !isMutable) && category === 'SECURITY') {
      await NotificationsService.queueSecurityEmail({
        userId, title, body, category,
      });
    }

    return {
      inbox: inboxEntry,
      delivery: deliveryRecord,
      quietHoursDeferred: inQuietHours && isMutable,
      pushSent: shouldPush,
      emailQueued: category === 'SECURITY',
    };
  }

  /**
   * Send a batch of notifications to multiple users.
   */
  static async sendBulkNotification({ userIds, category, title, body, deepLink, deepLinkWeb, metadata }) {
    const results = [];
    for (const userId of userIds) {
      try {
        const result = await NotificationsService.sendNotification({
          userId, category, title, body, deepLink, deepLinkWeb, metadata,
        });
        results.push({ userId, success: true, result });
      } catch (err) {
        logger.error('Bulk notification failed for user', { userId, error: err.message });
        results.push({ userId, success: false, error: err.message });
      }
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. FCM PUSH DISPATCH
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Dispatch FCM push notification to user's registered devices.
   * Tracks delivery status and creates dead-letter entries on failure.
   */
  static async dispatchFCMPush({ userId, inboxId, title, body, category, deepLink, metadata }) {
    // Get user's registered device tokens
    const devices = await query(
      `SELECT device_token, platform FROM user_devices
       WHERE user_id = $1 AND is_active = TRUE AND device_token IS NOT NULL`,
      [userId]
    );

    if (devices.rows.length === 0) {
      logger.info('No active devices for push notification', { userId, category });
      return null;
    }

    const deliveries = [];

    for (const device of devices.rows) {
      // Build FCM payload — SANITIZED (no balances, room codes, KYC)
      const fcmPayload = {
        notification: { title, body },
        data: {
          category,
          inbox_id: inboxId || '',
          deep_link: deepLink || '',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          ...NotificationsService.sanitizePayload(metadata),
        },
      };

      // Create delivery tracking record
      const deliveryResult = await query(
        `INSERT INTO notification_deliveries
           (inbox_id, user_id, device_token, platform, status, payload_sanitized)
         VALUES ($1, $2, $3, $4, 'PENDING', TRUE)
         RETURNING *`,
        [inboxId, userId, device.device_token, device.platform]
      );

      const delivery = deliveryResult.rows[0];

      // Simulate FCM dispatch (in production, replace with actual firebase-admin SDK call)
      try {
        // In production: await admin.messaging().send({ token: device.device_token, ...fcmPayload });
        const fcmMessageId = `fcm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        await query(
          `UPDATE notification_deliveries
           SET status = 'DISPATCHED', fcm_message_id = $1, dispatched_at = NOW()
           WHERE id = $2`,
          [fcmMessageId, delivery.id]
        );

        delivery.status = 'DISPATCHED';
        delivery.fcm_message_id = fcmMessageId;
      } catch (err) {
        logger.error('FCM dispatch failed', {
          deliveryId: delivery.id,
          userId,
          deviceToken: device.device_token.substring(0, 8) + '***',
          error: err.message,
        });

        await query(
          `UPDATE notification_deliveries
           SET status = 'FAILED', error_message = $1, retry_count = retry_count + 1,
               next_retry_at = NOW() + INTERVAL '5 minutes'
           WHERE id = $2`,
          [err.message, delivery.id]
        );

        delivery.status = 'FAILED';
      }

      deliveries.push(delivery);
    }

    return deliveries;
  }

  /**
   * Queue security email notification (placeholder for email service integration).
   */
  static async queueSecurityEmail({ userId, title, body, category }) {
    logger.info('Security email queued', { userId, title, category });
    // In production: Push to BullMQ email queue
    // await emailQueue.add('security-email', { userId, title, body });
    return { queued: true, userId, category };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. INBOX MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get user's inbox with pagination and optional category filter.
   */
  static async getInbox(userId, { cursor, limit = 20, category = null, unreadOnly = false } = {}) {
    let whereClause = 'WHERE i.user_id = $1 AND i.is_archived = FALSE';
    const params = [userId];

    if (category) {
      params.push(category);
      whereClause += ` AND i.category = $${params.length}`;
    }

    if (unreadOnly) {
      whereClause += ' AND i.is_read = FALSE';
    }

    if (cursor) {
      params.push(cursor);
      whereClause += ` AND i.created_at < $${params.length}`;
    }

    params.push(limit + 1);

    const result = await query(
      `SELECT i.id, i.category, i.title, i.body, i.deep_link, i.deep_link_web,
              i.metadata, i.is_read, i.read_at, i.is_mutable, i.created_at
       FROM user_inbox i
       ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    const hasMore = result.rows.length > limit;
    const items = hasMore ? result.rows.slice(0, limit) : result.rows;

    return {
      items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].created_at : null,
    };
  }

  /**
   * Get unread notification count by category.
   */
  static async getUnreadCounts(userId) {
    const result = await query(
      `SELECT category, COUNT(*)::int AS count
       FROM user_inbox
       WHERE user_id = $1 AND is_read = FALSE AND is_archived = FALSE
       GROUP BY category
       ORDER BY category`,
      [userId]
    );

    const total = result.rows.reduce((sum, row) => sum + row.count, 0);
    return { total, byCategory: result.rows };
  }

  /**
   * Mark a notification as read.
   */
  static async markAsRead(userId, notificationId) {
    const result = await query(
      `UPDATE user_inbox
       SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND is_read = FALSE
       RETURNING id, read_at`,
      [notificationId, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Mark all notifications as read, optionally filtered by category.
   */
  static async markAllAsRead(userId, category = null) {
    let sql = `UPDATE user_inbox SET is_read = TRUE, read_at = NOW()
               WHERE user_id = $1 AND is_read = FALSE AND is_archived = FALSE`;
    const params = [userId];

    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }

    const result = await query(sql, params);
    return { markedRead: result.rowCount };
  }

  /**
   * Archive a notification (soft delete).
   */
  static async archiveNotification(userId, notificationId) {
    const result = await query(
      `UPDATE user_inbox SET is_archived = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, userId]
    );
    return result.rows[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7. DEAD-LETTER QUEUE & RETRY
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Retry failed deliveries that haven't exceeded max retries.
   * Called by a background worker/cron job.
   */
  static async retryFailedDeliveries() {
    const failed = await query(
      `SELECT d.*, i.title, i.body, i.category, i.deep_link, i.metadata
       FROM notification_deliveries d
       LEFT JOIN user_inbox i ON d.inbox_id = i.id
       WHERE d.status = 'FAILED'
         AND d.retry_count < d.max_retries
         AND (d.next_retry_at IS NULL OR d.next_retry_at <= NOW())
       ORDER BY d.created_at
       LIMIT 100`,
      []
    );

    let retried = 0;
    let deadLettered = 0;

    for (const delivery of failed.rows) {
      try {
        // Attempt FCM resend
        const fcmMessageId = `fcm_retry_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        await query(
          `UPDATE notification_deliveries
           SET status = 'DISPATCHED', fcm_message_id = $1, dispatched_at = NOW(),
               error_message = NULL, retry_count = retry_count + 1
           WHERE id = $2`,
          [fcmMessageId, delivery.id]
        );

        retried++;
      } catch (err) {
        const newRetryCount = delivery.retry_count + 1;

        if (newRetryCount >= delivery.max_retries) {
          // Move to dead-letter queue
          await query(
            `UPDATE notification_deliveries
             SET status = 'DEAD_LETTER', dead_lettered_at = NOW(),
                 error_message = $1, retry_count = $2
             WHERE id = $3`,
            [`Final failure after ${newRetryCount} retries: ${err.message}`, newRetryCount, delivery.id]
          );
          deadLettered++;
        } else {
          // Schedule next retry with exponential backoff
          const backoffMinutes = Math.pow(2, newRetryCount) * 5;
          await query(
            `UPDATE notification_deliveries
             SET error_message = $1, retry_count = $2,
                 next_retry_at = NOW() + INTERVAL '${backoffMinutes} minutes'
             WHERE id = $3`,
            [err.message, newRetryCount, delivery.id]
          );
        }
      }
    }

    return { retried, deadLettered, total: failed.rows.length };
  }

  /**
   * Get dead-letter queue entries for admin review.
   */
  static async getDeadLetterQueue({ limit = 50, offset = 0 } = {}) {
    const result = await query(
      `SELECT d.id, d.user_id, d.device_token, d.platform, d.error_message,
              d.retry_count, d.dead_lettered_at, d.created_at,
              i.title, i.category, i.body
       FROM notification_deliveries d
       LEFT JOIN user_inbox i ON d.inbox_id = i.id
       WHERE d.status = 'DEAD_LETTER'
       ORDER BY d.dead_lettered_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int AS count FROM notification_deliveries WHERE status = 'DEAD_LETTER'`
    );

    return {
      items: result.rows,
      total: countResult.rows[0].count,
    };
  }

  /**
   * Get delivery logs for admin dashboard.
   */
  static async getDeliveryLogs({ limit = 50, offset = 0, status = null } = {}) {
    let whereClause = '';
    const params = [];

    if (status) {
      params.push(status);
      whereClause = `WHERE d.status = $${params.length}`;
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT d.id, d.user_id, d.platform, d.status, d.fcm_message_id,
              d.error_message, d.retry_count, d.dispatched_at, d.delivered_at,
              d.dead_lettered_at, d.created_at,
              i.title, i.category
       FROM notification_deliveries d
       LEFT JOIN user_inbox i ON d.inbox_id = i.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return result.rows;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 8. SYSTEM BANNERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get active system banners.
   */
  static async getActiveBanners(platform = null) {
    let sql = `SELECT id, title, message, severity, is_dismissible, starts_at, ends_at,
                      target_platforms, created_at
               FROM system_banners
               WHERE is_active = TRUE
                 AND starts_at <= NOW()
                 AND (ends_at IS NULL OR ends_at > NOW())`;
    const params = [];

    if (platform) {
      params.push(platform);
      sql += ` AND $${params.length} = ANY(target_platforms)`;
    }

    sql += ' ORDER BY severity DESC, created_at DESC';

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Create a system banner (admin only).
   */
  static async createBanner({ title, message, severity, isDismissible, startsAt, endsAt, targetPlatforms, createdBy }) {
    const result = await query(
      `INSERT INTO system_banners
         (title, message, severity, is_dismissible, starts_at, ends_at, target_platforms, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, message, severity || 'INFO', isDismissible ?? true, startsAt || new Date(), endsAt, targetPlatforms || ['WEB', 'MOBILE', 'ADMIN'], createdBy]
    );

    await appendAuditLog({
      actor_id: createdBy,
      actor_role: 'ADMIN',
      action: 'SYSTEM_BANNER_CREATED',
      resource_type: 'system_banner',
      resource_id: result.rows[0].id,
      details: { title, severity },
    });

    return result.rows[0];
  }

  /**
   * Deactivate a system banner.
   */
  static async deactivateBanner(bannerId, adminId) {
    const result = await query(
      `UPDATE system_banners SET is_active = FALSE WHERE id = $1 RETURNING *`,
      [bannerId]
    );

    if (result.rows.length > 0) {
      await appendAuditLog({
        actor_id: adminId,
        actor_role: 'ADMIN',
        action: 'SYSTEM_BANNER_DEACTIVATED',
        resource_type: 'system_banner',
        resource_id: bannerId,
      });
    }

    return result.rows[0] || null;
  }
}

export default NotificationsService;
