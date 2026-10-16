-- ============================================================================
-- Vexora Esports Tournament Platform
-- Phase 34: Vexora Extended Features (Section 41 & 43 Additions)
-- Migration 027: Scrims, LFT, Follows, Templates, Staff, Sponsors, Referrals,
--                Safe Chat, and Fair Play Pledges
-- ============================================================================

-- 1. Seed Feature Flags for Extended Features
INSERT INTO feature_flags (key, enabled, rollout_percent, description, audience)
VALUES
    ('extended_player_features', true, 100, 'Scrims, LFT, Shareable Stat Cards, Social Follows, Safe Chat', '{"regions":["IN","GLOBAL"],"tiers":["ALL"]}'::jsonb),
    ('extended_organiser_features', true, 100, 'Tournament Templates, Staff Referees, Bulk Results, Sponsor Banners', '{"regions":["IN","GLOBAL"],"tiers":["ALL"]}'::jsonb),
    ('extended_admin_features', true, 100, 'Case Timeline, Fraud Graph, Policy Engine, View-As Simulator', '{"regions":["IN","GLOBAL"],"tiers":["ADMIN"]}'::jsonb),
    ('extended_platform_features', true, 100, 'Referral Program with Anti-Abuse, Season Qualifiers', '{"regions":["IN","GLOBAL"],"tiers":["ALL"]}'::jsonb)
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;

-- 2. Scrims & Practice Rooms (Free Unranked Lobbies)
CREATE TABLE IF NOT EXISTS scrim_rooms (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title               VARCHAR(150) NOT NULL,
    game_id             UUID NOT NULL REFERENCES games(id),
    host_user_id        UUID NOT NULL REFERENCES users(id),
    room_code           VARCHAR(50),
    max_players         INT NOT NULL DEFAULT 16 CHECK (max_players >= 2 AND max_players <= 100),
    current_players     INT NOT NULL DEFAULT 1,
    status              VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'LIVE', 'COMPLETED', 'CANCELLED')),
    scheduled_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rules_notes         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrim_rooms_game ON scrim_rooms(game_id);
CREATE INDEX IF NOT EXISTS idx_scrim_rooms_status ON scrim_rooms(status);
CREATE INDEX IF NOT EXISTS idx_scrim_rooms_host ON scrim_rooms(host_user_id);

-- 3. Looking-for-Team (LFT) Board
CREATE TABLE IF NOT EXISTS lft_posts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    team_id             UUID REFERENCES teams(id),
    post_type           VARCHAR(30) NOT NULL CHECK (post_type IN ('PLAYER_LFT', 'TEAM_RECRUITING')),
    game_id             UUID NOT NULL REFERENCES games(id),
    preferred_role      VARCHAR(50) NOT NULL,
    rank_tier           VARCHAR(50),
    description         TEXT NOT NULL,
    in_game_uid         VARCHAR(100),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lft_posts_game_type ON lft_posts(game_id, post_type);
CREATE INDEX IF NOT EXISTS idx_lft_posts_active ON lft_posts(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_lft_posts_user ON lft_posts(user_id);

-- 4. Social Follows (Organisers, Teams, Games)
CREATE TABLE IF NOT EXISTS user_follows (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type         VARCHAR(30) NOT NULL CHECK (target_type IN ('ORGANISER', 'TEAM', 'GAME')),
    target_id           UUID NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_follow UNIQUE (follower_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_target ON user_follows(target_type, target_id);

-- 5. Tournament Templates
CREATE TABLE IF NOT EXISTS tournament_templates (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organiser_id        UUID NOT NULL REFERENCES users(id),
    template_name       VARCHAR(150) NOT NULL,
    game_id             UUID NOT NULL REFERENCES games(id),
    format              VARCHAR(50) NOT NULL,
    team_size           INT NOT NULL DEFAULT 1,
    rule_json           JSONB NOT NULL DEFAULT '{}',
    scoring_schema_id   UUID REFERENCES scoring_schemas(id),
    evidence_rules      JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_templates_org ON tournament_templates(organiser_id);

-- 6. Tournament Staff & Referees (Scoped Roles)
CREATE TABLE IF NOT EXISTS tournament_staff (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id       UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),
    staff_role          VARCHAR(30) NOT NULL CHECK (staff_role IN ('CO_ORGANISER', 'REFEREE', 'CASTER', 'SCOREKEEPER')),
    permissions         JSONB NOT NULL DEFAULT '{"can_verify_results": true, "can_manage_lobby": true}',
    assigned_by         UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tournament_staff UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_staff_tournament ON tournament_staff(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_staff_user ON tournament_staff(user_id);

-- 7. Sponsor Banners with Moderation
CREATE TABLE IF NOT EXISTS tournament_sponsors (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id       UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    sponsor_name        VARCHAR(150) NOT NULL,
    banner_url          TEXT NOT NULL,
    redirect_url        TEXT,
    moderation_status   VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (moderation_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    moderation_notes    TEXT,
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsors_tournament ON tournament_sponsors(tournament_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_moderation ON tournament_sponsors(moderation_status);

-- 8. Referral Program with Anti-Abuse
CREATE TABLE IF NOT EXISTS user_referrals (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id         UUID NOT NULL REFERENCES users(id),
    referee_id          UUID NOT NULL UNIQUE REFERENCES users(id),
    referral_code       VARCHAR(50) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'QUALIFIED', 'REWARDED', 'REJECTED_FRAUD')),
    ip_hash_referrer    VARCHAR(64),
    ip_hash_referee     VARCHAR(64),
    device_id_referee   VARCHAR(128),
    fraud_flags         TEXT[] DEFAULT '{}',
    qualified_at        TIMESTAMPTZ,
    rewarded_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON user_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON user_referrals(referral_code);

-- 9. Safe In-App Chat Messages (Filtered & Scoped)
CREATE TABLE IF NOT EXISTS safe_chat_messages (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_type        VARCHAR(30) NOT NULL CHECK (channel_type IN ('TOURNAMENT_LOBBY', 'SCRIM_LOBBY', 'MATCH_ROOM')),
    channel_id          UUID NOT NULL,
    sender_id           UUID NOT NULL REFERENCES users(id),
    message             VARCHAR(500) NOT NULL,
    is_flagged          BOOLEAN NOT NULL DEFAULT FALSE,
    flag_reason         VARCHAR(100),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_channel ON safe_chat_messages(channel_type, channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON safe_chat_messages(sender_id);

-- 10. Fair-Play Pledges
CREATE TABLE IF NOT EXISTS fair_play_pledges (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id),
    pledge_version      VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    ip_hash             VARCHAR(64) NOT NULL,
    user_agent          TEXT,
    pledged_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fair_play_pledge_user ON fair_play_pledges(user_id);

-- 11. Row-Level Security Policies
ALTER TABLE scrim_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE lft_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE safe_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE fair_play_pledges ENABLE ROW LEVEL SECURITY;

-- Scrim rooms: visible to all authenticated users
DROP POLICY IF EXISTS scrim_select ON scrim_rooms;
CREATE POLICY scrim_select ON scrim_rooms FOR SELECT USING (true);

-- LFT posts: visible to all authenticated users
DROP POLICY IF EXISTS lft_select ON lft_posts;
CREATE POLICY lft_select ON lft_posts FOR SELECT USING (true);

-- Follows: user can see who they follow, public can see follower counts
DROP POLICY IF EXISTS follows_select ON user_follows;
CREATE POLICY follows_select ON user_follows FOR SELECT USING (true);

-- Tournament templates: visible to template owner or staff
DROP POLICY IF EXISTS templates_select ON tournament_templates;
CREATE POLICY templates_select ON tournament_templates FOR SELECT
    USING (
        organiser_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')
    );

-- Sponsors: approved banners visible to public, all banners visible to organiser/admin
DROP POLICY IF EXISTS sponsors_select ON tournament_sponsors;
CREATE POLICY sponsors_select ON tournament_sponsors FOR SELECT
    USING (
        moderation_status = 'APPROVED'
        OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
        OR EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = tournament_sponsors.tournament_id
              AND t.organiser_id::text = current_setting('app.current_user_id', true)
        )
    );

-- Safe chat: participants can read messages in active channels
DROP POLICY IF EXISTS chat_select ON safe_chat_messages;
CREATE POLICY chat_select ON safe_chat_messages FOR SELECT USING (true);
