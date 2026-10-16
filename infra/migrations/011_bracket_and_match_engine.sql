-- ============================================================================
-- Vexora Database Migration 011: Bracket & Match Engine
-- Phase 17: Bracket Generation, Match Scheduling & Secure Room Code Engine
-- ============================================================================

-- 1. Extend match_status enum with blueprint canonical states
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LOBBY_READY' AND enumtypid = 'match_status'::regtype) THEN
        ALTER TYPE match_status ADD VALUE 'LOBBY_READY';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LIVE' AND enumtypid = 'match_status'::regtype) THEN
        ALTER TYPE match_status ADD VALUE 'LIVE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RESULT_SUBMITTED' AND enumtypid = 'match_status'::regtype) THEN
        ALTER TYPE match_status ADD VALUE 'RESULT_SUBMITTED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONFIRMED' AND enumtypid = 'match_status'::regtype) THEN
        ALTER TYPE match_status ADD VALUE 'CONFIRMED';
    END IF;
END $$;

-- 2. Enhance matches table with bracket progression and room release fields
ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS bracket_type VARCHAR(50) NOT NULL DEFAULT 'KNOCKOUT'
        CHECK (bracket_type IN ('KNOCKOUT', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'LEAGUE', 'BATTLE_ROYALE_LOBBY', 'CUSTOM')),
    ADD COLUMN IF NOT EXISTS lobby_group_index INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS stage VARCHAR(50) NOT NULL DEFAULT 'MAIN',
    ADD COLUMN IF NOT EXISTS participant_a_id UUID REFERENCES tournament_registrations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS participant_b_id UUID REFERENCES tournament_registrations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS winner_registration_id UUID REFERENCES tournament_registrations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS loser_registration_id UUID REFERENCES tournament_registrations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS next_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS bye_awarded BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS room_release_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS room_code_released_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_third_place BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Enhance match_participants with seeding and check-in snapshot
ALTER TABLE match_participants
    ADD COLUMN IF NOT EXISTS seed INTEGER,
    ADD COLUMN IF NOT EXISTS is_bye BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS roster_locked_snapshot JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS check_in_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Invariants & Integrity Constraints
-- Invariant: Distinct participants for head-to-head matches
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_distinct_match_participants'
    ) THEN
        ALTER TABLE matches
            ADD CONSTRAINT chk_distinct_match_participants
            CHECK (
                participant_a_id IS NULL OR
                participant_b_id IS NULL OR
                participant_a_id <> participant_b_id
            );
    END IF;
END $$;

-- Invariant: Positive round and match numbers
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_match_number_positive'
    ) THEN
        ALTER TABLE matches
            ADD CONSTRAINT chk_match_number_positive
            CHECK (round_number > 0 AND match_number > 0);
    END IF;
END $$;

-- Unique tournament bracket position constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_match_tournament_position
    ON matches (tournament_id, bracket_type, round_number, match_number, lobby_group_index);

-- 5. Fast Query Indexes
CREATE INDEX IF NOT EXISTS idx_matches_tournament_round
    ON matches (tournament_id, round_number, match_number);

CREATE INDEX IF NOT EXISTS idx_matches_room_release_time
    ON matches (tournament_id, room_release_time, status);

CREATE INDEX IF NOT EXISTS idx_matches_next_match
    ON matches (next_match_id)
    WHERE next_match_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_participant_a
    ON matches (participant_a_id)
    WHERE participant_a_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_participant_b
    ON matches (participant_b_id)
    WHERE participant_b_id IS NOT NULL;

-- 6. Row-Level Security on matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_matches_select ON matches;
CREATE POLICY rls_matches_select ON matches
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = matches.tournament_id
              AND (t.visibility = 'PUBLIC' OR t.organiser_id = current_setting('app.current_user_id', true)::uuid)
        )
    );

DROP POLICY IF EXISTS rls_matches_update ON matches;
CREATE POLICY rls_matches_update ON matches
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = matches.tournament_id
              AND t.organiser_id = current_setting('app.current_user_id', true)::uuid
        )
    );

-- Row-Level Security on match_participants
ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_match_participants_select ON match_participants;
CREATE POLICY rls_match_participants_select ON match_participants
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM matches m
            JOIN tournaments t ON t.id = m.tournament_id
            WHERE m.id = match_participants.match_id
              AND (t.visibility = 'PUBLIC' OR t.organiser_id = current_setting('app.current_user_id', true)::uuid)
        )
    );
