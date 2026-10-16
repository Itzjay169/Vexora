-- ============================================================================
-- Vexora Initial Launch Seeds: Games, Modes, Versioned Scoring & Rule Templates
-- Specifications: ADR-002, ADR-015, Blueprint Section 5 & 39
-- ============================================================================

-- 1. Games Catalog (BGMI, Free Fire MAX, Call of Duty Mobile)
INSERT INTO games (id, slug, name, publisher, status, max_team_size, min_team_size, platforms, metadata)
VALUES 
  (
    'a0000000-0000-0000-0000-000000000001',
    'bgmi',
    'Battlegrounds Mobile India',
    'Krafton',
    'ACTIVE',
    4,
    1,
    ARRAY['ANDROID', 'IOS'],
    '{"min_version": "3.4.0", "genre": "Battle Royale", "publisher_in_game_id_name": "Character ID (UID)"}'::jsonb
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'freefire',
    'Garena Free Fire MAX',
    'Garena',
    'ACTIVE',
    4,
    1,
    ARRAY['ANDROID', 'IOS'],
    '{"min_version": "1.106.1", "genre": "Battle Royale", "publisher_in_game_id_name": "Free Fire UID"}'::jsonb
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'codm',
    'Call of Duty: Mobile',
    'Activision',
    'ACTIVE',
    5,
    1,
    ARRAY['ANDROID', 'IOS'],
    '{"min_version": "1.0.46", "genre": "FPS / Battle Royale", "publisher_in_game_id_name": "CODM Player ID (OpenID)"}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  publisher = EXCLUDED.publisher,
  status = EXCLUDED.status,
  platforms = EXCLUDED.platforms,
  metadata = EXCLUDED.metadata;

-- 2. Game Modes
INSERT INTO game_modes (id, game_id, slug, name, format, team_size, min_team_size, max_team_size, is_active, description, metadata)
VALUES
  -- BGMI Modes
  (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'br_squad',
    'Battle Royale Squad',
    'BATTLE_ROYALE',
    4, 4, 4,
    true,
    'Official 4v4 Battle Royale format on Erangel, Miramar, Sanhok or Vikendi.',
    '{"lobby_capacity": 100, "max_squads": 25}'::jsonb
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'br_solo',
    'Battle Royale Solo',
    'BATTLE_ROYALE',
    1, 1, 1,
    true,
    '1v1 Battle Royale lobby tournament.',
    '{"lobby_capacity": 100, "max_squads": 100}'::jsonb
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'br_duo',
    'Battle Royale Duo',
    'BATTLE_ROYALE',
    2, 2, 2,
    true,
    '2v2 Battle Royale lobby tournament.',
    '{"lobby_capacity": 100, "max_squads": 50}'::jsonb
  ),
  -- Free Fire Modes
  (
    'c0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000002',
    'ff_br_squad',
    'Battle Royale Squad',
    'BATTLE_ROYALE',
    4, 4, 4,
    true,
    'Standard 48-player Free Fire BR lobby tournament.',
    '{"lobby_capacity": 48, "max_squads": 12}'::jsonb
  ),
  (
    'c0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000002',
    'ff_clash_squad',
    'Clash Squad 4v4',
    'SINGLE_ELIMINATION',
    4, 4, 4,
    true,
    'Round-based 4v4 fast paced tactical shootout.',
    '{"rounds_to_win": 7, "team_vs_team": true}'::jsonb
  ),
  -- CODM Modes
  (
    'c0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000003',
    'codm_snd',
    'Search & Destroy',
    'SINGLE_ELIMINATION',
    5, 5, 5,
    true,
    'Competitive 5v5 Search & Destroy round-based tournament.',
    '{"rounds_to_win": 7, "team_vs_team": true}'::jsonb
  ),
  (
    'c0000000-0000-0000-0000-000000000007',
    'a0000000-0000-0000-0000-000000000003',
    'codm_hardpoint',
    'Hardpoint',
    'SINGLE_ELIMINATION',
    5, 5, 5,
    true,
    '5v5 Zone control race to 250 points.',
    '{"score_limit": 250, "time_limit_seconds": 600}'::jsonb
  )
ON CONFLICT (game_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  format = EXCLUDED.format,
  team_size = EXCLUDED.team_size,
  min_team_size = EXCLUDED.min_team_size,
  max_team_size = EXCLUDED.max_team_size,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- 3. Versioned Scoring Schemas (ADR-002, ADR-015)
INSERT INTO scoring_schemas (
  id, game_id, mode_id, mode_slug, mode_name, version, formula, tie_breakers, evidence_requirements, is_active
)
VALUES
  -- BGMI Krafton Points Table v1.0.0
  (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'br_squad',
    'Official Krafton Points Table',
    'bgmi_br_v1.0.0',
    '{
      "placement_points": {"1": 10, "2": 6, "3": 5, "4": 4, "5": 3, "6": 2, "7": 1, "8": 1, "9": 0, "10": 0, "11": 0, "12": 0, "13": 0, "14": 0, "15": 0, "16": 0},
      "kill_points": 1,
      "integer_only": true
    }'::jsonb,
    '[
      {"order": 1, "rule": "TOTAL_POINTS", "description": "Highest total score (placement + kill points)"},
      {"order": 2, "rule": "TOTAL_PLACEMENT_POINTS", "description": "Highest cumulative placement points across all matches"},
      {"order": 3, "rule": "TOTAL_KILL_POINTS", "description": "Highest cumulative kill points"},
      {"order": 4, "rule": "FIRST_PLACE_FINISHES", "description": "Highest number of 1st-place finishes (WWCD)"},
      {"order": 5, "rule": "FINAL_MATCH_PLACEMENT", "description": "Most recent match placement (head-to-head performance)"}
    ]'::jsonb,
    '{
      "requires_end_screen_screenshot": true,
      "requires_all_player_uids": true,
      "min_screenshot_resolution": "1280x720",
      "required_visible_fields": ["placement", "team_kills", "player_uids", "match_time"]
    }'::jsonb,
    true
  ),
  -- Free Fire MAX Booyah Points Table v1.0.0
  (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000004',
    'ff_br_squad',
    'Standard BR Booyah Points Table',
    'freefire_br_v1.0.0',
    '{
      "placement_points": {"1": 12, "2": 9, "3": 8, "4": 7, "5": 6, "6": 4, "7": 3, "8": 2, "9": 1, "10": 0, "11": 0, "12": 0},
      "kill_points": 1,
      "integer_only": true
    }'::jsonb,
    '[
      {"order": 1, "rule": "TOTAL_POINTS", "description": "Highest total points (placement + kill points)"},
      {"order": 2, "rule": "FIRST_PLACE_FINISHES", "description": "Highest total Booyah (1st place) finishes"},
      {"order": 3, "rule": "TOTAL_KILL_POINTS", "description": "Highest total cumulative kill points"},
      {"order": 4, "rule": "FINAL_MATCH_PLACEMENT", "description": "Placement in the final round of the series"}
    ]'::jsonb,
    '{
      "requires_end_screen_screenshot": true,
      "requires_all_player_uids": true,
      "min_screenshot_resolution": "1280x720",
      "required_visible_fields": ["placement", "booyah_badge", "team_kills", "player_stats"]
    }'::jsonb,
    true
  ),
  -- CODM Multiplayer Standard v1.0.0
  (
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000006',
    'codm_snd',
    'CODM Competitive Series Scoring',
    'codm_mp_v1.0.0',
    '{
      "win_points": 3,
      "loss_points": 0,
      "round_points": 0,
      "integer_only": true
    }'::jsonb,
    '[
      {"order": 1, "rule": "MATCHES_WON", "description": "Highest number of matches won in series"},
      {"order": 2, "rule": "ROUND_DIFFERENTIAL", "description": "Round differential (rounds won - rounds lost)"},
      {"order": 3, "rule": "SCORE_DIFFERENTIAL", "description": "Score differential (points scored - points conceded)"},
      {"order": 4, "rule": "HEAD_TO_HEAD", "description": "Head-to-head match result"}
    ]'::jsonb,
    '{
      "requires_end_screen_screenshot": true,
      "requires_all_player_uids": true,
      "min_screenshot_resolution": "1280x720",
      "required_visible_fields": ["victory_defeat_banner", "final_score", "player_kda"]
    }'::jsonb,
    true
  )
ON CONFLICT (game_id, mode_slug, version) DO UPDATE SET
  mode_name = EXCLUDED.mode_name,
  formula = EXCLUDED.formula,
  tie_breakers = EXCLUDED.tie_breakers,
  evidence_requirements = EXCLUDED.evidence_requirements,
  is_active = EXCLUDED.is_active;

-- 4. Rule Templates
INSERT INTO rule_templates (
  id, game_id, mode_id, name, description, rules_text, evidence_requirements, tie_breaker_rules, is_default
)
VALUES
  -- BGMI Standard Competitive Rules
  (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'BGMI Standard Competitive Squad Rules',
    'Standard Krafton tournament rules for Battle Royale Squad lobbies.',
    '1. Emulator or iPad play is strictly prohibited unless explicitly stated. Mobile phones only.
2. Players must join the lobby with registered in-game UIDs. Mismatched UIDs will be kicked.
3. Teaming, scripting, map glitching, or third-party crosshairs will result in immediate disqualification and a 1-year platform ban.
4. If a player disconnects in spawn island, lobby will restart only if notified within 60 seconds. No in-game restarts for individual disconnects.
5. Captains must submit final match scoreboard screenshots within 15 minutes of match conclusion.',
    '{
      "screenshot_required": true,
      "video_required": false,
      "min_resolution": "1280x720",
      "allowed_formats": ["image/png", "image/jpeg"]
    }'::jsonb,
    '[
      {"metric": "TOTAL_POINTS", "priority": 1},
      {"metric": "TOTAL_PLACEMENT_POINTS", "priority": 2},
      {"metric": "TOTAL_KILL_POINTS", "priority": 3},
      {"metric": "FIRST_PLACE_FINISHES", "priority": 4}
    ]'::jsonb,
    true
  ),
  -- Free Fire Standard Rules
  (
    'd0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000004',
    'Free Fire MAX Competitive Rules',
    'Standard tournament rules for Free Fire BR Squad.',
    '1. All players must play on official Free Fire / Free Fire MAX mobile clients. PC emulators are strictly banned.
2. Gun attributes are turned OFF in all competitive custom rooms.
3. Character skill slots are permitted as configured by tournament lobby rules.
4. End-screen Booyah/Defeat screenshot showing squad kills and damage must be submitted within 15 minutes.
5. In case of tie, team with most Booyahs ranks higher.',
    '{
      "screenshot_required": true,
      "video_required": false,
      "min_resolution": "1280x720",
      "allowed_formats": ["image/png", "image/jpeg"]
    }'::jsonb,
    '[
      {"metric": "TOTAL_POINTS", "priority": 1},
      {"metric": "FIRST_PLACE_FINISHES", "priority": 2},
      {"metric": "TOTAL_KILL_POINTS", "priority": 3}
    ]'::jsonb,
    true
  ),
  -- CODM S&D Rules
  (
    'd0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000006',
    'CODM Search & Destroy 5v5 Rules',
    'Standard competitive rules for CODM Search & Destroy series.',
    '1. Best of 3 or Best of 5 series. First to 7 round wins takes each map.
2. Banned items: NA-45, Trip Mines, Thermites, persistence perk, and specific scorestreaks per CDL ruleset.
3. Emulators and external controllers (gamepads, triggers) are forbidden.
4. Screenshots of final scoreboard for each map must be submitted by both teams.',
    '{
      "screenshot_required": true,
      "video_required": false,
      "min_resolution": "1280x720",
      "allowed_formats": ["image/png", "image/jpeg"]
    }'::jsonb,
    '[
      {"metric": "MATCHES_WON", "priority": 1},
      {"metric": "ROUND_DIFFERENTIAL", "priority": 2},
      {"metric": "SCORE_DIFFERENTIAL", "priority": 3}
    ]'::jsonb,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  rules_text = EXCLUDED.rules_text,
  evidence_requirements = EXCLUDED.evidence_requirements,
  tie_breaker_rules = EXCLUDED.tie_breaker_rules,
  is_default = EXCLUDED.is_default;
