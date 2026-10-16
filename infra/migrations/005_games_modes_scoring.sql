-- ============================================================================
-- Vexora Database Migration 005: Games, Modes, Rule Templates & Versioned Scoring
-- Phase 11: Configurable Game Engine & Scoring Definitions
-- ============================================================================

-- 1. Create game_modes table
CREATE TABLE IF NOT EXISTS game_modes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    slug            VARCHAR(50) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    format          VARCHAR(50) NOT NULL DEFAULT 'BATTLE_ROYALE', -- BATTLE_ROYALE, SINGLE_ELIMINATION, ROUND_ROBIN, SWISS, LEAGUE
    team_size       INTEGER NOT NULL DEFAULT 4,
    min_team_size   INTEGER NOT NULL DEFAULT 1,
    max_team_size   INTEGER NOT NULL DEFAULT 4,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    description     TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_game_mode_slug UNIQUE (game_id, slug),
    CONSTRAINT chk_game_mode_team_sizes CHECK (min_team_size >= 1 AND max_team_size >= min_team_size AND team_size >= min_team_size AND team_size <= max_team_size)
);

-- 2. Create rule_templates table
CREATE TABLE IF NOT EXISTS rule_templates (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id                 UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    mode_id                 UUID REFERENCES game_modes(id) ON DELETE SET NULL,
    name                    VARCHAR(100) NOT NULL,
    description             TEXT,
    rules_text              TEXT NOT NULL,
    evidence_requirements   JSONB NOT NULL DEFAULT '{}',
    tie_breaker_rules       JSONB NOT NULL DEFAULT '[]',
    is_default              BOOLEAN NOT NULL DEFAULT FALSE,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enhance scoring_schemas table with version tracking, tie-breakers and evidence requirements
ALTER TABLE scoring_schemas
    ADD COLUMN IF NOT EXISTS mode_id UUID REFERENCES game_modes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tie_breakers JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS evidence_requirements JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES scoring_schemas(id);

-- 4. Create trigger to prevent in-place modification of live scoring formulas (ADR-002, ADR-015 Invariant: No Silent Edits)
CREATE OR REPLACE FUNCTION prevent_live_scoring_formula_mutation()
RETURNS TRIGGER AS $$
BEGIN
    -- If the formula or version is being altered on an existing row, reject
    IF OLD.formula IS DISTINCT FROM NEW.formula OR OLD.version IS DISTINCT FROM NEW.version THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Scoring formulas are immutable once published. You must create a new version row rather than modifying existing version %.', OLD.version;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_scoring_formula ON scoring_schemas;
CREATE TRIGGER trg_immutable_scoring_formula
BEFORE UPDATE ON scoring_schemas
FOR EACH ROW
EXECUTE FUNCTION prevent_live_scoring_formula_mutation();

-- 5. Row-Level Security policies for games, game_modes, rule_templates, scoring_schemas
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_schemas ENABLE ROW LEVEL SECURITY;

-- Public/Authenticated read policies (everyone can read active games catalog)
DROP POLICY IF EXISTS rls_games_read ON games;
CREATE POLICY rls_games_read ON games FOR SELECT USING (true);

DROP POLICY IF EXISTS rls_game_modes_read ON game_modes;
CREATE POLICY rls_game_modes_read ON game_modes FOR SELECT USING (true);

DROP POLICY IF EXISTS rls_rule_templates_read ON rule_templates;
CREATE POLICY rls_rule_templates_read ON rule_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS rls_scoring_schemas_read ON scoring_schemas;
CREATE POLICY rls_scoring_schemas_read ON scoring_schemas FOR SELECT USING (true);

-- Admin mutation policies (only admin roles can mutate catalog)
DROP POLICY IF EXISTS rls_games_admin_write ON games;
CREATE POLICY rls_games_admin_write ON games
    FOR ALL
    USING (
        CURRENT_SETTING('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS rls_game_modes_admin_write ON game_modes;
CREATE POLICY rls_game_modes_admin_write ON game_modes
    FOR ALL
    USING (
        CURRENT_SETTING('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS rls_rule_templates_admin_write ON rule_templates;
CREATE POLICY rls_rule_templates_admin_write ON rule_templates
    FOR ALL
    USING (
        CURRENT_SETTING('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS rls_scoring_schemas_admin_write ON scoring_schemas;
CREATE POLICY rls_scoring_schemas_admin_write ON scoring_schemas
    FOR ALL
    USING (
        CURRENT_SETTING('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

-- 6. Indexes for rapid lookups
CREATE INDEX IF NOT EXISTS idx_game_modes_game_id ON game_modes(game_id);
CREATE INDEX IF NOT EXISTS idx_rule_templates_game_id ON rule_templates(game_id);
CREATE INDEX IF NOT EXISTS idx_scoring_schemas_game_mode ON scoring_schemas(game_id, mode_slug);
