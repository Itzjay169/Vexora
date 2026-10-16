-- ============================================================================
-- Vexora Database Migration 016: Reports, Disputes, Moderation, Sanctions & Risk
-- Phase 23: Fair, Auditable Problem Handling, Settlement Freezes & Maker-Checker Appeals
-- Specifications: Blueprint Sections 11, 19, 26, 39 (Phase 5); ADR-002, ADR-004
-- ============================================================================

-- 1. Enhance Reports Table (Player, Team, Organiser, Result, Chat)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reports' AND column_name = 'target_type'
    ) THEN
        ALTER TABLE reports
            ADD COLUMN target_type VARCHAR(30) NOT NULL DEFAULT 'PLAYER',
            ADD COLUMN reported_target_id UUID,
            ADD COLUMN policy_clause VARCHAR(100),
            ADD COLUMN evidence_hashes VARCHAR(64)[] DEFAULT '{}',
            ADD COLUMN reporter_ip_hash VARCHAR(64),
            ADD COLUMN risk_priority INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_status_priority
    ON reports (status, risk_priority DESC, created_at ASC);

-- 2. Enhance Disputes Table (Settlement Freeze, SLA Deadline, Policy Clauses & Appeals)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'disputes' AND column_name = 'case_id'
    ) THEN
        ALTER TABLE disputes
            ADD COLUMN case_id VARCHAR(50) UNIQUE,
            ADD COLUMN settlement_frozen BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN settlement_frozen_at TIMESTAMPTZ DEFAULT NOW(),
            ADD COLUMN evidence_hashes VARCHAR(64)[] DEFAULT '{}',
            ADD COLUMN policy_clause VARCHAR(100),
            ADD COLUMN ruling_type VARCHAR(30), -- 'UPHELD', 'OVERTURNED', 'SPLIT', 'DISMISSED'
            ADD COLUMN ruling_reason TEXT,
            ADD COLUMN corrective_action VARCHAR(50) DEFAULT 'NONE', -- 'CORRECT_SCORE', 'REPLAY_MATCH', 'FORFEIT_VIOLATOR', 'NONE'
            ADD COLUMN appeal_window_expires_at TIMESTAMPTZ,
            ADD COLUMN appeal_status VARCHAR(30) NOT NULL DEFAULT 'NONE', -- 'NONE', 'PENDING_APPEAL', 'APPEAL_UPHELD', 'APPEAL_REJECTED'
            ADD COLUMN appeal_text TEXT,
            ADD COLUMN appeal_evidence_hashes VARCHAR(64)[] DEFAULT '{}',
            ADD COLUMN appeal_decided_by UUID REFERENCES users(id),
            ADD COLUMN appeal_decided_at TIMESTAMPTZ,
            ADD COLUMN appeal_reason TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_disputes_match_status
    ON disputes (match_id, status);

CREATE INDEX IF NOT EXISTS idx_disputes_sla_status
    ON disputes (status, sla_deadline ASC);

-- 3. Enhance Sanctions Table (Sanction Ladder & Policy Enforcement)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sanctions' AND column_name = 'policy_clause'
    ) THEN
        ALTER TABLE sanctions
            ADD COLUMN policy_clause VARCHAR(100) NOT NULL DEFAULT 'GENERAL_TERMS',
            ADD COLUMN appeal_deadline TIMESTAMPTZ,
            ADD COLUMN appeal_decided_by UUID REFERENCES users(id),
            ADD COLUMN appeal_decided_at TIMESTAMPTZ,
            ADD COLUMN ip_hash VARCHAR(64);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sanctions_active_user
    ON sanctions (user_id, is_active, expires_at);

-- 4. Risk Signals Table (Signals prioritise review; NEVER auto-ban in high-impact cases)
CREATE TABLE IF NOT EXISTS risk_signals (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_type         VARCHAR(30) NOT NULL, -- 'USER', 'MATCH', 'TEAM', 'ORGANISER'
    target_id           UUID NOT NULL,
    signal_type         VARCHAR(60) NOT NULL, -- 'EMULATOR_DETECTED', 'RAPID_DISPUTE_SPIKE', 'HEADSHOT_ANOMALY', etc.
    confidence_score    NUMERIC(4,3) NOT NULL DEFAULT 0.500, -- 0.000 to 1.000
    risk_weight         INTEGER NOT NULL DEFAULT 10, -- 1 to 100
    payload             JSONB NOT NULL DEFAULT '{}',
    reviewed            BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    action_taken        VARCHAR(50),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_risk_confidence CHECK (confidence_score >= 0.000 AND confidence_score <= 1.000),
    CONSTRAINT chk_risk_weight CHECK (risk_weight >= 1 AND risk_weight <= 100)
);

CREATE INDEX IF NOT EXISTS idx_risk_signals_unreviewed
    ON risk_signals (reviewed, risk_weight DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_risk_signals_target
    ON risk_signals (target_type, target_id, created_at DESC);

-- 5. Moderation Action Logs Table (Immutable audit trail for every disciplinary decision)
CREATE TABLE IF NOT EXISTS moderation_action_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    moderator_id        UUID NOT NULL REFERENCES users(id),
    moderator_role      VARCHAR(50) NOT NULL,
    action_type         VARCHAR(50) NOT NULL, -- 'DISPUTE_RULING', 'APPEAL_DECISION', 'SANCTION_ISSUED', 'SANCTION_REVOKED'
    target_type         VARCHAR(30) NOT NULL,
    target_id           UUID NOT NULL,
    policy_clause       VARCHAR(100) NOT NULL, -- Mandatory policy clause
    reason              TEXT NOT NULL, -- Mandatory justification
    evidence_hashes     VARCHAR(64)[] DEFAULT '{}',
    ip_address          VARCHAR(45) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_logs_moderator
    ON moderation_action_logs (moderator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mod_logs_target
    ON moderation_action_logs (target_type, target_id, created_at DESC);

-- Immutability trigger: prevent update or delete on moderation_action_logs
CREATE OR REPLACE FUNCTION prevent_mod_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'moderation_action_logs is an immutable audit journal: updates and deletions are strictly prohibited'
        USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_mod_log_mutation ON moderation_action_logs;
CREATE TRIGGER trg_prevent_mod_log_mutation
    BEFORE UPDATE OR DELETE ON moderation_action_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_mod_log_mutation();

-- 6. Row-Level Security
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_action_logs ENABLE ROW LEVEL SECURITY;

-- Reports: Reporters can view own reports; staff sees all
DROP POLICY IF EXISTS reports_select ON reports;
CREATE POLICY reports_select ON reports
    FOR SELECT
    USING (
        reporter_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_user_role', true) IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS reports_insert ON reports;
CREATE POLICY reports_insert ON reports
    FOR INSERT
    WITH CHECK (
        reporter_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_user_role', true) IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    );

-- Risk signals & moderation logs: only staff can inspect
DROP POLICY IF EXISTS risk_signals_select ON risk_signals;
CREATE POLICY risk_signals_select ON risk_signals
    FOR SELECT
    USING (
        current_setting('app.current_user_role', true) IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS mod_logs_select ON moderation_action_logs;
CREATE POLICY mod_logs_select ON moderation_action_logs
    FOR SELECT
    USING (
        current_setting('app.current_user_role', true) IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    );
