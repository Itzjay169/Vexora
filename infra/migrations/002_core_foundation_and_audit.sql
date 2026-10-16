-- ============================================================================
-- Vexora Esports Tournament Platform — DDL Migration 002
-- Version: 002_core_foundation_and_audit
-- Description: Core identity tables (roles, permissions, devices, MFA, feature flags),
--              tamper-evident audit chain enforcements, and least-privilege DB roles.
-- ============================================================================

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. RBAC: Roles and Permissions ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(50) NOT NULL UNIQUE,
    description     TEXT,
    is_system_role  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    module          VARCHAR(50) NOT NULL,
    action          VARCHAR(50) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by     UUID REFERENCES users(id),
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- ─── 2. Devices and Session Tracking ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_devices (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint_hash     VARCHAR(64) NOT NULL,
    platform                    VARCHAR(20) NOT NULL, -- 'ANDROID', 'IOS', 'WEB', 'DESKTOP'
    device_model                VARCHAR(100),
    os_version                  VARCHAR(50),
    app_version                 VARCHAR(20),
    push_token                  TEXT,
    trust_level                 VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED', -- 'UNVERIFIED', 'TRUSTED', 'BLOCKED'
    first_seen                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_user_device UNIQUE (user_id, device_fingerprint_hash)
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON user_devices(device_fingerprint_hash);

-- Enhance user_sessions with device linkage and security metadata
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES user_devices(id);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

-- ─── 3. Multi-Factor Authentication (MFA) ────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mfa_type') THEN
        CREATE TYPE mfa_type AS ENUM ('TOTP', 'WEBAUTHN', 'SMS');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS mfa_factors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            mfa_type NOT NULL,
    secret_ref      VARCHAR(255) NOT NULL, -- Reference to KMS/Secret vault, NEVER raw secret
    label           VARCHAR(50),
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_user_mfa_type UNIQUE (user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_mfa_user ON mfa_factors(user_id);

-- ─── 4. Tamper-Evident Audit Log Enhancements ────────────────────────────────

-- Add state diffing, device link, reason, and request correlation to audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_state JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_state JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(128);

-- Ensure strict sequence and indexes on audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_request_id ON audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_curr_hash ON audit_logs(curr_hash);

-- Re-affirm tamper-evident triggers forbidding UPDATE and DELETE
CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION: audit_logs rows are immutable. UPDATE and DELETE are strictly forbidden by database trigger.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON audit_logs;
CREATE TRIGGER trg_prevent_audit_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_tampering();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON audit_logs;
CREATE TRIGGER trg_prevent_audit_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_tampering();

-- Checkpoints table enhancements for Merkle root and SEV1 tracking
CREATE TABLE IF NOT EXISTS audit_chain_checkpoints (
    id                  BIGSERIAL PRIMARY KEY,
    checkpoint_index    BIGINT NOT NULL UNIQUE,
    checkpoint_date     DATE NOT NULL,
    from_log_id         BIGINT NOT NULL,
    to_log_id           BIGINT NOT NULL,
    merkle_root         VARCHAR(64) NOT NULL,
    signature           TEXT,
    verified_count      INTEGER NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'VALID', -- 'VALID', 'SEV1_CORRUPTED'
    signed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_date ON audit_chain_checkpoints(checkpoint_date);

-- ─── 5. Feature Flags (Regional & Operational Controls) ──────────────────────

CREATE TABLE IF NOT EXISTS feature_flags (
    key                 VARCHAR(100) PRIMARY KEY,
    enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    rollout_percent     INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
    audience            JSONB DEFAULT '{"regions": ["IN"], "tiers": ["ALL"]}',
    metadata            JSONB DEFAULT '{}',
    description         TEXT,
    updated_by          UUID REFERENCES users(id),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. Least-Privilege Database Roles (Zero-Trust Security Gate) ────────────

DO $$
BEGIN
    -- Application role: Read/Write business entities, INSERT/SELECT audit, NO UPDATE/DELETE on audit
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vexora_app_role') THEN
        CREATE ROLE vexora_app_role NOLOGIN;
    END IF;

    -- Auditor role: Read-only on audit_logs, audit_chain_checkpoints, ledger
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vexora_auditor_role') THEN
        CREATE ROLE vexora_auditor_role NOLOGIN;
    END IF;

    -- Migration role: DDL execution rights
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vexora_migration_role') THEN
        CREATE ROLE vexora_migration_role NOLOGIN;
    END IF;
END$$;

-- Grant permissions for vexora_app_role
GRANT USAGE ON SCHEMA public TO vexora_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vexora_app_role;
-- Explicitly revoke UPDATE and DELETE on immutable audit and ledger tables
REVOKE UPDATE, DELETE ON audit_logs FROM vexora_app_role;
REVOKE UPDATE, DELETE ON audit_chain_checkpoints FROM vexora_app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vexora_app_role;

-- Grant permissions for vexora_auditor_role (Strictly Read-Only)
GRANT USAGE ON SCHEMA public TO vexora_auditor_role;
GRANT SELECT ON audit_logs, audit_chain_checkpoints TO vexora_auditor_role;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM vexora_auditor_role;
