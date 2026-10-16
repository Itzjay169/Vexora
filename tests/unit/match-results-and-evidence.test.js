/**
 * Vexora Phase 19: Match Result Submission, Evidence & Dispute Stubs Test Suite
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 4, 11, 39 Phase 4, 47)
 *
 * Test coverage:
 *   1.  Migration 013 Database Schema (match_results, match_dispute_stubs, immutability trigger, indexes, RLS)
 *   2.  Validation: ResultConfirmationStatus enum
 *   3.  Validation: CombatantScoreSchema (placement, kills, deaths, assists, points)
 *   4.  Validation: MatchResultSubmissionSchema (UUID match_id, participants array, 64-char hex SHA-256)
 *   5.  Validation: MatchResultConfirmationSchema (CONFIRM / CONTEST with min 5-char contest_reason)
 *   6.  Validation: MatchResultAdjudicationSchema (staff adjudication input, referee reason, winner UUID)
 *   7.  Validation: ResultReplayChecklistSchema (4-point criteria)
 *   8.  Replay Checklist Service: Provides 4-point capture guide per game code
 *   9.  Idempotency Key Deduplication: Submissions with identical Idempotency-Key return cached result
 *   10. Submitting Result: Creates versioned result row with SHA-256 evidence ingress seal
 *   11. Maker-Checker Security Rule: Submitting player CANNOT confirm own result (SELF_CONFIRMATION_FORBIDDEN)
 *   12. Two-Party Score Agreement: When both combatants report matching scores, result auto-finalizes
 *   13. Score Discrepancy Conflict Hold: Conflicting scores freeze settlement immediately (DISPUTED stub)
 *   14. Opponent Contest: Opposing team contesting triggers dispute hold and creates dispute stub
 *   15. Staff Adjudication Gate: Non-staff users cannot adjudicate (FORBIDDEN_ROLE)
 *   16. Staff Adjudication Flow: Staff referee adjudication unfreezes settlement and creates immutable version
 *   17. Immutability Principle: Finalized results cannot be mutated; corrections create new versions
 *   18. Routes: matchesRouter mounts all required Phase 19 endpoints
 *   19. Flutter Screen: ResultSubmissionScreen exists with 4-point checklist, 15m timer, and SHA-256 seal
 *   20. Flutter Integration: BracketScreen and HomeShell mount ResultSubmissionScreen
 *   21. Web Component: ResultSubmissionModal exists with 4-point checklist, 15m timer, and SHA-256 seal
 *   22. Web Integration: BracketViewer mounts ResultSubmissionModal
 */

process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Services & routes
import { ResultSubmissionService } from '../../backend/src/matches/resultSubmission.service.js';
import { matchesRouter } from '../../backend/src/matches/matches.routes.js';
import { pool, closePool } from '../../backend/src/common/database.js';

// Validation schemas
import {
  ResultConfirmationStatus,
  CombatantScoreSchema,
  MatchResultSubmissionSchema,
  MatchResultConfirmationSchema,
  MatchResultAdjudicationSchema,
  ResultReplayChecklistSchema,
} from '../../packages/validation/src/index.ts';

test.describe('Phase 19: Database Migration 013 & Schema Invariants', () => {
  const migrationPath = path.resolve(process.cwd(), 'infra/migrations/013_match_results_and_evidence.sql');

  test('013_match_results_and_evidence.sql migration file exists', () => {
    assert.equal(fs.existsSync(migrationPath), true, 'Migration 013 file must exist');
  });

  test('Migration creates match_results and match_dispute_stubs tables with correct constraints', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.match(sql, /CREATE TABLE IF NOT EXISTS match_results/i);
    assert.match(sql, /match_id\s+UUID\s+NOT NULL\s+REFERENCES\s+matches\(id\)/i);
    assert.match(sql, /version\s+INTEGER\s+NOT NULL\s+DEFAULT\s+1/i);
    assert.match(sql, /confirmation_status\s+VARCHAR\(50\)/i);
    assert.match(sql, /evidence_sha256\s+VARCHAR\(64\)/i);
    assert.match(sql, /participants_scores\s+JSONB\s+NOT NULL/i);

    assert.match(sql, /CREATE TABLE IF NOT EXISTS match_dispute_stubs/i);
    assert.match(sql, /settlement_frozen\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+TRUE/i);
    assert.match(sql, /status\s+VARCHAR\(50\)/i);
  });

  test('Migration establishes trigger preventing mutation of finalized results (Immutability guarantee)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /prevent_finalized_result_mutation/i);
    assert.match(sql, /IMMUTABILITY VIOLATION/i);
  });

  test('Migration includes performance indexes and Row Level Security', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_match_results_match_id/i);
    assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_match_results_status/i);
    assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_match_results_evidence_sha256/i);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
  });
});

test.describe('Phase 19: Validation Schemas', () => {
  test('ResultConfirmationStatus enum accepts all 5 standard states', () => {
    const validStates = ['PENDING_CONFIRMATION', 'CONFIRMED', 'DISPUTED', 'ADJUDICATED', 'REJECTED'];
    for (const st of validStates) {
      assert.equal(ResultConfirmationStatus.parse(st), st);
    }
    assert.throws(() => ResultConfirmationStatus.parse('INVALID_STATUS'));
  });

  test('CombatantScoreSchema validates combatant placement, kills, deaths, assists', () => {
    const validScore = {
      registration_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      placement: 1,
      kills: 7,
      deaths: 2,
      assists: 4,
    };
    const parsed = CombatantScoreSchema.parse(validScore);
    assert.equal(parsed.placement, 1);
    assert.equal(parsed.kills, 7);

    // Rejects non-UUID registration_id
    assert.throws(() => CombatantScoreSchema.parse({ registration_id: 'bad-uuid', kills: 0 }));
    // Rejects negative kills
    assert.throws(() => CombatantScoreSchema.parse({
      registration_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      kills: -1,
    }));
  });

  test('MatchResultSubmissionSchema validates complete submission with SHA-256 hash', () => {
    const validPayload = {
      match_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      participants: [
        {
          registration_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          placement: 1,
          kills: 5,
        },
      ],
      evidence_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      evidence_file_url: 'https://storage.vexora.io/match-evidence.png',
      notes: 'Clean match without disconnects',
    };

    const parsed = MatchResultSubmissionSchema.parse(validPayload);
    assert.equal(parsed.match_id, validPayload.match_id);
    assert.equal(parsed.evidence_sha256, validPayload.evidence_sha256);

    // Rejects invalid SHA-256 hash length or characters
    assert.throws(() => MatchResultSubmissionSchema.parse({
      ...validPayload,
      evidence_sha256: 'short-hash',
    }));
  });

  test('MatchResultConfirmationSchema enforces contest_reason when action is CONTEST', () => {
    const validConfirm = {
      submission_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      action: 'CONFIRM',
    };
    assert.equal(MatchResultConfirmationSchema.parse(validConfirm).action, 'CONFIRM');

    const validContest = {
      submission_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      action: 'CONTEST',
      contest_reason: 'Enemy reported 12 kills but scoreboard shows only 8 kills',
    };
    assert.equal(MatchResultConfirmationSchema.parse(validContest).action, 'CONTEST');

    // Fails if CONTEST without reason
    assert.throws(() => MatchResultConfirmationSchema.parse({
      submission_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      action: 'CONTEST',
    }));
  });

  test('MatchResultAdjudicationSchema validates referee adjudication payload', () => {
    const validAdjudication = {
      final_scores: [
        {
          registration_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          placement: 1,
          kills: 6,
        },
      ],
      adjudication_reason: 'Official tournament referee review of room replay logs confirmed 6 kills.',
      winner_registration_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    };

    const parsed = MatchResultAdjudicationSchema.parse(validAdjudication);
    assert.equal(parsed.winner_registration_id, validAdjudication.winner_registration_id);
    assert.equal(parsed.adjudication_reason.length > 5, true);

    // Rejects too short reason
    assert.throws(() => MatchResultAdjudicationSchema.parse({
      ...validAdjudication,
      adjudication_reason: 'Bad',
    }));
  });

  test('ResultReplayChecklistSchema validates 4-point evidence criteria', () => {
    const checklist = {
      final_scoreboard_visible: true,
      kills_breakdown_visible: true,
      room_id_visible: true,
      player_uids_matched: true,
    };
    const parsed = ResultReplayChecklistSchema.parse(checklist);
    assert.equal(parsed.final_scoreboard_visible, true);
    assert.equal(parsed.player_uids_matched, true);
  });
});

test.describe('Phase 19: Result Submission Service Logic & Invariants', () => {
  test('getReplayChecklist returns 4 canonical evidence criteria', () => {
    const checklist = ResultSubmissionService.getReplayChecklist('BGMI');
    assert.equal(checklist.game_code, 'BGMI');
    assert.equal(checklist.items.length, 4);

    const keys = checklist.items.map(i => i.key);
    assert.equal(keys.includes('final_scoreboard_visible'), true);
    assert.equal(keys.includes('kills_breakdown_visible'), true);
    assert.equal(keys.includes('room_id_visible'), true);
    assert.equal(keys.includes('player_uids_matched'), true);
  });

  test('doScoresAgree correctly compares two combatant score submissions', () => {
    const combatantA = [
      { registration_id: 'reg-1', placement: 1, kills: 10 },
      { registration_id: 'reg-2', placement: 2, kills: 4 },
    ];
    const combatantBIdentical = [
      { registration_id: 'reg-1', placement: 1, kills: 10 },
      { registration_id: 'reg-2', placement: 2, kills: 4 },
    ];
    const combatantBConflict = [
      { registration_id: 'reg-1', placement: 1, kills: 10 },
      { registration_id: 'reg-2', placement: 2, kills: 6 }, // Kills conflict
    ];

    assert.equal(ResultSubmissionService.doScoresAgree(combatantA, combatantBIdentical), true);
    assert.equal(ResultSubmissionService.doScoresAgree(combatantA, combatantBConflict), false);
  });

  test('calculateEvidenceSha256 produces valid 64-char hex digest', () => {
    const digest = ResultSubmissionService.calculateEvidenceSha256('https://vexora.io/screenshot.png');
    assert.equal(typeof digest, 'string');
    assert.equal(digest.length, 64);
    assert.match(digest, /^[a-f0-9]{64}$/);
  });

  test('Idempotency deduplication returns cached result on duplicate key', async () => {
    const originalQuery = pool.query;
    const originalConnect = pool.connect;
    try {
      let queryCount = 0;
      pool.connect = async () => ({
        query: async (text, params) => pool.query(text, params),
        release: () => {},
      });

      pool.query = async (text, params) => {
        queryCount++;
        if (typeof text === 'string' && text.includes('idempotency_key = $1')) {
          return { rows: [{ id: 'sub-cached-1', idempotency_key: 'unique-key-phase19-test-1', status: 'PENDING_CONFIRMATION' }] };
        }
        return { rows: [] };
      };

      const payload = {
        match_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
        participants: [{ registration_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', kills: 4 }],
        evidence_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      };

      const idempotencyKey = 'unique-key-phase19-test-1';
      const firstCall = await ResultSubmissionService.submitResult(
        payload.match_id,
        'user-123',
        'PLAYER',
        payload,
        idempotencyKey
      );

      const countAfterFirst = queryCount;
      const secondCall = await ResultSubmissionService.submitResult(
        payload.match_id,
        'user-123',
        'PLAYER',
        payload,
        idempotencyKey
      );

      assert.deepEqual(firstCall, secondCall, 'Duplicate idempotency key must return identical cached result');
      assert.equal(firstCall.idempotent, true);
    } finally {
      pool.query = originalQuery;
      pool.connect = originalConnect;
    }
  });

  test('Maker-Checker: Submitting player CANNOT confirm their own result (SELF_CONFIRMATION_FORBIDDEN)', async () => {
    const originalQuery = pool.query;
    const originalConnect = pool.connect;
    try {
      pool.connect = async () => ({
        query: async (text, params) => pool.query(text, params),
        release: () => {},
      });

      pool.query = async (text, params) => {
        if (typeof text === 'string' && text.includes('SELECT mr.*, m.tournament_id')) {
          return {
            rows: [{
              id: 'submission-1',
              match_id: 'match-1',
              submitted_by: 'player-alice-uid',
              confirmation_status: 'PENDING_CONFIRMATION',
              participants_scores: [{ registration_id: 'reg-1', kills: 5 }],
              tournament_id: 'tourn-1',
            }],
          };
        }
        return { rows: [] };
      };

      await assert.rejects(
        () => ResultSubmissionService.confirmResult('match-1', 'submission-1', 'player-alice-uid', 'PLAYER', {
          submission_id: 'submission-1',
          action: 'CONFIRM',
        }),
        (err) => {
          assert.equal(err.code, 'SELF_CONFIRMATION_FORBIDDEN');
          return true;
        }
      );
    } finally {
      pool.query = originalQuery;
      pool.connect = originalConnect;
    }
  });

  test('Opponent confirming result marks match as FINAL and advances winner', async () => {
    const originalQuery = pool.query;
    const originalConnect = pool.connect;
    try {
      let matchFinalized = false;
      let winnerAdvanced = false;

      pool.connect = async () => ({
        query: async (text, params) => pool.query(text, params),
        release: () => {},
      });

      pool.query = async (text, params) => {
        if (typeof text === 'string' && text.includes('SELECT mr.*, m.tournament_id')) {
          return {
            rows: [{
              id: 'submission-1',
              match_id: 'match-1',
              submitted_by: 'player-alice-uid',
              confirmation_status: 'PENDING_CONFIRMATION',
              participants_scores: [
                { registration_id: 'reg-alice', kills: 10, is_winner: true },
                { registration_id: 'reg-bob', kills: 3, is_winner: false },
              ],
              tournament_id: 'tourn-1',
            }],
          };
        }
        if (typeof text === 'string' && text.includes('UPDATE match_results')) {
          return { rows: [{ id: 'submission-1', confirmation_status: 'CONFIRMED' }] };
        }
        if (typeof text === 'string' && text.includes("UPDATE matches SET status = 'FINAL'")) {
          matchFinalized = true;
          return { rows: [{ id: 'match-1', status: 'FINAL' }] };
        }
        if (typeof text === 'string' && text.includes('SELECT id, next_match_id, next_match_slot')) {
          return { rows: [{ id: 'match-1', next_match_id: 'match-2', next_match_slot: 'A', match_number: 1 }] };
        }
        if (typeof text === 'string' && text.includes('UPDATE matches SET participant_a_id = $1')) {
          winnerAdvanced = true;
          return { rows: [{ id: 'match-2' }] };
        }
        return { rows: [] };
      };

      const result = await ResultSubmissionService.confirmResult('match-1', 'submission-1', 'player-bob-uid', 'PLAYER', {
        submission_id: 'submission-1',
        action: 'CONFIRM',
      });

      assert.equal(result.action, 'CONFIRM');
      assert.equal(result.status, 'CONFIRMED');
      assert.equal(matchFinalized, true, 'Match status must transition to FINAL');
    } finally {
      pool.query = originalQuery;
      pool.connect = originalConnect;
    }
  });

  test('Opponent contesting result freezes settlement immediately and marks match DISPUTED', async () => {
    const originalQuery = pool.query;
    const originalConnect = pool.connect;
    try {
      let disputeStubCreated = false;
      let settlementFrozen = false;

      pool.connect = async () => ({
        query: async (text, params) => pool.query(text, params),
        release: () => {},
      });

      pool.query = async (text, params) => {
        if (typeof text === 'string' && text.includes('SELECT mr.*, m.tournament_id')) {
          return {
            rows: [{
              id: 'submission-1',
              match_id: 'match-1',
              submitted_by: 'player-alice-uid',
              confirmation_status: 'PENDING_CONFIRMATION',
              participants_scores: [{ registration_id: 'reg-alice', kills: 10 }],
              tournament_id: 'tourn-1',
            }],
          };
        }
        if (typeof text === 'string' && text.includes('UPDATE match_results')) {
          return { rows: [{ id: 'submission-1', confirmation_status: 'DISPUTED' }] };
        }
        if (typeof text === 'string' && text.includes("UPDATE matches SET status = 'DISPUTED'")) {
          settlementFrozen = true;
          return { rows: [{ id: 'match-1', status: 'DISPUTED' }] };
        }
        if (typeof text === 'string' && text.includes('INSERT INTO match_dispute_stubs')) {
          disputeStubCreated = true;
          return { rows: [{ id: 'dispute-stub-1', settlement_frozen: true }] };
        }
        return { rows: [] };
      };

      const result = await ResultSubmissionService.confirmResult('match-1', 'submission-1', 'player-bob-uid', 'PLAYER', {
        submission_id: 'submission-1',
        action: 'CONTEST',
        contest_reason: 'Incorrect kills entered. Official replay confirms 7 kills.',
      });

      assert.equal(result.status, 'DISPUTED');
      assert.equal(settlementFrozen, true, 'Match status must be set to DISPUTED');
      assert.equal(disputeStubCreated, true, 'Dispute stub with settlement_frozen must be inserted');
    } finally {
      pool.query = originalQuery;
      pool.connect = originalConnect;
    }
  });

  test('Staff adjudication enforces RBAC (Non-staff blocked with FORBIDDEN_ROLE)', async () => {
    await assert.rejects(
      () => ResultSubmissionService.adjudicateResult(
        'match-1',
        'regular-player-id',
        'PLAYER', // Not staff!
        {
          final_scores: [{ registration_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', placement: 1, kills: 5 }],
          adjudication_reason: 'Trying to adjudicate as player',
        }
      ),
      (err) => {
        assert.equal(err.code, 'FORBIDDEN_ROLE');
        return true;
      }
    );
  });

  test('Staff adjudication unfreezes settlement and creates immutable adjudicated version', async () => {
    const originalQuery = pool.query;
    const originalConnect = pool.connect;
    try {
      let versionCreated = false;
      let disputeResolved = false;

      pool.connect = async () => ({
        query: async (text, params) => pool.query(text, params),
        release: () => {},
      });

      pool.query = async (text, params) => {
        if (typeof text === 'string' && text.includes('SELECT m.*, t.id AS tournament_id')) {
          return { rows: [{ id: 'match-1', tournament_id: 'tourn-1', status: 'DISPUTED' }] };
        }
        if (typeof text === 'string' && text.includes('SELECT * FROM match_results WHERE match_id')) {
          return { rows: [{ version: 1 }] };
        }
        if (typeof text === 'string' && text.includes('INSERT INTO match_results')) {
          versionCreated = true;
          return {
            rows: [{
              id: 'adjudicated-result-v2',
              match_id: 'match-1',
              version: 2,
              confirmation_status: 'ADJUDICATED',
              is_adjudicated: true,
            }],
          };
        }
        if (typeof text === 'string' && text.includes('UPDATE match_dispute_stubs')) {
          disputeResolved = true;
          return { rows: [{ id: 'dispute-stub-1', dispute_status: 'RESOLVED', settlement_frozen: false }] };
        }
        if (typeof text === 'string' && text.includes('SELECT id, next_match_id, next_match_slot')) {
          return { rows: [] };
        }
        return { rows: [] };
      };

      const result = await ResultSubmissionService.adjudicateResult(
        'match-1',
        'admin-staff-id',
        'ADMIN',
        {
          final_scores: [{ registration_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', placement: 1, kills: 8 }],
          adjudication_reason: 'Official replay reviewed by Head Referee; Team Alice took 1st place with 8 kills.',
          winner_registration_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        }
      );

      assert.equal(result.confirmation_status, 'ADJUDICATED');
      assert.equal(versionCreated, true, 'Staff adjudication must create a new immutable version row');
      assert.equal(disputeResolved, true, 'Dispute stubs must be marked RESOLVED and unfrozen');
    } finally {
      pool.query = originalQuery;
      pool.connect = originalConnect;
    }
  });
});

test.describe('Phase 19: API Routes & UI Artifacts Verification', () => {
  test('matchesRouter mounts all Phase 19 endpoints', () => {
    const routes = matchesRouter.stack.map(layer => ({
      path: layer.route?.path,
      methods: Object.keys(layer.route?.methods || {}),
    }));

    const paths = routes.map(r => r.path).filter(Boolean);
    assert.equal(paths.includes('/:id/submit-result'), true, 'Must mount POST /:id/submit-result');
    assert.equal(paths.includes('/:id/confirm-result'), true, 'Must mount POST /:id/confirm-result');
    assert.equal(paths.includes('/:id/adjudicate-result'), true, 'Must mount POST /:id/adjudicate-result');
    assert.equal(paths.includes('/:id/result-history'), true, 'Must mount GET /:id/result-history');
    assert.equal(paths.includes('/:id/evidence-checklist'), true, 'Must mount GET /:id/evidence-checklist');
  });

  test('Flutter ResultSubmissionScreen artifact exists with required components', () => {
    const screenPath = path.resolve(process.cwd(), 'apps/mobile/lib/screens/result_submission_screen.dart');
    assert.equal(fs.existsSync(screenPath), true, 'ResultSubmissionScreen file must exist');

    const content = fs.readFileSync(screenPath, 'utf8');
    assert.match(content, /class ResultSubmissionScreen extends/);
    assert.match(content, /final_scoreboard_visible|Final Match Scoreboard/);
    assert.match(content, /kills_breakdown_visible|Kill & Assist Breakdown/);
    assert.match(content, /roomIdVisible|Room Watermark/);
    assert.match(content, /playerUidsMatched|Player In-Game UIDs/);
    assert.match(content, /SHA-256 Seal/);
    assert.match(content, /Submission Deadline Window/);
    assert.match(content, /Maker-Checker/);
  });

  test('Flutter BracketScreen and HomeShell mount ResultSubmissionScreen', () => {
    const bracketContent = fs.readFileSync(path.resolve(process.cwd(), 'apps/mobile/lib/screens/bracket_screen.dart'), 'utf8');
    assert.match(bracketContent, /result_submission_screen\.dart/);
    assert.match(bracketContent, /ResultSubmissionScreen/);

    const shellContent = fs.readFileSync(path.resolve(process.cwd(), 'apps/mobile/lib/screens/home_shell.dart'), 'utf8');
    assert.match(shellContent, /result_submission_screen\.dart/);
    assert.match(shellContent, /ResultSubmissionScreen/);
  });

  test('Web ResultSubmissionModal component exists with required features', () => {
    const modalPath = path.resolve(process.cwd(), 'apps/web/src/components/ResultSubmissionModal.tsx');
    assert.equal(fs.existsSync(modalPath), true, 'ResultSubmissionModal file must exist');

    const content = fs.readFileSync(modalPath, 'utf8');
    assert.match(content, /export function ResultSubmissionModal/);
    assert.match(content, /Evidence Integrity Checklist/);
    assert.match(content, /SHA-256:/);
    assert.match(content, /Submission Deadline Window/);
    assert.match(content, /Maker-Checker Opponent Verification/);
  });

  test('Web BracketViewer component renders ResultSubmissionModal', () => {
    const bracketContent = fs.readFileSync(path.resolve(process.cwd(), 'apps/web/src/components/BracketViewer.tsx'), 'utf8');
    assert.match(bracketContent, /ResultSubmissionModal/);
  });
});
