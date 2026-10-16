-- ============================================================================
-- Vexora Database Migration 015: Organiser Verification, Tiers & Trust Profiles
-- Phase 22: Trust & Safety, Tier-Gated Publishing, Encrypted KYC & Access Audit
-- Specifications: Blueprint Sections 10, 39 (Phase 5); ADR-002, ADR-004
-- ============================================================================

-- 1. Organiser KYC Applications Table (Separate isolated secure storage)
CREATE TABLE IF NOT EXISTS organiser_kyc_applications (
    id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organiser_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name                   VARCHAR(200) NOT NULL,
    contact_email                   VARCHAR(255) NOT NULL,
    contact_phone_encrypted         TEXT NOT NULL,
    country                         VARCHAR(3) NOT NULL, -- ISO Alpha-2/3
    id_document_type                VARCHAR(50) NOT NULL, -- 'PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE', 'BUSINESS_REG'
    id_document_number_encrypted    TEXT NOT NULL,
    id_document_front_s3_key        TEXT NOT NULL,
    id_document_front_hash          VARCHAR(64) NOT NULL, -- Cryptographic SHA-256 seal
    id_document_back_s3_key         TEXT,
    id_document_back_hash           VARCHAR(64),
    tax_id_encrypted                TEXT,
    address_encrypted               TEXT,
    status                          VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    risk_score                      NUMERIC(5,2) DEFAULT 0.00,
    provider_reference              VARCHAR(100),
    rejection_reason                TEXT,
    reviewer_notes                  TEXT,
    reviewed_by                     UUID REFERENCES users(id),
    reviewed_at                     TIMESTAMPTZ,
    submitted_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_kyc_app_status CHECK (
        status IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUESTED')
    ),
    CONSTRAINT chk_kyc_doc_type CHECK (
        id_document_type IN ('PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE', 'BUSINESS_REG')
    ),
    CONSTRAINT chk_kyc_front_hash_len CHECK (length(id_document_front_hash) = 64)
);

CREATE INDEX IF NOT EXISTS idx_kyc_applications_organiser
    ON organiser_kyc_applications (organiser_id, status);

CREATE INDEX IF NOT EXISTS idx_kyc_applications_status_created
    ON organiser_kyc_applications (status, submitted_at ASC);

-- 2. Enhance organiser_profiles with Tiers, Publishing Holds, & Trust Metrics
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organiser_profiles' AND column_name = 'publishing_held'
    ) THEN
        ALTER TABLE organiser_profiles
            ADD COLUMN publishing_held BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN publishing_hold_reason TEXT,
            ADD COLUMN publishing_hold_at TIMESTAMPTZ,
            ADD COLUMN tier_updated_at TIMESTAMPTZ DEFAULT NOW(),
            ADD COLUMN verified_at TIMESTAMPTZ,
            ADD COLUMN dispute_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
            ADD COLUMN max_concurrent_tournaments INTEGER NOT NULL DEFAULT 1,
            ADD COLUMN max_participants_cap INTEGER NOT NULL DEFAULT 32;
    END IF;
END $$;

-- 3. KYC Access Logs Table (Strict Security Gate: Audits every view of sensitive KYC)
CREATE TABLE IF NOT EXISTS kyc_access_logs (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id                UUID NOT NULL REFERENCES users(id),
    actor_role              VARCHAR(50) NOT NULL,
    target_application_id   UUID NOT NULL REFERENCES organiser_kyc_applications(id) ON DELETE CASCADE,
    target_organiser_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_reason           TEXT NOT NULL, -- Mandatory justification (cannot be empty)
    ip_address              VARCHAR(45) NOT NULL,
    user_agent              TEXT,
    accessed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_kyc_access_reason_length CHECK (length(trim(access_reason)) >= 5)
);

CREATE INDEX IF NOT EXISTS idx_kyc_access_logs_target
    ON kyc_access_logs (target_organiser_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_kyc_access_logs_actor
    ON kyc_access_logs (actor_id, accessed_at DESC);

-- Immutable trigger on kyc_access_logs: cannot update or delete access logs
CREATE OR REPLACE FUNCTION prevent_kyc_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'kyc_access_logs is an immutable audit journal: updates and deletions are strictly prohibited'
        USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_kyc_log_mutation ON kyc_access_logs;
CREATE TRIGGER trg_prevent_kyc_log_mutation
    BEFORE UPDATE OR DELETE ON kyc_access_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_kyc_log_mutation();

-- 4. Public Sanitised Projection View (Zero PII leakage)
CREATE OR REPLACE VIEW v_organiser_public_trust AS
SELECT 
    op.user_id AS organiser_id,
    op.business_name,
    op.tier,
    op.kyc_status,
    op.trust_score,
    op.total_tournaments,
    op.completed_tournaments,
    op.cancelled_tournaments,
    op.disputed_tournaments,
    op.dispute_rate,
    op.verified_at,
    op.publishing_held,
    op.max_concurrent_tournaments,
    op.max_participants_cap,
    op.social_links,
    op.created_at
FROM organiser_profiles op;

-- 5. Row-Level Security on sensitive KYC tables
ALTER TABLE organiser_kyc_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_access_logs ENABLE ROW LEVEL SECURITY;

-- Policy: KYC Applications — Owner can only select their own application;
-- ADMIN and SUPER_ADMIN can view; MODERATOR and others are strictly blocked
DROP POLICY IF EXISTS kyc_applications_select ON organiser_kyc_applications;
CREATE POLICY kyc_applications_select ON organiser_kyc_applications
    FOR SELECT
    USING (
        organiser_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS kyc_applications_insert ON organiser_kyc_applications;
CREATE POLICY kyc_applications_insert ON organiser_kyc_applications
    FOR INSERT
    WITH CHECK (
        organiser_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS kyc_applications_update ON organiser_kyc_applications;
CREATE POLICY kyc_applications_update ON organiser_kyc_applications
    FOR UPDATE
    USING (
        current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

-- Policy: KYC Access Logs — Only readable by SUPER_ADMIN & COMPLIANCE, appendable by system
DROP POLICY IF EXISTS kyc_access_logs_select ON organiser_kyc_applications;
CREATE POLICY kyc_access_logs_select ON kyc_access_logs
    FOR SELECT
    USING (
        current_setting('app.current_user_role', true) IN ('SUPER_ADMIN')
    );

DROP POLICY IF EXISTS kyc_access_logs_insert ON kyc_access_logs;
CREATE POLICY kyc_access_logs_insert ON kyc_access_logs
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

ALTER TABLE organiser_kyc_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE kyc_access_logs FORCE ROW LEVEL SECURITY;
