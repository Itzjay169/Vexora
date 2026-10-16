-- ════════════════════════════════════════════════════════════════════════════
-- Migration 024: Analytics & Dashboards
-- Phase 31 — PDF refs: Sections 22, 39 (Phase 8)
--
-- Strategy:
--   - Materialised views for heavy aggregation (refreshed by background workers)
--   - No heavy analytics queries on primary tables during live events
--   - EXPLAIN-verified query patterns with proper indexes
--   - Read-replica readiness: all analytics queries use SELECT-only paths
--   - Export audit log tracking every CSV/PDF export
--
-- Tables & Views:
--   1. analytics_metric_definitions   – Documented metric catalogue
--   2. mv_player_stats               – Materialised: player performance summary
--   3. mv_organiser_stats            – Materialised: organiser performance summary
--   4. mv_platform_daily_stats       – Materialised: daily platform-wide metrics
--   5. mv_game_popularity            – Materialised: game popularity rankings
--   6. analytics_export_log          – Audit trail for all data exports
--   7. analytics_refresh_log         – Worker refresh tracking
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: analytics_metric_definitions
-- Every metric has a documented definition (Exit criterion)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS analytics_metric_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key      VARCHAR(100) NOT NULL UNIQUE,
  display_name    VARCHAR(300) NOT NULL,
  description     TEXT NOT NULL,
  category        VARCHAR(50) NOT NULL DEFAULT 'PLATFORM',
  data_source     VARCHAR(200) NOT NULL,
  aggregation     VARCHAR(50) NOT NULL DEFAULT 'COUNT',
  unit            VARCHAR(50) DEFAULT 'count',
  refresh_cadence VARCHAR(50) NOT NULL DEFAULT 'HOURLY',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed canonical metric definitions
INSERT INTO analytics_metric_definitions (metric_key, display_name, description, category, data_source, aggregation, unit, refresh_cadence) VALUES
  ('total_users',            'Total Registered Users',         'Count of all registered users on the platform',                  'PLATFORM', 'users',                    'COUNT',   'users',       'HOURLY'),
  ('active_users_daily',     'Daily Active Users (DAU)',        'Unique users with at least one session in the last 24 hours',   'PLATFORM', 'user_sessions',            'COUNT_DISTINCT', 'users', 'HOURLY'),
  ('active_users_monthly',   'Monthly Active Users (MAU)',      'Unique users with at least one session in the last 30 days',    'PLATFORM', 'user_sessions',            'COUNT_DISTINCT', 'users', 'DAILY'),
  ('total_tournaments',      'Total Tournaments Created',      'All tournaments across all statuses',                            'PLATFORM', 'tournaments',              'COUNT',   'tournaments', 'HOURLY'),
  ('live_tournaments',       'Currently Live Tournaments',     'Tournaments currently in LIVE status',                           'PLATFORM', 'tournaments',              'COUNT',   'tournaments', 'REALTIME'),
  ('total_matches',          'Total Matches Played',           'Matches that have reached FINAL status',                         'PLATFORM', 'matches',                  'COUNT',   'matches',     'HOURLY'),
  ('total_disputes',         'Total Disputes Filed',           'All disputes across all statuses',                               'PLATFORM', 'disputes',                 'COUNT',   'disputes',    'DAILY'),
  ('dispute_resolution_rate','Dispute Resolution Rate',        'Percentage of disputes resolved vs total filed',                 'PLATFORM', 'disputes',                 'RATIO',   'percent',     'DAILY'),
  ('avg_match_duration',     'Average Match Duration',         'Mean time from match LIVE to FINAL status',                      'PLATFORM', 'matches',                  'AVG',     'minutes',     'DAILY'),
  ('player_win_rate',        'Player Win Rate',                'Percentage of matches won out of total played per player',       'PLAYER',   'match_participants',       'RATIO',   'percent',     'HOURLY'),
  ('player_tournaments_joined','Tournaments Joined',           'Count of tournaments a player has registered for',              'PLAYER',   'tournament_registrations',  'COUNT',   'tournaments', 'HOURLY'),
  ('player_fair_play_score', 'Fair Play Score',                'Composite score (0-100) based on conduct, dispute history',      'PLAYER',   'users',                    'SCORE',   'points',      'DAILY'),
  ('organiser_tournaments_hosted','Tournaments Hosted',        'Count of tournaments created by an organiser',                  'ORGANISER','tournaments',              'COUNT',   'tournaments', 'HOURLY'),
  ('organiser_total_participants','Total Participants Served',  'Sum of registrations across all organiser tournaments',         'ORGANISER','tournament_registrations',  'SUM',     'players',     'DAILY'),
  ('organiser_avg_fill_rate','Average Fill Rate',              'Mean ratio of registered vs max participants per tournament',    'ORGANISER','tournaments',              'AVG',     'percent',     'DAILY'),
  ('organiser_dispute_rate', 'Dispute Rate',                   'Disputes per 100 matches across organiser tournaments',         'ORGANISER','disputes',                 'RATIO',   'per_100',     'DAILY'),
  ('game_tournament_count',  'Tournaments per Game',           'Number of tournaments created per game title',                   'GAME',     'tournaments',              'COUNT',   'tournaments', 'DAILY'),
  ('game_active_players',    'Active Players per Game',        'Unique players who played a match in the last 30 days per game','GAME',     'match_participants',       'COUNT_DISTINCT','players','DAILY')
ON CONFLICT (metric_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- MATERIALISED VIEW: mv_player_stats
-- Player performance analytics (refreshed by worker, never live-queried)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_player_stats AS
SELECT
  u.id AS user_id,
  u.username,
  u.created_at AS joined_at,
  COALESCE(reg.tournaments_joined, 0) AS tournaments_joined,
  COALESCE(mp.matches_played, 0) AS matches_played,
  COALESCE(mp.matches_won, 0) AS matches_won,
  CASE
    WHEN COALESCE(mp.matches_played, 0) > 0
    THEN ROUND((mp.matches_won::NUMERIC / mp.matches_played) * 100, 2)
    ELSE 0
  END AS win_rate_pct,
  COALESCE(mp.total_kills, 0) AS total_kills,
  COALESCE(mp.total_score, 0) AS total_score,
  COALESCE(u.fair_play_score, 100) AS fair_play_score,
  COALESCE(disp.disputes_filed, 0) AS disputes_filed,
  COALESCE(disp.disputes_won, 0) AS disputes_won,
  NOW() AS refreshed_at
FROM users u
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS tournaments_joined
  FROM tournament_registrations tr
  WHERE tr.user_id = u.id AND tr.status IN ('CONFIRMED', 'CHECKED_IN')
) reg ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::INT AS matches_played,
    COUNT(*) FILTER (WHERE mp2.is_winner = TRUE)::INT AS matches_won,
    COALESCE(SUM(mp2.kills), 0)::INT AS total_kills,
    COALESCE(SUM(mp2.score), 0)::INT AS total_score
  FROM match_participants mp2
  WHERE mp2.user_id = u.id
) mp ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::INT AS disputes_filed,
    COUNT(*) FILTER (WHERE d.resolution_winner_id = u.id)::INT AS disputes_won
  FROM disputes d
  WHERE d.reporter_id = u.id
) disp ON TRUE
WHERE u.status = 'ACTIVE'
WITH NO DATA;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_player_stats_user_id ON mv_player_stats(user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- MATERIALISED VIEW: mv_organiser_stats
-- Organiser performance dashboard data
-- ═══════════════════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_organiser_stats AS
SELECT
  op.user_id AS organiser_id,
  op.org_name AS organiser_name,
  op.verification_status,
  COALESCE(t_stats.tournaments_hosted, 0) AS tournaments_hosted,
  COALESCE(t_stats.total_participants, 0) AS total_participants,
  COALESCE(t_stats.avg_fill_rate, 0) AS avg_fill_rate_pct,
  COALESCE(t_stats.completed_tournaments, 0) AS completed_tournaments,
  COALESCE(t_stats.live_tournaments, 0) AS live_tournaments,
  COALESCE(d_stats.total_disputes, 0) AS total_disputes,
  CASE
    WHEN COALESCE(t_stats.total_matches, 0) > 0
    THEN ROUND((d_stats.total_disputes::NUMERIC / t_stats.total_matches) * 100, 2)
    ELSE 0
  END AS dispute_rate_pct,
  COALESCE(r_stats.avg_rating, 0) AS avg_rating,
  NOW() AS refreshed_at
FROM organiser_profiles op
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::INT AS tournaments_hosted,
    COUNT(*) FILTER (WHERE t.status = 'COMPLETED')::INT AS completed_tournaments,
    COUNT(*) FILTER (WHERE t.status = 'LIVE')::INT AS live_tournaments,
    COALESCE(SUM(t.current_participants), 0)::INT AS total_participants,
    CASE WHEN COUNT(*) > 0
      THEN ROUND(AVG(
        CASE WHEN t.max_participants > 0
          THEN (t.current_participants::NUMERIC / t.max_participants) * 100
          ELSE 0
        END
      ), 2)
      ELSE 0
    END AS avg_fill_rate,
    COALESCE((SELECT COUNT(*)::INT FROM matches m
      JOIN tournaments t2 ON m.tournament_id = t2.id
      WHERE t2.organiser_id = op.user_id), 0) AS total_matches
  FROM tournaments t
  WHERE t.organiser_id = op.user_id
) t_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS total_disputes
  FROM disputes d
  JOIN matches m ON d.match_id = m.id
  JOIN tournaments t ON m.tournament_id = t.id
  WHERE t.organiser_id = op.user_id
) d_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT ROUND(AVG(r.score)::NUMERIC, 2) AS avg_rating
  FROM ratings r
  WHERE r.target_id = op.user_id AND r.target_type = 'ORGANISER'
) r_stats ON TRUE
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_organiser_stats_id ON mv_organiser_stats(organiser_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- MATERIALISED VIEW: mv_platform_daily_stats
-- Platform-wide daily metrics for admin dashboard
-- ═══════════════════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_daily_stats AS
SELECT
  DATE_TRUNC('day', gs.day)::DATE AS stat_date,
  COALESCE(u_count.new_users, 0) AS new_users,
  COALESCE(t_count.new_tournaments, 0) AS new_tournaments,
  COALESCE(t_count.completed_tournaments, 0) AS completed_tournaments,
  COALESCE(m_count.matches_played, 0) AS matches_played,
  COALESCE(r_count.new_registrations, 0) AS new_registrations,
  COALESCE(d_count.disputes_filed, 0) AS disputes_filed,
  COALESCE(d_count.disputes_resolved, 0) AS disputes_resolved,
  NOW() AS refreshed_at
FROM generate_series(
  CURRENT_DATE - INTERVAL '90 days',
  CURRENT_DATE,
  '1 day'::INTERVAL
) gs(day)
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS new_users
  FROM users WHERE DATE_TRUNC('day', created_at) = DATE_TRUNC('day', gs.day)
) u_count ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::INT AS new_tournaments,
    COUNT(*) FILTER (WHERE status = 'COMPLETED')::INT AS completed_tournaments
  FROM tournaments WHERE DATE_TRUNC('day', created_at) = DATE_TRUNC('day', gs.day)
) t_count ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS matches_played
  FROM matches WHERE DATE_TRUNC('day', created_at) = DATE_TRUNC('day', gs.day) AND status = 'FINAL'
) m_count ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS new_registrations
  FROM tournament_registrations WHERE DATE_TRUNC('day', created_at) = DATE_TRUNC('day', gs.day)
) r_count ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::INT AS disputes_filed,
    COUNT(*) FILTER (WHERE status IN ('RESOLVED', 'CLOSED'))::INT AS disputes_resolved
  FROM disputes WHERE DATE_TRUNC('day', created_at) = DATE_TRUNC('day', gs.day)
) d_count ON TRUE
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_daily_date ON mv_platform_daily_stats(stat_date);

-- ═══════════════════════════════════════════════════════════════════════════
-- MATERIALISED VIEW: mv_game_popularity
-- Game popularity rankings
-- ═══════════════════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_game_popularity AS
SELECT
  g.id AS game_id,
  g.title AS game_title,
  g.slug AS game_slug,
  COALESCE(t_stats.tournament_count, 0) AS tournament_count,
  COALESCE(t_stats.total_participants, 0) AS total_participants,
  COALESCE(m_stats.matches_played, 0) AS matches_played_30d,
  COALESCE(m_stats.active_players, 0) AS active_players_30d,
  RANK() OVER (ORDER BY COALESCE(m_stats.active_players, 0) DESC) AS popularity_rank,
  NOW() AS refreshed_at
FROM games g
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::INT AS tournament_count,
    COALESCE(SUM(t.current_participants), 0)::INT AS total_participants
  FROM tournaments t
  WHERE t.game_id = g.id
) t_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT m.id)::INT AS matches_played,
    COUNT(DISTINCT mp.user_id)::INT AS active_players
  FROM matches m
  JOIN tournaments t ON m.tournament_id = t.id
  JOIN match_participants mp ON mp.match_id = m.id
  WHERE t.game_id = g.id
    AND m.status = 'FINAL'
    AND m.created_at >= NOW() - INTERVAL '30 days'
) m_stats ON TRUE
WHERE g.is_active = TRUE
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_game_popularity_id ON mv_game_popularity(game_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: analytics_export_log
-- Audit trail for every CSV/PDF export (masked, role-controlled, logged)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS analytics_export_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID NOT NULL REFERENCES users(id),
  actor_role      VARCHAR(50) NOT NULL,
  export_type     VARCHAR(50) NOT NULL,
  report_name     VARCHAR(200) NOT NULL,
  format          VARCHAR(10) NOT NULL DEFAULT 'CSV',
  row_count       INT NOT NULL DEFAULT 0,
  filters_applied JSONB DEFAULT '{}',
  is_masked       BOOLEAN NOT NULL DEFAULT TRUE,
  watermark       VARCHAR(200),
  ip_hash         VARCHAR(128),
  exported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutability: export logs cannot be updated or deleted
CREATE OR REPLACE FUNCTION prevent_export_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Export audit logs are immutable. UPDATE and DELETE are forbidden.'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_export_log ON analytics_export_log;
CREATE TRIGGER trg_immutable_export_log
  BEFORE UPDATE OR DELETE ON analytics_export_log
  FOR EACH ROW EXECUTE FUNCTION prevent_export_log_mutation();

CREATE INDEX IF NOT EXISTS idx_export_log_actor ON analytics_export_log(actor_id, exported_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: analytics_refresh_log
-- Tracks materialised view refresh operations
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS analytics_refresh_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_name       VARCHAR(100) NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INT,
  rows_affected   INT,
  status          VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  error_message   TEXT,
  triggered_by    VARCHAR(50) DEFAULT 'WORKER'
);

CREATE INDEX IF NOT EXISTS idx_refresh_log_view ON analytics_refresh_log(view_name, started_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE analytics_export_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_export_log FORCE ROW LEVEL SECURITY;

CREATE POLICY export_log_admin_read ON analytics_export_log
  FOR SELECT USING (TRUE);

CREATE POLICY export_log_insert ON analytics_export_log
  FOR INSERT WITH CHECK (TRUE);

ALTER TABLE analytics_refresh_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_refresh_log FORCE ROW LEVEL SECURITY;

CREATE POLICY refresh_log_read ON analytics_refresh_log
  FOR SELECT USING (TRUE);

CREATE POLICY refresh_log_insert ON analytics_refresh_log
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY refresh_log_update ON analytics_refresh_log
  FOR UPDATE USING (TRUE);

COMMIT;
