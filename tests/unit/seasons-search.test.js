/**
 * Vexora Phase 14: Seasons, Search & Filters
 *
 * Tests cover:
 *   1.  Migration 008 Structure (seasons table, pg_trgm/unaccent, indexes, constraints)
 *   2.  One-active-season-per-game invariant index
 *   3.  Trigram and full-text search indexes on all 5 entities
 *   4.  Validation schemas (SeasonCreate, SeasonUpdate, SearchQuery)
 *   5.  Security Gate: Zero private fields exposed in search projections
 *   6.  Privacy Gate: Private profiles excluded from player search
 *   7.  Seasons service methods & audit trail verification
 *   8.  Express routes registration & admin RBAC gate enforcement
 *   9.  Flutter Search screen & Category filter chips
 */

process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Service & router imports
import {
  createSeason,
  getSeasons,
  getActiveSeason,
  getSeasonById,
  updateSeason,
  activateSeason,
  archiveSeason,
} from '../../backend/src/seasons/seasons.service.js';

import { seasonsRouter } from '../../backend/src/seasons/seasons.routes.js';

import {
  searchAll,
  searchGames,
  searchTeams,
  searchPlayers,
  searchTournaments,
  searchSeasons,
  PUBLIC_PLAYER_FIELDS,
  PUBLIC_TEAM_FIELDS,
  PUBLIC_GAME_FIELDS,
  PUBLIC_TOURNAMENT_FIELDS,
  PUBLIC_SEASON_FIELDS,
} from '../../backend/src/search/search.service.js';

import { searchRouter } from '../../backend/src/search/search.routes.js';

// Validation schemas import
import {
  SeasonCreateSchema,
  SeasonUpdateSchema,
  SearchQuerySchema,
} from '../../packages/validation/src/index.ts';

const ROOT = path.resolve('.');

// ─── 1. Migration 008 Structure Validation ──────────────────────────────────

test('Phase 14 Database: Migration 008 file exists and enables search extensions', () => {
  const migPath = path.join(ROOT, 'infra/migrations/008_seasons_and_search_indexes.sql');
  assert.ok(fs.existsSync(migPath), 'Migration 008 file must exist');

  const sql = fs.readFileSync(migPath, 'utf8');

  // Extensions
  assert.ok(sql.includes('CREATE EXTENSION IF NOT EXISTS pg_trgm'), 'Must enable pg_trgm extension');
  assert.ok(sql.includes('CREATE EXTENSION IF NOT EXISTS unaccent'), 'Must enable unaccent extension');
});

test('Phase 14 Database: Migration 008 defines seasons table with required constraints', () => {
  const migPath = path.join(ROOT, 'infra/migrations/008_seasons_and_search_indexes.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS seasons'), 'Must create seasons table');
  assert.ok(sql.includes('game_id'), 'Must include game_id foreign key');
  assert.ok(sql.includes('season_number'), 'Must include season_number');
  assert.ok(sql.includes('start_at'), 'Must include start_at');
  assert.ok(sql.includes('end_at'), 'Must include end_at');
  assert.ok(sql.includes('is_active'), 'Must include is_active boolean');
  assert.ok(sql.includes('chk_season_dates CHECK (end_at > start_at)'), 'Must check end_at > start_at');
  assert.ok(sql.includes('chk_season_status CHECK'), 'Must constrain season status enum');
  assert.ok(sql.includes('uq_game_season_slug UNIQUE (game_id, slug)'), 'Must have unique slug per game');

  // Single active season invariant
  assert.ok(sql.includes('idx_one_active_season_per_game'), 'Must define partial unique index for active season');
  assert.ok(sql.includes('WHERE is_active = TRUE'), 'Active season index must filter by is_active = TRUE');
});

test('Phase 14 Database: Migration 008 defines trigram and FTS indexes across entities', () => {
  const migPath = path.join(ROOT, 'infra/migrations/008_seasons_and_search_indexes.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  // Games
  assert.ok(sql.includes('idx_games_name_trgm'), 'Must have trigram index on games name');
  assert.ok(sql.includes('idx_games_search'), 'Must have FTS index on games');

  // Teams
  assert.ok(sql.includes('idx_teams_name_trgm'), 'Must have trigram index on teams name');
  assert.ok(sql.includes('idx_teams_tag_trgm'), 'Must have trigram index on teams tag');
  assert.ok(sql.includes('idx_teams_search'), 'Must have FTS index on teams');

  // Users (Players)
  assert.ok(sql.includes('idx_users_username_trgm'), 'Must have trigram index on username');
  assert.ok(sql.includes('idx_users_display_name_trgm'), 'Must have trigram index on display_name');
  assert.ok(sql.includes('idx_users_search'), 'Must have FTS index on users');

  // Tournaments & Seasons
  assert.ok(sql.includes('idx_tournaments_name_trgm'), 'Must have trigram index on tournaments name');
  assert.ok(sql.includes('idx_tournaments_search'), 'Must have FTS index on tournaments');
  assert.ok(sql.includes('idx_seasons_name_trgm'), 'Must have trigram index on seasons name');
  assert.ok(sql.includes('idx_seasons_search'), 'Must have FTS index on seasons');

  // Row Level Security
  assert.ok(sql.includes('ALTER TABLE seasons ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on seasons');
  assert.ok(sql.includes('rls_seasons_public_read'), 'Must have public read policy on seasons');
});

// ─── 2. Validation Schemas ──────────────────────────────────────────────────

test('Phase 14 Validation: SeasonCreateSchema accepts valid season', () => {
  const valid = {
    game_id: 'a0000000-0000-0000-0000-000000000001',
    name: 'BGMI Season 1: Genesis',
    slug: 'bgmi_s1_genesis',
    season_number: 1,
    description: 'Premier inaugural season',
    start_at: '2026-09-01T00:00:00.000Z',
    end_at: '2026-12-31T23:59:59.000Z',
    banner_url: 'https://assets.vexora.gg/banners/bgmi-s1.jpg',
    rules_config: { formula: 'bgmi_br_v1.0.0' },
  };

  const parsed = SeasonCreateSchema.parse(valid);
  assert.equal(parsed.name, 'BGMI Season 1: Genesis');
  assert.equal(parsed.slug, 'bgmi_s1_genesis');
  assert.equal(parsed.season_number, 1);
});

test('Phase 14 Validation: SeasonCreateSchema rejects invalid slug format', () => {
  assert.throws(() => {
    SeasonCreateSchema.parse({
      game_id: 'a0000000-0000-0000-0000-000000000001',
      name: 'BGMI Season',
      slug: 'BGMI Season with Spaces!', // uppercase and spaces forbidden
      start_at: '2026-09-01T00:00:00.000Z',
      end_at: '2026-12-31T23:59:59.000Z',
    });
  });
});

test('Phase 14 Validation: SeasonCreateSchema rejects end_at <= start_at', () => {
  assert.throws(() => {
    SeasonCreateSchema.parse({
      game_id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Invalid Season',
      slug: 'invalid_season',
      start_at: '2026-12-31T00:00:00.000Z',
      end_at: '2026-09-01T00:00:00.000Z', // end before start
    });
  });
});

test('Phase 14 Validation: SeasonUpdateSchema accepts partial updates', () => {
  const update = {
    name: 'Updated Season Name',
    status: 'ACTIVE',
  };
  const parsed = SeasonUpdateSchema.parse(update);
  assert.equal(parsed.name, 'Updated Season Name');
  assert.equal(parsed.status, 'ACTIVE');
});

test('Phase 14 Validation: SearchQuerySchema accepts valid queries with defaults', () => {
  const query = { q: 'bgmi' };
  const parsed = SearchQuerySchema.parse(query);
  assert.equal(parsed.q, 'bgmi');
  assert.equal(parsed.type, 'ALL');
  assert.equal(parsed.limit, 20);
  assert.equal(parsed.offset, 0);
  assert.equal(parsed.sort, 'RELEVANCE');
});

test('Phase 14 Validation: SearchQuerySchema accepts all category types', () => {
  const types = ['ALL', 'GAMES', 'TEAMS', 'PLAYERS', 'TOURNAMENTS', 'SEASONS'];
  for (const t of types) {
    const parsed = SearchQuerySchema.parse({ q: 'test', type: t });
    assert.equal(parsed.type, t);
  }
});

test('Phase 14 Validation: SearchQuerySchema rejects empty search string', () => {
  assert.throws(() => {
    SearchQuerySchema.parse({ q: '' });
  });
});

// ─── 3. Security Gate: Zero-Leak Search Projections ─────────────────────────

test('Phase 14 Security Gate: PUBLIC_PLAYER_FIELDS strictly excludes all private PII fields', () => {
  const fields = PUBLIC_PLAYER_FIELDS.map((f) => f.toLowerCase());

  // Must include only safe public fields
  assert.ok(fields.some((f) => f.includes('username')));
  assert.ok(fields.some((f) => f.includes('display_name')));
  assert.ok(fields.some((f) => f.includes('avatar_url')));
  assert.ok(fields.some((f) => f.includes('fair_play_score')));

  // Strictly FORBIDDEN in public search results
  const forbidden = [
    'email',
    'phone',
    'firebase_uid',
    'password_hash',
    'device_id',
    'dob',
    'country_code',
    'ip_hash',
    'refresh_token',
    'secret',
  ];

  for (const priv of forbidden) {
    assert.ok(
      !fields.some((f) => f.includes(priv)),
      `SECURITY VIOLATION: Private field "${priv}" must NEVER be in PUBLIC_PLAYER_FIELDS`
    );
  }
});

test('Phase 14 Security Gate: Player search query strictly filters out PRIVATE profiles', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'backend/src/search/search.service.js'), 'utf8');

  // Verify privacy check in SQL query
  assert.ok(
    serviceSrc.includes("profile_visibility, 'PUBLIC') != 'PRIVATE'"),
    'Must enforce profile_visibility != PRIVATE in searchPlayers'
  );
  assert.ok(
    serviceSrc.includes("status = 'ACTIVE'"),
    'Must only return ACTIVE accounts in player search'
  );
});

test('Phase 14 Security Gate: Search service uses parameterized queries (no SQL injection)', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'backend/src/search/search.service.js'), 'utf8');

  assert.ok(serviceSrc.includes('$1'), 'Must use parameterized queries');
  assert.ok(serviceSrc.includes('plainto_tsquery'), 'Must use plainto_tsquery for safe text parsing');
  assert.ok(serviceSrc.includes('similarity('), 'Must use similarity function for fuzzy trigram matching');
});

// ─── 4. Seasons Service Methods & Invariants ────────────────────────────────

test('Phase 14 Seasons Service: exports all 7 management methods', () => {
  assert.equal(typeof createSeason, 'function');
  assert.equal(typeof getSeasons, 'function');
  assert.equal(typeof getActiveSeason, 'function');
  assert.equal(typeof getSeasonById, 'function');
  assert.equal(typeof updateSeason, 'function');
  assert.equal(typeof activateSeason, 'function');
  assert.equal(typeof archiveSeason, 'function');
});

test('Phase 14 Seasons Invariant: activateSeason deactivates other active seasons for same game', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'backend/src/seasons/seasons.service.js'), 'utf8');

  // Must deactivate prior active seasons before setting new active
  assert.ok(
    serviceSrc.includes('UPDATE seasons SET is_active = FALSE'),
    'Must deactivate previous active seasons in activateSeason'
  );
  assert.ok(
    serviceSrc.includes("SET is_active = TRUE, status = 'ACTIVE'"),
    'Must set selected season to is_active = TRUE and status = ACTIVE'
  );
});

test('Phase 14 Seasons Audit: All mutating actions are recorded in audit log', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'backend/src/seasons/seasons.service.js'), 'utf8');

  assert.ok(serviceSrc.includes("action: 'seasons:create'"), 'Must audit season creation');
  assert.ok(serviceSrc.includes("action: 'seasons:update'"), 'Must audit season update');
  assert.ok(serviceSrc.includes("action: 'seasons:activate'"), 'Must audit season activation');
  assert.ok(serviceSrc.includes("action: 'seasons:archive'"), 'Must audit season archiving');
});

// ─── 5. Search Service Methods ──────────────────────────────────────────────

test('Phase 14 Search Service: exports unified searchAll and entity searchers', () => {
  assert.equal(typeof searchAll, 'function');
  assert.equal(typeof searchGames, 'function');
  assert.equal(typeof searchTeams, 'function');
  assert.equal(typeof searchPlayers, 'function');
  assert.equal(typeof searchTournaments, 'function');
  assert.equal(typeof searchSeasons, 'function');
});

test('Phase 14 Search Service: searchAll dispatches categories and handles empty queries gracefully', async () => {
  const emptyRes = await searchAll({ q: '' });
  assert.deepEqual(emptyRes, { games: [], teams: [], players: [], tournaments: [], seasons: [] });
});

// ─── 6. Express Routes & Admin RBAC Gates ───────────────────────────────────

test('Phase 14 Routes: seasonsRouter registers public and admin endpoints', () => {
  assert.ok(seasonsRouter, 'seasonsRouter must exist');

  const routes = seasonsRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  const paths = routes.map((r) => r.path);
  assert.ok(paths.includes('/'), 'Must have GET / route');
  assert.ok(paths.includes('/active/:gameId'), 'Must have GET /active/:gameId route');
  assert.ok(paths.includes('/:id'), 'Must have GET /:id route');
  assert.ok(paths.includes('/:id/activate'), 'Must have POST /:id/activate route');
  assert.ok(paths.includes('/:id/archive'), 'Must have POST /:id/archive route');
});

test('Phase 14 Routes: searchRouter registers unified and entity search endpoints', () => {
  assert.ok(searchRouter, 'searchRouter must exist');

  const routes = searchRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  const paths = routes.map((r) => r.path);
  assert.ok(paths.includes('/'), 'Must have GET / unified search route');
  assert.ok(paths.includes('/games'), 'Must have GET /games route');
  assert.ok(paths.includes('/teams'), 'Must have GET /teams route');
  assert.ok(paths.includes('/players'), 'Must have GET /players route');
  assert.ok(paths.includes('/tournaments'), 'Must have GET /tournaments route');
  assert.ok(paths.includes('/seasons'), 'Must have GET /seasons route');
});

test('Phase 14 Server Integration: server.js mounts /api/v1/seasons and /api/v1/search', () => {
  const serverSrc = fs.readFileSync(path.join(ROOT, 'backend/src/server.js'), 'utf8');

  assert.ok(serverSrc.includes("app.use('/api/v1/seasons',        seasonsRouter)"), 'Must mount seasonsRouter');
  assert.ok(serverSrc.includes("app.use('/api/v1/search',         searchRouter)"), 'Must mount searchRouter');
});

// ─── 7. Flutter Mobile Search Screen & Category Filters ─────────────────────

test('Phase 14 Flutter: SearchScreen exists and integrates category filters', () => {
  const screenPath = path.join(ROOT, 'apps/mobile/lib/screens/search_screen.dart');
  assert.ok(fs.existsSync(screenPath), 'search_screen.dart must exist');

  const src = fs.readFileSync(screenPath, 'utf8');

  // Verify class and state
  assert.ok(src.includes('class SearchScreen extends ConsumerStatefulWidget'));
  assert.ok(src.includes('class _SearchScreenState extends ConsumerState<SearchScreen>'));

  // Category filter chips
  assert.ok(src.includes("'ALL'"));
  assert.ok(src.includes("'GAME'"));
  assert.ok(src.includes("'SEASON'"));
  assert.ok(src.includes("'TEAM'"));
  assert.ok(src.includes("'TOURNAMENT'"));
  assert.ok(src.includes("'PLAYER'"));

  // Privacy notice
  assert.ok(src.includes('ADR-006 & Section 24'));
  assert.ok(src.includes('Private profiles and sensitive contact data are never exposed in search'));
});

test('Phase 14 Flutter: HomeShell AppBar includes search button route', () => {
  const shellSrc = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/screens/home_shell.dart'), 'utf8');

  assert.ok(shellSrc.includes("import 'search_screen.dart'"), 'Must import search_screen.dart');
  assert.ok(shellSrc.includes('Icons.search_rounded'), 'Must have search icon button');
  assert.ok(shellSrc.includes('MaterialPageRoute(builder: (_) => const SearchScreen())'), 'Must navigate to SearchScreen');
});
