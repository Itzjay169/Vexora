-- ============================================================================
-- Vexora Esports Tournament Platform — DDL Migration 003
-- Version: 003_auth_sessions_enhancement
-- Description: Phase 7 — Session family tracking for refresh token rotation
--              with reuse detection, OTP throttle tracking, and account
--              deletion anonymisation support.
-- ============================================================================

-- ─── 1. Session Family Tracking (Reuse Detection) ────────────────────────────

-- session_family groups all tokens from a single login event.
-- If a rotated-out refresh token is reused, the entire family is revoked.
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_family UUID;

CREATE INDEX IF NOT EXISTS idx_sessions_family ON user_sessions(session_family);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON user_sessions(refresh_token_hash);

-- ─── 2. OTP Throttle Tracking (persistent across restarts) ──────────────────

CREATE TABLE IF NOT EXISTS otp_throttle_log (
    id              BIGSERIAL PRIMARY KEY,
    phone           VARCHAR(20),
    ip_hash         VARCHAR(64),
    device_hash     VARCHAR(64),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_throttle_phone ON otp_throttle_log(phone, sent_at);
CREATE INDEX IF NOT EXISTS idx_otp_throttle_ip ON otp_throttle_log(ip_hash, sent_at);
CREATE INDEX IF NOT EXISTS idx_otp_throttle_device ON otp_throttle_log(device_hash, sent_at);

-- Auto-cleanup: delete entries older than 1 hour (run by scheduled job)
-- This keeps the table small while maintaining the throttle window.

-- ─── 3. Account Deletion Tracking ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    reason          TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING, COMPLETED, CANCELLED
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    cooling_off_ends TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_deletion_user ON account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_status ON account_deletion_requests(status);

-- ─── 4. Login Attempt Tracking (Brute Force Protection) ────────────────────────

CREATE TABLE IF NOT EXISTS login_attempts (
    id              BIGSERIAL PRIMARY KEY,
    identifier      VARCHAR(255) NOT NULL,  -- username, email, or phone
    ip_hash         VARCHAR(64),
    device_hash     VARCHAR(64),
    success         BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_hash, attempted_at);
