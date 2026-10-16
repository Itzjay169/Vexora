/**
 * Vexora Phase 15: Tournament State Machine & Creation Wizard
 *
 * Tests cover:
 *   1.  Migration 009 Structure (tournament_status enum, tournament_rules, constraints)
 *   2.  Canonical 11-state machine — all valid transitions
 *   3.  State machine — all invalid/illegal jumps rejected
 *   4.  State machine — terminal states have no outgoing transitions
 *   5.  Service exports — TournamentService and helper functions
 *   6.  Launch principle — v1 free-only enforced (entry_fee_credits = 0)
 *   7.  Validation: TournamentCreateSchema accepts valid free tournament
 *   8.  Validation: TournamentCreateSchema enforces v1 free-only (rejects entry_fee > 0)
 *   9.  Validation: TournamentCreateSchema enforces min <= max participants
 *   10. Validation: TournamentCreateSchema enforces schedule order
 *   11. Validation: TournamentUpdateSchema accepts partial updates
 *   12. Validation: TournamentRuleUpdateSchema requires change_summary
 *   13. Validation: TournamentTransitionSchema validates new_status enum
 *   14. Versioned rules immutability: migration trigger prevents UPDATE/DELETE
 *   15. Anti-IDOR: ownership check returns 404 not 403
 *   16. Editable states: draft fields only editable in DRAFT/PENDING_REVIEW
 *   17. Routes registration: all expected endpoints mounted
 *   18. Server integration: /api/v1/tournaments mounted
 *   19. Flutter: tournament wizard screen exists
 *   20. Admin: tournament review page exists
 *   21. Security gate: server-time-only enforcement
 *   22. Audit trail: every mutating action records audit log
 */

process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Service imports
import {
  TournamentService,
  TOURNAMENT_STATES,
  VALID_TRANSITIONS,
  canTransition,
} from '../../backend/src/tournaments/tournaments.service.js';

import { pool, closePool } from '../../backend/src/common/database.js';

// Routes import
import { tournamentsRouter } from '../../backend/src/tournaments/tournaments.routes.js';

// Validation schemas
import {
  TournamentCreateSchema,
  TournamentUpdateSchema,
  TournamentRuleUpdateSchema,
  TournamentTransitionSchema,
  TournamentStatus,
  TournamentFormat,
} from '../../packages/validation/src/index.ts';

const ROOT = path.resolve('.');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeFutureDate(hoursFromNow = 24) {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d.toISOString();
}

function makeValidTournamentInput(overrides = {}) {
  return {
    game_id: '550e8400-e29b-41d4-a716-446655440001',
    scoring_schema_id: '550e8400-e29b-41d4-a716-446655440002',
    title: 'BGMI Battle Royale Cup #1',
    format: 'BATTLE_ROYALE_LOBBY',
    team_size: 4,
    min_participants: 8,
    max_participants: 64,
    start_time: makeFutureDate(48),
    registration_open: makeFutureDate(2),
    registration_close: makeFutureDate(24),
    entry_fee_credits: 0,
    prize_pool_credits: 0,
    ...overrides,
  };
}

// ─── 1. Migration 009 Structure Validation ──────────────────────────────────

test('Phase 15 Database: Migration 009 file exists and covers state machine + rules', () => {
  const migPath = path.join(ROOT, 'infra/migrations/009_tournament_state_machine_and_rules.sql');
  assert.ok(fs.existsSync(migPath), 'Migration 009 file must exist');

  const sql = fs.readFileSync(migPath, 'utf8');

  // Must extend tournament_status enum with Blueprint states
  assert.ok(sql.includes('SCHEDULED'), 'Must add SCHEDULED state');
  assert.ok(sql.includes('CHECK_IN'), 'Must add CHECK_IN state');
  assert.ok(sql.includes('LIVE'), 'Must add LIVE state');
  assert.ok(sql.includes('DISPUTED'), 'Must add DISPUTED state');
  assert.ok(sql.includes('SETTLED'), 'Must add SETTLED state');
  assert.ok(sql.includes('ARCHIVED'), 'Must add ARCHIVED state');
});

test('Phase 15 Database: Migration 009 creates versioned tournament_rules table', () => {
  const migPath = path.join(ROOT, 'infra/migrations/009_tournament_state_machine_and_rules.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS tournament_rules'), 'Must create tournament_rules table');
  assert.ok(sql.includes('version'), 'tournament_rules must have version column');
  assert.ok(sql.includes('rule_json'), 'tournament_rules must have rule_json JSONB column');
  assert.ok(sql.includes('change_summary'), 'tournament_rules must have change_summary for audit');
  assert.ok(sql.includes('changed_by'), 'tournament_rules must record who changed the rules');
  assert.ok(sql.includes('uq_tournament_rule_version'), 'Must have unique constraint on (tournament_id, version)');
});

test('Phase 15 Database: Migration 009 enforces append-only rules immutability', () => {
  const migPath = path.join(ROOT, 'infra/migrations/009_tournament_state_machine_and_rules.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  assert.ok(sql.includes('prevent_tournament_rules_mutation'), 'Must create immutability trigger function');
  assert.ok(sql.includes('trg_immutable_tournament_rules'), 'Must create immutability trigger');
  assert.ok(sql.includes('BEFORE UPDATE OR DELETE'), 'Trigger must fire on UPDATE and DELETE');
  assert.ok(sql.includes('append-only'), 'Trigger error message must mention append-only');
});

test('Phase 15 Database: Migration 009 enforces v1 free-tournaments-only constraint', () => {
  const migPath = path.join(ROOT, 'infra/migrations/009_tournament_state_machine_and_rules.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  assert.ok(sql.includes('chk_tournaments_v1_free_only'), 'Must have CHECK constraint for v1 free-only');
  assert.ok(sql.includes('entry_fee_credits = 0'), 'Constraint must enforce entry_fee_credits = 0');
});

test('Phase 15 Database: Migration 009 applies RLS on tournament_rules', () => {
  const migPath = path.join(ROOT, 'infra/migrations/009_tournament_state_machine_and_rules.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  assert.ok(sql.includes('ALTER TABLE tournament_rules ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on tournament_rules');
  assert.ok(sql.includes('FORCE ROW LEVEL SECURITY'), 'Must force RLS on tournament_rules');
  assert.ok(sql.includes('tournament_rules_select'), 'Must have public read policy');
  assert.ok(sql.includes('tournament_rules_insert'), 'Must have organiser/admin write policy');
});

// ─── 2. Canonical 11-State Machine ──────────────────────────────────────────

test('Phase 15 State Machine: Exactly 11 canonical states defined', () => {
  assert.equal(TOURNAMENT_STATES.length, 11, 'Must define exactly 11 tournament states');
  assert.deepEqual(TOURNAMENT_STATES, [
    'DRAFT', 'PENDING_REVIEW', 'SCHEDULED', 'REGISTRATION_OPEN',
    'CHECK_IN', 'LIVE', 'RESULT_PENDING', 'DISPUTED',
    'COMPLETED', 'SETTLED', 'ARCHIVED',
  ]);
});

test('Phase 15 State Machine: All valid forward transitions permitted', () => {
  assert.ok(canTransition('DRAFT', 'PENDING_REVIEW'), 'DRAFT → PENDING_REVIEW');
  assert.ok(canTransition('PENDING_REVIEW', 'SCHEDULED'), 'PENDING_REVIEW → SCHEDULED');
  assert.ok(canTransition('SCHEDULED', 'REGISTRATION_OPEN'), 'SCHEDULED → REGISTRATION_OPEN');
  assert.ok(canTransition('REGISTRATION_OPEN', 'CHECK_IN'), 'REGISTRATION_OPEN → CHECK_IN');
  assert.ok(canTransition('CHECK_IN', 'LIVE'), 'CHECK_IN → LIVE');
  assert.ok(canTransition('LIVE', 'RESULT_PENDING'), 'LIVE → RESULT_PENDING');
  assert.ok(canTransition('RESULT_PENDING', 'COMPLETED'), 'RESULT_PENDING → COMPLETED');
  assert.ok(canTransition('RESULT_PENDING', 'DISPUTED'), 'RESULT_PENDING → DISPUTED');
  assert.ok(canTransition('DISPUTED', 'COMPLETED'), 'DISPUTED → COMPLETED');
  assert.ok(canTransition('COMPLETED', 'SETTLED'), 'COMPLETED → SETTLED');
  assert.ok(canTransition('SETTLED', 'ARCHIVED'), 'SETTLED → ARCHIVED');
});

test('Phase 15 State Machine: Archival transitions permitted from cancellable states', () => {
  const cancellableStates = ['DRAFT', 'PENDING_REVIEW', 'SCHEDULED', 'REGISTRATION_OPEN', 'CHECK_IN'];
  for (const state of cancellableStates) {
    assert.ok(canTransition(state, 'ARCHIVED'), `${state} → ARCHIVED should be allowed`);
  }
});

test('Phase 15 State Machine: Revert from PENDING_REVIEW to DRAFT allowed', () => {
  assert.ok(canTransition('PENDING_REVIEW', 'DRAFT'), 'PENDING_REVIEW → DRAFT (send back for edits)');
});

// ─── 3. Illegal Transitions Rejected ────────────────────────────────────────

test('Phase 15 State Machine: Arbitrary illegal jumps rejected', () => {
  assert.equal(canTransition('DRAFT', 'LIVE'), false, 'Cannot jump DRAFT → LIVE');
  assert.equal(canTransition('DRAFT', 'COMPLETED'), false, 'Cannot jump DRAFT → COMPLETED');
  assert.equal(canTransition('LIVE', 'SETTLED'), false, 'Cannot jump LIVE → SETTLED');
  assert.equal(canTransition('SCHEDULED', 'LIVE'), false, 'Cannot jump SCHEDULED → LIVE');
  assert.equal(canTransition('REGISTRATION_OPEN', 'COMPLETED'), false, 'Cannot skip to COMPLETED');
  assert.equal(canTransition('CHECK_IN', 'SETTLED'), false, 'Cannot skip from CHECK_IN to SETTLED');
  assert.equal(canTransition('DISPUTED', 'SETTLED'), false, 'DISPUTED must go through COMPLETED first');
});

test('Phase 15 State Machine: Terminal states have no outgoing edges', () => {
  assert.deepEqual(VALID_TRANSITIONS['ARCHIVED'], [], 'ARCHIVED is terminal');
  assert.equal(canTransition('ARCHIVED', 'DRAFT'), false, 'Cannot leave ARCHIVED');
  assert.equal(canTransition('ARCHIVED', 'LIVE'), false, 'Cannot leave ARCHIVED');
});

test('Phase 15 State Machine: Non-reversible post-LIVE states', () => {
  assert.equal(canTransition('RESULT_PENDING', 'LIVE'), false, 'Cannot go back to LIVE');
  assert.equal(canTransition('COMPLETED', 'RESULT_PENDING'), false, 'Cannot revert COMPLETED');
  assert.equal(canTransition('SETTLED', 'COMPLETED'), false, 'Cannot revert SETTLED');
});

// ─── 4. Service Exports ─────────────────────────────────────────────────────

test('Phase 15 Service: TournamentService exports all required methods', () => {
  assert.equal(typeof TournamentService.createDraft, 'function', 'Must export createDraft');
  assert.equal(typeof TournamentService.updateDraft, 'function', 'Must export updateDraft');
  assert.equal(typeof TournamentService.updateRules, 'function', 'Must export updateRules');
  assert.equal(typeof TournamentService.transitionStatus, 'function', 'Must export transitionStatus');
  assert.equal(typeof TournamentService.getById, 'function', 'Must export getById');
  assert.equal(typeof TournamentService.getRulesHistory, 'function', 'Must export getRulesHistory');
  assert.equal(typeof TournamentService.listTournaments, 'function', 'Must export listTournaments');
});

test('Phase 15 Service: canTransition is a pure function matching VALID_TRANSITIONS', () => {
  assert.equal(typeof canTransition, 'function');
  // Verify that every entry in VALID_TRANSITIONS is accessible via canTransition
  for (const [state, targets] of Object.entries(VALID_TRANSITIONS)) {
    for (const target of targets) {
      assert.ok(canTransition(state, target), `canTransition(${state}, ${target}) must be true`);
    }
  }
});

// ─── 5. Validation Schemas ──────────────────────────────────────────────────

test('Phase 15 Validation: TournamentCreateSchema accepts valid free tournament', () => {
  const input = makeValidTournamentInput();
  const result = TournamentCreateSchema.safeParse(input);
  assert.ok(result.success, `Should accept valid input: ${JSON.stringify(result.error?.issues)}`);
  assert.equal(result.data.entry_fee_credits, 0, 'Entry fee must be 0');
  assert.equal(result.data.prize_pool_credits, 0, 'Prize pool must be 0');
});

test('Phase 15 Validation: TournamentCreateSchema enforces v1 free-only (rejects entry_fee > 0)', () => {
  const input = makeValidTournamentInput({ entry_fee_credits: 100 });
  const result = TournamentCreateSchema.safeParse(input);
  assert.equal(result.success, false, 'Must reject entry_fee > 0');
});

test('Phase 15 Validation: TournamentCreateSchema rejects prize_pool > 0', () => {
  const input = makeValidTournamentInput({ prize_pool_credits: 500 });
  const result = TournamentCreateSchema.safeParse(input);
  assert.equal(result.success, false, 'Must reject prize_pool > 0');
});

test('Phase 15 Validation: TournamentCreateSchema enforces min <= max participants', () => {
  const input = makeValidTournamentInput({
    min_participants: 100,
    max_participants: 10,
  });
  const result = TournamentCreateSchema.safeParse(input);
  assert.equal(result.success, false, 'Must reject min > max participants');
});

test('Phase 15 Validation: TournamentCreateSchema enforces schedule order', () => {
  const now = new Date();
  const regOpen = new Date(now.getTime() + 2 * 3600000).toISOString();
  const regClose = new Date(now.getTime() + 1 * 3600000).toISOString(); // before regOpen!
  const startTime = new Date(now.getTime() + 48 * 3600000).toISOString();

  const input = makeValidTournamentInput({
    registration_open: regOpen,
    registration_close: regClose,
    start_time: startTime,
  });
  const result = TournamentCreateSchema.safeParse(input);
  assert.equal(result.success, false, 'Must reject registration_close before registration_open');
});

test('Phase 15 Validation: TournamentCreateSchema rejects title too short', () => {
  const input = makeValidTournamentInput({ title: 'AB' });
  const result = TournamentCreateSchema.safeParse(input);
  assert.equal(result.success, false, 'Must reject title < 3 chars');
});

test('Phase 15 Validation: TournamentCreateSchema accepts all valid formats', () => {
  const formats = ['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'SWISS', 'BATTLE_ROYALE_LOBBY', 'LEAGUE', 'CUSTOM'];
  for (const format of formats) {
    const input = makeValidTournamentInput({ format });
    const result = TournamentCreateSchema.safeParse(input);
    assert.ok(result.success, `Must accept format: ${format}`);
  }
});

test('Phase 15 Validation: TournamentUpdateSchema accepts partial updates', () => {
  const result = TournamentUpdateSchema.safeParse({ title: 'Updated Title' });
  assert.ok(result.success, 'Must accept partial update');
  assert.equal(result.data.title, 'Updated Title');
});

test('Phase 15 Validation: TournamentUpdateSchema accepts empty update (no fields)', () => {
  const result = TournamentUpdateSchema.safeParse({});
  assert.ok(result.success, 'Must accept empty object');
});

test('Phase 15 Validation: TournamentRuleUpdateSchema requires change_summary', () => {
  const resultWithout = TournamentRuleUpdateSchema.safeParse({
    rule_json: { some: 'rule' },
  });
  assert.equal(resultWithout.success, false, 'Must reject without change_summary');

  const resultShort = TournamentRuleUpdateSchema.safeParse({
    rule_json: { some: 'rule' },
    change_summary: 'Hi',
  });
  assert.equal(resultShort.success, false, 'Must reject summary < 5 chars');

  const resultValid = TournamentRuleUpdateSchema.safeParse({
    rule_json: { some: 'rule' },
    change_summary: 'Updated evidence policy for screenshots',
  });
  assert.ok(resultValid.success, 'Must accept valid rule update with summary');
});

test('Phase 15 Validation: TournamentTransitionSchema validates new_status enum', () => {
  const valid = TournamentTransitionSchema.safeParse({ new_status: 'PENDING_REVIEW' });
  assert.ok(valid.success, 'Must accept valid status');

  const invalid = TournamentTransitionSchema.safeParse({ new_status: 'NONEXISTENT_STATUS' });
  assert.equal(invalid.success, false, 'Must reject unknown status');

  const withReason = TournamentTransitionSchema.safeParse({
    new_status: 'SCHEDULED',
    reason: 'Admin approved after review',
  });
  assert.ok(withReason.success, 'Must accept optional reason');
});

test('Phase 15 Validation: TournamentStatus enum matches 11 canonical states', () => {
  assert.equal(TournamentStatus.options.length, 11, 'TournamentStatus must have 11 options');
  for (const state of TOURNAMENT_STATES) {
    const result = TournamentStatus.safeParse(state);
    assert.ok(result.success, `TournamentStatus must accept ${state}`);
  }
});

test('Phase 15 Validation: TournamentFormat enum includes all blueprint formats', () => {
  const expectedFormats = [
    'SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN',
    'SWISS', 'BATTLE_ROYALE_LOBBY',
  ];
  for (const fmt of expectedFormats) {
    const result = TournamentFormat.safeParse(fmt);
    assert.ok(result.success, `TournamentFormat must accept ${fmt}`);
  }
});

// ─── 6. Anti-IDOR & Ownership ───────────────────────────────────────────────

test('Phase 15 Anti-IDOR: Service updateDraft performs ownership check (rejects with 404)', async () => {
  const origQuery = pool.query;
  pool.query = async (text, params) => {
    // Non-existent ID returns empty
    if (params && params[0] === '00000000-0000-0000-0000-000000000001') {
      return { rows: [] };
    }
    // Existing tournament owned by another user
    if (params && params[0] === '00000000-0000-0000-0000-000000000002') {
      return {
        rows: [{
          id: params[0],
          organiser_id: 'usr_legit_owner',
          status: 'DRAFT',
          rules_version: 1,
        }],
      };
    }
    return { rows: [] };
  };

  try {
    // 1. Non-existent returns 404
    try {
      await TournamentService.updateDraft(
        '00000000-0000-0000-0000-000000000001',
        'usr_attacker',
        'PLAYER',
        { title: 'Hacked Title' }
      );
      assert.fail('Should have thrown 404 for non-existent tournament');
    } catch (err) {
      assert.equal(err.statusCode, 404, 'Must return 404 for non-existent tournament');
      assert.equal(err.code, 'TOURNAMENT_NOT_FOUND');
    }

    // 2. Non-owner returns 404 (Anti-IDOR: never return 403 to prevent ID harvesting)
    try {
      await TournamentService.updateDraft(
        '00000000-0000-0000-0000-000000000002',
        'usr_attacker',
        'PLAYER',
        { title: 'Hacked Title' }
      );
      assert.fail('Should have thrown 404 for non-owner');
    } catch (err) {
      assert.equal(err.statusCode, 404, 'Anti-IDOR must return 404, not 403');
      assert.equal(err.code, 'TOURNAMENT_NOT_FOUND');
    }
  } finally {
    pool.query = origQuery;
  }
});

test('Phase 15 Anti-IDOR: Service updateRules rejects non-owner with 404', async () => {
  const origQuery = pool.query;
  pool.query = async (text, params) => {
    if (params && params[0] === '00000000-0000-0000-0000-000000000002') {
      return {
        rows: [{
          id: params[0],
          organiser_id: 'usr_legit_owner',
          status: 'DRAFT',
          rules_version: 1,
        }],
      };
    }
    return { rows: [] };
  };

  try {
    await TournamentService.updateRules(
      '00000000-0000-0000-0000-000000000002',
      'usr_attacker',
      'PLAYER',
      { change_summary: 'Attacker trying to modify rules' }
    );
    assert.fail('Should have thrown');
  } catch (err) {
    assert.equal(err.statusCode, 404, 'Must return 404 for non-owner (Anti-IDOR)');
    assert.equal(err.code, 'TOURNAMENT_NOT_FOUND');
  } finally {
    pool.query = origQuery;
  }
});

test('Phase 15 Anti-IDOR: Service transitionStatus rejects non-existent tournament', async () => {
  const origQuery = pool.query;
  pool.query = async (text, params) => {
    return { rows: [] };
  };

  try {
    await TournamentService.transitionStatus(
      '00000000-0000-0000-0000-000000000099',
      'PENDING_REVIEW',
      'usr_random',
      'PLAYER'
    );
    assert.fail('Should have thrown');
  } catch (err) {
    assert.equal(err.statusCode, 404, 'Must return 404 for non-existent tournament');
    assert.equal(err.code, 'TOURNAMENT_NOT_FOUND');
  } finally {
    pool.query = origQuery;
  }
});

// ─── 7. Routes Registration ─────────────────────────────────────────────────

test('Phase 15 Routes: tournamentsRouter registers all expected endpoints', () => {
  const layers = tournamentsRouter.stack || [];
  const routes = layers
    .filter(l => l.route)
    .map(l => ({
      path: l.route.path,
      methods: Object.keys(l.route.methods),
    }));

  const routePaths = routes.map(r => `${r.methods[0].toUpperCase()} ${r.path}`);

  assert.ok(routePaths.some(r => r.includes('GET /')), 'Must have GET / (discover)');
  assert.ok(routePaths.some(r => r.includes('GET /meta/states')), 'Must have GET /meta/states');
  assert.ok(routePaths.some(r => r.includes('GET /:id')), 'Must have GET /:id');
  assert.ok(routePaths.some(r => r.includes('GET /:id/rules')), 'Must have GET /:id/rules');
  assert.ok(routePaths.some(r => r.includes('POST /')), 'Must have POST / (create)');
  assert.ok(routePaths.some(r => r.includes('PATCH /:id')), 'Must have PATCH /:id (update)');
  assert.ok(routePaths.some(r => r.includes('POST /:id/rules')), 'Must have POST /:id/rules');
  assert.ok(routePaths.some(r => r.includes('POST /:id/submit-review')), 'Must have POST /:id/submit-review');
  assert.ok(routePaths.some(r => r.includes('POST /:id/transition')), 'Must have POST /:id/transition');
  assert.ok(routePaths.some(r => r.includes('POST /:id/register')), 'Must have POST /:id/register');
  assert.ok(routePaths.some(r => r.includes('POST /:id/check-in')), 'Must have POST /:id/check-in');
});

test('Phase 15 Server Integration: server.js mounts /api/v1/tournaments', () => {
  const serverSrc = fs.readFileSync(path.join(ROOT, 'backend/src/server.js'), 'utf8');
  assert.ok(
    serverSrc.includes("'/api/v1/tournaments'") && serverSrc.includes('tournamentsRouter'),
    'server.js must mount tournamentsRouter at /api/v1/tournaments'
  );
});

// ─── 8. Flutter Mobile Wizard ───────────────────────────────────────────────

test('Phase 15 Flutter: Tournament creation wizard screen exists', () => {
  const wizardPath = path.join(ROOT, 'apps/mobile/lib/screens/tournament_wizard_screen.dart');
  assert.ok(fs.existsSync(wizardPath), 'Tournament wizard screen file must exist');

  const src = fs.readFileSync(wizardPath, 'utf8');
  assert.ok(src.includes('TournamentWizardScreen'), 'Must define TournamentWizardScreen widget');
  assert.ok(src.includes('Stepper') || src.includes('Step') || src.includes('PageView'), 'Must use wizard/stepper flow');
  assert.ok(src.includes('DRAFT'), 'Must reference DRAFT initial state');
  assert.ok(src.includes('format'), 'Must have format selector');
  assert.ok(src.includes('Semantics'), 'Must include accessibility semantics');
});

// ─── 9. Admin Tournament Review ──────────────────────────────────────────────

test('Phase 15 Admin: Tournament review page exists', () => {
  const reviewPath = path.join(ROOT, 'apps/admin/src/app/tournaments/page.tsx');
  assert.ok(fs.existsSync(reviewPath), 'Admin tournaments page must exist');

  const src = fs.readFileSync(reviewPath, 'utf8');
  assert.ok(src.includes('PENDING_REVIEW'), 'Must show tournaments pending review');
  assert.ok(src.includes('SCHEDULED') || src.includes('approve'), 'Must support approval action');
  assert.ok(src.includes('tournament'), 'Must reference tournaments');
});

// ─── 10. Security Gate ──────────────────────────────────────────────────────

test('Phase 15 Security Gate: Service enforces server-time-only scheduling', () => {
  const serviceSrc = fs.readFileSync(
    path.join(ROOT, 'backend/src/tournaments/tournaments.service.js'),
    'utf8'
  );
  assert.ok(serviceSrc.includes('new Date()'), 'Must use server Date() for time validation');
  assert.ok(
    serviceSrc.includes('INVALID_SCHEDULE') || serviceSrc.includes('start_time must be in the future'),
    'Must reject past start_time'
  );
  assert.ok(
    serviceSrc.includes('FREE_TOURNAMENTS_ONLY'),
    'Must have FREE_TOURNAMENTS_ONLY error code'
  );
});

test('Phase 15 Security Gate: Service records audit logs for all mutations', () => {
  const serviceSrc = fs.readFileSync(
    path.join(ROOT, 'backend/src/tournaments/tournaments.service.js'),
    'utf8'
  );

  const auditActions = [
    'TOURNAMENT_CREATED',
    'TOURNAMENT_DRAFT_UPDATED',
    'TOURNAMENT_RULES_VERSION_INCREMENTED',
    'TOURNAMENT_STATUS_CHANGED',
  ];

  for (const action of auditActions) {
    assert.ok(
      serviceSrc.includes(action),
      `Service must record audit action: ${action}`
    );
  }
});

test('Phase 15 Security Gate: Routes require authentication on mutating endpoints', () => {
  const routesSrc = fs.readFileSync(
    path.join(ROOT, 'backend/src/tournaments/tournaments.routes.js'),
    'utf8'
  );
  // POST / requires authenticate + authorize
  assert.ok(routesSrc.includes('authenticate'), 'Must use authenticate middleware');
  assert.ok(routesSrc.includes("authorize('ORGANISER'"), 'Must authorize ORGANISER for creation');
  assert.ok(routesSrc.includes('requireIdempotencyKey'), 'Must require idempotency on create');
});

test('Phase 15 Teardown: Clean up database pool', async () => {
  await closePool();
  assert.ok(true);
});
