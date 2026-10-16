-- ============================================================================
-- Vexora Database Migration 014: Scoring Engine, Leaderboards & Season Stats
-- Phase 20: Reproducible Scoring, Single-Transaction Leaderboards & Snapshots
-- Specifications: Blueprint Sections 5, 7, 16, 39, 42; ADR-002, ADR-015
-- ============================================================================

-- 1. Global / Seasonal Leaderboard Entries Table (Blueprint Section 7 & 16)
CREATE TABLE IF NOT EXISTS leaderboard_entries (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id                 UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    season_id               UUID REFERENCES seasons(id) ON DELETE CASCADE,
    participant_id          UUID NOT NULL, -- user_id or team_id
    participant_type        VARCHAR(10) NOT NULL DEFAULT 'USER',
    rank_position           INTEGER NOT NULL DEFAULT 0,
    total_points            INTEGER NOT NULL DEFAULT 0, -- ADR-015: strict integer arithmetic
    placement_points        INTEGER NOT NULL DEFAULT 0,
    kill_points             INTEGER NOT NULL DEFAULT 0,
    bonus_points            INTEGER NOT NULL DEFAULT 0,
    kills                   INTEGER NOT NULL DEFAULT 0,
    matches_played          INTEGER NOT NULL DEFAULT 0,
    wins                    INTEGER NOT NULL DEFAULT 0, -- 1st place finishes (WWCD / Booyahs)
    win_rate                NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    average_placement       NUMERIC(5,2) DEFAULT 0.00,
    first_place_finishes    INTEGER NOT NULL DEFAULT 0,
    last_match_placement    INTEGER DEFAULT NULL,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_lb_participant_type CHECK (participant_type IN ('USER', 'TEAM')),
    CONSTRAINT chk_lb_points_non_negative CHECK (total_points >= 0),
    CONSTRAINT chk_lb_rank_non_negative CHECK (rank_position >= 0),
    CONSTRAINT chk_lb_matches_positive CHECK (matches_played >= 0),
    CONSTRAINT chk_lb_wins_valid CHECK (wins <= matches_played),
    CONSTRAINT uq_leaderboard_season_participant UNIQUE (game_id, season_id, participant_id)
);

-- Fast lookup indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_game_season_rank
    ON leaderboard_entries (game_id, season_id, rank_position ASC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_participant
    ON leaderboard_entries (participant_id, participant_type);

CREATE INDEX IF NOT EXISTS idx_leaderboard_total_points
    ON leaderboard_entries (game_id, total_points DESC, updated_at DESC);


-- 2. Player Season Stats Table (Blueprint Section 7 & 16)
-- System of record for a player's seasonal aggregate statistics
CREATE TABLE IF NOT EXISTS season_stats (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id               UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    game_id                 UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    matches_played          INTEGER NOT NULL DEFAULT 0,
    wins                    INTEGER NOT NULL DEFAULT 0,
    podiums                 INTEGER NOT NULL DEFAULT 0, -- Top 3 finishes
    total_kills             INTEGER NOT NULL DEFAULT 0,
    total_placement_points  INTEGER NOT NULL DEFAULT 0,
    total_kill_points       INTEGER NOT NULL DEFAULT 0,
    total_points            INTEGER NOT NULL DEFAULT 0,
    average_placement       NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    win_rate                NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    current_rank            INTEGER NOT NULL DEFAULT 0,
    highest_rank            INTEGER NOT NULL DEFAULT 0,
    fair_play_score         INTEGER NOT NULL DEFAULT 100,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_season_stats_matches_positive CHECK (matches_played >= 0),
    CONSTRAINT chk_season_stats_wins_valid CHECK (wins <= matches_played),
    CONSTRAINT chk_season_stats_points_positive CHECK (total_points >= 0),
    CONSTRAINT chk_season_stats_kills_positive CHECK (total_kills >= 0),
    CONSTRAINT uq_season_stats_user UNIQUE (season_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_season_stats_user_game
    ON season_stats (user_id, game_id);

CREATE INDEX IF NOT EXISTS idx_season_stats_season_rank
    ON season_stats (season_id, current_rank ASC);


-- 3. Leaderboard Snapshots Table (Blueprint Section 7, 16, 42)
-- Historical append-only snapshots preserving reproducible rankings over time
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id             UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    season_id           UUID REFERENCES seasons(id) ON DELETE CASCADE,
    snapshot_type       VARCHAR(20) NOT NULL,
    snapshot_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    total_participants  INTEGER NOT NULL DEFAULT 0,
    rankings_payload    JSONB NOT NULL DEFAULT '[]',
    merkle_root         VARCHAR(64) NOT NULL, -- SHA-256 seal of the rankings payload
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_snapshot_type CHECK (snapshot_type IN ('DAILY', 'WEEKLY', 'SEASON_END', 'POST_MATCH'))
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_game_season
    ON leaderboard_snapshots (game_id, season_id, created_at DESC);

-- Immutability trigger: Leaderboard historical snapshots can NEVER be updated or deleted
CREATE OR REPLACE FUNCTION prevent_leaderboard_snapshot_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'IMMUTABILITY VIOLATION: Leaderboard snapshots are append-only and cannot be altered or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_leaderboard_snapshots ON leaderboard_snapshots;
CREATE TRIGGER trg_immutable_leaderboard_snapshots
    BEFORE UPDATE OR DELETE ON leaderboard_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION prevent_leaderboard_snapshot_mutation();


-- 4. Row-Level Security Policies
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read access for competitive transparency
CREATE POLICY rls_leaderboard_entries_public_read
    ON leaderboard_entries FOR SELECT
    USING (TRUE);

CREATE POLICY rls_season_stats_public_read
    ON season_stats FOR SELECT
    USING (TRUE);

CREATE POLICY rls_leaderboard_snapshots_public_read
    ON leaderboard_snapshots FOR SELECT
    USING (TRUE);
