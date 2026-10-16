-- ============================================================================
-- Vexora Database Migration 008: Seasons, Search Indexes & Filters
-- Phase 14: Structured Seasons & High-Performance PostgreSQL Search
-- ============================================================================

-- 1. Enable Full-Text and Trigram Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Seasons Table (Section 7, 16, 39)
CREATE TABLE IF NOT EXISTS seasons (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    season_number   INTEGER NOT NULL DEFAULT 1,
    description     TEXT,
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'UPCOMING',
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    banner_url      TEXT,
    rules_config    JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_season_dates CHECK (end_at > start_at),
    CONSTRAINT chk_season_status CHECK (status IN ('UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED')),
    CONSTRAINT uq_game_season_slug UNIQUE (game_id, slug)
);

-- Invariant: Exactly one active season per game title
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_season_per_game
    ON seasons (game_id)
    WHERE is_active = TRUE;

-- 3. High-Performance Full-Text & Trigram Search Indexes

-- Games search indexes
CREATE INDEX IF NOT EXISTS idx_games_name_trgm
    ON games USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_games_search
    ON games USING gin (to_tsvector('english', name || ' ' || COALESCE(publisher, '')));

-- Teams search indexes (name and tag trigrams for quick autocomplete)
CREATE INDEX IF NOT EXISTS idx_teams_name_trgm
    ON teams USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_teams_tag_trgm
    ON teams USING gin (tag gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_teams_search
    ON teams USING gin (to_tsvector('english', name || ' ' || tag || ' ' || COALESCE(description, '')));

-- Users (Players) search indexes (username and display_name)
CREATE INDEX IF NOT EXISTS idx_users_username_trgm
    ON users USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_display_name_trgm
    ON users USING gin (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_search
    ON users USING gin (to_tsvector('english', username || ' ' || COALESCE(display_name, '')));

-- Tournaments search indexes
CREATE INDEX IF NOT EXISTS idx_tournaments_name_trgm
    ON tournaments USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tournaments_search
    ON tournaments USING gin (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Seasons search indexes
CREATE INDEX IF NOT EXISTS idx_seasons_name_trgm
    ON seasons USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_seasons_search
    ON seasons USING gin (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Filter and lookup indexes
CREATE INDEX IF NOT EXISTS idx_seasons_game_status ON seasons(game_id, status);
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(game_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_tournaments_game_status ON tournaments(game_id, status);

-- 4. Row-Level Security for Seasons Table
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_seasons_public_read ON seasons;
CREATE POLICY rls_seasons_public_read ON seasons
    FOR SELECT
    USING (TRUE); -- Seasons are public to discover and browse

DROP POLICY IF EXISTS rls_seasons_app_write ON seasons;
CREATE POLICY rls_seasons_app_write ON seasons
    FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE); -- App mutations gated via service layer & admin RBAC
