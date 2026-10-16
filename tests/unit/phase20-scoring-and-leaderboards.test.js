import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateScore,
  calculateFormulaScore,
  calculateCodmScore,
  sortStandings,
  verifyLobbyPlacementPoints,
  verifyCombatantKillCount,
  simulateTournamentScoring,
  computeStandingsDigest,
  reproduceMatchScore,
  previewScore,
  BGMI_PLACEMENT_TABLE,
  FREEFIRE_PLACEMENT_TABLE,
} from '@vexora/scoring-engine';
import {
  LeaderboardQuerySchema,
  ProcessMatchResultSchema,
  LeaderboardSnapshotCreateSchema,
} from '@vexora/validation';
import { leaderboardsRouter } from '../../backend/src/leaderboards/leaderboards.routes.js';
import { closePool } from '../../backend/src/common/database.js';

// ============================================================================
// Phase 20: Scoring Engine, Leaderboards & Reproducibility Test Suite
// Specifications: Blueprint Section 5, 7, 16, 39; ADR-002, ADR-015
// ============================================================================

test('Phase 20 Database: Migration 014 file exists and defines leaderboard foundation', () => {
  const migrationPath = path.resolve(process.cwd(), 'infra/migrations/014_scoring_engine_and_leaderboards.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration 014 must exist');
  const content = fs.readFileSync(migrationPath, 'utf8');

  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS leaderboard_entries'), 'Defines leaderboard_entries table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS season_stats'), 'Defines season_stats table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS leaderboard_snapshots'), 'Defines leaderboard_snapshots table');
  assert.ok(content.includes('prevent_leaderboard_snapshot_mutation'), 'Defines snapshot immutability trigger');
  assert.ok(content.includes('ENABLE ROW LEVEL SECURITY'), 'Enables Row-Level Security');
});

// ─── Hand-Calculated Scenarios for Launch Games (Exit Criterion) ────────────

test('Phase 20 Scoring Exit Criterion: BGMI Krafton 10-Point Hand-Calculated Matches', () => {
  // Scenario 1: 1st place with 10 kills -> 10 + 10 = 20
  const match1 = calculateScore('bgmi', { placement: 1, kills: 10 });
  assert.equal(match1.placementPoints, 10);
  assert.equal(match1.killPoints, 10);
  assert.equal(match1.totalPoints, 20);

  // Scenario 2: 2nd place with 4 kills -> 6 + 4 = 10
  const match2 = calculateScore('bgmi', { placement: 2, kills: 4 });
  assert.equal(match2.placementPoints, 6);
  assert.equal(match2.killPoints, 4);
  assert.equal(match2.totalPoints, 10);

  // Scenario 3: 3rd place with 0 kills -> 5 + 0 = 5
  const match3 = calculateScore('bgmi', { placement: 3, kills: 0 });
  assert.equal(match3.placementPoints, 5);
  assert.equal(match3.killPoints, 0);
  assert.equal(match3.totalPoints, 5);

  // Scenario 4: 8th place with 2 kills -> 1 + 2 = 3
  const match4 = calculateScore('bgmi', { placement: 8, kills: 2 });
  assert.equal(match4.placementPoints, 1);
  assert.equal(match4.killPoints, 2);
  assert.equal(match4.totalPoints, 3);

  // Scenario 5: 9th place receives 0 placement points -> 0 + 5 = 5
  const match5 = calculateScore('bgmi', { placement: 9, kills: 5 });
  assert.equal(match5.placementPoints, 0);
  assert.equal(match5.killPoints, 5);
  assert.equal(match5.totalPoints, 5);
});

test('Phase 20 Scoring Exit Criterion: Free Fire MAX Booyah Hand-Calculated Matches', () => {
  // Scenario 1: 1st place Booyah with 7 kills -> 12 + 7 = 19
  const ff1 = calculateScore('freefire', { placement: 1, kills: 7 });
  assert.equal(ff1.placementPoints, 12);
  assert.equal(ff1.killPoints, 7);
  assert.equal(ff1.totalPoints, 19);

  // Scenario 2: 2nd place with 3 kills -> 9 + 3 = 12
  const ff2 = calculateScore('freefire', { placement: 2, kills: 3 });
  assert.equal(ff2.placementPoints, 9);
  assert.equal(ff2.killPoints, 3);
  assert.equal(ff2.totalPoints, 12);

  // Scenario 3: 9th place with 1 kill -> 1 + 1 = 2
  const ff3 = calculateScore('freefire', { placement: 9, kills: 1 });
  assert.equal(ff3.placementPoints, 1);
  assert.equal(ff3.killPoints, 1);
  assert.equal(ff3.totalPoints, 2);

  // Scenario 4: 10th place receives 0 placement points -> 0 + 6 = 6
  const ff4 = calculateScore('freefire', { placement: 10, kills: 6 });
  assert.equal(ff4.placementPoints, 0);
  assert.equal(ff4.killPoints, 6);
  assert.equal(ff4.totalPoints, 6);
});

test('Phase 20 Scoring Exit Criterion: CODM Multiplayer Hand-Calculated Matches', () => {
  // Match Win: 3 Match Points
  const codmWin = calculateCodmScore({ is_winner: true, score: 250, kills: 24 });
  assert.equal(codmWin.totalPoints, 3);
  assert.equal(codmWin.bonusPoints, 3);
  assert.equal(codmWin.killPoints, 24);

  // Match Loss: 0 Match Points
  const codmLoss = calculateCodmScore({ is_winner: false, score: 180, kills: 15 });
  assert.equal(codmLoss.totalPoints, 0);
  assert.equal(codmLoss.bonusPoints, 0);
  assert.equal(codmLoss.killPoints, 15);
});

// ─── Reproducibility Verifier (Exit Criterion) ──────────────────────────────

test('Phase 20 Exit Criterion: Finalised results are 100% reproducible from stored inputs', () => {
  const formula = {
    placement_points: { 1: 15, 2: 10, 3: 8, 4: 5 },
    kill_points: 2,
    assist_points: 1,
    win_points: 5,
  };

  const rawStats = {
    placement: 1,
    kills: 8,
    assists: 4,
    is_winner: true,
  };

  const calculation1 = reproduceMatchScore(formula, rawStats);
  const calculation2 = reproduceMatchScore(formula, rawStats);

  assert.deepEqual(calculation1.score, calculation2.score, 'Repeated calculation must be identical');
  assert.equal(calculation1.score.placementPoints, 15);
  assert.equal(calculation1.score.killPoints, 16); // 8 * 2
  assert.equal(calculation1.score.bonusPoints, 9); // (4 * 1) + 5
  assert.equal(calculation1.score.totalPoints, 40); // 15 + 16 + 9
});

// ─── Deterministic Tie-Breaker Hierarchies (ADR-015) ─────────────────────────

test('Phase 20 Tie-Breakers: BGMI Krafton hierarchy prioritizes placement points over kill points on equal total', () => {
  // Team A: 20 pts (10 placement, 10 kills)
  // Team B: 20 pts (6 placement, 14 kills)
  const combatants = [
    { id: 'team-b', placementPoints: 6, killPoints: 14, totalPoints: 20, first_place_finishes: 0, final_match_placement: 2 },
    { id: 'team-a', placementPoints: 10, killPoints: 10, totalPoints: 20, first_place_finishes: 1, final_match_placement: 1 },
  ];

  const sorted = sortStandings(combatants, 'bgmi');
  assert.equal(sorted[0].id, 'team-a', 'Team A must win tie-breaker due to higher placement points');
  assert.equal(sorted[0].rank, 1);
  assert.equal(sorted[1].id, 'team-b');
  assert.equal(sorted[1].rank, 2);
});

test('Phase 20 Tie-Breakers: Free Fire Booyah hierarchy prioritizes 1st place finishes', () => {
  // Both teams have 25 total points and 10 kill points.
  // Team X has 2 Booyahs (1st places); Team Y has 1 Booyah.
  const combatants = [
    { id: 'team-y', placementPoints: 15, killPoints: 10, totalPoints: 25, first_place_finishes: 1, final_match_placement: 3 },
    { id: 'team-x', placementPoints: 15, killPoints: 10, totalPoints: 25, first_place_finishes: 2, final_match_placement: 4 },
  ];

  const sorted = sortStandings(combatants, 'freefire');
  assert.equal(sorted[0].id, 'team-x', 'Team X must win tie-breaker due to more Booyahs');
  assert.equal(sorted[0].rank, 1);
  assert.equal(sorted[1].id, 'team-y');
  assert.equal(sorted[1].rank, 2);
});

test('Phase 20 Tie-Breakers: CODM hierarchy prioritizes round differential on equal match points', () => {
  const combatants = [
    { id: 'clan-2', totalPoints: 6, rounds_won: 15, rounds_lost: 12, score: 500, kills: 45 }, // Round Diff: +3
    { id: 'clan-1', totalPoints: 6, rounds_won: 18, rounds_lost: 10, score: 520, kills: 50 }, // Round Diff: +8
  ];

  const sorted = sortStandings(combatants, 'codm');
  assert.equal(sorted[0].id, 'clan-1', 'Clan 1 must rank higher due to superior round differential (+8 vs +3)');
});

// ─── Security Gate: Property-Based Tests ────────────────────────────────────

test('Phase 20 Property Test: Integer-Only Arithmetic Invariant across 100 randomized inputs', () => {
  const formula = {
    placement_points: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 4, 7: 2 },
    kill_points: 2,
    assist_points: 1,
    win_points: 5,
    round_points: 3,
  };

  for (let i = 0; i < 100; i++) {
    const randomStats = {
      placement: Math.floor(Math.random() * 20) + 1,
      kills: Math.floor(Math.random() * 50),
      assists: Math.floor(Math.random() * 20),
      rounds_won: Math.floor(Math.random() * 10),
      is_winner: Math.random() > 0.5,
    };

    const score = calculateFormulaScore(formula, randomStats);

    assert.ok(Number.isInteger(score.placementPoints), 'Placement points must be strict integer');
    assert.ok(Number.isInteger(score.killPoints), 'Kill points must be strict integer');
    assert.ok(Number.isInteger(score.bonusPoints), 'Bonus points must be strict integer');
    assert.ok(Number.isInteger(score.totalPoints), 'Total points must be strict integer');
    assert.ok(score.totalPoints >= 0, 'Total points must never be negative');
    assert.equal(score.totalPoints, score.placementPoints + score.killPoints + score.bonusPoints);
  }
});

test('Phase 20 Property Test: Monotonicity — more kills never lowers total score', () => {
  for (let k = 0; k < 20; k++) {
    const scoreA = calculateScore('bgmi', { placement: 2, kills: k });
    const scoreB = calculateScore('bgmi', { placement: 2, kills: k + 1 });
    assert.ok(scoreB.totalPoints >= scoreA.totalPoints, 'Score must be monotonically non-decreasing with kills');
  }
});

test('Phase 20 Property Test: Determinism — Standings sort produces identical order in 50 iterations', () => {
  const pool = [
    { id: 'p1', totalPoints: 45, placementPoints: 30, killPoints: 15, first_place_finishes: 2, final_match_placement: 1 },
    { id: 'p2', totalPoints: 45, placementPoints: 25, killPoints: 20, first_place_finishes: 1, final_match_placement: 2 },
    { id: 'p3', totalPoints: 38, placementPoints: 20, killPoints: 18, first_place_finishes: 0, final_match_placement: 5 },
    { id: 'p4', totalPoints: 52, placementPoints: 40, killPoints: 12, first_place_finishes: 3, final_match_placement: 1 },
    { id: 'p5', totalPoints: 20, placementPoints: 10, killPoints: 10, first_place_finishes: 0, final_match_placement: 8 },
  ];

  const firstSort = sortStandings(pool, 'bgmi');
  const referenceOrder = firstSort.map(p => p.id);

  for (let run = 0; run < 50; run++) {
    // Shuffle copy before sorting
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const sorted = sortStandings(shuffled, 'bgmi');
    const order = sorted.map(p => p.id);
    assert.deepEqual(order, referenceOrder, `Deterministic order must be preserved across shuffle run ${run}`);
  }
});

// ─── Security Gate: Mutation Tests ──────────────────────────────────────────

test('Phase 20 Mutation Test: Negative kills input is clamped to zero', () => {
  const score = calculateScore('bgmi', { placement: 1, kills: -5 });
  assert.equal(score.killPoints, 0, 'Negative kills must be clamped to 0');
  assert.equal(score.totalPoints, 10);
});

test('Phase 20 Mutation Test: Unmapped placement rank yields 0 placement points', () => {
  const score = calculateScore('bgmi', { placement: 999, kills: 3 });
  assert.equal(score.placementPoints, 0);
  assert.equal(score.killPoints, 3);
  assert.equal(score.totalPoints, 3);
});

test('Phase 20 Mutation Test: Missing formula throws explicit error', () => {
  assert.throws(
    () => calculateFormulaScore(null, { placement: 1, kills: 2 }),
    /Invalid scoring formula/
  );
});

// ─── Invariant Verification Helpers ─────────────────────────────────────────

test('Phase 20 Invariants: Lobby placement points verification accurately detects discrepancies', () => {
  // Correct lobby sum for top 8
  const validResults = [
    { placementPoints: 10 },
    { placementPoints: 6 },
    { placementPoints: 5 },
    { placementPoints: 4 },
  ];
  const checkValid = verifyLobbyPlacementPoints(validResults, BGMI_PLACEMENT_TABLE, 4);
  assert.ok(checkValid.valid, 'Sum must match expected 25 points');

  // Corrupted lobby sum
  const corruptedResults = [
    { placementPoints: 10 },
    { placementPoints: 9 }, // Tampered
    { placementPoints: 5 },
    { placementPoints: 4 },
  ];
  const checkCorrupted = verifyLobbyPlacementPoints(corruptedResults, BGMI_PLACEMENT_TABLE, 4);
  assert.equal(checkCorrupted.valid, false);
  assert.ok(checkCorrupted.error?.includes('Placement points sum mismatch'));
});

test('Phase 20 Invariants: Combatant kill count verifier flags impossible kill totals', () => {
  const normalResults = [{ kills: 5 }, { kills: 3 }, { kills: 8 }];
  assert.ok(verifyCombatantKillCount(normalResults, 20).valid);

  const excessiveResults = [{ kills: 50 }, { kills: 60 }];
  const flagged = verifyCombatantKillCount(excessiveResults, 64);
  assert.equal(flagged.valid, false);
  assert.ok(flagged.error?.includes('Excessive kills recorded'));
});

// ─── Digest & Snapshot Verification ─────────────────────────────────────────

test('Phase 20 Snapshot Integrity: computeStandingsDigest produces standard 64-char hex SHA-256', () => {
  const sampleStandings = [
    { rank: 1, id: 'user-a', totalPoints: 45, placementPoints: 30, killPoints: 15, bonusPoints: 0 },
    { rank: 2, id: 'user-b', totalPoints: 35, placementPoints: 20, killPoints: 15, bonusPoints: 0 },
  ];

  const digest1 = computeStandingsDigest(sampleStandings);
  const digest2 = computeStandingsDigest(sampleStandings);

  assert.equal(digest1.length, 64);
  assert.equal(digest1, digest2, 'Digest must be deterministic');

  // Altering points must alter digest
  const alteredStandings = [
    { rank: 1, id: 'user-a', totalPoints: 46, placementPoints: 31, killPoints: 15, bonusPoints: 0 },
    { rank: 2, id: 'user-b', totalPoints: 35, placementPoints: 20, killPoints: 15, bonusPoints: 0 },
  ];
  const digestAltered = computeStandingsDigest(alteredStandings);
  assert.notEqual(digest1, digestAltered, 'Tampered standings must produce different hash');
});

// ─── Validation Schemas ─────────────────────────────────────────────────────

test('Phase 20 Validation: LeaderboardQuerySchema validates and applies defaults', () => {
  const valid = LeaderboardQuerySchema.parse({
    game: 'bgmi',
  });
  assert.equal(valid.timeframe, 'SEASON');
  assert.equal(valid.participant_type, 'USER');
  assert.equal(valid.limit, 50);

  const invalidLimit = LeaderboardQuerySchema.safeParse({ limit: 500 });
  assert.equal(invalidLimit.success, false);
});

test('Phase 20 Validation: ProcessMatchResultSchema validates UUID match_id', () => {
  const valid = ProcessMatchResultSchema.parse({
    match_id: 'a0000000-0000-0000-0000-000000000001',
  });
  assert.equal(valid.force_recalculate, false);

  const invalid = ProcessMatchResultSchema.safeParse({ match_id: 'not-a-uuid' });
  assert.equal(invalid.success, false);
});

test('Phase 20 Validation: LeaderboardSnapshotCreateSchema validates snapshot types', () => {
  const valid = LeaderboardSnapshotCreateSchema.parse({
    game_id: 'a0000000-0000-0000-0000-000000000001',
    snapshot_type: 'DAILY',
  });
  assert.equal(valid.snapshot_type, 'DAILY');

  const invalidType = LeaderboardSnapshotCreateSchema.safeParse({
    game_id: 'a0000000-0000-0000-0000-000000000001',
    snapshot_type: 'INVALID_TYPE',
  });
  assert.equal(invalidType.success, false);
});

// ─── Client-Side Preview Helper ─────────────────────────────────────────────

test('Phase 20 Client Preview: previewScore computes immediate points preview', () => {
  const bgmiPreview = previewScore('bgmi', null, { placement: 1, kills: 6 });
  assert.equal(bgmiPreview.totalPoints, 16);

  const ffPreview = previewScore('freefire', null, { placement: 1, kills: 4 });
  assert.equal(ffPreview.totalPoints, 16); // 12 + 4

  const codmPreview = previewScore('codm', null, { is_winner: true, kills: 20 });
  assert.equal(codmPreview.totalPoints, 3);
});

// ─── Teardown ───────────────────────────────────────────────────────────────

test('Phase 20 Teardown: Clean up database pool', async () => {
  await closePool();
});
