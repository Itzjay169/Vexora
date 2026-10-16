/**
 * Vexora Phase 17: Bracket & Match Engine Test Suite
 *
 * Tests cover:
 *   1.  Migration 011 Database Schema (matches & match_participants enhancements, RLS, indexes)
 *   2.  Validation: MatchStatus, BracketType, SeedingMethod enums
 *   3.  Validation: BracketGenerateSchema (Knockout, Round Robin, Battle Royale)
 *   4.  Validation: MatchRoomUpdateSchema & MatchTransitionSchema
 *   5.  Validation: MatchResultSubmitDetailedSchema & participant scores
 *   6.  Bracket Engine: 16-Team Knockout Generation — exactly 4 rounds, 15 matches
 *   7.  Bracket Engine: Standard Seeding Order Invariant (1 vs 16, 2 vs 15, etc.)
 *   8.  Bracket Engine: Byes Handling (12 teams in 16-slot bracket gives 4 byes to top seeds)
 *   9.  Bracket Engine: Round Robin Berger Algorithm (all teams play each other once)
 *   10. Bracket Engine: Battle Royale Snake-Seeded Lobby Grouping (balanced lobbies)
 *   11. Knockout Progression: Winner advancement to next_match_id
 *   12. Match State Machine: Canonical 8 states and valid forward transitions
 *   13. Match State Machine: Rejection of illegal state jumps & terminal states
 *   14. Security Gate: Room codes hidden until server release time
 *   15. Security Gate: Non-checked-in players denied room codes even after release time
 *   16. Security Gate: Checked-in match participants receive unredacted room credentials
 *   17. Security Gate: Organiser and Admin have unrestricted room access
 *   18. Security Gate: Room codes strictly excluded from push notification payloads
 *   19. Routes: matchesRouter mounts all required Phase 17 endpoints
 *   20. UI: Flutter BracketScreen and Next.js BracketViewer exist and export correctly
 */

process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Services & routes
import {
  MatchBracketService,
  MATCH_STATES,
  VALID_MATCH_TRANSITIONS,
  canTransitionMatch,
  getStandardSeedOrder,
  getRoundStageLabel,
} from '../../backend/src/matches/matches.service.js';

import { matchesRouter } from '../../backend/src/matches/matches.routes.js';
import { pool, closePool } from '../../backend/src/common/database.js';

// Validation schemas
import {
  MatchStatus,
  BracketType,
  SeedingMethod,
  BracketGenerateSchema,
  MatchRoomUpdateSchema,
  MatchTransitionSchema,
  MatchParticipantScoreSchema,
  MatchResultSubmitDetailedSchema,
} from '../../packages/validation/src/index.ts';

const ROOT = path.resolve('.');

// ─── 1. Migration 011 Database Schema ───────────────────────────────────────

test('Phase 17 Database: Migration 011 file exists and defines match enhancements', () => {
  const migPath = path.join(ROOT, 'infra/migrations/011_bracket_and_match_engine.sql');
  assert.ok(fs.existsSync(migPath), 'Migration 011 file must exist');

  const sql = fs.readFileSync(migPath, 'utf8');

  // Enum extensions
  assert.ok(sql.includes("ALTER TYPE match_status ADD VALUE 'LOBBY_READY'"), 'Must add LOBBY_READY status');
  assert.ok(sql.includes("ALTER TYPE match_status ADD VALUE 'LIVE'"), 'Must add LIVE status');
  assert.ok(sql.includes("ALTER TYPE match_status ADD VALUE 'RESULT_SUBMITTED'"), 'Must add RESULT_SUBMITTED status');
  assert.ok(sql.includes("ALTER TYPE match_status ADD VALUE 'CONFIRMED'"), 'Must add CONFIRMED status');

  // matches columns
  assert.ok(sql.includes('bracket_type VARCHAR(50)'), 'Must add bracket_type column');
  assert.ok(sql.includes('lobby_group_index INTEGER'), 'Must add lobby_group_index column');
  assert.ok(sql.includes('stage VARCHAR(50)'), 'Must add stage column');
  assert.ok(sql.includes('participant_a_id UUID'), 'Must add participant_a_id column');
  assert.ok(sql.includes('participant_b_id UUID'), 'Must add participant_b_id column');
  assert.ok(sql.includes('winner_registration_id UUID'), 'Must add winner_registration_id column');
  assert.ok(sql.includes('next_match_id UUID'), 'Must add next_match_id column');
  assert.ok(sql.includes('bye_awarded BOOLEAN'), 'Must add bye_awarded column');
  assert.ok(sql.includes('room_release_time TIMESTAMPTZ'), 'Must add room_release_time column');
});

test('Phase 17 Database: Migration 011 defines constraints, indexes, and RLS', () => {
  const migPath = path.join(ROOT, 'infra/migrations/011_bracket_and_match_engine.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  // Invariant constraints
  assert.ok(sql.includes('chk_distinct_match_participants'), 'Must enforce distinct match combatants');
  assert.ok(sql.includes('chk_match_number_positive'), 'Must enforce positive round/match numbers');
  assert.ok(sql.includes('uq_match_tournament_position'), 'Must enforce unique tournament match position');

  // Indexes
  assert.ok(sql.includes('idx_matches_tournament_round'), 'Must index tournament rounds');
  assert.ok(sql.includes('idx_matches_room_release_time'), 'Must index room release time');
  assert.ok(sql.includes('idx_matches_next_match'), 'Must index next_match_id');

  // Row Level Security
  assert.ok(sql.includes('ALTER TABLE matches ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on matches');
  assert.ok(sql.includes('rls_matches_select'), 'Must define select policy on matches');
});

// ─── 2. Validation Schemas ──────────────────────────────────────────────────

test('Phase 17 Validation: MatchStatus and BracketType enums validate correctly', () => {
  // MatchStatus
  assert.equal(MatchStatus.parse('SCHEDULED'), 'SCHEDULED');
  assert.equal(MatchStatus.parse('LOBBY_READY'), 'LOBBY_READY');
  assert.equal(MatchStatus.parse('LIVE'), 'LIVE');
  assert.equal(MatchStatus.parse('RESULT_SUBMITTED'), 'RESULT_SUBMITTED');
  assert.equal(MatchStatus.parse('CONFIRMED'), 'CONFIRMED');
  assert.equal(MatchStatus.parse('DISPUTED'), 'DISPUTED');
  assert.equal(MatchStatus.parse('FINAL'), 'FINAL');
  assert.equal(MatchStatus.parse('CANCELLED'), 'CANCELLED');
  assert.throws(() => MatchStatus.parse('INVALID_STATUS'));

  // BracketType
  assert.equal(BracketType.parse('KNOCKOUT'), 'KNOCKOUT');
  assert.equal(BracketType.parse('ROUND_ROBIN'), 'ROUND_ROBIN');
  assert.equal(BracketType.parse('BATTLE_ROYALE_LOBBY'), 'BATTLE_ROYALE_LOBBY');
  assert.equal(BracketType.parse('LEAGUE'), 'LEAGUE');
  assert.throws(() => BracketType.parse('UNKNOWN_FORMAT'));
});

test('Phase 17 Validation: BracketGenerateSchema applies defaults', () => {
  const result = BracketGenerateSchema.parse({});
  assert.equal(result.bracket_type, 'KNOCKOUT');
  assert.equal(result.seeding_method, 'STANDARD');
  assert.equal(result.lobby_size, 16);
  assert.equal(result.matches_per_lobby, 1);
  assert.equal(result.third_place_match, false);
});

test('Phase 17 Validation: MatchRoomUpdateSchema validates datetime and room fields', () => {
  const valid = MatchRoomUpdateSchema.parse({
    room_id: 'ROOM-99221',
    room_password: 'SECRET_PASS_123',
    room_release_time: new Date(Date.now() + 600000).toISOString(),
  });
  assert.equal(valid.room_id, 'ROOM-99221');
  assert.equal(valid.room_password, 'SECRET_PASS_123');

  // Rejects empty room_id
  assert.throws(() => MatchRoomUpdateSchema.parse({ room_id: '', room_release_time: new Date().toISOString() }));
  // Rejects invalid datetime
  assert.throws(() => MatchRoomUpdateSchema.parse({ room_id: 'R1', room_release_time: 'not-a-date' }));
});

test('Phase 17 Validation: MatchResultSubmitDetailedSchema validates scores and hash', () => {
  const valid = MatchResultSubmitDetailedSchema.parse({
    participants: [
      {
        registration_id: '11111111-1111-4111-a111-111111111111',
        placement: 1,
        kills: 12,
        deaths: 2,
        assists: 4,
        is_winner: true,
      },
      {
        registration_id: '22222222-2222-4222-a222-222222222222',
        placement: 2,
        kills: 5,
        deaths: 4,
        assists: 1,
        is_winner: false,
      },
    ],
    evidence_sha256: 'a'.repeat(64),
  });
  assert.equal(valid.participants.length, 2);
  assert.equal(valid.participants[0].kills, 12);
  assert.equal(valid.participants[0].is_winner, true);

  // Rejects empty participants
  assert.throws(() => MatchResultSubmitDetailedSchema.parse({ participants: [] }));
  // Rejects invalid SHA-256 hash length
  assert.throws(() => MatchResultSubmitDetailedSchema.parse({
    participants: [{ registration_id: '11111111-1111-4111-a111-111111111111' }],
    evidence_sha256: 'short-hash',
  }));
});

// ─── 3. Bracket Engine: 16-Team Knockout Generator ──────────────────────────

test('Phase 17 Exit Criterion: 16-team free tournament generates a correct bracket', () => {
  // Generate 16 mock registered teams
  const teams = Array.from({ length: 16 }, (_, i) => ({
    id: `00000000-0000-4000-a000-0000000000${(i + 1).toString().padStart(2, '0')}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));

  const bracket = MatchBracketService.generateKnockoutTree(teams, {
    bracket_type: 'KNOCKOUT',
    seeding_method: 'STANDARD',
  });

  // Verify tree structure
  assert.equal(bracket.bracket_type, 'KNOCKOUT');
  assert.equal(bracket.slots, 16);
  assert.equal(bracket.total_rounds, 4);
  assert.equal(bracket.byes_count, 0);
  assert.equal(bracket.rounds.length, 4);

  // Round 1: Round of 16 (8 matches)
  const round1 = bracket.rounds[0];
  assert.equal(round1.stage, 'ROUND_OF_16');
  assert.equal(round1.matches.length, 8);

  // Round 2: Quarterfinals (4 matches)
  const round2 = bracket.rounds[1];
  assert.equal(round2.stage, 'QUARTER_FINALS');
  assert.equal(round2.matches.length, 4);

  // Round 3: Semifinals (2 matches)
  const round3 = bracket.rounds[2];
  assert.equal(round3.stage, 'SEMI_FINALS');
  assert.equal(round3.matches.length, 2);

  // Round 4: Finals (1 match)
  const round4 = bracket.rounds[3];
  assert.equal(round4.stage, 'FINALS');
  assert.equal(round4.matches.length, 1);

  // Total matches = 8 + 4 + 2 + 1 = 15
  const totalMatches = bracket.rounds.reduce((acc, r) => acc + r.matches.length, 0);
  assert.equal(totalMatches, 15);
});

test('Phase 17 Bracket Engine: Standard Seeding Order Invariant (Seed 1 vs 16, 2 vs 15)', () => {
  const seedOrder16 = getStandardSeedOrder(16);
  // Expected standard seed order: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
  assert.deepEqual(seedOrder16, [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);

  const teams = Array.from({ length: 16 }, (_, i) => ({
    id: `team-uuid-${i + 1}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));

  const bracket = MatchBracketService.generateKnockoutTree(teams);
  const r1Matches = bracket.rounds[0].matches;

  // Match 1: Seed 1 vs Seed 16
  assert.equal(r1Matches[0].participant_a.seed, 1);
  assert.equal(r1Matches[0].participant_b.seed, 16);

  // Match 2: Seed 8 vs Seed 9
  assert.equal(r1Matches[1].participant_a.seed, 8);
  assert.equal(r1Matches[1].participant_b.seed, 9);

  // Match 3: Seed 4 vs Seed 13
  assert.equal(r1Matches[2].participant_a.seed, 4);
  assert.equal(r1Matches[2].participant_b.seed, 13);

  // Match 5: Seed 2 vs Seed 15
  assert.equal(r1Matches[4].participant_a.seed, 2);
  assert.equal(r1Matches[4].participant_b.seed, 15);

  // Verify next match linkages
  assert.ok(r1Matches[0].next_match_id, 'Round 1 match must link to next round');
  assert.equal(r1Matches[0].next_match_id, r1Matches[1].next_match_id, 'Matches 1 and 2 must feed the same QF match');
  assert.equal(r1Matches[2].next_match_id, r1Matches[3].next_match_id, 'Matches 3 and 4 must feed the same QF match');
});

test('Phase 17 Bracket Engine: Byes Handling (12 teams in 16 slots awards 4 byes)', () => {
  // 12 teams in a 16-slot bracket
  const teams = Array.from({ length: 12 }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));

  const bracket = MatchBracketService.generateKnockoutTree(teams);

  assert.equal(bracket.slots, 16);
  assert.equal(bracket.byes_count, 4);

  const r1Matches = bracket.rounds[0].matches;

  // Seeds 1, 2, 3, 4 face missing seeds 16, 15, 14, 13 -> Byes!
  const byeMatches = r1Matches.filter(m => m.bye_awarded);
  assert.equal(byeMatches.length, 4, 'Must have exactly 4 bye matches in Round 1');

  // Bye matches must be pre-finalized
  for (const m of byeMatches) {
    assert.equal(m.status, 'FINAL', 'Bye match must be immediately FINAL');
    assert.ok(m.winner_id, 'Bye match must have winner_id set to the seeded participant');
  }

  // Top 4 seeds must automatically appear in Round 2 (Quarterfinals)
  const r2Matches = bracket.rounds[1].matches;
  const r2Participants = r2Matches.flatMap(m => [m.participant_a, m.participant_b]).filter(Boolean);

  const advancedSeeds = r2Participants.map(p => p.seed);
  assert.ok(advancedSeeds.includes(1), 'Seed 1 must be auto-advanced to Round 2');
  assert.ok(advancedSeeds.includes(2), 'Seed 2 must be auto-advanced to Round 2');
  assert.ok(advancedSeeds.includes(3), 'Seed 3 must be auto-advanced to Round 2');
  assert.ok(advancedSeeds.includes(4), 'Seed 4 must be auto-advanced to Round 2');
});

// ─── 4. Bracket Engine: Round Robin (Berger Algorithm) ──────────────────────

test('Phase 17 Bracket Engine: Round Robin complete pairing (all play all)', () => {
  const teams = [
    { id: 't1', name: 'Alpha' },
    { id: 't2', name: 'Bravo' },
    { id: 't3', name: 'Charlie' },
    { id: 't4', name: 'Delta' },
  ];

  const rr = MatchBracketService.generateRoundRobinSchedule(teams);

  assert.equal(rr.bracket_type, 'ROUND_ROBIN');
  assert.equal(rr.total_teams, 4);
  assert.equal(rr.total_rounds, 3); // 4 - 1 = 3 rounds
  assert.equal(rr.matches_per_round, 2); // 4 / 2 = 2 matches/round

  // Count unique match-ups
  const matchups = new Set();
  for (const round of rr.rounds) {
    for (const match of round.matches) {
      const pair = [match.participant_a.id, match.participant_b.id].sort().join('-vs-');
      assert.ok(!matchups.has(pair), `Match-up ${pair} occurred more than once`);
      matchups.add(pair);
    }
  }

  // Combinations 4C2 = 6 total unique match-ups
  assert.equal(matchups.size, 6, 'Every team must play every other team exactly once');
});

// ─── 5. Bracket Engine: Battle Royale Lobby Grouping ────────────────────────

test('Phase 17 Bracket Engine: Battle Royale Snake-Seeded Lobby Grouping', () => {
  // 48 squads, lobby size 16 = 3 lobbies
  const squads = Array.from({ length: 48 }, (_, i) => ({
    id: `squad-${i + 1}`,
    name: `Squad ${i + 1}`,
    seed: i + 1,
  }));

  const br = MatchBracketService.generateBattleRoyaleLobbies(squads, 16, 2);

  assert.equal(br.bracket_type, 'BATTLE_ROYALE_LOBBY');
  assert.equal(br.num_lobbies, 3);
  assert.equal(br.total_participants, 48);

  // Each lobby must have exactly 16 squads
  for (const lobby of br.lobbies) {
    assert.equal(lobby.participants.length, 16, 'Lobby must contain exactly 16 squads');
    assert.equal(lobby.matches.length, 2, 'Must generate 2 matches per lobby');
  }

  // Snake seeding distribution verification:
  // Seed 1 in Lobby 1, Seed 2 in Lobby 2, Seed 3 in Lobby 3
  // Seed 4 in Lobby 3, Seed 5 in Lobby 2, Seed 6 in Lobby 1
  assert.equal(br.lobbies[0].participants[0].seed, 1);
  assert.equal(br.lobbies[1].participants[0].seed, 2);
  assert.equal(br.lobbies[2].participants[0].seed, 3);

  assert.equal(br.lobbies[2].participants[1].seed, 4);
  assert.equal(br.lobbies[1].participants[1].seed, 5);
  assert.equal(br.lobbies[0].participants[1].seed, 6);
});

// ─── 6. Match State Machine ─────────────────────────────────────────────────

test('Phase 17 State Machine: All 8 canonical match states defined', () => {
  assert.equal(MATCH_STATES.length, 8);
  assert.deepEqual(MATCH_STATES, [
    'SCHEDULED',
    'LOBBY_READY',
    'LIVE',
    'RESULT_SUBMITTED',
    'CONFIRMED',
    'DISPUTED',
    'FINAL',
    'CANCELLED',
  ]);
});

test('Phase 17 State Machine: Valid forward transitions permitted', () => {
  assert.ok(canTransitionMatch('SCHEDULED', 'LOBBY_READY'));
  assert.ok(canTransitionMatch('LOBBY_READY', 'LIVE'));
  assert.ok(canTransitionMatch('LIVE', 'RESULT_SUBMITTED'));
  assert.ok(canTransitionMatch('RESULT_SUBMITTED', 'CONFIRMED'));
  assert.ok(canTransitionMatch('CONFIRMED', 'FINAL'));
  assert.ok(canTransitionMatch('RESULT_SUBMITTED', 'DISPUTED'));
  assert.ok(canTransitionMatch('DISPUTED', 'FINAL'));
  assert.ok(canTransitionMatch('DISPUTED', 'LIVE')); // Re-match
  assert.ok(canTransitionMatch('SCHEDULED', 'CANCELLED'));
  assert.ok(canTransitionMatch('LOBBY_READY', 'CANCELLED'));
});

test('Phase 17 State Machine: Arbitrary illegal jumps strictly rejected', () => {
  assert.equal(canTransitionMatch('SCHEDULED', 'FINAL'), false);
  assert.equal(canTransitionMatch('SCHEDULED', 'LIVE'), false);
  assert.equal(canTransitionMatch('LIVE', 'FINAL'), false);
  assert.equal(canTransitionMatch('RESULT_SUBMITTED', 'SCHEDULED'), false);
  assert.equal(canTransitionMatch('CONFIRMED', 'LIVE'), false);

  // Terminal states have zero outgoing transitions
  assert.equal(canTransitionMatch('FINAL', 'SCHEDULED'), false);
  assert.equal(canTransitionMatch('FINAL', 'LIVE'), false);
  assert.equal(canTransitionMatch('CANCELLED', 'SCHEDULED'), false);
});

// ─── 7. Security Gate: Room Code Sanitization & Release Time ────────────────

test('Phase 17 Security Gate: Room codes hidden until server release time', () => {
  const match = {
    id: 'm-1',
    tournament_id: 't-1',
    participant_a_id: 'reg-a',
    participant_b_id: 'reg-b',
    room_id: 'SUPER_SECRET_ROOM_ID',
    room_password: 'SECRET_PASSWORD',
    room_release_time: new Date(Date.now() + 600000).toISOString(), // 10 mins in future
  };

  const user = { id: 'user-a', role: 'PLAYER' };
  const userReg = { id: 'reg-a', status: 'CHECKED_IN' };

  // Current server time is BEFORE release time
  const sanitized = MatchBracketService.sanitizeMatchForUser(match, user, userReg, new Date());

  assert.equal(sanitized.room_id, null, 'room_id must be redacted before release time');
  assert.equal(sanitized.room_password, null, 'room_password must be redacted before release time');
  assert.equal(sanitized.room_code_status, 'LOCKED_UNTIL_RELEASE_TIME');
});

test('Phase 17 Security Gate: Non-checked-in players denied room code after release time', () => {
  const pastReleaseTime = new Date(Date.now() - 60000).toISOString(); // 1 min in past
  const match = {
    id: 'm-1',
    tournament_id: 't-1',
    participant_a_id: 'reg-a',
    participant_b_id: 'reg-b',
    room_id: 'SUPER_SECRET_ROOM_ID',
    room_password: 'SECRET_PASSWORD',
    room_release_time: pastReleaseTime,
  };

  // User is confirmed but NOT checked-in
  const user = { id: 'user-a', role: 'PLAYER' };
  const notCheckedInReg = { id: 'reg-a', status: 'CONFIRMED' };

  const sanitized = MatchBracketService.sanitizeMatchForUser(match, user, notCheckedInReg, new Date());

  assert.equal(sanitized.room_id, null, 'room_id must be redacted for non-checked-in player');
  assert.equal(sanitized.room_password, null, 'room_password must be redacted');
  assert.equal(sanitized.room_code_status, 'RESTRICTED_TO_CHECKED_IN_PARTICIPANTS');
});

test('Phase 17 Security Gate: Checked-in match participants receive unredacted room credentials', () => {
  const pastReleaseTime = new Date(Date.now() - 60000).toISOString();
  const match = {
    id: 'm-1',
    tournament_id: 't-1',
    participant_a_id: 'reg-a',
    participant_b_id: 'reg-b',
    room_id: 'SUPER_SECRET_ROOM_ID',
    room_password: 'SECRET_PASSWORD',
    room_release_time: pastReleaseTime,
  };

  // User is checked in AND is participant_a
  const user = { id: 'user-a', role: 'PLAYER' };
  const checkedInReg = { id: 'reg-a', status: 'CHECKED_IN' };

  const sanitized = MatchBracketService.sanitizeMatchForUser(match, user, checkedInReg, new Date());

  assert.equal(sanitized.room_id, 'SUPER_SECRET_ROOM_ID', 'Checked-in player must receive room_id');
  assert.equal(sanitized.room_password, 'SECRET_PASSWORD', 'Checked-in player must receive room_password');
  assert.equal(sanitized.room_code_status, 'RELEASED_VERIFIED');
});

test('Phase 17 Security Gate: Organiser and Admin have unrestricted room access', () => {
  const futureReleaseTime = new Date(Date.now() + 600000).toISOString();
  const match = {
    id: 'm-1',
    tournament_id: 't-1',
    organiser_id: 'org-user-1',
    room_id: 'SECRET_ROOM',
    room_password: 'SECRET_PASS',
    room_release_time: futureReleaseTime,
  };

  // Organiser
  const orgUser = { id: 'org-user-1', role: 'ORGANISER' };
  const orgView = MatchBracketService.sanitizeMatchForUser(match, orgUser, null, new Date());
  assert.equal(orgView.room_id, 'SECRET_ROOM');
  assert.equal(orgView.room_code_status, 'UNRESTRICTED_STAFF');

  // Super Admin
  const adminUser = { id: 'admin-1', role: 'SUPER_ADMIN' };
  const adminView = MatchBracketService.sanitizeMatchForUser(match, adminUser, null, new Date());
  assert.equal(adminView.room_id, 'SECRET_ROOM');
  assert.equal(adminView.room_code_status, 'UNRESTRICTED_STAFF');
});

test('Phase 17 Security Gate: Room codes strictly excluded from push notification payloads', () => {
  const match = {
    id: 'm-101',
    tournament_id: 't-pro-1',
    round_number: 1,
    match_number: 1,
    stage: 'ROUND_OF_16',
    status: 'LOBBY_READY',
    room_id: 'SENSITIVE_ROOM_CODE_123',
    room_password: 'SENSITIVE_PASSWORD_ABC',
  };

  const payload = MatchBracketService.buildMatchPushPayload(match);

  assert.equal(payload.match_id, 'm-101');
  assert.equal(payload.status, 'LOBBY_READY');
  assert.ok(payload.deep_link.includes('vexora://tournaments/t-pro-1/matches/m-101'));

  // Critical Invariant: No room secrets in push payload
  assert.equal(payload.room_id, undefined, 'Push payload MUST NOT contain room_id');
  assert.equal(payload.room_password, undefined, 'Push payload MUST NOT contain room_password');
  assert.equal(JSON.stringify(payload).includes('SENSITIVE_ROOM_CODE_123'), false);
  assert.equal(JSON.stringify(payload).includes('SENSITIVE_PASSWORD_ABC'), false);
});

// ─── 8. Winner Progression in Knockout ───────────────────────────────────────

test('Phase 17 Knockout Progression: Winner advances into next_match_id', () => {
  const match1 = {
    id: 'm-1',
    match_number: 1,
    status: 'FINAL',
    winner_id: 'winner-reg-1',
    next_match_id: 'm-qf-1',
  };

  const match2 = {
    id: 'm-2',
    match_number: 2,
    status: 'FINAL',
    winner_id: 'winner-reg-2',
    next_match_id: 'm-qf-1',
  };

  const qfMatch = {
    id: 'm-qf-1',
    participant_a_id: null,
    participant_b_id: null,
  };

  const allMatches = [match1, match2, qfMatch];

  // Match 1 (odd match_number) advances to participant_a
  MatchBracketService.advanceKnockoutWinner(match1, allMatches);
  assert.equal(qfMatch.participant_a_id, 'winner-reg-1');

  // Match 2 (even match_number) advances to participant_b
  MatchBracketService.advanceKnockoutWinner(match2, allMatches);
  assert.equal(qfMatch.participant_b_id, 'winner-reg-2');
});

// ─── 9. Routes & Server Integration ─────────────────────────────────────────

test('Phase 17 Routes: matchesRouter registers all expected endpoints', () => {
  const routes = matchesRouter.stack
    .filter(layer => layer.route)
    .map(layer => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  const paths = routes.map(r => r.path);

  assert.ok(paths.includes('/tournament/:id/generate-bracket'), 'Must register POST /tournament/:id/generate-bracket');
  assert.ok(paths.includes('/tournament/:id/bracket'), 'Must register GET /tournament/:id/bracket');
  assert.ok(paths.includes('/tournament/:id'), 'Must register GET /tournament/:id');
  assert.ok(paths.includes('/:id'), 'Must register GET /:id');
  assert.ok(paths.includes('/:id/room'), 'Must register PATCH /:id/room');
  assert.ok(paths.includes('/:id/transition'), 'Must register POST /:id/transition');
  assert.ok(paths.includes('/:id/submit-result'), 'Must register POST /:id/submit-result');
  assert.ok(paths.includes('/:id/confirm-result'), 'Must register POST /:id/confirm-result');
});

// ─── 10. Flutter & Web UI Integration ───────────────────────────────────────

test('Phase 17 Flutter: BracketScreen exists and implements tournament bracket view', () => {
  const flutterScreenPath = path.join(ROOT, 'apps/mobile/lib/screens/bracket_screen.dart');
  assert.ok(fs.existsSync(flutterScreenPath), 'BracketScreen must exist in mobile app');

  const content = fs.readFileSync(flutterScreenPath, 'utf8');
  assert.ok(content.includes('class BracketScreen'), 'Must define BracketScreen widget');
  assert.ok(content.includes('TabBar'), 'Must include round TabBar');
  assert.ok(content.includes('_buildRoomCredentialsTile'), 'Must include room credentials tile');
  assert.ok(content.includes('RELEASED_VERIFIED'), 'Must implement room security release status');
  assert.ok(content.includes('LOCKED_UNTIL_RELEASE_TIME'), 'Must implement room lock status');
});

test('Phase 17 Web: BracketViewer component exists and exports properly', () => {
  const webComponentPath = path.join(ROOT, 'apps/web/src/components/BracketViewer.tsx');
  assert.ok(fs.existsSync(webComponentPath), 'BracketViewer must exist in web app');

  const content = fs.readFileSync(webComponentPath, 'utf8');
  assert.ok(content.includes('export function BracketViewer'), 'Must export BracketViewer component');
  assert.ok(content.includes('RELEASED_VERIFIED'), 'Must handle unredacted room status');
  assert.ok(content.includes('LOCKED_UNTIL_RELEASE_TIME'), 'Must handle locked room release status');
});

// ─── Teardown ───────────────────────────────────────────────────────────────

test('Phase 17 Teardown: Clean up database pool', async () => {
  await closePool();
  assert.ok(true, 'Database pool closed cleanly');
});
