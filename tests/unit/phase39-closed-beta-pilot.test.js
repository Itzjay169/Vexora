import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PilotService } from '../../backend/src/pilot/pilot.service.js';
import { closePool } from '../../backend/src/common/database.js';
import {
  BetaTesterEnrollSchema,
  PilotTournamentCreateSchema,
  PilotEvaluationSchema,
  BetaFeedbackSubmitSchema,
  IncidentRehearsalRecordSchema,
} from '../../packages/validation/src/index.ts';

/**
 * Phase 39: Closed Beta & Pilot Tournaments Test Suite
 * Blueprint Ref: Sections 32, 35, 39 (Phase 10)
 */

test('Phase 39 Cohort: Enrolls beta tester with unique code and rejects duplicates', async () => {
  const randomEmail = `test.player.${Date.now()}@vexora.gg`;

  // 1. Valid enrollment
  const tester = await PilotService.enrollBetaTester({
    email: randomEmail,
    displayName: 'StrikeEagle',
    phone: '+919876543210',
    testerType: 'PLAYER',
    distributionChannel: 'ANDROID_PLAY_INTERNAL',
    deviceModel: 'Pixel 8',
    osVersion: 'Android 14',
  });

  assert.ok(tester.id);
  assert.equal(tester.email, randomEmail);
  assert.equal(tester.status, 'INVITED');
  assert.ok(tester.invitation_code.startsWith('VEXORA-BETA-PL-'));

  // 2. Reject duplicate email
  await assert.rejects(
    async () => {
      await PilotService.enrollBetaTester({
        email: randomEmail,
        displayName: 'StrikeEagleDuplicate',
        testerType: 'PLAYER',
        distributionChannel: 'ANDROID_PLAY_INTERNAL',
      });
    },
    (err) => {
      assert.equal(err.code, 'TESTER_ALREADY_EXISTS');
      return true;
    }
  );

  // 3. Activate membership via invitation code
  const activated = await PilotService.activateTester(tester.invitation_code, crypto.randomUUID());
  assert.equal(activated.status, 'ACTIVE');
  assert.ok(activated.user_id);
});

test('Phase 39 Cohort: Rejects enrollment if cohort capacity exceeded', async () => {
  // Max 3 organisers allowed
  // Seed already has 2 organisers. Let's add the 3rd.
  const org3Email = `test.org3.${Date.now()}@vexora.gg`;
  await PilotService.enrollBetaTester({
    email: org3Email,
    displayName: 'Third Verified Org',
    testerType: 'ORGANISER',
    distributionChannel: 'ANDROID_PLAY_INTERNAL',
  });

  // Attempting 4th organiser must fail
  const org4Email = `test.org4.${Date.now()}@vexora.gg`;
  await assert.rejects(
    async () => {
      await PilotService.enrollBetaTester({
        email: org4Email,
        displayName: 'Fourth Org Attempt',
        testerType: 'ORGANISER',
        distributionChannel: 'ANDROID_PLAY_INTERNAL',
      });
    },
    (err) => {
      assert.equal(err.code, 'COHORT_CAPACITY_EXCEEDED');
      assert.ok(err.message.includes('Cohort capacity reached for ORGANISER'));
      return true;
    }
  );
});

test('Phase 39 Pilot Execution: Creation, evaluation, and strict zero-discrepancy gate', async () => {
  const tournamentId = crypto.randomUUID();
  const pilotCode = `PILOT-TEST-${Date.now().toString().slice(-4)}`;

  // 1. Create pilot tournament with assigned standby moderator and channel
  const pilot = await PilotService.createPilotTournament({
    tournamentId,
    pilotCode,
    gameTitle: 'BGMI Pilot Knockout',
    standbyModeratorName: 'Priyadarshini Mohanty',
    incidentChannel: '#incident-pilot-bgmi',
    targetParticipants: 16,
  });

  assert.ok(pilot.id);
  assert.equal(pilot.pilot_code, pilotCode);
  assert.equal(pilot.standby_moderator_name, 'Priyadarshini Mohanty');
  assert.equal(pilot.incident_channel, '#incident-pilot-bgmi');
  assert.equal(pilot.status, 'SCHEDULED');

  // 2. Reject evaluation with non-zero financial discrepancy (strict security gate)
  await assert.rejects(
    async () => {
      await PilotService.evaluatePilotTournament({
        pilotId: pilot.id,
        crashFreeRate: 99.8,
        disputesRaised: 1,
        disputesResolved: 1,
        avgResolutionMinutes: 15,
        financialDiscrepancyCents: 50.00, // Non-zero discrepancy!
        incidentCount: 0,
        evaluationNotes: 'Should fail evaluation due to ledger imbalance',
      });
    },
    (err) => {
      assert.equal(err.code, 'FINANCIAL_DISCREPANCY_DETECTED');
      return true;
    }
  );

  // 3. Successful evaluation with zero discrepancy and crash-free >= 99.5%
  const evaluated = await PilotService.evaluatePilotTournament({
    pilotId: pilot.id,
    crashFreeRate: 99.90,
    disputesRaised: 1,
    disputesResolved: 1,
    avgResolutionMinutes: 20,
    financialDiscrepancyCents: 0.00,
    incidentCount: 0,
    evaluationNotes: 'Pilot completed with zero financial discrepancy and 99.90% crash-free rate',
  });

  assert.equal(evaluated.status, 'SETTLED');
  assert.equal(evaluated.crash_free_rate, 99.90);
  assert.equal(evaluated.financial_discrepancy_cents, 0.00);
});

test('Phase 39 Feedback: Closed beta feedback submission and GitHub issue sync', async () => {
  const feedback = await PilotService.submitFeedback({
    authorEmail: 'shadow.sniper@vexora.gg',
    feedbackType: 'PERFORMANCE',
    severity: 'MEDIUM',
    title: 'Frame rate steady during final circle on mid-range Android',
    description: 'Tested on Redmi Note 12 over 4 matches. Live bracket socket connection stayed alive.',
    screenName: 'LiveTournamentBoardScreen',
    deviceTelemetry: { fps: 60, ram_usage_mb: 280, network: '4G' },
  });

  assert.ok(feedback.id);
  assert.equal(feedback.feedback_type, 'PERFORMANCE');
  assert.equal(feedback.status, 'SUBMITTED');
  assert.ok(feedback.github_issue_number > 0);
  assert.ok(feedback.github_issue_url.includes('github.com/vexora/vexora-core/issues/'));

  const list = await PilotService.listFeedback();
  assert.ok(list.length > 0);
});

test('Phase 39 Incident Rehearsal: Audits killswitch drill and on-call escalation contact', async () => {
  const rehearsal = await PilotService.recordRehearsal({
    scenarioName: 'Closed Beta Staged Drill: Wallet Freeze & Rapid Incident Bridge',
    scenarioType: 'KILLSWITCH_TRIGGER',
    leadEngineer: 'Siddharth Roy',
    standbyModerator: 'Priyadarshini Mohanty',
    onCallContact: '+91-98765-43210',
    escalationContact: '+91-98765-01234',
    timeToDetectSeconds: 12,
    timeToMitigateSeconds: 38,
    outcome: 'SUCCESS',
    killswitchVerified: true,
    notes: 'Killswitch flipped to false in Remote Config mirror. All mutative calls blocked with 403.',
  });

  assert.ok(rehearsal.id);
  assert.equal(rehearsal.outcome, 'SUCCESS');
  assert.equal(rehearsal.killswitch_verified, true);
  assert.equal(rehearsal.time_to_mitigate_seconds, 38);
  assert.ok(rehearsal.on_call_contact.length > 0);
  assert.ok(rehearsal.escalation_contact.length > 0);

  const rehearsals = await PilotService.listRehearsals();
  assert.ok(rehearsals.length >= 1);
});

test('Phase 39 Public Status: Live telemetry provider exposes all required SLOs and services', async () => {
  const status = await PilotService.getSystemStatus();

  assert.equal(status.status, 'OPERATIONAL');
  assert.ok(Array.isArray(status.services));
  assert.ok(status.services.some((s) => s.name.includes('Core Tournament API')));
  assert.ok(status.services.some((s) => s.name.includes('Double-Entry Ledger')));
  assert.ok(status.services.some((s) => s.name.includes('WebSocket')));
  assert.equal(status.closed_beta_metrics.unresolved_ledger_discrepancies, 0);
  assert.ok(status.support_sla.safety_first_response.includes('1 hour'));
});

test('Phase 39 Validation Schemas: Validate and reject inputs per business rules', () => {
  // Invalid pilot code format
  assert.throws(() => {
    PilotTournamentCreateSchema.parse({
      tournament_id: crypto.randomUUID(),
      pilot_code: 'invalid_code', // must match PILOT-<GAME>-<NUM>
      game_title: 'BGMI',
      standby_moderator_name: 'Priya',
      incident_channel: '#channel',
    });
  });

  // Valid pilot code format
  const validPilot = PilotTournamentCreateSchema.parse({
    tournament_id: crypto.randomUUID(),
    pilot_code: 'PILOT-BGMI-001',
    game_title: 'Battlegrounds Mobile India',
    standby_moderator_name: 'Priyadarshini Mohanty',
    incident_channel: '#incident-pilot-bgmi',
  });
  assert.equal(validPilot.pilot_code, 'PILOT-BGMI-001');

  // Reject non-zero discrepancy in PilotEvaluationSchema
  assert.throws(() => {
    PilotEvaluationSchema.parse({
      pilot_id: crypto.randomUUID(),
      crash_free_rate: 99.8,
      disputes_raised: 0,
      disputes_resolved: 0,
      avg_resolution_minutes: 0,
      financial_discrepancy_cents: 10.0, // Must be 0
      incident_count: 0,
      evaluation_notes: 'Should fail',
    });
  });

  // Valid evaluation
  const validEval = PilotEvaluationSchema.parse({
    pilot_id: crypto.randomUUID(),
    crash_free_rate: 99.8,
    disputes_raised: 1,
    disputes_resolved: 1,
    avg_resolution_minutes: 15,
    financial_discrepancy_cents: 0.0,
    incident_count: 0,
    evaluation_notes: 'Pilot tournament evaluated with zero discrepancies',
  });
  assert.equal(validEval.financial_discrepancy_cents, 0.0);
});

test('Phase 39 Database & Artifacts: Migration 030 and Policies exist', () => {
  const migrationPath = path.resolve('infra/migrations/030_closed_beta_and_pilot_tournaments.sql');
  const termsPath = path.resolve('docs/policies/terms-of-service.md');
  const privacyPath = path.resolve('docs/policies/privacy-policy.md');
  const refundPath = path.resolve('docs/policies/refund-cancellation-policy.md');
  const codeOfConductPath = path.resolve('docs/policies/code-of-conduct.md');

  assert.ok(fs.existsSync(migrationPath), 'Migration 030 must exist');
  assert.ok(fs.existsSync(termsPath), 'Terms of service must exist');
  assert.ok(fs.existsSync(privacyPath), 'Privacy policy must exist');
  assert.ok(fs.existsSync(refundPath), 'Refund policy must exist');
  assert.ok(fs.existsSync(codeOfConductPath), 'Code of conduct must exist');

  const migration = fs.readFileSync(migrationPath, 'utf-8');
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS beta_testers'));
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS pilot_tournaments'));
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS beta_feedback'));
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS incident_rehearsals'));
});

test('Phase 39 Teardown: Clean up database pool', async () => {
  await closePool();
  assert.ok(true);
});
