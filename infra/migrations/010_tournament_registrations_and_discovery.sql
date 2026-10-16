-- ============================================================================
-- Vexora Database Migration 010: Tournament Registrations & Discovery
-- Phase 16: Discovery & Registration with Concurrency Safety (Last-Slot Race)
-- ============================================================================

-- 1. Extend registration_status enum to cover WAITLISTED and CANCELLED
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONFIRMED' AND enumtypid = 'registration_status'::regtype) THEN
        ALTER TYPE registration_status ADD VALUE 'CONFIRMED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'WAITLISTED' AND enumtypid = 'registration_status'::regtype) THEN
        ALTER TYPE registration_status ADD VALUE 'WAITLISTED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CANCELLED' AND enumtypid = 'registration_status'::regtype) THEN
        ALTER TYPE registration_status ADD VALUE 'CANCELLED';
    END IF;
END $$;

-- 2. Enhance tournament_registrations table
ALTER TABLE tournament_registrations
    ADD COLUMN IF NOT EXISTS participant_type VARCHAR(10) NOT NULL DEFAULT 'SOLO' CHECK (participant_type IN ('SOLO', 'TEAM')),
    ADD COLUMN IF NOT EXISTS slot_number INTEGER,
    ADD COLUMN IF NOT EXISTS waitlist_position INTEGER,
    ADD COLUMN IF NOT EXISTS roster_locked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS roster JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Invariants & Unique Constraints for Concurrency Safety (Section 26 & 39)
-- Invariant: Slot number must be strictly unique per tournament (Zero slot collision)
CREATE UNIQUE INDEX IF NOT EXISTS uq_tourn_slot_active
    ON tournament_registrations (tournament_id, slot_number)
    WHERE slot_number IS NOT NULL AND status IN ('CONFIRMED', 'CHECKED_IN');

-- Invariant: A user cannot hold multiple active registrations in the same tournament
CREATE UNIQUE INDEX IF NOT EXISTS uq_tourn_user_active
    ON tournament_registrations (tournament_id, user_id)
    WHERE user_id IS NOT NULL AND status IN ('CONFIRMED', 'WAITLISTED', 'CHECKED_IN');

-- Invariant: A team cannot hold multiple active registrations in the same tournament
CREATE UNIQUE INDEX IF NOT EXISTS uq_tourn_team_active
    ON tournament_registrations (tournament_id, team_id)
    WHERE team_id IS NOT NULL AND status IN ('CONFIRMED', 'WAITLISTED', 'CHECKED_IN');

-- Invariant: Positive slot number constraint
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_slot_positive'
    ) THEN
        ALTER TABLE tournament_registrations
            ADD CONSTRAINT chk_slot_positive
            CHECK (slot_number IS NULL OR slot_number > 0);
    END IF;
END $$;

-- Invariant: Positive waitlist position constraint
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_waitlist_pos_positive'
    ) THEN
        ALTER TABLE tournament_registrations
            ADD CONSTRAINT chk_waitlist_pos_positive
            CHECK (waitlist_position IS NULL OR waitlist_position > 0);
    END IF;
END $$;

-- 4. Fast Query Indexes for Discovery & Waitlist Processing
CREATE INDEX IF NOT EXISTS idx_tourn_reg_status_lookup
    ON tournament_registrations (tournament_id, status);

CREATE INDEX IF NOT EXISTS idx_tourn_reg_waitlist_order
    ON tournament_registrations (tournament_id, waitlist_position ASC)
    WHERE status = 'WAITLISTED';

-- Composite Discovery Indexes on tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_discovery
    ON tournaments (status, start_time, game_id, format, visibility);

-- 5. Row-Level Security on tournament_registrations
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can view registrations for public tournaments
DROP POLICY IF EXISTS rls_tournament_registrations_select ON tournament_registrations;
CREATE POLICY rls_tournament_registrations_select ON tournament_registrations
    FOR SELECT
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = tournament_registrations.tournament_id
              AND (t.visibility = 'PUBLIC' OR t.organiser_id = current_setting('app.current_user_id', true)::uuid)
        )
    );

-- Insert permitted for authenticated user registering themselves or their team
DROP POLICY IF EXISTS rls_tournament_registrations_insert ON tournament_registrations;
CREATE POLICY rls_tournament_registrations_insert ON tournament_registrations
    FOR INSERT
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::uuid
    );

-- Update permitted for owner or organiser/admin
DROP POLICY IF EXISTS rls_tournament_registrations_update ON tournament_registrations;
CREATE POLICY rls_tournament_registrations_update ON tournament_registrations
    FOR UPDATE
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = tournament_registrations.tournament_id
              AND t.organiser_id = current_setting('app.current_user_id', true)::uuid
        )
    );
