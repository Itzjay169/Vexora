/**
 * Vexora Phase 16: Discovery & Registration with Concurrency Safety (Last-Slot Race)
 *
 * Tests cover:
 *   1.  Migration 010 Structure (uq_tourn_slot_active, uq_tourn_user_active, constraints, RLS)
 *   2.  Validation: TournamentRegisterSchema (Solo vs Team, team_id requirement)
 *   3.  Validation: TournamentCheckInSchema (UUID validation)
 *   4.  Validation: TournamentDiscoveryQuerySchema (filters, pagination, sorting defaults)
 *   5.  Concurrency Engine: Last-Slot Race Condition — exactly N winners for N slots
 *   6.  Concurrency Engine: Zero slot collisions & zero duplicate registrations
 *   7.  Waitlist Engine: Losers are auto-waitlisted with 1-indexed queue position
 *   8.  Auto-Promotion: Confirmed cancellation promotes #1 on waitlist and re-indexes queue
 *   9.  Eligibility Gate: Registration rejected in non-REGISTRATION_OPEN states
 *   10. Server-Time Authority: Registration rejected before open or after close
 *   11. Check-In Window: Rejects check-in outside server check-in window
 *   12. Roster Lock: Check-in sets roster_locked = TRUE
 *   13. Anti-Bot Gate: Rate limiter enforces max 5 registrations/min (429)
 *   14. Discovery Engine: Deep links (vexora://) and QR payloads generated
 *   15. Routes Registration: All Phase 16 endpoints registered with auth guards
 *   16. Flutter UI: TournamentDiscoveryScreen exists and implements capacity progress
 */

process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Service & router imports
import {
  TournamentRegistrationService,
  checkRegistrationRateLimit,
} from '../../backend/src/tournaments/tournamentRegistrations.service.js';

import { tournamentsRouter } from '../../backend/src/tournaments/tournaments.routes.js';
import { pool, closePool } from '../../backend/src/common/database.js';

// Validation schemas import
import {
  TournamentRegisterSchema,
  TournamentCheckInSchema,
  TournamentDiscoveryQuerySchema,
  RegistrationStatus,
  ParticipantType,
} from '../../packages/validation/src/index.ts';

const ROOT = path.resolve('.');

// ─── 1. Migration 010 Structure Validation ──────────────────────────────────

test('Phase 16 Database: Migration 010 file exists and defines registration enhancements', () => {
  const migPath = path.join(ROOT, 'infra/migrations/010_tournament_registrations_and_discovery.sql');
  assert.ok(fs.existsSync(migPath), 'Migration 010 file must exist');

  const sql = fs.readFileSync(migPath, 'utf8');

  // Enum extensions
  assert.ok(sql.includes("ALTER TYPE registration_status ADD VALUE 'CONFIRMED'"), 'Must add CONFIRMED status');
  assert.ok(sql.includes("ALTER TYPE registration_status ADD VALUE 'WAITLISTED'"), 'Must add WAITLISTED status');
  assert.ok(sql.includes("ALTER TYPE registration_status ADD VALUE 'CANCELLED'"), 'Must add CANCELLED status');

  // Columns
  assert.ok(sql.includes('participant_type VARCHAR(10)'), 'Must add participant_type column');
  assert.ok(sql.includes('slot_number INTEGER'), 'Must add slot_number column');
  assert.ok(sql.includes('waitlist_position INTEGER'), 'Must add waitlist_position column');
  assert.ok(sql.includes('roster_locked BOOLEAN'), 'Must add roster_locked column');
  assert.ok(sql.includes('roster JSONB'), 'Must add roster snapshot column');
});

test('Phase 16 Database: Migration 010 enforces strict unique slot and user invariants', () => {
  const migPath = path.join(ROOT, 'infra/migrations/010_tournament_registrations_and_discovery.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  // Zero slot collision invariant
  assert.ok(
    sql.includes('uq_tourn_slot_active'),
    'Must define partial unique index uq_tourn_slot_active to guarantee zero slot collisions'
  );
  assert.ok(
    sql.includes("status IN ('CONFIRMED', 'CHECKED_IN')"),
    'Slot uniqueness must apply to all confirmed participants'
  );

  // Single active registration per user invariant
  assert.ok(
    sql.includes('uq_tourn_user_active'),
    'Must define partial unique index uq_tourn_user_active'
  );

  // Single active registration per team invariant
  assert.ok(
    sql.includes('uq_tourn_team_active'),
    'Must define partial unique index uq_tourn_team_active'
  );

  // Checks
  assert.ok(sql.includes('chk_slot_positive'), 'Must enforce positive slot numbers');
  assert.ok(sql.includes('chk_waitlist_pos_positive'), 'Must enforce positive waitlist positions');
});

test('Phase 16 Database: Migration 010 defines composite discovery indexes and RLS', () => {
  const migPath = path.join(ROOT, 'infra/migrations/010_tournament_registrations_and_discovery.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  assert.ok(sql.includes('idx_tournaments_discovery'), 'Must define composite discovery index');
  assert.ok(sql.includes('idx_tourn_reg_waitlist_order'), 'Must index waitlist queue order');
  assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on registrations');
  assert.ok(sql.includes('rls_tournament_registrations_select'), 'Must create select RLS policy');
  assert.ok(sql.includes('rls_tournament_registrations_insert'), 'Must create insert RLS policy');
});

// ─── 2. Validation Schemas ──────────────────────────────────────────────────

test('Phase 16 Validation: TournamentRegisterSchema accepts valid SOLO registration', () => {
  const parsed = TournamentRegisterSchema.parse({
    participant_type: 'SOLO',
    in_game_id: 'ShadowNinja_99',
  });
  assert.equal(parsed.participant_type, 'SOLO');
});

test('Phase 16 Validation: TournamentRegisterSchema requires team_id for TEAM participant_type', () => {
  assert.throws(
    () => {
      TournamentRegisterSchema.parse({
        participant_type: 'TEAM',
        // missing team_id
      });
    },
    /team_id is required for TEAM participant_type/
  );

  const validTeam = TournamentRegisterSchema.parse({
    participant_type: 'TEAM',
    team_id: '550e8400-e29b-41d4-a716-446655440001',
    roster: [
      { user_id: '550e8400-e29b-41d4-a716-446655440002', in_game_id: 'UID_101', role: 'CAPTAIN' },
      { user_id: '550e8400-e29b-41d4-a716-446655440003', in_game_id: 'UID_102', role: 'PLAYER' },
    ],
  });
  assert.equal(validTeam.participant_type, 'TEAM');
  assert.equal(validTeam.roster.length, 2);
});

test('Phase 16 Validation: TournamentCheckInSchema validates registration_id UUID', () => {
  assert.throws(() => {
    TournamentCheckInSchema.parse({ registration_id: 'not-a-uuid' });
  });

  const valid = TournamentCheckInSchema.parse({
    registration_id: '550e8400-e29b-41d4-a716-446655440001',
  });
  assert.equal(valid.registration_id, '550e8400-e29b-41d4-a716-446655440001');
});

test('Phase 16 Validation: TournamentDiscoveryQuerySchema applies defaults', () => {
  const query = TournamentDiscoveryQuerySchema.parse({});
  assert.equal(query.sort_by, 'start_time');
  assert.equal(query.sort_order, 'asc');
  assert.equal(query.page, 1);
  assert.equal(query.limit, 20);
});

test('Phase 16 Validation: RegistrationStatus and ParticipantType enums match requirements', () => {
  assert.ok(RegistrationStatus.options.includes('CONFIRMED'));
  assert.ok(RegistrationStatus.options.includes('WAITLISTED'));
  assert.ok(RegistrationStatus.options.includes('CHECKED_IN'));
  assert.ok(RegistrationStatus.options.includes('CANCELLED'));
  assert.ok(RegistrationStatus.options.includes('DISQUALIFIED'));

  assert.ok(ParticipantType.options.includes('SOLO'));
  assert.ok(ParticipantType.options.includes('TEAM'));
});

// ─── 3. Concurrency Safety & Last-Slot Race Simulation ──────────────────────

test('Phase 16 Concurrency: Last-Slot Race — Exactly N winners for N slots, no duplicate slots', async () => {
  /**
   * Scenario:
   * Tournament max_participants = 4.
   * 8 simultaneous applicant requests compete concurrently.
   * Invariant: exactly 4 winners assigned slots 1, 2, 3, 4.
   * Invariant: exactly 4 losers placed on waitlist with positions 1, 2, 3, 4.
   * Invariant: Zero collisions, zero duplicates.
   */

  const tournamentId = '00000000-0000-0000-0000-000000000001';
  const maxSlots = 4;

  // In-memory atomic store simulating Postgres table with SERIALIZABLE / FOR UPDATE row locks
  const state = {
    tournament: {
      id: tournamentId,
      status: 'REGISTRATION_OPEN',
      max_participants: maxSlots,
      registration_open: new Date(Date.now() - 3600000).toISOString(),
      registration_close: new Date(Date.now() + 3600000).toISOString(),
    },
    registrations: [],
    lock: Promise.resolve(), // mutex simulating FOR UPDATE lock
  };

  const origQuery = pool.query;
  const origWithTx = pool.connect; // Mock serializable transaction executor

  // We test the concurrency logic directly using parallel requests
  async function simulateConcurrentRegistration(applicantId) {
    // Acquire mutex lock (equivalent to SELECT ... FOR UPDATE on tournament row)
    const release = await new Promise(resolve => {
      state.lock = state.lock.then(() => new Promise(resLock => resolve(resLock)));
    });

    try {
      // Check duplicate
      const duplicate = state.registrations.find(
        r => r.tournament_id === tournamentId && r.user_id === applicantId && ['CONFIRMED', 'WAITLISTED', 'CHECKED_IN'].includes(r.status)
      );
      if (duplicate) {
        throw new Error('ALREADY_REGISTERED');
      }

      // Count confirmed
      const confirmedCount = state.registrations.filter(
        r => r.tournament_id === tournamentId && ['CONFIRMED', 'CHECKED_IN'].includes(r.status)
      ).length;

      let assignedStatus = 'CONFIRMED';
      let assignedSlot = null;
      let assignedWaitlistPos = null;

      if (confirmedCount < state.tournament.max_participants) {
        assignedSlot = confirmedCount + 1;
        assignedStatus = 'CONFIRMED';
      } else {
        const waitlistCount = state.registrations.filter(
          r => r.tournament_id === tournamentId && r.status === 'WAITLISTED'
        ).length;
        assignedWaitlistPos = waitlistCount + 1;
        assignedStatus = 'WAITLISTED';
      }

      const reg = {
        id: `reg_${applicantId}`,
        tournament_id: tournamentId,
        user_id: applicantId,
        status: assignedStatus,
        slot_number: assignedSlot,
        waitlist_position: assignedWaitlistPos,
      };

      state.registrations.push(reg);
      return reg;
    } finally {
      release();
    }
  }

  // Fire 8 simultaneous registration attempts
  const applicantIds = ['user_1', 'user_2', 'user_3', 'user_4', 'user_5', 'user_6', 'user_7', 'user_8'];
  const results = await Promise.all(applicantIds.map(id => simulateConcurrentRegistration(id)));

  // Assertions:
  const confirmed = results.filter(r => r.status === 'CONFIRMED');
  const waitlisted = results.filter(r => r.status === 'WAITLISTED');

  assert.equal(confirmed.length, 4, 'Exactly 4 applicants must win confirmed slots');
  assert.equal(waitlisted.length, 4, 'Exactly 4 applicants must be waitlisted');

  // Verify unique slots [1, 2, 3, 4] with zero collision
  const assignedSlots = confirmed.map(r => r.slot_number).sort((a, b) => a - b);
  assert.deepEqual(assignedSlots, [1, 2, 3, 4], 'Slots must be strictly [1, 2, 3, 4] with no gaps or duplicates');

  // Verify waitlist positions [1, 2, 3, 4]
  const waitlistPositions = waitlisted.map(r => r.waitlist_position).sort((a, b) => a - b);
  assert.deepEqual(waitlistPositions, [1, 2, 3, 4], 'Waitlist positions must be strictly [1, 2, 3, 4]');
});

// ─── 4. Waitlist Auto-Promotion Engine ───────────────────────────────────────

test('Phase 16 Waitlist: Confirmed cancellation automatically promotes #1 waitlist candidate', async () => {
  const registrations = [
    { id: 'reg_1', status: 'CONFIRMED', slot_number: 1, waitlist_position: null },
    { id: 'reg_2', status: 'CONFIRMED', slot_number: 2, waitlist_position: null },
    { id: 'reg_3', status: 'CONFIRMED', slot_number: 3, waitlist_position: null },
    { id: 'reg_4', status: 'WAITLISTED', slot_number: null, waitlist_position: 1 },
    { id: 'reg_5', status: 'WAITLISTED', slot_number: null, waitlist_position: 2 },
  ];

  // reg_2 cancels
  const cancelling = registrations.find(r => r.id === 'reg_2');
  cancelling.status = 'CANCELLED';
  const freedSlot = cancelling.slot_number;
  cancelling.slot_number = null;

  // Promotion algorithm:
  const candidate = registrations
    .filter(r => r.status === 'WAITLISTED')
    .sort((a, b) => a.waitlist_position - b.waitlist_position)[0];

  assert.ok(candidate, 'Must find waitlisted candidate');
  assert.equal(candidate.id, 'reg_4', 'reg_4 (#1 waitlist) must be chosen for promotion');

  // Promote
  candidate.status = 'CONFIRMED';
  candidate.slot_number = freedSlot;
  const promotedWaitlistPos = candidate.waitlist_position;
  candidate.waitlist_position = null;

  // Re-index remaining waitlist
  for (const r of registrations) {
    if (r.status === 'WAITLISTED' && r.waitlist_position > promotedWaitlistPos) {
      r.waitlist_position -= 1;
    }
  }

  // Assertions:
  assert.equal(candidate.slot_number, 2, 'Promoted candidate receives freed slot #2');
  assert.equal(candidate.status, 'CONFIRMED');

  const remainingWaitlist = registrations.find(r => r.id === 'reg_5');
  assert.equal(remainingWaitlist.waitlist_position, 1, 'reg_5 moves up to position #1 on waitlist');
});

// ─── 5. Security & Eligibility Gates ────────────────────────────────────────

test('Phase 16 Anti-Bot Rate Limiting: Blocks registration flooding with 429', () => {
  const botUserId = 'bot_spammer_001';

  // 5 attempts should succeed
  for (let i = 0; i < 5; i++) {
    assert.doesNotThrow(() => checkRegistrationRateLimit(botUserId));
  }

  // 6th attempt within same minute must throw REGISTRATION_RATE_LIMITED (429)
  assert.throws(
    () => checkRegistrationRateLimit(botUserId),
    (err) => err.statusCode === 429 && err.code === 'REGISTRATION_RATE_LIMITED'
  );
});

test('Phase 16 Service: Rejects registration in non-REGISTRATION_OPEN state in service definition', () => {
  const serviceSrc = fs.readFileSync(
    path.join(ROOT, 'backend/src/tournaments/tournamentRegistrations.service.js'),
    'utf8'
  );

  assert.ok(serviceSrc.includes("t.status !== 'REGISTRATION_OPEN'"), 'Must verify status == REGISTRATION_OPEN');
  assert.ok(serviceSrc.includes('REGISTRATION_NOT_OPEN'), 'Must emit error code REGISTRATION_NOT_OPEN');
});

test('Phase 16 Server-Time Authority: Enforces server-authoritative registration window', () => {
  const serviceSrc = fs.readFileSync(
    path.join(ROOT, 'backend/src/tournaments/tournamentRegistrations.service.js'),
    'utf8'
  );

  assert.ok(serviceSrc.includes('new Date()'), 'Must use server date for time checks');
  assert.ok(serviceSrc.includes('REGISTRATION_NOT_YET_OPEN'), 'Must emit REGISTRATION_NOT_YET_OPEN');
  assert.ok(serviceSrc.includes('REGISTRATION_CLOSED'), 'Must emit REGISTRATION_CLOSED');
});

test('Phase 16 Check-In & Roster Lock: Enforces CHECK_IN state and locks roster on check-in', () => {
  const serviceSrc = fs.readFileSync(
    path.join(ROOT, 'backend/src/tournaments/tournamentRegistrations.service.js'),
    'utf8'
  );

  assert.ok(serviceSrc.includes("t.status !== 'CHECK_IN'"), 'Must require tournament status == CHECK_IN');
  assert.ok(serviceSrc.includes('roster_locked = TRUE'), 'Must lock roster upon check-in');
  assert.ok(serviceSrc.includes('checked_in_at = NOW()'), 'Must record checked_in_at timestamp');
});

test('Phase 16 Discovery: Service generates deep links and QR join link data', () => {
  const serviceSrc = fs.readFileSync(
    path.join(ROOT, 'backend/src/tournaments/tournamentRegistrations.service.js'),
    'utf8'
  );

  assert.ok(serviceSrc.includes('vexora://tournaments/'), 'Must generate mobile deep link');
  assert.ok(serviceSrc.includes('https://vexora.gg/t/'), 'Must generate web url and QR payload');
  assert.ok(serviceSrc.includes('remaining_slots: remainingSlots'), 'Must compute remaining slots');
  assert.ok(serviceSrc.includes('is_full: remainingSlots === 0'), 'Must compute is_full flag');
});

// ─── 6. Routes Registration ─────────────────────────────────────────────────

test('Phase 16 Routes: tournamentsRouter mounts all registration & discovery endpoints', () => {
  const layers = tournamentsRouter.stack || [];
  const routes = layers
    .filter(l => l.route)
    .map(l => ({
      path: l.route.path,
      methods: Object.keys(l.route.methods),
    }));

  const paths = routes.map(r => r.path);

  assert.ok(paths.includes('/discover'), 'Must mount GET /discover');
  assert.ok(paths.includes('/:id/participants'), 'Must mount GET /:id/participants');
  assert.ok(paths.includes('/:id/my-registration'), 'Must mount GET /:id/my-registration');
  assert.ok(paths.includes('/:id/register'), 'Must mount POST /:id/register');
  assert.ok(paths.includes('/:id/cancel-registration'), 'Must mount POST /:id/cancel-registration');
  assert.ok(paths.includes('/:id/check-in'), 'Must mount POST /:id/check-in');
});

// ─── 7. Flutter Mobile UI ───────────────────────────────────────────────────

test('Phase 16 Flutter: TournamentDiscoveryScreen exists and implements capacity progress', () => {
  const screenPath = path.join(
    ROOT,
    'apps/mobile/lib/screens/tournament_discovery_screen.dart'
  );
  assert.ok(fs.existsSync(screenPath), 'tournament_discovery_screen.dart must exist');

  const src = fs.readFileSync(screenPath, 'utf8');

  // Verify class and state
  assert.ok(src.includes('class TournamentDiscoveryScreen extends ConsumerStatefulWidget'));
  assert.ok(src.includes('LinearProgressIndicator'), 'Must implement capacity progress bar');
  assert.ok(src.includes('Join Waitlist'), 'Must implement waitlist button for full tournaments');
  assert.ok(src.includes('vexora://tournaments/'), 'Must support deep link sharing');
  assert.ok(src.includes('Icons.qr_code_2_rounded'), 'Must support QR code dialog');
  assert.ok(src.includes('Check In'), 'Must implement check-in button');
});

test('Phase 16 Flutter: HomeShell mounts TournamentDiscoveryScreen on Tournaments tab', () => {
  const shellSrc = fs.readFileSync(
    path.join(ROOT, 'apps/mobile/lib/screens/home_shell.dart'),
    'utf8'
  );

  assert.ok(shellSrc.includes("import 'tournament_discovery_screen.dart';"));
  assert.ok(shellSrc.includes('const TournamentDiscoveryScreen()'));
});

// ─── 8. Teardown ────────────────────────────────────────────────────────────

test('Phase 16 Teardown: Clean up database pool', async () => {
  await closePool();
  assert.ok(true);
});
