-- ============================================================================
-- Vexora Esports Tournament Platform
-- Phase 35: Privacy, Compliance, Localisation & Accessibility
-- Migration 028: Data Processing Register, Granular Revocable Consents,
--                Guardian Consents (Minors), Data Subject Requests (DPDP),
--                Data Retention Policies & Disposal, Vendor Register,
--                Statutory Takedowns (IT Rules 2021)
-- ============================================================================

-- 1. Data Processing Register (Data Map / Art. 30 GDPR / DPDP Section 8)
CREATE TABLE IF NOT EXISTS data_processing_register (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_class          VARCHAR(50) NOT NULL UNIQUE,
    data_elements       TEXT[] NOT NULL,
    lawful_basis        VARCHAR(50) NOT NULL,
    processing_purpose  TEXT NOT NULL,
    retention_period    VARCHAR(100) NOT NULL,
    storage_tier        VARCHAR(50) NOT NULL,
    is_pii              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed processing register according to ADR-013 & DPDP Act 2023
INSERT INTO data_processing_register (data_class, data_elements, lawful_basis, processing_purpose, retention_period, storage_tier, is_pii)
VALUES
    ('CLASS_A_ACCOUNT', ARRAY['username', 'email', 'phone', 'linked_auth_uid'], 'CONTRACT_NECESSITY', 'User registration and identity management (IT Rules Rule 3(1)(h))', 'Active account + 180 days post-deletion', 'HOT_DB_THEN_COLD_ARCHIVE', TRUE),
    ('CLASS_B_GAME_IDS', ARRAY['in_game_uid', 'ign', 'game_stats'], 'LEGITIMATE_INTEREST', 'Tournament match routing and anti-smurfing duplicate checks', 'Active account lifetime (anonymised on deletion)', 'HOT_DB', FALSE),
    ('CLASS_C_MATCH_EVIDENCE', ARRAY['screenshots', 'video_clips', 'evidence_hashes'], 'CONTRACT_DISPUTES', 'Match result verification, anti-cheat audit, and dispute appeals', '12 months from tournament settlement', 'MINIO_ENCRYPTED_S3', FALSE),
    ('CLASS_D_COMMUNICATIONS', ARRAY['lobby_chat', 'support_tickets', 'abuse_reports'], 'LEGAL_COMPLIANCE', 'Platform safety, community moderation, and law enforcement requests', '90 days active, 180 days archived', 'POSTGRES_THEN_PURGE', TRUE),
    ('CLASS_E_FINANCIAL_LEDGER', ARRAY['ledger_entries', 'voucher_claims', 'tds_records'], 'STATUTORY_LEGAL_DUTY', 'PMLA and Income Tax Act Section 194BA statutory financial compliance', '5 years from financial year end', 'IMMUTABLE_WORM_LEDGER', TRUE),
    ('CLASS_F_KYC_VERIFICATION', ARRAY['pan_number', 'aadhaar_redacted', 'full_name', 'dob'], 'STATUTORY_LEGAL_DUTY', 'RBI KYC Directions and Prevention of Money Laundering Act', '5 years post-account closure (AES-256 encrypted)', 'RESTRICTED_VAULT', TRUE),
    ('CLASS_G_SECURITY_LOGS', ARRAY['audit_hash_chain', 'ip_hashes', 'admin_actions'], 'LEGAL_COMPLIANCE', 'CERT-In cyber incident reporting directions & forensic integrity', '5 years (tamper-evident hash chain)', 'APPEND_ONLY_ARCHIVE', FALSE)
ON CONFLICT (data_class) DO UPDATE
SET data_elements = EXCLUDED.data_elements,
    retention_period = EXCLUDED.retention_period;

-- 2. Granular Revocable Consent (DPDP Section 6)
CREATE TABLE IF NOT EXISTS user_consents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type        VARCHAR(50) NOT NULL CHECK (consent_type IN ('ANALYTICS', 'MARKETING_NOTIFICATIONS', 'LOCATION_TELEMETRY', 'MATCH_NOTIFICATIONS', 'THIRD_PARTY_SHARING')),
    is_granted          BOOLEAN NOT NULL DEFAULT FALSE,
    granted_at          TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    ip_hash             VARCHAR(64),
    consent_version     VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_consent_type UNIQUE (user_id, consent_type)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id);

-- 3. Guardian Consent for Minors (Ages 16-17, ADR-009 / DPDP Section 9)
CREATE TABLE IF NOT EXISTS guardian_consents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    minor_dob           DATE NOT NULL,
    guardian_name       VARCHAR(150) NOT NULL,
    guardian_email      VARCHAR(255) NOT NULL,
    guardian_phone      VARCHAR(50) NOT NULL,
    verification_token  VARCHAR(64) NOT NULL,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at         TIMESTAMPTZ,
    consent_ip_hash     VARCHAR(64),
    consent_method      VARCHAR(50) NOT NULL DEFAULT 'EMAIL_OTP',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardian_consents_user ON guardian_consents(user_id);

-- 4. Data Subject Rights Requests (DPDP Chapter III - Access, Correction, Erasure)
CREATE TABLE IF NOT EXISTS data_subject_requests (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    request_type        VARCHAR(50) NOT NULL CHECK (request_type IN ('EXPORT_DATA', 'CORRECT_DATA', 'DELETE_ACCOUNT', 'RESTRICT_PROCESSING')),
    status              VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')),
    sla_due_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    verification_token  VARCHAR(64),
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    export_archive_url  TEXT,
    rejection_reason    TEXT,
    completed_at        TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsr_user ON data_subject_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_dsr_status ON data_subject_requests(status);
CREATE INDEX IF NOT EXISTS idx_dsr_sla ON data_subject_requests(sla_due_at);

-- 5. Data Retention Policies & Automated Disposal Reports (ADR-013)
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_class          VARCHAR(50) NOT NULL UNIQUE REFERENCES data_processing_register(data_class),
    retention_days      INT NOT NULL,
    disposal_action     VARCHAR(50) NOT NULL CHECK (disposal_action IN ('HARD_DELETE', 'PSEUDONYMISE', 'COLD_ARCHIVE')),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO data_retention_policies (data_class, retention_days, disposal_action, is_active)
VALUES
    ('CLASS_A_ACCOUNT', 180, 'PSEUDONYMISE', TRUE),
    ('CLASS_C_MATCH_EVIDENCE', 365, 'HARD_DELETE', TRUE),
    ('CLASS_D_COMMUNICATIONS', 90, 'HARD_DELETE', TRUE)
ON CONFLICT (data_class) DO UPDATE
SET retention_days = EXCLUDED.retention_days;

CREATE TABLE IF NOT EXISTS data_disposal_reports (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id              VARCHAR(100) NOT NULL,
    executed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    records_purged      INT NOT NULL DEFAULT 0,
    classes_affected    TEXT[] NOT NULL,
    summary_report      JSONB NOT NULL,
    signed_hash         VARCHAR(64) NOT NULL
);

-- 6. Third-Party Vendor Register (Processors / Sub-processors)
CREATE TABLE IF NOT EXISTS data_processor_vendors (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_name         VARCHAR(100) NOT NULL UNIQUE,
    service_provided    VARCHAR(150) NOT NULL,
    data_processed      TEXT[] NOT NULL,
    data_residency      VARCHAR(50) NOT NULL DEFAULT 'INDIA (Mumbai/Bengaluru)',
    dpa_executed        BOOLEAN NOT NULL DEFAULT TRUE,
    soc2_certified      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO data_processor_vendors (vendor_name, service_provided, data_processed, data_residency, dpa_executed, soc2_certified)
VALUES
    ('Firebase (Google Cloud India)', 'Authentication & Push Messaging', ARRAY['Phone number', 'Email', 'FCM device tokens'], 'INDIA (Mumbai / Delhi)', TRUE, TRUE),
    ('AWS Cloud India / MinIO S3', 'Encrypted Media & Match Evidence Storage', ARRAY['Result screenshots', 'Replay evidence'], 'INDIA (Mumbai / Hyderabad)', TRUE, TRUE),
    ('Cashfree / Razorpay India', 'Statutory Payouts & Verification', ARRAY['Bank account number', 'IFSC', 'PAN'], 'INDIA (Bengaluru / Mumbai)', TRUE, TRUE),
    ('Sentry Observability', 'Crash Reporting & Error Telemetry', ARRAY['Anonymised error traces', 'Device OS build'], 'EU / US Privacy Shield', TRUE, TRUE)
ON CONFLICT (vendor_name) DO NOTHING;

-- 7. Statutory Takedown Requests (IT Intermediary Rules 2021)
CREATE TABLE IF NOT EXISTS statutory_takedowns (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_reference   VARCHAR(50) NOT NULL UNIQUE,
    legal_basis         VARCHAR(60) NOT NULL CHECK (legal_basis IN ('RULE_3_2_B_IMPERSONATION_SEXUAL', 'RULE_3_1_D_COURT_ORDER', 'COPYRIGHT_INFRINGEMENT', 'DEFAMATION_HARASSMENT')),
    complainant_name    VARCHAR(150) NOT NULL,
    complainant_email   VARCHAR(255) NOT NULL,
    targeted_content    JSONB NOT NULL,
    statutory_sla_hours INT NOT NULL,
    sla_due_at          TIMESTAMPTZ NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONTENT_QUARANTINED', 'DISMISSED', 'COMPLETED')),
    action_taken        TEXT,
    handled_by          UUID REFERENCES users(id),
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_takedowns_status ON statutory_takedowns(status);
CREATE INDEX IF NOT EXISTS idx_takedowns_sla ON statutory_takedowns(sla_due_at);

-- 8. Row-Level Security
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_takedowns ENABLE ROW LEVEL SECURITY;

-- User consents: users view and edit their own consents
DROP POLICY IF EXISTS consents_user ON user_consents;
CREATE POLICY consents_user ON user_consents FOR ALL
    USING (user_id::text = current_setting('app.current_user_id', true)
           OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN'));

-- Guardian consents: minor sees own, staff views all
DROP POLICY IF EXISTS guardian_select ON guardian_consents;
CREATE POLICY guardian_select ON guardian_consents FOR SELECT
    USING (user_id::text = current_setting('app.current_user_id', true)
           OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN'));

-- Data subject requests: user can view their own requests, admin sees all
DROP POLICY IF EXISTS dsr_user ON data_subject_requests;
CREATE POLICY dsr_user ON data_subject_requests FOR ALL
    USING (user_id::text = current_setting('app.current_user_id', true)
           OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN'));
