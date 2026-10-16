-- ============================================================================
-- Vexora Database Migration 006: Player Profiles, In-Game IDs & Secure Upload Pipeline
-- Phase 12: Player Identity & Media Security
-- ============================================================================

-- 1. Enhance users table with privacy controls and favourite games
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS favourite_game_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    ADD COLUMN IF NOT EXISTS show_stats BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS show_game_ids BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS fair_play_score INTEGER NOT NULL DEFAULT 100;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_profile_visibility'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT chk_profile_visibility 
            CHECK (profile_visibility IN ('PUBLIC', 'PRIVATE', 'FRIENDS_ONLY'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_fair_play_score'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT chk_fair_play_score 
            CHECK (fair_play_score >= 0 AND fair_play_score <= 100);
    END IF;
END $$;

-- 2. Enhance user_game_ids with proof attachment and verification metadata
ALTER TABLE user_game_ids
    ADD COLUMN IF NOT EXISTS proof_upload_id UUID,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- 3. Create media_uploads table for tamper-evident ingress hashing & asset lifecycle
CREATE TABLE IF NOT EXISTS media_uploads (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose             VARCHAR(50) NOT NULL,
    storage_key         VARCHAR(255) NOT NULL UNIQUE,
    original_filename   VARCHAR(255) NOT NULL,
    mime_type           VARCHAR(100) NOT NULL,
    file_size_bytes     INTEGER NOT NULL,
    sha256_hash         VARCHAR(64) NOT NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    is_sanitized        BOOLEAN NOT NULL DEFAULT FALSE,
    rejection_reason    VARCHAR(255),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_upload_purpose CHECK (
        purpose IN ('AVATAR', 'PROFILE_PROOF', 'MATCH_EVIDENCE', 'KYC_DOCUMENT', 'DISPUTE_EVIDENCE')
    ),
    CONSTRAINT chk_upload_status CHECK (
        status IN ('PENDING', 'VALIDATED', 'INFECTED', 'REJECTED', 'PROCESSED')
    ),
    CONSTRAINT chk_file_size_positive CHECK (file_size_bytes > 0)
);

-- 4. Evidence immutability trigger: once SHA-256 is recorded, hash and storage_key cannot be altered
CREATE OR REPLACE FUNCTION prevent_upload_evidence_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.sha256_hash IS DISTINCT FROM NEW.sha256_hash OR OLD.storage_key IS DISTINCT FROM NEW.storage_key THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Upload evidence hash and storage key are immutable once ingested. (Key: %)', OLD.storage_key;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_media_upload ON media_uploads;
CREATE TRIGGER trg_immutable_media_upload
BEFORE UPDATE ON media_uploads
FOR EACH ROW
EXECUTE FUNCTION prevent_upload_evidence_tampering();

-- 5. Row-Level Security for media_uploads
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;

-- Owner can read their own uploads
DROP POLICY IF EXISTS rls_media_uploads_owner_read ON media_uploads;
CREATE POLICY rls_media_uploads_owner_read ON media_uploads
    FOR SELECT
    USING (
        user_id = NULLIF(CURRENT_SETTING('app.current_user_id', true), '')::UUID
        OR CURRENT_SETTING('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'AUDITOR')
    );

-- Owner can insert their own uploads
DROP POLICY IF EXISTS rls_media_uploads_owner_insert ON media_uploads;
CREATE POLICY rls_media_uploads_owner_insert ON media_uploads
    FOR INSERT
    WITH CHECK (
        user_id = NULLIF(CURRENT_SETTING('app.current_user_id', true), '')::UUID
        OR CURRENT_SETTING('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

-- 6. Indexes for rapid lookups
CREATE INDEX IF NOT EXISTS idx_media_uploads_user ON media_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_media_uploads_hash ON media_uploads(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_media_uploads_purpose ON media_uploads(purpose);
CREATE INDEX IF NOT EXISTS idx_user_game_ids_user ON user_game_ids(user_id);
