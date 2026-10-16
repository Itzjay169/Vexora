-- ════════════════════════════════════════════════════════════════════════════
-- Migration 023: Push Notifications, Inbox & Announcements
-- Phase 30 — PDF refs: Sections 20, 39 (Phase 7)
--
-- Tables:
--   1. notification_categories     – Canonical notification category enum
--   2. user_inbox                  – Per-user in-app notification inbox
--   3. notification_preferences    – Per-user per-category preference controls
--   4. notification_deliveries     – FCM push delivery tracking & dead-letter
--   5. announcements               – Organiser/admin broadcast announcements
--   6. system_banners              – Maintenance & global alert banners
--
-- Security:
--   - No balances, KYC details, or room codes in push payloads (enforced at app layer)
--   - Mandatory non-mutable security alerts cannot be disabled by users
--   - Quiet hours respected for non-urgent categories; bypassed for SECURITY
--   - RLS policies on all tables
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Notification Category Enum ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE notification_category AS ENUM (
    'SECURITY',
    'TOURNAMENT',
    'MATCH',
    'DISPUTE',
    'WALLET',
    'ANNOUNCEMENT',
    'SOCIAL',
    'SYSTEM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Delivery Status Enum ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM (
    'PENDING',
    'DISPATCHED',
    'DELIVERED',
    'FAILED',
    'DEAD_LETTER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. Announcement Channel Enum ──────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE announcement_channel AS ENUM (
    'PUBLIC',
    'TOURNAMENT',
    'ORGANISER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 4. Announcement Moderation Status Enum ────────────────────────────────
DO $$ BEGIN
  CREATE TYPE announcement_moderation_status AS ENUM (
    'PENDING',
    'APPROVED',
    'FLAGGED',
    'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 5. Banner Severity Enum ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE banner_severity AS ENUM (
    'INFO',
    'WARNING',
    'CRITICAL',
    'MAINTENANCE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: user_inbox — Per-user in-app notification inbox
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_inbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category        notification_category NOT NULL DEFAULT 'SYSTEM',
  title           VARCHAR(500) NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  deep_link       VARCHAR(1000),          -- e.g. vexora://tournaments/abc123
  deep_link_web   VARCHAR(1000),          -- e.g. /tournaments/abc123
  metadata        JSONB NOT NULL DEFAULT '{}',
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  is_mutable      BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE for security alerts
  is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
  source_event_id UUID,                   -- Link back to event_outbox if applicable
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for inbox queries
CREATE INDEX IF NOT EXISTS idx_inbox_user_unread
  ON user_inbox(user_id, is_read, created_at DESC)
  WHERE is_archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_inbox_user_category
  ON user_inbox(user_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_created_at
  ON user_inbox(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: notification_preferences — Per-user per-category preferences
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notification_preferences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category            notification_category NOT NULL,
  push_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  in_app_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start   TIME,                -- e.g. 22:00
  quiet_hours_end     TIME,                -- e.g. 07:00
  quiet_hours_tz      VARCHAR(50) DEFAULT 'Asia/Kolkata',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One preference row per user per category
  CONSTRAINT uq_user_notification_pref UNIQUE (user_id, category)
);

-- Security alert preferences are NON-MUTABLE: enforce at app layer
-- SECURITY category push_enabled and in_app_enabled CANNOT be set to false
-- Enforced via trigger below:

CREATE OR REPLACE FUNCTION enforce_security_notification_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category = 'SECURITY' AND (NEW.push_enabled = FALSE OR NEW.in_app_enabled = FALSE) THEN
    RAISE EXCEPTION 'SECURITY notifications cannot be disabled. push_enabled and in_app_enabled must remain TRUE for SECURITY category.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_security_notification_pref ON notification_preferences;
CREATE TRIGGER trg_enforce_security_notification_pref
  BEFORE INSERT OR UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION enforce_security_notification_immutable();

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: notification_deliveries — FCM push delivery tracking
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id            UUID REFERENCES user_inbox(id) ON DELETE SET NULL,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token        VARCHAR(500) NOT NULL,
  fcm_message_id      VARCHAR(500),
  platform            VARCHAR(20) NOT NULL DEFAULT 'ANDROID',  -- ANDROID, IOS, WEB
  status              delivery_status NOT NULL DEFAULT 'PENDING',
  error_message       TEXT,
  retry_count         INT NOT NULL DEFAULT 0,
  max_retries         INT NOT NULL DEFAULT 3,
  next_retry_at       TIMESTAMPTZ,
  dispatched_at       TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  dead_lettered_at    TIMESTAMPTZ,
  payload_sanitized   BOOLEAN NOT NULL DEFAULT TRUE, -- Confirms no sensitive data in payload
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_status
  ON notification_deliveries(status, next_retry_at)
  WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX IF NOT EXISTS idx_deliveries_user
  ON notification_deliveries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliveries_dead_letter
  ON notification_deliveries(status, dead_lettered_at DESC)
  WHERE status = 'DEAD_LETTER';

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: announcements — Organiser/admin broadcast announcements
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS announcements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id           UUID NOT NULL REFERENCES users(id),
  author_role         VARCHAR(50) NOT NULL DEFAULT 'ORGANISER',
  channel             announcement_channel NOT NULL DEFAULT 'PUBLIC',
  target_tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  title               VARCHAR(500) NOT NULL,
  body                TEXT NOT NULL,
  rich_content        JSONB DEFAULT '{}',
  moderation_status   announcement_moderation_status NOT NULL DEFAULT 'PENDING',
  moderated_by        UUID REFERENCES users(id),
  moderation_reason   TEXT,
  moderated_at        TIMESTAMPTZ,
  is_pinned           BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at          TIMESTAMPTZ,
  view_count          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_channel_status
  ON announcements(channel, moderation_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_tournament
  ON announcements(target_tournament_id, created_at DESC)
  WHERE target_tournament_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_moderation_pending
  ON announcements(moderation_status, created_at)
  WHERE moderation_status = 'PENDING';

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: system_banners — Maintenance & global alert banners
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS system_banners (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               VARCHAR(300) NOT NULL,
  message             TEXT NOT NULL,
  severity            banner_severity NOT NULL DEFAULT 'INFO',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_dismissible      BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at             TIMESTAMPTZ,
  target_platforms     TEXT[] DEFAULT ARRAY['WEB', 'MOBILE', 'ADMIN'],
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_active
  ON system_banners(is_active, starts_at, ends_at)
  WHERE is_active = TRUE;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

-- user_inbox: Users can only see their own notifications
ALTER TABLE user_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inbox FORCE ROW LEVEL SECURITY;

CREATE POLICY inbox_user_select ON user_inbox
  FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

CREATE POLICY inbox_app_insert ON user_inbox
  FOR INSERT WITH CHECK (TRUE); -- App layer inserts for any user

CREATE POLICY inbox_user_update ON user_inbox
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- notification_preferences: Users can only manage their own preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;

CREATE POLICY prefs_user_all ON notification_preferences
  FOR ALL USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- notification_deliveries: Admin/system access only
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries FORCE ROW LEVEL SECURITY;

CREATE POLICY deliveries_admin_select ON notification_deliveries
  FOR SELECT USING (TRUE); -- Admins and system processes need visibility

CREATE POLICY deliveries_app_insert ON notification_deliveries
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY deliveries_app_update ON notification_deliveries
  FOR UPDATE USING (TRUE);

-- announcements: Public read for approved, author/admin write
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements FORCE ROW LEVEL SECURITY;

CREATE POLICY announcements_public_read ON announcements
  FOR SELECT USING (moderation_status = 'APPROVED' OR author_id = current_setting('app.current_user_id', TRUE)::UUID);

CREATE POLICY announcements_insert ON announcements
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY announcements_update ON announcements
  FOR UPDATE USING (TRUE);

-- system_banners: Public read, admin write
ALTER TABLE system_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_banners FORCE ROW LEVEL SECURITY;

CREATE POLICY banners_public_read ON system_banners
  FOR SELECT USING (TRUE);

CREATE POLICY banners_admin_write ON system_banners
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY banners_admin_update ON system_banners
  FOR UPDATE USING (TRUE);

-- ═══════════════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inbox_updated_at
  BEFORE UPDATE ON user_inbox
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_deliveries_updated_at
  BEFORE UPDATE ON notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_banners_updated_at
  BEFORE UPDATE ON system_banners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
