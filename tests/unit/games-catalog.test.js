process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Scoring engine imports
import {
  calculateScore,
  calculateCodmScore,
  calculateFormulaScore,
  sortStandings,
  verifyLobbyPlacementPoints,
  verifyCombatantKillCount,
  simulateTournamentScoring,
  BGMI_PLACEMENT_TABLE,
  FREEFIRE_PLACEMENT_TABLE,
} from '../../packages/scoring-engine/src/index.js';

// Validation schemas import
import {
  GameCreateSchema,
  GameModeCreateSchema,
  ScoringFormulaSchema,
  ScoringSchemaCreateSchema,
  ScoringSchemaNewVersionSchema,
  RuleTemplateCreateSchema,
  EvidenceRequirementsSchema,
  ScoringSimulationInputSchema,
} from '../../packages/validation/src/index.ts';

// RBAC imports
import { PERMISSIONS, ROLES, hasPermission, isAdminRole } from '../../backend/src/common/rbac.js';

const ROOT = path.resolve('.');

// ─── 1. Migration 005 Foundation & Security Triggers ────────────────────────

test('Phase 11 Database: Migration 005 exists and defines game_modes, rule_templates, and versioned scoring enhancements', () => {
  const migPath = path.join(ROOT, 'infra/migrations/005_games_modes_scoring.sql');
  assert.ok(fs.existsSync(migPath), 'Migration 005 file must exist');

  const sql = fs.readFileSync(migPath, 'utf8');

  // Verify required tables and schema modifications
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS game_modes'), 'Migration 005 must create game_modes table');
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS rule_templates'), 'Migration 005 must create rule_templates table');
  assert.ok(sql.includes('ALTER TABLE scoring_schemas'), 'Migration 005 must alter scoring_schemas');
  assert.ok(sql.includes('previous_version_id UUID'), 'Migration 005 must add previous_version_id to track version lineage');
  assert.ok(sql.includes('tie_breakers JSONB'), 'Migration 005 must add tie_breakers JSONB column');
  assert.ok(sql.includes('evidence_requirements JSONB'), 'Migration 005 must add evidence_requirements JSONB column');
});

test('Phase 11 Security Gate: Database trigger forbids in-place modification of published scoring formulas', () => {
  const migPath = path.join(ROOT, 'infra/migrations/005_games_modes_scoring.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  // Verify trigger and security exception message
  assert.ok(
    sql.includes('prevent_live_scoring_formula_mutation()'),
    'Function to prevent live scoring formula tampering must be defined'
  );
  assert.ok(
    sql.includes('SECURITY VIOLATION: Scoring formulas are immutable once published'),
    'Trigger must raise security exception when an update attempts to silently modify formula'
  );
  assert.ok(
    sql.includes('BEFORE UPDATE ON scoring_schemas'),
    'BEFORE UPDATE trigger must be attached to scoring_schemas'
  );
});

test('Phase 11 Security Gate: RLS policies enforce public read and admin-only write on games catalog', () => {
  const migPath = path.join(ROOT, 'infra/migrations/005_games_modes_scoring.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  assert.ok(sql.includes('ALTER TABLE games ENABLE ROW LEVEL SECURITY'), 'games table must have RLS enabled');
  assert.ok(sql.includes('ALTER TABLE game_modes ENABLE ROW LEVEL SECURITY'), 'game_modes table must have RLS enabled');
  assert.ok(sql.includes('ALTER TABLE rule_templates ENABLE ROW LEVEL SECURITY'), 'rule_templates table must have RLS enabled');
  assert.ok(sql.includes('ALTER TABLE scoring_schemas ENABLE ROW LEVEL SECURITY'), 'scoring_schemas table must have RLS enabled');
  assert.ok(sql.includes("CURRENT_SETTING('app.current_user_role', true) IN ('ADMIN', 'SUPER_ADMIN')"), 'Admin-only mutation policy must check user role');
});

// ─── 2. Seed Data Validation (seed_games.sql) ───────────────────────────────

test('Phase 11 Seeds: seed_games.sql contains valid schema for BGMI, Free Fire MAX, and CODM', () => {
  const seedPath = path.join(ROOT, 'infra/seeds/seed_games.sql');
  assert.ok(fs.existsSync(seedPath), 'seed_games.sql must exist');

  const sql = fs.readFileSync(seedPath, 'utf8');

  // Launch games
  assert.ok(sql.includes("'bgmi'"), 'BGMI launch game must be seeded');
  assert.ok(sql.includes("'freefire'"), 'Free Fire MAX launch game must be seeded');
  assert.ok(sql.includes("'codm'"), 'Call of Duty Mobile launch game must be seeded');

  // Modes
  assert.ok(sql.includes("'br_squad'"), 'BGMI Squad mode must be seeded');
  assert.ok(sql.includes("'ff_br_squad'"), 'Free Fire Squad mode must be seeded');
  assert.ok(sql.includes("'codm_snd'"), 'CODM Search & Destroy mode must be seeded');

  // Scoring schemas
  assert.ok(sql.includes("'bgmi_br_v1.0.0'"), 'BGMI v1.0.0 scoring schema must be seeded');
  assert.ok(sql.includes("'freefire_br_v1.0.0'"), 'Free Fire v1.0.0 scoring schema must be seeded');
  assert.ok(sql.includes("'codm_mp_v1.0.0'"), 'CODM v1.0.0 scoring schema must be seeded');

  // Rule templates
  assert.ok(sql.includes('BGMI Standard Competitive Squad Rules'), 'BGMI rule template must be seeded');
  assert.ok(sql.includes('Free Fire MAX Competitive Rules'), 'Free Fire rule template must be seeded');
  assert.ok(sql.includes('CODM Search & Destroy 5v5 Rules'), 'CODM rule template must be seeded');
});

// ─── 3. Shared Validation Package Tests ─────────────────────────────────────

test('Phase 11 Validation: GameCreateSchema validates correct slug and team constraints', () => {
  const valid = GameCreateSchema.safeParse({
    slug: 'apex_mobile',
    name: 'Apex Legends Mobile',
    publisher: 'EA / Respawn',
    max_team_size: 3,
    min_team_size: 1,
    platforms: ['ANDROID', 'IOS'],
  });
  assert.ok(valid.success, 'Valid game create payload must pass');

  // Invalid slug with spaces or uppercase
  const invalidSlug = GameCreateSchema.safeParse({
    slug: 'Apex Legends Mobile!',
    name: 'Apex Legends',
  });
  assert.equal(invalidSlug.success, false, 'Invalid slug with special characters must fail');
});

test('Phase 11 Validation: ScoringFormulaSchema enforces integer arithmetic invariant', () => {
  const valid = ScoringFormulaSchema.safeParse({
    placement_points: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6 },
    kill_points: 2,
    integer_only: true,
  });
  assert.ok(valid.success, 'Integer formula must pass validation');

  // Fractional kill points should fail or be rejected
  const invalidFractional = ScoringFormulaSchema.safeParse({
    placement_points: { 1: 10 },
    kill_points: 1.5, // Not integer
  });
  assert.equal(invalidFractional.success, false, 'Fractional kill points must be rejected');
});

test('Phase 11 Validation: ScoringSchemaNewVersionSchema mandates change reason for audit compliance', () => {
  const valid = ScoringSchemaNewVersionSchema.safeParse({
    new_version: 'bgmi_br_v1.1.0',
    formula: {
      placement_points: { 1: 10, 2: 6 },
      kill_points: 1,
    },
    change_reason: 'Updated placement table in accordance with Krafton 2026 Season Rules',
  });
  assert.ok(valid.success, 'Valid version update with reason must pass');

  // Missing or too short reason
  const missingReason = ScoringSchemaNewVersionSchema.safeParse({
    new_version: 'bgmi_br_v1.1.0',
    formula: { kill_points: 1 },
    change_reason: 'ok', // < 5 chars
  });
  assert.equal(missingReason.success, false, 'Too short change reason must be rejected');
});

// ─── 4. Deterministic Scoring Engine Mathematics (ADR-015) ───────────────────

test('Phase 11 Scoring Engine: BGMI Krafton placement points + kills (10-point system)', () => {
  // 1st place + 7 kills = 17 pts (10 + 7)
  const score1 = calculateScore('bgmi', { placement: 1, kills: 7 });
  assert.equal(score1.placementPoints, 10);
  assert.equal(score1.killPoints, 7);
  assert.equal(score1.totalPoints, 17);

  // 2nd place + 4 kills = 10 pts (6 + 4)
  const score2 = calculateScore('bgmi', { placement: 2, kills: 4 });
  assert.equal(score2.placementPoints, 6);
  assert.equal(score2.totalPoints, 10);

  // 8th place = 1 placement point
  const score8 = calculateScore('bgmi', { placement: 8, kills: 1 });
  assert.equal(score8.placementPoints, 1);
  assert.equal(score8.totalPoints, 2);

  // 9th place = 0 placement points
  const score9 = calculateScore('bgmi', { placement: 9, kills: 5 });
  assert.equal(score9.placementPoints, 0);
  assert.equal(score9.totalPoints, 5);
});

test('Phase 11 Scoring Engine: Free Fire Booyah points + kills (12-point system)', () => {
  // 1st place Booyah + 9 kills = 21 pts (12 + 9)
  const score1 = calculateScore('freefire', { placement: 1, kills: 9 });
  assert.equal(score1.placementPoints, 12);
  assert.equal(score1.killPoints, 9);
  assert.equal(score1.totalPoints, 21);

  // 5th place = 6 placement points
  const score5 = calculateScore('freefire', { placement: 5, kills: 2 });
  assert.equal(score5.placementPoints, 6);
  assert.equal(score5.totalPoints, 8);

  // 10th place = 0 placement points
  const score10 = calculateScore('freefire', { placement: 10, kills: 3 });
  assert.equal(score10.placementPoints, 0);
  assert.equal(score10.totalPoints, 3);
});

test('Phase 11 Scoring Engine: CODM Multiplayer Match Win scoring (ADR-015 Section 3)', () => {
  const win = calculateCodmScore({ is_winner: true, rounds_won: 7, rounds_lost: 4, kills: 14 });
  assert.equal(win.bonusPoints, 3);
  assert.equal(win.totalPoints, 3);

  const loss = calculateCodmScore({ is_winner: false, rounds_won: 4, rounds_lost: 7, kills: 9 });
  assert.equal(loss.bonusPoints, 0);
  assert.equal(loss.totalPoints, 0);
});

test('Phase 11 Scoring Engine: Universal calculateFormulaScore executes arbitrary versioned JSON schemas', () => {
  const customFormula = {
    placement_points: { 1: 20, 2: 15, 3: 10, 4: 5 },
    kill_points: 2,
    assist_points: 1,
    win_points: 5,
    integer_only: true,
  };

  const rawStats = {
    placement: 1,
    kills: 6,
    assists: 3,
    is_winner: true,
  };

  // 20 (1st) + (6 * 2 = 12 kills) + (3 * 1 = 3 assists) + 5 (win) = 40 pts
  const result = calculateFormulaScore(customFormula, rawStats);
  assert.equal(result.placementPoints, 20);
  assert.equal(result.killPoints, 12);
  assert.equal(result.bonusPoints, 8);
  assert.equal(result.totalPoints, 40);
  assert.equal(Number.isInteger(result.totalPoints), true, 'Invariant: result must be integer');
});

// ─── 5. Tie-Breaking Hierarchies (ADR-015) ───────────────────────────────────

test('Phase 11 Tie-Breaker: BGMI ties resolved by Placement Points -> Kill Points -> WWCDs -> Final Match Rank', () => {
  const participants = [
    // Team A: 15 pts (10 placement + 5 kills, 1 WWCD, final rank 1)
    { id: 'A', name: 'Team A', placementPoints: 10, killPoints: 5, totalPoints: 15, first_place_finishes: 1, final_match_placement: 1 },
    // Team B: 15 pts (6 placement + 9 kills, 0 WWCD, final rank 2)
    { id: 'B', name: 'Team B', placementPoints: 6, killPoints: 9, totalPoints: 15, first_place_finishes: 0, final_match_placement: 2 },
    // Team C: 15 pts (10 placement + 5 kills, 1 WWCD, final rank 3)
    { id: 'C', name: 'Team C', placementPoints: 10, killPoints: 5, totalPoints: 15, first_place_finishes: 1, final_match_placement: 3 },
  ];

  const standings = sortStandings(participants, 'bgmi');

  // Both A and C have 10 placement pts vs B's 6 placement pts -> B must be 3rd
  assert.equal(standings[2].id, 'B', 'Team B has fewer placement points, ranks 3rd');

  // Between A and C: both 15 pts, 10 placement, 5 kills, 1 WWCD -> A has final rank 1 vs C's 3 -> A is 1st, C is 2nd
  assert.equal(standings[0].id, 'A', 'Team A ranks 1st via final match placement');
  assert.equal(standings[1].id, 'C', 'Team C ranks 2nd');
});

test('Phase 11 Tie-Breaker: Free Fire ties resolved by Booyahs (1st finishes) -> Kill Points', () => {
  const participants = [
    // Team X: 20 pts (12 placement + 8 kills, 1 Booyah)
    { id: 'X', name: 'Team X', placementPoints: 12, killPoints: 8, totalPoints: 20, first_place_finishes: 1 },
    // Team Y: 20 pts (8 placement + 12 kills, 0 Booyahs)
    { id: 'Y', name: 'Team Y', placementPoints: 8, killPoints: 12, totalPoints: 20, first_place_finishes: 0 },
    // Team Z: 20 pts (12 placement + 8 kills, 2 Booyahs)
    { id: 'Z', name: 'Team Z', placementPoints: 12, killPoints: 8, totalPoints: 20, first_place_finishes: 2 },
  ];

  const standings = sortStandings(participants, 'freefire');

  // Team Z has 2 Booyahs -> ranks 1st
  assert.equal(standings[0].id, 'Z', 'Team Z has most Booyahs, ranks 1st');
  // Team X has 1 Booyah -> ranks 2nd
  assert.equal(standings[1].id, 'X', 'Team X has 1 Booyah, ranks 2nd');
  // Team Y has 0 Booyahs -> ranks 3rd
  assert.equal(standings[2].id, 'Y', 'Team Y has 0 Booyahs, ranks 3rd');
});

test('Phase 11 Tie-Breaker: CODM ties resolved by Round Differential', () => {
  const participants = [
    // Team Alpha: 6 match pts (rounds: 14 won, 10 lost -> +4 diff)
    { id: 'Alpha', name: 'Alpha', placementPoints: 0, killPoints: 0, totalPoints: 6, rounds_won: 14, rounds_lost: 10 },
    // Team Beta: 6 match pts (rounds: 14 won, 6 lost -> +8 diff)
    { id: 'Beta', name: 'Beta', placementPoints: 0, killPoints: 0, totalPoints: 6, rounds_won: 14, rounds_lost: 6 },
  ];

  const standings = sortStandings(participants, 'codm');
  assert.equal(standings[0].id, 'Beta', 'Beta has higher round differential (+8 vs +4), ranks 1st');
  assert.equal(standings[1].id, 'Alpha', 'Alpha ranks 2nd');
});

// ─── 6. Automated Verification Invariants (ADR-015 Invariant 3) ──────────────

test('Phase 11 Invariant: verifyLobbyPlacementPoints verifies expected sum for lobby size', () => {
  // BGMI 16-team lobby placement points sum: 10+6+5+4+3+2+1+1 = 32 points
  const validResults = [
    { placement: 1, placementPoints: 10 },
    { placement: 2, placementPoints: 6 },
    { placement: 3, placementPoints: 5 },
    { placement: 4, placementPoints: 4 },
    { placement: 5, placementPoints: 3 },
    { placement: 6, placementPoints: 2 },
    { placement: 7, placementPoints: 1 },
    { placement: 8, placementPoints: 1 },
    { placement: 9, placementPoints: 0 },
    { placement: 10, placementPoints: 0 },
  ];

  const checkValid = verifyLobbyPlacementPoints(validResults, BGMI_PLACEMENT_TABLE, 10);
  assert.equal(checkValid.valid, true, 'Valid placement sum must pass verification');
  assert.equal(checkValid.actualSum, 32);

  // Manipulated result where 1st place is awarded 15 points instead of 10
  const tamperedResults = [
    ...validResults.slice(1),
    { placement: 1, placementPoints: 15 },
  ];
  const checkTampered = verifyLobbyPlacementPoints(tamperedResults, BGMI_PLACEMENT_TABLE, 10);
  assert.equal(checkTampered.valid, false, 'Tampered placement sum must be detected');
  assert.ok(checkTampered.error.includes('mismatch'));
});

test('Phase 11 Invariant: verifyCombatantKillCount rejects impossible kills exceeding lobby size', () => {
  // In a 100-player lobby, max recorded kills cannot exceed 100
  const validKills = [{ kills: 12 }, { kills: 8 }, { kills: 20 }, { kills: 15 }];
  const checkValid = verifyCombatantKillCount(validKills, 100);
  assert.equal(checkValid.valid, true);

  // Manipulated kills summing to 105 in a 100-player lobby
  const excessiveKills = [{ kills: 60 }, { kills: 50 }];
  const checkExcessive = verifyCombatantKillCount(excessiveKills, 100);
  assert.equal(checkExcessive.valid, false);
  assert.ok(checkExcessive.error.includes('Excessive kills recorded'));
});

// ─── 7. Scoring Simulator Execution ─────────────────────────────────────────

test('Phase 11 Simulator: simulateTournamentScoring returns ranked standings and summary', () => {
  const sampleParticipants = [
    { id: '1', name: 'Team Soul', placement: 2, kills: 9 },
    { id: '2', name: 'GodLike', placement: 1, kills: 7 },
    { id: '3', name: 'Entity', placement: 3, kills: 3 },
  ];

  const simulation = simulateTournamentScoring({ gameSlug: 'bgmi' }, sampleParticipants);

  assert.equal(simulation.standings.length, 3);
  assert.equal(simulation.summary.totalParticipants, 3);
  assert.equal(simulation.summary.totalKillsRecorded, 19);

  // GodLike: 10 + 7 = 17 pts. Team Soul: 6 + 9 = 15 pts. Entity: 5 + 3 = 8 pts.
  assert.equal(simulation.standings[0].name, 'GodLike');
  assert.equal(simulation.standings[0].totalPoints, 17);
  assert.equal(simulation.standings[0].rank, 1);

  assert.equal(simulation.standings[1].name, 'Team Soul');
  assert.equal(simulation.standings[1].totalPoints, 15);
  assert.equal(simulation.standings[1].rank, 2);

  assert.equal(simulation.standings[2].name, 'Entity');
  assert.equal(simulation.standings[2].totalPoints, 8);
  assert.equal(simulation.standings[2].rank, 3);
});

// ─── 8. RBAC Permissions Matrix for Game Management ─────────────────────────

test('Phase 11 RBAC Gate: Only ADMIN and SUPER_ADMIN have GAMES_CREATE, GAMES_EDIT, and GAMES_SCORING_MANAGE', () => {
  // Super Admin has all permissions
  assert.equal(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.GAMES_CREATE), true);
  assert.equal(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.GAMES_EDIT), true);
  assert.equal(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.GAMES_DELETE), true);
  assert.equal(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.GAMES_SCORING_MANAGE), true);

  // Admin has create, edit, scoring_manage
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.GAMES_CREATE), true);
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.GAMES_EDIT), true);
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.GAMES_SCORING_MANAGE), true);

  // Regular players CANNOT edit games or scoring schemas
  assert.equal(hasPermission(ROLES.PLAYER, PERMISSIONS.GAMES_CREATE), false);
  assert.equal(hasPermission(ROLES.PLAYER, PERMISSIONS.GAMES_EDIT), false);
  assert.equal(hasPermission(ROLES.PLAYER, PERMISSIONS.GAMES_SCORING_MANAGE), false);

  // Organisers can view games and run the scoring simulator, but CANNOT mutate games catalog
  assert.equal(hasPermission(ROLES.ORGANISER, PERMISSIONS.GAMES_VIEW), true);
  assert.equal(hasPermission(ROLES.ORGANISER, PERMISSIONS.SCORING_SIMULATE), true);
  assert.equal(hasPermission(ROLES.ORGANISER, PERMISSIONS.GAMES_CREATE), false);
  assert.equal(hasPermission(ROLES.ORGANISER, PERMISSIONS.GAMES_EDIT), false);
  assert.equal(hasPermission(ROLES.ORGANISER, PERMISSIONS.GAMES_SCORING_MANAGE), false);
});
