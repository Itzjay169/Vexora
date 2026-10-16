-- ============================================================================
-- Vexora Database Migration 009: Tournament State Machine & Versioned Rules
-- Phase 15: Safe, Validated Tournament Lifecycle & Organiser Wizard
-- ============================================================================

-- 1. Extend tournament_status enum to cover all 11 canonical Blueprint states:
--    DRAFT -> PENDING_REVIEW -> SCHEDULED -> REGISTRATION_OPEN -> CHECK_IN ->
--    LIVE -> RESULT_PENDING -> DISPUTED -> COMPLETED -> SETTLED -> ARCHIVED
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SCHEDULED' AND enumtypid = 'tournament_status'::regtype) THEN
        ALTER TYPE tournament_status ADD VALUE 'SCHEDULED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CHECK_IN' AND enumtypid = 'tournament_status'::regtype) THEN
        ALTER TYPE tournament_status ADD VALUE 'CHECK_IN';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LIVE' AND enumtypid = 'tournament_status'::regtype) THEN
        ALTER TYPE tournament_status ADD VALUE 'LIVE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DISPUTED' AND enumtypid = 'tournament_status'::regtype) THEN
        ALTER TYPE tournament_status ADD VALUE 'DISPUTED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SETTLED' AND enumtypid = 'tournament_status'::regtype) THEN
        ALTER TYPE tournament_status ADD VALUE 'SETTLED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ARCHIVED' AND enumtypid = 'tournament_status'::regtype) THEN
        ALTER TYPE tournament_status ADD VALUE 'ARCHIVED';
    END IF;
END $$;

-- 2. Enhance tournaments table with versioning, mode, and launch constraints
ALTER TABLE tournaments
    ADD COLUMN IF NOT EXISTS rules_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS prize_text VARCHAR(500),
    ADD COLUMN IF NOT EXISTS mode_id UUID REFERENCES game_modes(id),
    ADD COLUMN IF NOT EXISTS disconnect_policy TEXT,
    ADD COLUMN IF NOT EXISTS evidence_requirements JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS server_time_locked BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS last_status_change_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- 3. Launch principle: v1 Public Launch = 100% FREE tournaments only
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_tournaments_v1_free_only'
    ) THEN
        ALTER TABLE tournaments ADD CONSTRAINT chk_tournaments_v1_free_only
            CHECK (entry_fee_credits = 0);
    END IF;
END $$;

-- 4. Create versioned tournament_rules table (Immutable History)
CREATE TABLE IF NOT EXISTS tournament_rules (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id       UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    version             INTEGER NOT NULL DEFAULT 1,
    rule_json           JSONB NOT NULL DEFAULT '{}',
    rules_text          TEXT,
    evidence_policy     JSONB NOT NULL DEFAULT '{}',
    disconnect_policy   TEXT,
    tie_breaker_policy  JSONB NOT NULL DEFAULT '{}',
    change_summary      TEXT,
    changed_by          UUID REFERENCES users(id),
    published_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_tournament_rule_version UNIQUE (tournament_id, version)
);

CREATE INDEX IF NOT EXISTS idx_tournament_rules_tournament ON tournament_rules(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_rules_version ON tournament_rules(tournament_id, version DESC);

-- 5. Immutability trigger: rules cannot be updated or deleted silently
CREATE OR REPLACE FUNCTION prevent_tournament_rules_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'tournament_rules is append-only and versioned; UPDATE or DELETE is strictly forbidden. Create a new version with an incremented version number.'
        USING ERRCODE = '20002';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_tournament_rules ON tournament_rules;
CREATE TRIGGER trg_immutable_tournament_rules
    BEFORE UPDATE OR DELETE ON tournament_rules
    FOR EACH ROW
    EXECUTE FUNCTION prevent_tournament_rules_mutation();

-- 6. Row-Level Security on tournament_rules
ALTER TABLE tournament_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tournament_rules_select ON tournament_rules;
CREATE POLICY tournament_rules_select ON tournament_rules
    FOR SELECT USING (TRUE); -- Rules are publicly transparent for players

DROP POLICY IF EXISTS tournament_rules_insert ON tournament_rules;
CREATE POLICY tournament_rules_insert ON tournament_rules
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = tournament_id
            AND (
                t.organiser_id = NULLIF(current_setting('vexora.current_user_id', true), '')::uuid
                OR current_setting('vexora.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
            )
        )
    );

ALTER TABLE tournament_rules FORCE ROW LEVEL SECURITY;
