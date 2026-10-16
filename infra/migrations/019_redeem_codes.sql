-- ============================================================================
-- Vexora Esports Tournament Platform — DDL Migration 019
-- Version: 019_redeem_codes
-- Description: Phase 26 — Redeem Codes
--              Admin batches with Maker-Checker dual authorization,
--              HMAC-SHA256 hashed code storage with prefix and checksum char,
--              Redemption tracking, brute-force rate-limiting & anomaly attempts,
--              and encrypted watermarked batch exports.
-- ============================================================================

-- ─── 1. Redeem Code Batches Table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS redeem_code_batches (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_name              VARCHAR(100) NOT NULL,
    denomination            NUMERIC(14,2) NOT NULL CHECK (denomination > 0),
    quantity                INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 10000),
    max_uses_per_code       INTEGER NOT NULL DEFAULT 1 CHECK (max_uses_per_code >= 1),
    expires_at              TIMESTAMPTZ NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL'
                            CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
    maker_admin_id          UUID NOT NULL REFERENCES users(id),
    checker_admin_id        UUID REFERENCES users(id),
    approved_at             TIMESTAMPTZ,
    rejected_at             TIMESTAMPTZ,
    rejection_reason        TEXT,
    export_count            INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Strict Maker-Checker constraint: creator can never self-approve
    CONSTRAINT chk_batch_maker_checker
        CHECK (checker_admin_id IS NULL OR maker_admin_id != checker_admin_id)
);

CREATE INDEX IF NOT EXISTS idx_redeem_batches_status ON redeem_code_batches(status);
CREATE INDEX IF NOT EXISTS idx_redeem_batches_maker ON redeem_code_batches(maker_admin_id);
CREATE INDEX IF NOT EXISTS idx_redeem_batches_expires ON redeem_code_batches(expires_at);

-- ─── 2. Enhance Redeem Codes Table ──────────────────────────────────────────

DO $$
BEGIN
    -- Add batch_uuid referencing redeem_code_batches if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'redeem_codes' AND column_name = 'batch_uuid'
    ) THEN
        ALTER TABLE redeem_codes 
        ADD COLUMN batch_uuid UUID REFERENCES redeem_code_batches(id) ON DELETE CASCADE;
    END IF;

    -- Add code_prefix for safe customer support and search lookup
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'redeem_codes' AND column_name = 'code_prefix'
    ) THEN
        ALTER TABLE redeem_codes 
        ADD COLUMN code_prefix VARCHAR(12);
    END IF;

    -- Add checksum_char for early rejection of typos before DB lookup
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'redeem_codes' AND column_name = 'checksum_char'
    ) THEN
        ALTER TABLE redeem_codes 
        ADD COLUMN checksum_char CHAR(1);
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_redeem_codes_batch_uuid ON redeem_codes(batch_uuid);
CREATE INDEX IF NOT EXISTS idx_redeem_codes_prefix ON redeem_codes(code_prefix);
CREATE INDEX IF NOT EXISTS idx_redeem_codes_status ON redeem_codes(status);

-- ─── 3. Redeem Code Redemptions Table ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS redeem_code_redemptions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_id                 UUID NOT NULL REFERENCES redeem_codes(id) ON DELETE CASCADE,
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount                  NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    ledger_tx_id            UUID REFERENCES ledger_transactions(id),
    ip_address              VARCHAR(45),
    user_agent              TEXT,
    redeemed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_code_user_redemption UNIQUE (code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_redeem_redemptions_user ON redeem_code_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_redeem_redemptions_code ON redeem_code_redemptions(code_id);

-- ─── 4. Redeem Attempts & Abuse Monitoring Table ────────────────────────────

CREATE TABLE IF NOT EXISTS redeem_attempts (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address              VARCHAR(45) NOT NULL,
    attempted_code_prefix   VARCHAR(12),
    failure_reason          VARCHAR(50) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redeem_attempts_ip_time ON redeem_attempts(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_redeem_attempts_user_time ON redeem_attempts(user_id, created_at);

-- ─── 5. Redeem Code Export Audit Log ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS redeem_code_exports (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id                UUID NOT NULL REFERENCES redeem_code_batches(id) ON DELETE CASCADE,
    admin_id                UUID NOT NULL REFERENCES users(id),
    watermark               VARCHAR(150) NOT NULL,
    exported_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redeem_exports_batch ON redeem_code_exports(batch_id);
CREATE INDEX IF NOT EXISTS idx_redeem_exports_admin ON redeem_code_exports(admin_id);
