import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ReleaseService } from '../../backend/src/release/release.service.js';
import { closePool } from '../../backend/src/common/database.js';
import {
  ReleaseCandidateCreateSchema,
  ReleaseCandidateApproveStep1Schema,
  ReleaseCandidateApproveStep2Schema,
  FeatureFlagSetSchema,
  RegressionTestRunLogSchema,
  RolloutRecordSchema,
} from '../../packages/validation/src/index.ts';

/**
 * Phase 38: Store Preparation & Release Candidate Test Suite
 * Blueprint Ref: Sections 29, 35, 39 (Phase 9)
 */

test('Phase 38 Security Gate: Money-module flag requires two distinct engineers', async () => {
  const adminCreator = crypto.randomUUID();
  const approver1 = crypto.randomUUID();
  const approver2 = crypto.randomUUID();

  // Missing approvers for money module
  await assert.rejects(
    async () => {
      await ReleaseService.setFlag({
        flagKey: 'real_money_wallet_enabled',
        newValue: true,
        changedById: adminCreator,
        reason: 'Enable real money beta',
      });
    },
    (err) => {
      assert.equal(err.code, 'TWO_PERSON_APPROVAL_REQUIRED');
      return true;
    }
  );

  // Self-approval attempt (Approver 1 == Approver 2)
  await assert.rejects(
    async () => {
      await ReleaseService.setFlag({
        flagKey: 'real_money_wallet_enabled',
        newValue: true,
        changedById: adminCreator,
        reason: 'Attempt self approval with duplicate IDs',
        approver1Id: approver1,
        approver2Id: approver1,
      });
    },
    (err) => {
      assert.equal(err.code, 'SELF_APPROVAL_FORBIDDEN');
      assert.ok(err.message.includes('approver_2 must be a different engineer'));
      return true;
    }
  );

  // Requester cannot approve their own change
  await assert.rejects(
    async () => {
      await ReleaseService.setFlag({
        flagKey: 'real_money_wallet_enabled',
        newValue: true,
        changedById: adminCreator,
        reason: 'Requester acts as approver 1',
        approver1Id: adminCreator,
        approver2Id: approver2,
      });
    },
    (err) => {
      assert.equal(err.code, 'SELF_REFERENTIAL_APPROVAL');
      return true;
    }
  );

  // Valid two-person distinct approval succeeds
  const result = await ReleaseService.setFlag({
    flagKey: 'real_money_wallet_enabled',
    newValue: false, // keep false per v1 free policy
    changedById: adminCreator,
    reason: 'Locking real money wallet to OFF for initial launch',
    approver1Id: approver1,
    approver2Id: approver2,
  });

  assert.equal(result.flag_key, 'real_money_wallet_enabled');
  assert.equal(result.flag_value, false);
});

test('Phase 38 Flags: Non-money flags can be updated with audit trail without dual approval', async () => {
  const adminId = crypto.randomUUID();
  const result = await ReleaseService.setFlag({
    flagKey: 'publishing_enabled',
    newValue: true,
    changedById: adminId,
    reason: 'Enabling tournament publishing for launch',
  });

  assert.equal(result.flag_key, 'publishing_enabled');
  assert.equal(result.flag_value, true);
  assert.equal(result.changed_by, adminId);
});

test('Phase 38 Release Candidate: Creation and Two-Person Approval Gate lifecycle', async () => {
  const creatorId = crypto.randomUUID();
  const engApprover1 = crypto.randomUUID();
  const secApprover2 = crypto.randomUUID();
  const gitSha = '7b84f2c0199e8d47b0a31249e0c65d93e1104e5a';

  // 1. Create RC
  const rc = await ReleaseService.createRC({
    rcTag: 'v1.0.0-rc.1',
    versionName: '1.0.0',
    versionCode: 1,
    gitSha,
    buildUrl: 'https://ci.vexora.gg/builds/1042',
    createdBy: creatorId,
    notes: 'Release candidate for Google Play internal testing',
  });

  assert.ok(rc.id);
  assert.equal(rc.rc_tag, 'v1.0.0-rc.1');
  assert.equal(rc.status, 'PENDING');
  assert.equal(rc.git_sha, gitSha);

  // 2. Step 1 sign-off: Creator cannot approve their own RC
  await assert.rejects(
    async () => {
      await ReleaseService.approveRC_step1({
        rcId: rc.id,
        approverId: creatorId,
      });
    },
    (err) => {
      assert.equal(err.code, 'SELF_APPROVAL_FORBIDDEN');
      return true;
    }
  );

  // 3. Step 1 sign-off succeeds with distinct first engineer
  const step1Result = await ReleaseService.approveRC_step1({
    rcId: rc.id,
    approverId: engApprover1,
  });
  assert.equal(step1Result.approver_1_id, engApprover1);
  assert.ok(step1Result.approver_1_at);

  // 4. Duplicate Step 1 is rejected
  await assert.rejects(
    async () => {
      await ReleaseService.approveRC_step1({
        rcId: rc.id,
        approverId: engApprover1,
      });
    },
    (err) => {
      assert.equal(err.code, 'RC_ALREADY_APPROVED_STEP1');
      return true;
    }
  );

  // 5. Step 2 sign-off: Approver 2 cannot be the same as Approver 1
  await assert.rejects(
    async () => {
      await ReleaseService.approveRC_step2({
        rcId: rc.id,
        approverId: engApprover1,
      });
    },
    (err) => {
      assert.equal(err.code, 'DUAL_APPROVER_SAME_ENGINEER');
      return true;
    }
  );

  // 6. Step 2 sign-off: Creator cannot be Approver 2
  await assert.rejects(
    async () => {
      await ReleaseService.approveRC_step2({
        rcId: rc.id,
        approverId: creatorId,
      });
    },
    (err) => {
      assert.equal(err.code, 'SELF_APPROVAL_FORBIDDEN');
      return true;
    }
  );

  // 7. Step 2 sign-off succeeds with distinct second engineer
  const step2Result = await ReleaseService.approveRC_step2({
    rcId: rc.id,
    approverId: secApprover2,
  });

  assert.equal(step2Result.approver_2_id, secApprover2);
  assert.equal(step2Result.status, 'APPROVED');
  assert.ok(step2Result.approval_token.startsWith('VEXORA-RC-APPROVED-'));
});

test('Phase 38 Regression Runs & Validation Summary', async () => {
  const rcId = crypto.randomUUID();
  const testerId = crypto.randomUUID();

  // Log test runs
  await ReleaseService.logTestRun({
    rcId,
    runType: 'UNIT',
    environment: 'staging',
    totalTests: 776,
    passingTests: 776,
    failingTests: 0,
    status: 'PASS',
    runBy: testerId,
  });

  await ReleaseService.logTestRun({
    rcId,
    runType: 'E2E',
    environment: 'staging',
    totalTests: 18,
    passingTests: 18,
    failingTests: 0,
    status: 'PASS',
    runBy: testerId,
  });

  const summary = await ReleaseService.getRCValidationSummary(rcId);
  assert.equal(summary.rc_id, rcId);
  assert.equal(summary.all_passed, false); // because other suites (CONTRACT, etc.) are NOT_RUN yet
  assert.ok(summary.not_run.includes('CONTRACT'));
  assert.ok(summary.not_run.includes('MUTATION'));
  assert.equal(summary.failing.length, 0);

  const unitSummary = summary.summary.find((s) => s.run_type === 'UNIT');
  assert.equal(unitSummary.status, 'PASS');
  assert.equal(unitSummary.pass_rate, '100.0');
});

test('Phase 38 Rollout: Percentage tracking and Emergency Rollback enforcement', async () => {
  const rcId = crypto.randomUUID();
  const adminId = crypto.randomUUID();

  // 1. Advance to 10%
  const step1 = await ReleaseService.recordRollout({
    rcId,
    previousPct: 0,
    newPct: 10,
    action: 'INCREMENT',
    crashFreeRate: 99.8,
    disputeRate: 0.2,
    anrRate: 0.05,
    reason: 'Initial 10% staged release on Google Play',
    authorizedBy: adminId,
  });
  assert.equal(step1.new_pct, 10);
  assert.equal(step1.action, 'INCREMENT');

  // 2. Rollback requires new_pct === 0
  await assert.rejects(
    async () => {
      await ReleaseService.recordRollout({
        rcId,
        previousPct: 10,
        newPct: 5,
        action: 'ROLLBACK',
        reason: 'Attempt invalid rollback without zeroing out',
        authorizedBy: adminId,
      });
    },
    (err) => {
      assert.equal(err.code, 'INVALID_ROLLBACK');
      return true;
    }
  );

  // 3. Valid emergency rollback to 0%
  const rollback = await ReleaseService.recordRollout({
    rcId,
    previousPct: 10,
    newPct: 0,
    action: 'ROLLBACK',
    crashFreeRate: 97.5,
    disputeRate: 2.1,
    anrRate: 0.6,
    reason: 'Crash rate anomaly detected on low-end Android 11 devices',
    authorizedBy: adminId,
  });

  assert.equal(rollback.new_pct, 0);
  assert.equal(rollback.action, 'ROLLBACK');
});

test('Phase 38 Validation Schemas: Reject invalid inputs correctly', () => {
  // Invalid RC tag format
  assert.throws(() => {
    ReleaseCandidateCreateSchema.parse({
      rc_tag: 'invalid-tag-1.0',
      version_name: '1.0.0',
      version_code: 1,
      git_sha: '7b84f2c0199e8d47b0a31249e0c65d93e1104e5a',
    });
  });

  // Invalid Git SHA length
  assert.throws(() => {
    ReleaseCandidateCreateSchema.parse({
      rc_tag: 'v1.0.0-rc.1',
      version_name: '1.0.0',
      version_code: 1,
      git_sha: 'short-sha',
    });
  });

  // Valid RC create schema
  const validRC = ReleaseCandidateCreateSchema.parse({
    rc_tag: 'v1.0.0-rc.1',
    version_name: '1.0.0',
    version_code: 1,
    git_sha: '7b84f2c0199e8d47b0a31249e0c65d93e1104e5a',
    notes: 'Valid RC notes',
  });
  assert.equal(validRC.rc_tag, 'v1.0.0-rc.1');

  // Valid Rollout Schema
  const validRollout = RolloutRecordSchema.parse({
    rc_id: crypto.randomUUID(),
    previous_pct: 0,
    new_pct: 25,
    action: 'INCREMENT',
    reason: 'Advancing staged rollout after 24h stability',
  });
  assert.equal(validRollout.new_pct, 25);
});

test('Phase 38 Store Preparation: Android network security and Manifest hardening verification', () => {
  const manifestPath = path.resolve('apps/mobile/android/app/src/main/AndroidManifest.xml');
  const netSecPath = path.resolve('apps/mobile/android/app/src/main/res/xml/network_security_config.xml');
  const fastfilePath = path.resolve('apps/mobile/fastlane/Fastfile');
  const appfilePath = path.resolve('apps/mobile/fastlane/Appfile');
  const checklistPath = path.resolve('docs/store/play-store-checklist.md');
  const migrationPath = path.resolve('infra/migrations/029_release_candidate_and_killswitches.sql');

  assert.ok(fs.existsSync(manifestPath), 'AndroidManifest.xml must exist');
  assert.ok(fs.existsSync(netSecPath), 'network_security_config.xml must exist');
  assert.ok(fs.existsSync(fastfilePath), 'Fastlane Fastfile must exist');
  assert.ok(fs.existsSync(appfilePath), 'Fastlane Appfile must exist');
  assert.ok(fs.existsSync(checklistPath), 'Play Store checklist must exist');
  assert.ok(fs.existsSync(migrationPath), 'Migration 029 must exist');

  const manifest = fs.readFileSync(manifestPath, 'utf-8');
  assert.ok(manifest.includes('android:usesCleartextTraffic="false"'), 'Cleartext traffic must be forbidden');
  assert.ok(manifest.includes('android:name="android.permission.USE_BIOMETRIC"'), 'Biometric permission present');
  assert.ok(manifest.includes('com.vexora.vexora_mobile'), 'App identifier correct');

  const netSec = fs.readFileSync(netSecPath, 'utf-8');
  assert.ok(netSec.includes('cleartextTrafficPermitted="false"'), 'Cleartext forbidden in network security XML');
  assert.ok(netSec.includes('api.vexora.gg'), 'Production API domain pinned');

  const checklist = fs.readFileSync(checklistPath, 'utf-8');
  assert.ok(checklist.includes('Target SDK') && checklist.includes('34'), 'Target SDK 34 verified');
  assert.ok(checklist.includes('Min SDK') && checklist.includes('21'), 'Min SDK 21 verified');
  assert.ok(checklist.includes('Data Safety Form'), 'Data safety section present');
  assert.ok(checklist.includes('Account Deletion'), 'In-app account deletion policy verified');
});

test('Phase 38 Teardown: Clean up database pool', async () => {
  await closePool();
  assert.ok(true);
});

