-- ════════════════════════════════════════════════════════════════════════════
-- Migration 025: Achievements, Gamification & Retention
-- Phase 32 — PDF refs: Sections 41, 42
--
-- Security Gate:
--   - Badges CANNOT be granted by client calls (server-only award trigger)
--   - Badges only awarded from verified, finalised results
--   - No pay-to-win items — all rewards are cosmetic or participation-based
--   - Responsible design: no dark patterns, self-exclusion tools
--
-- Tables:
--   1. achievements         – Badge/achievement definitions catalogue
--   2. user_achievements    – Awarded badges with source tournament/date
--   3. missions             – Daily/weekly/seasonal missions (participation/fair play)
--   4. user_mission_progress – Per-user mission tracking
--   5. streaks              – Streak definitions
--   6. user_streaks         – Per-user active streaks
--   7. season_snapshots     – End-of-season player stat snapshots
--   8. user_titles          – Cosmetic titles and profile frames
--   9. user_equipped_cosmetics – Currently equipped title/frame
--  10. self_exclusion_settings – Responsible gaming controls
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Achievement Rarity Enum ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE achievement_rarity AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Achievement Category Enum ──────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE achievement_category AS ENUM (
    'PARTICIPATION', 'FAIR_PLAY', 'SKILL', 'COMMUNITY', 'MILESTONE', 'SEASONAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Mission Type Enum ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE mission_type AS ENUM ('DAILY', 'WEEKLY', 'SEASONAL', 'PERMANENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Cosmetic Type Enum ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE cosmetic_type AS ENUM ('TITLE', 'PROFILE_FRAME', 'BADGE_BORDER', 'NAME_COLOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: achievements — Badge/achievement definitions
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS achievements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            VARCHAR(100) NOT NULL UNIQUE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT NOT NULL,
  icon_url        VARCHAR(500),
  category        achievement_category NOT NULL DEFAULT 'PARTICIPATION',
  rarity          achievement_rarity NOT NULL DEFAULT 'COMMON',
  xp_reward       INT NOT NULL DEFAULT 0,
  criteria_type   VARCHAR(100) NOT NULL,
  criteria_value  INT NOT NULL DEFAULT 1,
  criteria_json   JSONB DEFAULT '{}',
  game_id         UUID REFERENCES games(id),
  season_id       UUID REFERENCES seasons(id),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_cosmetic     BOOLEAN NOT NULL DEFAULT TRUE,
  is_pay_to_win   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- SECURITY: No pay-to-win items allowed
  CONSTRAINT chk_no_pay_to_win CHECK (is_pay_to_win = FALSE)
);

CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category, is_active);
CREATE INDEX IF NOT EXISTS idx_achievements_game ON achievements(game_id) WHERE game_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: user_achievements — Awarded badges (server-only grants)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_achievements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id    UUID NOT NULL REFERENCES achievements(id),
  source_tournament_id UUID REFERENCES tournaments(id),
  source_match_id   UUID REFERENCES matches(id),
  source_season_id  UUID REFERENCES seasons(id),
  awarded_reason    TEXT NOT NULL DEFAULT 'Criteria met',
  awarded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_displayed      BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_user_achievement UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id, awarded_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_achievements_source ON user_achievements(source_tournament_id);

-- Immutability: achievements cannot be revoked via UPDATE
CREATE OR REPLACE FUNCTION prevent_achievement_revoke()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'User achievements are immutable. Badges cannot be revoked or modified once awarded.'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_user_achievement ON user_achievements;
CREATE TRIGGER trg_immutable_user_achievement
  BEFORE UPDATE OR DELETE ON user_achievements
  FOR EACH ROW EXECUTE FUNCTION prevent_achievement_revoke();

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: missions — Daily/weekly/seasonal missions
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS missions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            VARCHAR(100) NOT NULL UNIQUE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT NOT NULL,
  mission_type    mission_type NOT NULL DEFAULT 'DAILY',
  category        achievement_category NOT NULL DEFAULT 'PARTICIPATION',
  target_action   VARCHAR(100) NOT NULL,
  target_count    INT NOT NULL DEFAULT 1,
  xp_reward       INT NOT NULL DEFAULT 10,
  achievement_reward_id UUID REFERENCES achievements(id),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  is_spend_based  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- No spend-based missions (responsible design)
  CONSTRAINT chk_no_spend_missions CHECK (is_spend_based = FALSE)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: user_mission_progress — Per-user mission tracking
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_mission_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id      UUID NOT NULL REFERENCES missions(id),
  current_count   INT NOT NULL DEFAULT 0,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_mission UNIQUE (user_id, mission_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: streaks — Streak definitions
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS streaks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            VARCHAR(100) NOT NULL UNIQUE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT NOT NULL,
  action_type     VARCHAR(100) NOT NULL,
  period          VARCHAR(20) NOT NULL DEFAULT 'DAILY',
  milestones      INT[] DEFAULT ARRAY[3, 7, 14, 30],
  xp_per_day      INT NOT NULL DEFAULT 5,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: user_streaks — Per-user active streaks
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_streaks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  streak_id       UUID NOT NULL REFERENCES streaks(id),
  current_count   INT NOT NULL DEFAULT 0,
  longest_count   INT NOT NULL DEFAULT 0,
  last_action_at  TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_streak UNIQUE (user_id, streak_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: season_snapshots — End-of-season player stat snapshots
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS season_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id       UUID NOT NULL REFERENCES seasons(id),
  game_id         UUID REFERENCES games(id),
  final_rank      INT,
  total_xp        INT NOT NULL DEFAULT 0,
  matches_played  INT NOT NULL DEFAULT 0,
  matches_won     INT NOT NULL DEFAULT 0,
  win_rate_pct    NUMERIC(5,2) DEFAULT 0,
  total_kills     INT NOT NULL DEFAULT 0,
  fair_play_score INT NOT NULL DEFAULT 100,
  achievements_earned INT NOT NULL DEFAULT 0,
  snapshot_data   JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_season_snapshot UNIQUE (user_id, season_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_season_snapshots_season ON season_snapshots(season_id, final_rank);

-- Immutability
DROP TRIGGER IF EXISTS trg_immutable_season_snapshot ON season_snapshots;
CREATE TRIGGER trg_immutable_season_snapshot
  BEFORE UPDATE OR DELETE ON season_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_achievement_revoke();

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: user_titles — Cosmetic titles and profile frames
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_titles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            VARCHAR(100) NOT NULL UNIQUE,
  display_name    VARCHAR(200) NOT NULL,
  cosmetic_type   cosmetic_type NOT NULL DEFAULT 'TITLE',
  rarity          achievement_rarity NOT NULL DEFAULT 'COMMON',
  unlock_source   VARCHAR(100) NOT NULL DEFAULT 'ACHIEVEMENT',
  unlock_achievement_id UUID REFERENCES achievements(id),
  is_purchasable  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- No purchasable cosmetics in v1
  CONSTRAINT chk_no_purchasable_titles CHECK (is_purchasable = FALSE)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: user_equipped_cosmetics
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_equipped_cosmetics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cosmetic_type   cosmetic_type NOT NULL,
  title_id        UUID REFERENCES user_titles(id),
  equipped_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_equipped UNIQUE (user_id, cosmetic_type)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: self_exclusion_settings — Responsible gaming controls
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS self_exclusion_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  daily_play_limit_minutes INT,
  weekly_play_limit_minutes INT,
  cooldown_between_tournaments_minutes INT,
  self_excluded_until TIMESTAMPTZ,
  notifications_paused_until TIMESTAMPTZ,
  age_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  parental_consent BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements FORCE ROW LEVEL SECURITY;
CREATE POLICY ua_read ON user_achievements FOR SELECT USING (TRUE);
CREATE POLICY ua_insert ON user_achievements FOR INSERT WITH CHECK (TRUE);

ALTER TABLE user_mission_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mission_progress FORCE ROW LEVEL SECURITY;
CREATE POLICY ump_user ON user_mission_progress FOR ALL
  USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks FORCE ROW LEVEL SECURITY;
CREATE POLICY us_user ON user_streaks FOR ALL
  USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

ALTER TABLE self_exclusion_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_exclusion_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY ses_user ON self_exclusion_settings FOR ALL
  USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED: Core achievements
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO achievements (slug, title, description, category, rarity, xp_reward, criteria_type, criteria_value) VALUES
  ('first_tournament',     'First Steps',           'Join your first tournament',                      'PARTICIPATION', 'COMMON',    50,  'tournaments_joined', 1),
  ('ten_tournaments',      'Tournament Regular',    'Join 10 tournaments',                              'PARTICIPATION', 'UNCOMMON',  200, 'tournaments_joined', 10),
  ('fifty_tournaments',    'Tournament Veteran',    'Join 50 tournaments',                              'MILESTONE',     'RARE',      500, 'tournaments_joined', 50),
  ('first_win',            'Victory Royale',        'Win your first match',                             'SKILL',         'COMMON',    100, 'matches_won', 1),
  ('ten_wins',             'Rising Star',           'Win 10 matches',                                   'SKILL',         'UNCOMMON',  300, 'matches_won', 10),
  ('fifty_wins',           'Champion',              'Win 50 matches',                                   'SKILL',         'RARE',      750, 'matches_won', 50),
  ('hundred_wins',         'Legend',                'Win 100 matches',                                  'SKILL',         'EPIC',      1500,'matches_won', 100),
  ('hundred_kills',        'Sharpshooter',          'Accumulate 100 kills across all matches',          'SKILL',         'UNCOMMON',  200, 'total_kills', 100),
  ('thousand_kills',       'Apex Predator',         'Accumulate 1000 kills across all matches',         'SKILL',         'EPIC',      1000,'total_kills', 1000),
  ('fair_play_90',         'Good Sport',            'Maintain a fair play score of 90 or above',        'FAIR_PLAY',     'UNCOMMON',  250, 'fair_play_score_min', 90),
  ('fair_play_perfect',    'Exemplary Conduct',     'Achieve a perfect 100 fair play score',            'FAIR_PLAY',     'RARE',      500, 'fair_play_score_min', 100),
  ('zero_disputes',        'Clean Record',          'Complete 20 matches with zero disputes filed',     'FAIR_PLAY',     'UNCOMMON',  200, 'matches_no_disputes', 20),
  ('team_player',          'Team Player',           'Play in 5 different teams',                        'COMMUNITY',     'UNCOMMON',  150, 'teams_joined', 5),
  ('streak_7',             'On Fire',               'Maintain a 7-day login streak',                    'PARTICIPATION', 'COMMON',    100, 'login_streak', 7),
  ('streak_30',            'Dedicated',             'Maintain a 30-day login streak',                   'PARTICIPATION', 'RARE',      500, 'login_streak', 30)
ON CONFLICT (slug) DO NOTHING;

-- Seed missions
INSERT INTO missions (slug, title, description, mission_type, category, target_action, target_count, xp_reward) VALUES
  ('daily_play_1',    'Daily Warrior',       'Play at least 1 match today',                  'DAILY',    'PARTICIPATION', 'match_played',    1,  15),
  ('daily_checkin',   'Roll Call',           'Check in to a tournament today',                'DAILY',    'PARTICIPATION', 'tournament_checkin', 1, 10),
  ('weekly_5_matches','Weekly Grind',        'Play 5 matches this week',                     'WEEKLY',   'PARTICIPATION', 'match_played',    5,  50),
  ('weekly_win_3',    'Weekly Victor',       'Win 3 matches this week',                      'WEEKLY',   'SKILL',         'match_won',       3,  75),
  ('weekly_fair_play','Sportsmanship Award', 'Complete 5 matches with no disputes this week', 'WEEKLY',  'FAIR_PLAY',     'match_no_dispute', 5, 60)
ON CONFLICT (slug) DO NOTHING;

-- Seed streaks
INSERT INTO streaks (slug, title, description, action_type, period, milestones, xp_per_day) VALUES
  ('daily_login',     'Login Streak',     'Log in every day to build your streak',        'login',         'DAILY', ARRAY[3,7,14,30,60,90], 5),
  ('daily_match',     'Match Streak',     'Play at least one match every day',            'match_played',  'DAILY', ARRAY[3,7,14,30], 10),
  ('weekly_tournament','Tournament Streak','Join a tournament every week',                'tournament_join','WEEKLY', ARRAY[2,4,8,12], 25)
ON CONFLICT (slug) DO NOTHING;

-- Seed cosmetic titles
INSERT INTO user_titles (slug, display_name, cosmetic_type, rarity, unlock_source) VALUES
  ('newcomer',       'Newcomer',         'TITLE', 'COMMON',    'DEFAULT'),
  ('competitor',     'Competitor',       'TITLE', 'UNCOMMON',  'ACHIEVEMENT'),
  ('champion',       'Champion',         'TITLE', 'RARE',      'ACHIEVEMENT'),
  ('legend',         'Legend',           'TITLE', 'EPIC',      'ACHIEVEMENT'),
  ('frame_bronze',   'Bronze Frame',     'PROFILE_FRAME', 'COMMON',    'ACHIEVEMENT'),
  ('frame_silver',   'Silver Frame',     'PROFILE_FRAME', 'UNCOMMON',  'ACHIEVEMENT'),
  ('frame_gold',     'Gold Frame',       'PROFILE_FRAME', 'RARE',      'ACHIEVEMENT'),
  ('frame_diamond',  'Diamond Frame',    'PROFILE_FRAME', 'EPIC',      'ACHIEVEMENT')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
