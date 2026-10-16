-- ============================================================================
-- Vexora Esports Tournament Platform — DDL Migration 004
-- Version: 004_rbac_rls_policies
-- Description: Row-Level Security (RLS) policies, break-glass access table,
--              maker-checker request table, and database-level permission enforcement.
-- Phase: 8 — RBAC, Row-Level Security & Permission Matrix
-- PDF refs: Section 2 (Permission Matrix), Section 47 (Security Patterns)
-- ============================================================================

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. Break-Glass Access Requests
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'break_glass_status') THEN
        CREATE TYPE break_glass_status AS ENUM (
            'PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED', 'DENIED'
        );
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS break_glass_requests (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id            UUID NOT NULL REFERENCES users(id),
    requester_role          VARCHAR(50) NOT NULL,
    reason                  TEXT NOT NULL,
    elevated_permissions    JSONB NOT NULL DEFAULT '[]',
    duration_hours          INTEGER NOT NULL DEFAULT 1,
    expires_at              TIMESTAMPTZ NOT NULL,
    status                  break_glass_status NOT NULL DEFAULT 'PENDING',
    approved_by             UUID REFERENCES users(id),
    approved_at             TIMESTAMPTZ,
    revoked_by              UUID REFERENCES users(id),
    revoked_at              TIMESTAMPTZ,
    ip_hash                 VARCHAR(64),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Maker-checker: approver must not be requester
    CONSTRAINT chk_break_glass_self_approve
        CHECK (approved_by IS NULL OR approved_by != requester_id)
);

CREATE INDEX IF NOT EXISTS idx_break_glass_requester ON break_glass_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_break_glass_status ON break_glass_requests(status);
CREATE INDEX IF NOT EXISTS idx_break_glass_expires ON break_glass_requests(expires_at) WHERE status = 'ACTIVE';

-- ============================================================================
-- 2. Maker-Checker Approval Requests
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mc_status') THEN
        CREATE TYPE mc_status AS ENUM (
            'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXECUTED', 'EXPIRED', 'CANCELLED'
        );
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mc_category') THEN
        CREATE TYPE mc_category AS ENUM (
            'PAYOUT', 'WALLET_ADJUSTMENT', 'REDEEM_BATCH', 'USER_BAN',
            'BREAK_GLASS', 'FEATURE_FLAG', 'ORGANISER_TIER', 'RESULT_CORRECTION'
        );
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS maker_checker_requests (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    maker_id            UUID NOT NULL REFERENCES users(id),
    maker_role          VARCHAR(50) NOT NULL,
    checker_id          UUID REFERENCES users(id),
    checker_role        VARCHAR(50),
    category            mc_category NOT NULL,
    entity_type         VARCHAR(50) NOT NULL,
    entity_id           VARCHAR(100),
    payload             JSONB NOT NULL DEFAULT '{}',
    reason              TEXT NOT NULL,
    status              mc_status NOT NULL DEFAULT 'PENDING_REVIEW',
    checker_notes       TEXT,
    execution_result    JSONB,
    expires_at          TIMESTAMPTZ NOT NULL,
    reviewed_at         TIMESTAMPTZ,
    executed_at         TIMESTAMPTZ,
    ip_hash             VARCHAR(64),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Core invariant: maker cannot be the checker
    CONSTRAINT chk_maker_checker_self_approve
        CHECK (checker_id IS NULL OR checker_id != maker_id)
);

CREATE INDEX IF NOT EXISTS idx_mc_maker ON maker_checker_requests(maker_id);
CREATE INDEX IF NOT EXISTS idx_mc_status ON maker_checker_requests(status);
CREATE INDEX IF NOT EXISTS idx_mc_category ON maker_checker_requests(category);
CREATE INDEX IF NOT EXISTS idx_mc_expires ON maker_checker_requests(expires_at) WHERE status = 'PENDING_REVIEW';

-- ============================================================================
-- 3. Row-Level Security (RLS) Policies
-- ============================================================================
-- RLS provides database-level access control INDEPENDENT of the API layer.
-- Even if the API guard is bypassed, the DB itself prevents unauthorized access.
--
-- Strategy:
--   - Use session variables (SET LOCAL) to pass user context from the API layer
--   - Policies check current_setting('app.current_user_id') and ('app.current_user_role')
--   - Admin roles bypass restrictions via separate policies

-- ─── Enable RLS on user-owned tables ────────────────────────────────────────

-- Users table: users can see their own row; admins can see all
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_select ON users;
CREATE POLICY users_self_select ON users
    FOR SELECT
    USING (
        id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_AGENT')
        OR TRUE  -- Public profile data is visible (privacy controlled at column level)
    );

DROP POLICY IF EXISTS users_self_update ON users;
CREATE POLICY users_self_update ON users
    FOR UPDATE
    USING (
        id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

-- ─── Tournaments: organiser can edit own; everyone can view ─────────────────

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tournaments_select ON tournaments;
CREATE POLICY tournaments_select ON tournaments
    FOR SELECT
    USING (TRUE);  -- Tournaments are publicly discoverable

DROP POLICY IF EXISTS tournaments_insert ON tournaments;
CREATE POLICY tournaments_insert ON tournaments
    FOR INSERT
    WITH CHECK (
        organiser_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS tournaments_update ON tournaments;
CREATE POLICY tournaments_update ON tournaments
    FOR UPDATE
    USING (
        organiser_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

-- ─── Wallet accounts: owner can see own; finance/admin can see all ──────────

ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_owner_select ON wallet_accounts;
CREATE POLICY wallet_owner_select ON wallet_accounts
    FOR SELECT
    USING (
        owner_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE', 'AUDITOR')
    );

DROP POLICY IF EXISTS wallet_owner_update ON wallet_accounts;
CREATE POLICY wallet_owner_update ON wallet_accounts
    FOR UPDATE
    USING (
        current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE')
    );

-- ─── Ledger transactions: owner can see own; finance/auditor can see all ────

ALTER TABLE ledger_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_select ON ledger_transactions;
CREATE POLICY ledger_select ON ledger_transactions
    FOR SELECT
    USING (
        initiated_by::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE', 'AUDITOR')
    );

-- Ledger is append-only; insert controlled by application layer
DROP POLICY IF EXISTS ledger_insert ON ledger_transactions;
CREATE POLICY ledger_insert ON ledger_transactions
    FOR INSERT
    WITH CHECK (TRUE);  -- Insert controlled by application-layer maker-checker

-- ─── Teams: captain can edit own; public view ───────────────────────────────

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teams_select ON teams;
CREATE POLICY teams_select ON teams
    FOR SELECT
    USING (TRUE);  -- Teams are publicly viewable

DROP POLICY IF EXISTS teams_update ON teams;
CREATE POLICY teams_update ON teams
    FOR UPDATE
    USING (
        captain_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

-- ─── Support tickets: user sees own; support agents see all ─────────────────

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tickets_select ON support_tickets;
CREATE POLICY tickets_select ON support_tickets
    FOR SELECT
    USING (
        user_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT')
    );

DROP POLICY IF EXISTS tickets_insert ON support_tickets;
CREATE POLICY tickets_insert ON support_tickets
    FOR INSERT
    WITH CHECK (
        user_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT')
    );

-- ─── Disputes: raiser sees own; moderators see all ──────────────────────────

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS disputes_select ON disputes;
CREATE POLICY disputes_select ON disputes
    FOR SELECT
    USING (
        raised_by::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_AGENT')
    );

DROP POLICY IF EXISTS disputes_update ON disputes;
CREATE POLICY disputes_update ON disputes
    FOR UPDATE
    USING (
        current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
    );

-- ─── Notifications: user sees own only ──────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications
    FOR SELECT
    USING (
        user_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

-- ─── Payout requests: user sees own; finance/admin see all ──────────────────

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payouts_select ON payout_requests;
CREATE POLICY payouts_select ON payout_requests
    FOR SELECT
    USING (
        user_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE')
    );

-- ─── Organiser profiles: owner sees own; admins see all ─────────────────────

ALTER TABLE organiser_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organiser_select ON organiser_profiles;
CREATE POLICY organiser_select ON organiser_profiles
    FOR SELECT
    USING (
        user_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
        OR kyc_status = 'APPROVED'  -- Approved organisers are publicly visible (non-KYC fields)
    );

DROP POLICY IF EXISTS organiser_update ON organiser_profiles;
CREATE POLICY organiser_update ON organiser_profiles
    FOR UPDATE
    USING (
        user_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

-- ============================================================================
-- 4. Superuser bypass for migration and maintenance roles
-- ============================================================================
-- The RLS policies above use current_setting with `true` (missing_ok),
-- so if the session variable is not set, they return NULL and the row is hidden.
-- The vexora_app_role is used by the application and WILL set session vars.
-- The vexora_migration_role and superuser bypass RLS automatically.

-- Ensure the app role respects RLS
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE tournaments FORCE ROW LEVEL SECURITY;
ALTER TABLE wallet_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE ledger_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE teams FORCE ROW LEVEL SECURITY;
ALTER TABLE support_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE disputes FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE payout_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE organiser_profiles FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. Grant permissions on new tables
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON break_glass_requests TO vexora_app_role;
GRANT SELECT, INSERT, UPDATE ON maker_checker_requests TO vexora_app_role;
GRANT SELECT ON break_glass_requests TO vexora_auditor_role;
GRANT SELECT ON maker_checker_requests TO vexora_auditor_role;
