-- ============================================================================
-- Vexora Initial Launch Seeds: Competitive Seasons
-- Specifications: ADR-002, Blueprint Section 7 & 16, Phase 14
-- ============================================================================

INSERT INTO seasons (
    id, game_id, name, slug, season_number, description,
    start_at, end_at, status, is_active, banner_url, rules_config
)
VALUES
  -- 1. BGMI Season 1
  (
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'BGMI Season 1: Genesis',
    'bgmi_s1_genesis',
    1,
    'Inaugural competitive season for Battlegrounds Mobile India. Features 10-point Krafton scoring.',
    '2026-09-01T00:00:00Z',
    '2026-12-31T23:59:59Z',
    'ACTIVE',
    TRUE,
    'https://assets.vexora.gg/banners/bgmi-s1.jpg',
    '{"max_teams_per_match": 16, "scoring_formula": "bgmi_br_v1.0.0", "tie_breaker": "kills_first"}'::jsonb
  ),

  -- 2. Free Fire MAX Season 1
  (
    'e0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'Free Fire Season 1: Booyah Clash',
    'ff_s1_booyah',
    1,
    'Premier Free Fire MAX championship season. Official 12-point Booyah placement system.',
    '2026-09-01T00:00:00Z',
    '2026-12-31T23:59:59Z',
    'ACTIVE',
    TRUE,
    'https://assets.vexora.gg/banners/ff-s1.jpg',
    '{"max_teams_per_match": 12, "scoring_formula": "freefire_br_v1.0.0", "tie_breaker": "placement_first"}'::jsonb
  ),

  -- 3. CODM Season 1
  (
    'e0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'CODM Season 1: Iron Front',
    'codm_s1_iron_front',
    1,
    'Call of Duty: Mobile tactical season. Multiplayer Search & Destroy and Hardpoint tournament formats.',
    '2026-09-01T00:00:00Z',
    '2026-12-31T23:59:59Z',
    'ACTIVE',
    TRUE,
    'https://assets.vexora.gg/banners/codm-s1.jpg',
    '{"mode": "search_and_destroy", "scoring_formula": "codm_mp_v1.0.0"}'::jsonb
  )
ON CONFLICT (game_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active,
  banner_url = EXCLUDED.banner_url,
  rules_config = EXCLUDED.rules_config;
