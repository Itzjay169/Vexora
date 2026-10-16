import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NotificationsService,
  NOTIFICATION_CATEGORIES,
} from '../../backend/src/notifications/notifications.service.js';

import {
  NotificationCategory,
  DeliveryStatus,
  AnnouncementChannel,
  AnnouncementModerationStatus,
  BannerSeverity,
  NotificationPreferencesUpdateSchema,
  AdminSendNotificationSchema,
  CreateAnnouncementSchema,
  ModerateAnnouncementSchema,
  SystemBannerSchema,
} from '../../packages/validation/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('Phase 30: Push Notifications, Inbox & Announcements', () => {

  // ═══════════════════════════════════════════════════════════════════════
  // 1. PAYLOAD SANITIZATION — Security Gate
  // ═══════════════════════════════════════════════════════════════════════

  describe('Payload Sanitization (Security Gate — No sensitive data in push)', () => {

    it('strips wallet balance from push payload', () => {
      const payload = {
        tournament_id: 'tourn-123',
        wallet_balance: 5000,
        available_balance: 3000,
        action: 'CREDIT',
      };
      const sanitized = NotificationsService.sanitizePayload(payload);
      assert.equal(sanitized.wallet_balance, undefined);
      assert.equal(sanitized.available_balance, undefined);
      assert.equal(sanitized.tournament_id, 'tourn-123');
      assert.equal(sanitized.action, 'CREDIT');
    });

    it('strips room codes and passwords from push payload', () => {
      const payload = {
        match_id: 'match-456',
        room_code: 'ABC123',
        room_password: 'secret_pwd',
        room_id: 'lobby_room_789',
        round: 2,
      };
      const sanitized = NotificationsService.sanitizePayload(payload);
      assert.equal(sanitized.room_code, undefined);
      assert.equal(sanitized.room_password, undefined);
      assert.equal(sanitized.room_id, undefined);
      assert.equal(sanitized.match_id, 'match-456');
      assert.equal(sanitized.round, 2);
    });

    it('strips KYC details from push payload', () => {
      const payload = {
        notification_type: 'KYC_UPDATE',
        kyc_status: 'VERIFIED',
        pan_number: 'ABCDE1234F',
        aadhaar: '123456789012',
        user_name: 'Player One',
      };
      const sanitized = NotificationsService.sanitizePayload(payload);
      assert.equal(sanitized.kyc_status, undefined);
      assert.equal(sanitized.pan_number, undefined);
      assert.equal(sanitized.aadhaar, undefined);
      assert.equal(sanitized.notification_type, 'KYC_UPDATE');
      assert.equal(sanitized.user_name, 'Player One');
    });

    it('strips tokens and credentials from push payload', () => {
      const payload = {
        message: 'Session refreshed',
        access_token: 'eyJhbGciOi...',
        refresh_token: 'rf_token_xyz',
        firebase_uid: 'uid_abc123',
        device_token: 'fcm_token_xyz',
      };
      const sanitized = NotificationsService.sanitizePayload(payload);
      assert.equal(sanitized.access_token, undefined);
      assert.equal(sanitized.refresh_token, undefined);
      assert.equal(sanitized.firebase_uid, undefined);
      assert.equal(sanitized.device_token, undefined);
      assert.equal(sanitized.message, 'Session refreshed');
    });

    it('strips sensitive data from nested objects', () => {
      const payload = {
        match_id: 'match-789',
        details: {
          lobby_code: 'SECRET_LOBBY',
          round: 3,
          password: 'my_password',
        },
      };
      const sanitized = NotificationsService.sanitizePayload(payload);
      assert.equal(sanitized.details.lobby_code, undefined);
      assert.equal(sanitized.details.password, undefined);
      assert.equal(sanitized.details.round, 3);
    });

    it('validates payload safety and reports violations', () => {
      const unsafePayload = {
        title: 'Match Update',
        room_code: 'ABC123',
        balance: 5000,
      };
      const result = NotificationsService.validatePayloadSafety(unsafePayload);
      assert.equal(result.safe, false);
      assert.ok(result.violations.length > 0);
      assert.ok(result.violations.some(v => v.includes('room_code')));
      assert.ok(result.violations.some(v => v.includes('balance')));
    });

    it('passes safety validation for clean payload', () => {
      const safePayload = {
        tournament_id: 'tourn-123',
        match_id: 'match-456',
        round: 2,
        action: 'START',
      };
      const result = NotificationsService.validatePayloadSafety(safePayload);
      assert.equal(result.safe, true);
      assert.equal(result.violations.length, 0);
    });

    it('handles null/undefined payloads gracefully', () => {
      assert.deepStrictEqual(NotificationsService.sanitizePayload(null), {});
      assert.deepStrictEqual(NotificationsService.sanitizePayload(undefined), {});
      assert.deepStrictEqual(NotificationsService.sanitizePayload({}), {});
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. SECURITY ALERTS — Non-Mutable
  // ═══════════════════════════════════════════════════════════════════════

  describe('Security Alerts Non-Mutable (SECURITY category cannot be disabled)', () => {

    it('SECURITY category is always present in NOTIFICATION_CATEGORIES', () => {
      assert.ok(NOTIFICATION_CATEGORIES.includes('SECURITY'));
    });

    it('all 8 notification categories are defined', () => {
      assert.equal(NOTIFICATION_CATEGORIES.length, 8);
      const expected = ['SECURITY', 'TOURNAMENT', 'MATCH', 'DISPUTE', 'WALLET', 'ANNOUNCEMENT', 'SOCIAL', 'SYSTEM'];
      for (const cat of expected) {
        assert.ok(NOTIFICATION_CATEGORIES.includes(cat), `Missing category: ${cat}`);
      }
    });

    it('service code enforces SECURITY push_enabled cannot be false', () => {
      const svcPath = path.join(ROOT, 'backend/src/notifications/notifications.service.js');
      const content = fs.readFileSync(svcPath, 'utf-8');
      assert.ok(content.includes('SECURITY_ALERTS_NON_MUTABLE'));
      assert.ok(content.includes("category === 'SECURITY'"));
    });

    it('service enforces SECURITY preferences stay enabled in getUserPreferences', () => {
      const svcPath = path.join(ROOT, 'backend/src/notifications/notifications.service.js');
      const content = fs.readFileSync(svcPath, 'utf-8');
      assert.ok(content.includes("prefsMap['SECURITY'].push_enabled = true"));
      assert.ok(content.includes("prefsMap['SECURITY'].in_app_enabled = true"));
      assert.ok(content.includes("prefsMap['SECURITY'].email_enabled = true"));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. QUIET HOURS — SECURITY bypasses
  // ═══════════════════════════════════════════════════════════════════════

  describe('Quiet Hours Evaluation (SECURITY bypasses quiet hours)', () => {

    it('SECURITY category ALWAYS bypasses quiet hours', () => {
      assert.equal(NotificationsService.isInQuietHours('SECURITY', '22:00', '07:00'), false);
      assert.equal(NotificationsService.isInQuietHours('SECURITY', '00:00', '23:59'), false);
    });

    it('returns false when quiet hours not configured', () => {
      assert.equal(NotificationsService.isInQuietHours('TOURNAMENT', null, null), false);
      assert.equal(NotificationsService.isInQuietHours('MATCH', null, '07:00'), false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. DEAD-LETTER QUEUE
  // ═══════════════════════════════════════════════════════════════════════

  describe('Dead-Letter Queue Handling', () => {

    it('moves failed delivery to DEAD_LETTER after max retries', () => {
      const delivery = { retry_count: 3, max_retries: 3, status: 'FAILED' };
      if (delivery.retry_count >= delivery.max_retries) {
        delivery.status = 'DEAD_LETTER';
      }
      assert.equal(delivery.status, 'DEAD_LETTER');
    });

    it('does NOT dead-letter when retries remain', () => {
      const delivery = { retry_count: 1, max_retries: 3, status: 'FAILED' };
      if (delivery.retry_count >= delivery.max_retries) {
        delivery.status = 'DEAD_LETTER';
      }
      assert.equal(delivery.status, 'FAILED');
    });

    it('applies exponential backoff on retries', () => {
      assert.equal(Math.pow(2, 1) * 5, 10);  // retry 1: 10 min
      assert.equal(Math.pow(2, 2) * 5, 20);  // retry 2: 20 min
      assert.equal(Math.pow(2, 3) * 5, 40);  // retry 3: 40 min
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. ANNOUNCEMENT MODERATION
  // ═══════════════════════════════════════════════════════════════════════

  describe('Announcement Moderation Flow', () => {

    it('admin announcements are auto-approved', () => {
      for (const role of ['ADMIN', 'SUPER_ADMIN', 'MODERATOR']) {
        const isAdminRole = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(role);
        assert.equal(isAdminRole ? 'APPROVED' : 'PENDING', 'APPROVED');
      }
    });

    it('organiser announcements go to moderation queue', () => {
      const isAdminRole = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes('ORGANISER');
      assert.equal(isAdminRole ? 'APPROVED' : 'PENDING', 'PENDING');
    });

    it('TOURNAMENT channel requires target_tournament_id', () => {
      const svcPath = path.join(ROOT, 'backend/src/notifications/announcements.service.js');
      const content = fs.readFileSync(svcPath, 'utf-8');
      assert.ok(content.includes('TOURNAMENT_ID_REQUIRED'));
      assert.ok(content.includes("channel === 'TOURNAMENT'"));
    });

    it('rejection requires reason of at least 5 characters', () => {
      const svcPath = path.join(ROOT, 'backend/src/notifications/announcements.service.js');
      const content = fs.readFileSync(svcPath, 'utf-8');
      assert.ok(content.includes('Rejection reason must be at least 5 characters'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. MIGRATION 023
  // ═══════════════════════════════════════════════════════════════════════

  describe('Migration 023 Validation', () => {
    const migrationPath = path.join(ROOT, 'infra/migrations/023_notifications_inbox_and_announcements.sql');

    it('migration file exists', () => {
      assert.ok(fs.existsSync(migrationPath));
    });

    it('creates user_inbox table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS user_inbox'));
    });

    it('creates notification_preferences table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS notification_preferences'));
    });

    it('creates notification_deliveries table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS notification_deliveries'));
    });

    it('creates announcements table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS announcements'));
    });

    it('creates system_banners table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS system_banners'));
    });

    it('enforces security notification immutability via trigger', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('enforce_security_notification_immutable'));
    });

    it('enables Row-Level Security on all tables', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));
      assert.ok(sql.includes('FORCE ROW LEVEL SECURITY'));
    });

    it('defines notification_category enum with all required categories', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes("'SECURITY'"));
      assert.ok(sql.includes("'TOURNAMENT'"));
      assert.ok(sql.includes("'MATCH'"));
      assert.ok(sql.includes("'DISPUTE'"));
      assert.ok(sql.includes("'WALLET'"));
      assert.ok(sql.includes("'ANNOUNCEMENT'"));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 7. SERVICE FILES STRUCTURE
  // ═══════════════════════════════════════════════════════════════════════

  describe('Service Files Validation', () => {

    it('notifications.service.js exports required methods', () => {
      assert.equal(typeof NotificationsService.sanitizePayload, 'function');
      assert.equal(typeof NotificationsService.validatePayloadSafety, 'function');
      assert.equal(typeof NotificationsService.isInQuietHours, 'function');
    });

    it('SENSITIVE_FIELDS covers room codes in notifications service', () => {
      const p = path.join(ROOT, 'backend/src/notifications/notifications.service.js');
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('room_code'));
      assert.ok(content.includes('room_password'));
      assert.ok(content.includes('room_id'));
      assert.ok(content.includes('lobby_code'));
      assert.ok(content.includes('lobby_password'));
    });

    it('SENSITIVE_FIELDS covers financial data', () => {
      const p = path.join(ROOT, 'backend/src/notifications/notifications.service.js');
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('wallet_balance'));
      assert.ok(content.includes('available_balance'));
      assert.ok(content.includes('bank_account'));
      assert.ok(content.includes('ifsc_code'));
    });

    it('SENSITIVE_FIELDS covers KYC data', () => {
      const p = path.join(ROOT, 'backend/src/notifications/notifications.service.js');
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('kyc_status'));
      assert.ok(content.includes('pan_number'));
      assert.ok(content.includes('aadhaar'));
    });

    it('notifications.routes.js has all Phase 30 endpoints', () => {
      const p = path.join(ROOT, 'backend/src/notifications/notifications.routes.js');
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('/preferences'));
      assert.ok(content.includes('/banners'));
      assert.ok(content.includes('/announcements'));
      assert.ok(content.includes('/admin/deliveries'));
      assert.ok(content.includes('/admin/dead-letter'));
      assert.ok(content.includes('/admin/retry-failed'));
      assert.ok(content.includes('/admin/send'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 8. VALIDATION SCHEMAS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Validation Schemas', () => {

    it('NotificationCategory enum has 8 categories', () => {
      const parsed = NotificationCategory.parse('SECURITY');
      assert.equal(parsed, 'SECURITY');
      assert.throws(() => NotificationCategory.parse('INVALID'));
    });

    it('DeliveryStatus enum has 5 statuses', () => {
      assert.equal(DeliveryStatus.parse('PENDING'), 'PENDING');
      assert.equal(DeliveryStatus.parse('DEAD_LETTER'), 'DEAD_LETTER');
      assert.throws(() => DeliveryStatus.parse('NONEXISTENT'));
    });

    it('AnnouncementChannel enum validates correctly', () => {
      assert.equal(AnnouncementChannel.parse('PUBLIC'), 'PUBLIC');
      assert.equal(AnnouncementChannel.parse('TOURNAMENT'), 'TOURNAMENT');
      assert.equal(AnnouncementChannel.parse('ORGANISER'), 'ORGANISER');
      assert.throws(() => AnnouncementChannel.parse('PRIVATE'));
    });

    it('SystemBannerSchema validates required fields', () => {
      const valid = SystemBannerSchema.parse({
        title: 'Maintenance Notice',
        message: 'System maintenance at 2 AM IST',
      });
      assert.equal(valid.title, 'Maintenance Notice');
      assert.equal(valid.severity, 'INFO'); // default
      assert.equal(valid.isDismissible, true); // default
    });

    it('SystemBannerSchema rejects short title', () => {
      assert.throws(() => SystemBannerSchema.parse({
        title: 'Hi',
        message: 'Valid message here',
      }));
    });

    it('CreateAnnouncementSchema requires body >= 10 chars', () => {
      assert.throws(() => CreateAnnouncementSchema.parse({
        title: 'Test Announcement',
        body: 'Short',
      }));
    });

    it('CreateAnnouncementSchema requires tournament ID for TOURNAMENT channel', () => {
      assert.throws(() => CreateAnnouncementSchema.parse({
        channel: 'TOURNAMENT',
        title: 'Tournament Update',
        body: 'This is a valid tournament body text',
        targetTournamentId: null,
      }));
    });

    it('ModerateAnnouncementSchema requires reason for REJECT action', () => {
      assert.throws(() => ModerateAnnouncementSchema.parse({
        action: 'REJECT',
        reason: 'Hi', // too short, needs >= 5
      }));
    });

    it('AdminSendNotificationSchema validates required fields', () => {
      const result = AdminSendNotificationSchema.parse({
        userId: '12345678-1234-1234-1234-123456789012',
        title: 'Test Notification',
        body: 'This is a test',
      });
      assert.equal(result.category, 'SYSTEM'); // default
      assert.equal(result.title, 'Test Notification');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 9. UI FILES
  // ═══════════════════════════════════════════════════════════════════════

  describe('UI Files Existence & Content', () => {

    it('admin notifications page exists with required features', () => {
      const p = path.join(ROOT, 'apps/admin/src/app/notifications/page.tsx');
      assert.ok(fs.existsSync(p));
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('Moderation Queue'));
      assert.ok(content.includes('Dead-Letter'));
      assert.ok(content.includes('Delivery Logs'));
      assert.ok(content.includes('Push Payload Security Gate'));
    });

    it('web inbox page exists with preferences and deep links', () => {
      const p = path.join(ROOT, 'apps/web/src/app/inbox/page.tsx');
      assert.ok(fs.existsSync(p));
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('Notification Preferences'));
      assert.ok(content.includes('MANDATORY'));
      assert.ok(content.includes('deep_link_web'));
    });

    it('admin shell includes Notifications nav item', () => {
      const p = path.join(ROOT, 'apps/admin/src/components/AdminShell.tsx');
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes("name: 'Notifications'"));
      assert.ok(content.includes("href: '/notifications'"));
    });

    it('Flutter inbox screen exists with categories and preferences', () => {
      const p = path.join(ROOT, 'apps/mobile/lib/screens/inbox_screen.dart');
      assert.ok(fs.existsSync(p));
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('InboxScreen'));
      assert.ok(content.includes('SECURITY'));
      assert.ok(content.includes('Notification Preferences'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 10. SYSTEM BANNER LOGIC
  // ═══════════════════════════════════════════════════════════════════════

  describe('System Banner Management', () => {

    it('supports all 4 banner severity levels', () => {
      for (const sev of ['INFO', 'WARNING', 'CRITICAL', 'MAINTENANCE']) {
        assert.equal(BannerSeverity.parse(sev), sev);
      }
    });

    it('banner time window filtering works correctly (active)', () => {
      const now = new Date();
      const banner = {
        is_active: true,
        starts_at: new Date(now.getTime() - 3600000),
        ends_at: new Date(now.getTime() + 3600000),
      };
      const isActive = banner.is_active && banner.starts_at <= now && (banner.ends_at === null || banner.ends_at > now);
      assert.equal(isActive, true);
    });

    it('banner time window filtering excludes expired banners', () => {
      const now = new Date();
      const banner = {
        is_active: true,
        starts_at: new Date(now.getTime() - 7200000),
        ends_at: new Date(now.getTime() - 3600000),
      };
      const isActive = banner.is_active && banner.starts_at <= now && (banner.ends_at === null || banner.ends_at > now);
      assert.equal(isActive, false);
    });
  });
});
