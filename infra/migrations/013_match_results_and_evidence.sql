-- ============================================================================
-- Vexora Database Migration 013: Result Submission, Evidence & Conflict Holds
-- Phase 19: Trustworthy Result Entry & Evidence Integrity
-- ============================================================================

-- 1. Create match_results table (Raw submissions and versioned adjudicated results)
CREATE TABLE IF NOT EXISTS match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES users(id),
    submitting_role VARCHAR(50) NOT NULL DEFAULT 'PLAYER',
    version INTEGER NOT NULL DEFAULT 1,
    is_adjudicated BOOLEAN NOT NULL DEFAULT FALSE,
    participants_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_upload_id UUID REFERENCES media_uploads(id) ON DELETE SET NULL,
    evidence_sha256 VARCHAR(64),
    evidence_url TEXT,
    notes TEXT,
    confirmation_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    confirmation_deadline TIMESTAMPTZ,
    confirmed_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_match_results_idempotency UNIQUE (idempotency_key),
    CONSTRAINT uq_match_version UNIQUE (match_id, version),
    CONSTRAINT chk_result_confirmation_status CHECK (
        confirmation_status IN (
            'PENDING_CONFIRMATION',
            'CONFIRMED',
            'DISPUTED',
            'ADJUDICATED',
            'REJECTED'
        )
    ),
    CONSTRAINT chk_evidence_sha256_format CHECK (
        evidence_sha256 IS NULL OR evidence_sha256 ~* '^[a-f0-9]{64}$'
    )
);

-- 2. Create match_dispute_stubs table (Automatic conflict holds and dispute records)
CREATE TABLE IF NOT EXISTS match_dispute_stubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    submission_a_id UUID REFERENCES match_results(id) ON DELETE SET NULL,
    submission_b_id UUID REFERENCES match_results(id) ON DELETE SET NULL,
    opened_by UUID REFERENCES users(id),
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'HOLD_PENDING_MODERATION',
    settlement_frozen BOOLEAN NOT NULL DEFAULT TRUE,
    resolution_notes TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_dispute_stub_status CHECK (
        status IN (
            'HOLD_PENDING_MODERATION',
            'UNDER_REVIEW',
            'RESOLVED',
            'CANCELLED'
        )
    )
);

-- 3. Immutability trigger for finalized match results (Security Gate)
CREATE OR REPLACE FUNCTION prevent_finalized_result_mutation()
RETURNS TRIGGER AS $$
BEGIN
    -- Forbid modifications to confirmed or adjudicated results
    IF OLD.is_adjudicated = TRUE OR OLD.confirmation_status IN ('CONFIRMED', 'ADJUDICATED') THEN
        IF TG_OP = 'UPDATE' THEN
            RAISE EXCEPTION '🚨 IMMUTABILITY VIOLATION: Finalized match result % cannot be updated in-place. Create a new correction version.', OLD.id;
        ELSIF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION '🚨 IMMUTABILITY VIOLATION: Finalized match result % cannot be deleted.', OLD.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_finalized_match_result ON match_results;
CREATE TRIGGER trg_immutable_finalized_match_result
    BEFORE UPDATE OR DELETE ON match_results
    FOR EACH ROW
    EXECUTE FUNCTION prevent_finalized_result_mutation();

-- 4. Fast Query Indexes
CREATE INDEX IF NOT EXISTS idx_match_results_match_id
    ON match_results(match_id);

CREATE INDEX IF NOT EXISTS idx_match_results_match_version
    ON match_results(match_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_match_results_status
    ON match_results(match_id, confirmation_status);

CREATE INDEX IF NOT EXISTS idx_match_results_evidence_sha256
    ON match_results(evidence_sha256);

CREATE INDEX IF NOT EXISTS idx_match_dispute_stubs_match
    ON match_dispute_stubs(match_id, status);

CREATE INDEX IF NOT EXISTS idx_match_dispute_stubs_tournament
    ON match_dispute_stubs(tournament_id, settlement_frozen);

-- 5. Row-Level Security
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_dispute_stubs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_results_read') THEN
        CREATE POLICY match_results_read ON match_results
            FOR SELECT USING (TRUE); -- Public transparency on tournament match results
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_dispute_stubs_staff_read') THEN
        CREATE POLICY match_dispute_stubs_staff_read ON match_dispute_stubs
            FOR SELECT USING (
                current_setting('vexora.current_role', true) IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
                OR opened_by = current_setting('vexora.current_user_id', true)::uuid
            );
    END IF;
END $$;
