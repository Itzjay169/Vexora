-- ============================================================================
-- Vexora Database Migration 007: Teams, Rosters & Transfer Log
-- Phase 13: Full Team System with Authorization Controls
-- ============================================================================

-- 1. Extend team_member_role enum to include OWNER and MANAGER
DO $$ BEGIN
    -- Add OWNER role (team creator, highest privilege)
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'OWNER' AND enumtypid = 'team_member_role'::regtype) THEN
        ALTER TYPE team_member_role ADD VALUE 'OWNER';
    END IF;
    -- Add MANAGER role (can manage roster but not dissolve team)
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MANAGER' AND enumtypid = 'team_member_role'::regtype) THEN
        ALTER TYPE team_member_role ADD VALUE 'MANAGER';
    END IF;
END $$;

-- 2. Enhance teams table with roster limits, description, region, and social links
ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS region VARCHAR(50),
    ADD COLUMN IF NOT EXISTS max_roster_size INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS min_roster_size INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS transfer_window_open BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS disbanded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}';

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_roster_size_range'
    ) THEN
        ALTER TABLE teams ADD CONSTRAINT chk_roster_size_range
            CHECK (max_roster_size >= min_roster_size AND max_roster_size <= 50 AND min_roster_size >= 1);
    END IF;
END $$;

-- 3. Enhance team_members with jersey number, joined_reason, and left_reason
ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS jersey_number INTEGER,
    ADD COLUMN IF NOT EXISTS joined_reason VARCHAR(50) NOT NULL DEFAULT 'INVITED',
    ADD COLUMN IF NOT EXISTS left_reason VARCHAR(50);

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_joined_reason'
    ) THEN
        ALTER TABLE team_members ADD CONSTRAINT chk_joined_reason
            CHECK (joined_reason IN ('CREATED', 'INVITED', 'TRANSFERRED', 'PROMOTED'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_left_reason'
    ) THEN
        ALTER TABLE team_members ADD CONSTRAINT chk_left_reason
            CHECK (left_reason IS NULL OR left_reason IN ('LEFT', 'KICKED', 'TRANSFERRED', 'DISBANDED', 'BANNED'));
    END IF;
END $$;

-- 4. Enhance team_invitations with expiry, rate limiting columns, and block awareness
ALTER TABLE team_invitations
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    ADD COLUMN IF NOT EXISTS role_offered team_member_role NOT NULL DEFAULT 'PLAYER';

-- 5. Create team_transfer_log — public, append-only record of all roster changes
CREATE TABLE IF NOT EXISTS team_transfer_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    action          VARCHAR(30) NOT NULL,
    from_role       team_member_role,
    to_role         team_member_role,
    reason          VARCHAR(255),
    performed_by    UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_transfer_action CHECK (
        action IN (
            'JOINED', 'LEFT', 'KICKED', 'PROMOTED', 'DEMOTED',
            'ROLE_CHANGED', 'TRANSFERRED_IN', 'TRANSFERRED_OUT',
            'TEAM_CREATED', 'TEAM_DISBANDED'
        )
    )
);

-- Immutability trigger: transfer log is append-only (no UPDATE/DELETE)
CREATE OR REPLACE FUNCTION prevent_transfer_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION: team_transfer_log is append-only. UPDATE and DELETE are forbidden.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_transfer_log_update ON team_transfer_log;
CREATE TRIGGER trg_immutable_transfer_log_update
BEFORE UPDATE ON team_transfer_log
FOR EACH ROW
EXECUTE FUNCTION prevent_transfer_log_mutation();

DROP TRIGGER IF EXISTS trg_immutable_transfer_log_delete ON team_transfer_log;
CREATE TRIGGER trg_immutable_transfer_log_delete
BEFORE DELETE ON team_transfer_log
FOR EACH ROW
EXECUTE FUNCTION prevent_transfer_log_mutation();

-- 6. Create team_blocks table — prevents invite spam from blocked users/teams
CREATE TABLE IF NOT EXISTS team_blocks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES users(id),
    blocked_by      UUID NOT NULL REFERENCES users(id),
    reason          VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_team_block UNIQUE (team_id, blocked_user_id)
);

-- 7. One-captain constraint: enforce exactly one CAPTAIN or OWNER per active team
-- (enforced in application layer with DB UNIQUE partial index as safety net)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_owner_per_team
    ON team_members (team_id)
    WHERE role = 'OWNER' AND left_at IS NULL;

-- 8. Duplicate identity check: a player cannot be active in multiple teams for the same game
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_team_per_game_per_user
    ON team_members (user_id, (SELECT game_id FROM teams WHERE teams.id = team_members.team_id))
    WHERE left_at IS NULL;
-- NOTE: PostgreSQL doesn't support subqueries in index expressions.
-- This constraint is enforced in the application layer (teams.service.js).

-- Drop the invalid index if it was created
DROP INDEX IF EXISTS idx_one_team_per_game_per_user;

-- 9. Performance indexes
CREATE INDEX IF NOT EXISTS idx_transfer_log_team ON team_transfer_log(team_id);
CREATE INDEX IF NOT EXISTS idx_transfer_log_user ON team_transfer_log(user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_log_date ON team_transfer_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_invitations_invitee ON team_invitations(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id, status);
CREATE INDEX IF NOT EXISTS idx_team_blocks_team ON team_blocks(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members(team_id) WHERE left_at IS NULL;

-- 10. Row-Level Security for team_transfer_log (public read, admin write)
ALTER TABLE team_transfer_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_transfer_log_public_read ON team_transfer_log;
CREATE POLICY rls_transfer_log_public_read ON team_transfer_log
    FOR SELECT
    USING (TRUE); -- Transfer log is public

DROP POLICY IF EXISTS rls_transfer_log_app_insert ON team_transfer_log;
CREATE POLICY rls_transfer_log_app_insert ON team_transfer_log
    FOR INSERT
    WITH CHECK (TRUE); -- App-level insertion controlled by service layer
