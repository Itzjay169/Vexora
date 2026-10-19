import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LaunchService } from '../../backend/src/launch/launch.service.js';
import { closePool } from '../../backend/src/common/database.js';
import {
  RegionalRolloutUpdateSchema,
  EnablePaidFeaturesSchema,
  TransparencyReportPublishSchema,
  DoDItemCertifySchema,
} from '../../packages/validation/src/index.ts';

/**
 * Phase 40: Controlled Public Launch & Section 52 Final Definition of Done (DoD) Test Suite
 * Blueprint Ref: Sections 6, 28, 36, 52
 */

test('Phase 40 Regional Gating: Lists seeded Indian regions with 100% free tournaments and paid disabled', async () => {
  const configs = await LaunchService.listRegionalConfigs();

  assert.ok(Array.isArray(configs));
  assert.ok(configs.length >= 7, 'Expected at least 7 regional launch configs seeded');

  // Verify launch principle: 100% FREE tournaments active
  const panIndia = configs.find((c) => c.region_code === 'IN-ALL');
  assert.ok(panIndia, 'IN-ALL configuration must exist');
  assert.equal(panIndia.free_tournaments_active, true, 'Free tournaments must be active');
  assert.equal(panIndia.paid_tournaments_active, false, 'Paid tournaments must be disabled by default');

  const delhi = configs.find((c) => c.region_code === 'IN-DL');
  assert.ok(delhi);
  assert.equal(delhi.free_tournaments_active, true);
  assert.equal(delhi.paid_tournaments_active, false);
});

test('Phase 40 Staged Rollout: Allows staged progression (10% -> 25% -> 50% -> 100%) and rejects invalid percentages', async () => {
  // 1. Valid update to 50%
  const updated50 = await LaunchService.updateRegionalRollout('IN-WB', {
    rollout_percentage: 50,
    notes: 'Staged pilot phase 2 expansion',
  });
  assert.equal(updated50.rollout_percentage, 50);
  assert.equal(updated50.status, 'STAGED_ROLLOUT');

  // 2. Valid update to 100% (Public Active)
  const updated100 = await LaunchService.updateRegionalRollout('IN-WB', {
    rollout_percentage: 100,
  });
  assert.equal(updated100.rollout_percentage, 100);
  assert.equal(updated100.status, 'PUBLIC_ACTIVE');

  // 3. Reject invalid rollout percentage (e.g. 33)
  await assert.rejects(
    async () => {
      await LaunchService.updateRegionalRollout('IN-WB', {
        rollout_percentage: 33,
      });
    },
    (err) => {
      assert.equal(err.code, 'INVALID_ROLLOUT_PERCENTAGE');
      return true;
    }
  );

  // Zod schema validation check
  assert.throws(() => {
    RegionalRolloutUpdateSchema.parse({ rollout_percentage: 42 });
  });
  const validZod = RegionalRolloutUpdateSchema.parse({ rollout_percentage: 50 });
  assert.equal(validZod.rollout_percentage, 50);
});

test('Phase 40 Security Gate: Rejects enabling paid features without valid legal sign-off reference', async () => {
  // Reject missing legal_signoff_reference
  await assert.rejects(
    async () => {
      await LaunchService.enablePaidFeaturesForRegion('IN-MH', {
        legal_signoff_reference: '',
        signed_by_legal_officer: 'Adv. Rajesh Sharma',
        jurisdiction_legal_brief: 'Skill gaming assessment for Maharashtra',
      });
    },
    (err) => {
      assert.equal(err.code, 'LEGAL_SIGNOFF_MANDATORY');
      return true;
    }
  );

  // Reject short/invalid legal_signoff_reference
  await assert.rejects(
    async () => {
      await LaunchService.enablePaidFeaturesForRegion('IN-MH', {
        legal_signoff_reference: 'N/A',
        signed_by_legal_officer: 'Adv. Rajesh Sharma',
        jurisdiction_legal_brief: 'Skill gaming assessment for Maharashtra',
      });
    },
    (err) => {
      assert.equal(err.code, 'LEGAL_SIGNOFF_MANDATORY');
      return true;
    }
  );
});

test('Phase 40 Security Gate: Rejects enabling paid features if legal officer signature is missing', async () => {
  await assert.rejects(
    async () => {
      await LaunchService.enablePaidFeaturesForRegion('IN-KA', {
        legal_signoff_reference: 'VEXORA-LEGAL-KA-2026-CERT-009',
        signed_by_legal_officer: '',
        jurisdiction_legal_brief: 'Karnataka High Court skill-gaming compliance review',
      });
    },
    (err) => {
      assert.equal(err.code, 'LEGAL_OFFICER_SIGNATURE_REQUIRED');
      return true;
    }
  );
});

test('Phase 40 Security Gate: Enables paid features with certified legal sign-off and allows emergency kill-switch disable', async () => {
  const signoffRef = 'VEXORA-LEGAL-MH-2026-CERT-012';
  const officer = 'Adv. Sunita Deshmukh (High Court Bar Council)';

  // 1. Enable with proper legal sign-off
  const enabled = await LaunchService.enablePaidFeaturesForRegion('IN-MH', {
    legal_signoff_reference: signoffRef,
    signed_by_legal_officer: officer,
    jurisdiction_legal_brief: 'Bombay High Court precedent: Skill tournament entry fees compliant',
  });
  assert.equal(enabled.paid_tournaments_active, true);
  assert.equal(enabled.legal_signoff_reference, signoffRef);
  assert.equal(enabled.signed_by_legal_officer, officer);

  // 2. Emergency regional kill-switch disable
  const disabled = await LaunchService.disablePaidFeaturesForRegion(
    'IN-MH',
    'Precautionary free-first enforcement'
  );
  assert.equal(disabled.paid_tournaments_active, false);
});

test('Phase 40 Transparency: Rejects publishing report if financial discrepancy is not zero', async () => {
  await assert.rejects(
    async () => {
      await LaunchService.publishTransparencyReport({
        report_code: 'TR-2026-Q4-002',
        reporting_period: '2026-Q4 (Pilot & Launch)',
        total_tournaments: 20,
        total_matches: 80,
        total_participants: 600,
        disputes_opened: 1,
        disputes_resolved: 1,
        avg_dispute_resolution_hours: 1.5,
        fair_play_sanctions_issued: 0,
        financial_discrepancy_count: 5, // NON-ZERO: FORBIDDEN!
      });
    },
    (err) => {
      assert.equal(err.code, 'DISCREPANCY_NOT_ZERO');
      return true;
    }
  );
});

test('Phase 40 Transparency: Publishes report with valid SHA-256 integrity hash and retrieves latest', async () => {
  const reportCode = `TR-2026-Q4-${Math.floor(100 + Math.random() * 900)}`;

  const report = await LaunchService.publishTransparencyReport({
    report_code: reportCode,
    reporting_period: '2026-Q4 (Public Launch)',
    total_tournaments: 25,
    total_matches: 100,
    total_participants: 800,
    disputes_opened: 2,
    disputes_resolved: 2,
    avg_dispute_resolution_hours: 1.25,
    fair_play_sanctions_issued: 1,
    grievance_officer_tickets: 0,
    it_rules_takedowns_processed: 0,
    financial_discrepancy_count: 0,
    notes: 'Q4 inaugural public transparency disclosure with zero financial variance.',
  });

  assert.ok(report.id);
  assert.equal(report.report_code, reportCode);
  assert.equal(report.financial_discrepancy_count, 0);
  assert.equal(report.ledger_invariant_status, 'EQUILIBRIUM_VERIFIED');
  assert.match(report.sha256_hash, /^[a-f0-9]{64}$/, 'Must have a 64-character SHA-256 integrity hash');

  // Verify retrieval
  const latest = await LaunchService.getLatestTransparencyReport();
  assert.ok(latest.report_code);
  assert.ok(latest.sha256_hash);
});

test('Phase 40 Section 52 Final DoD: Evaluates all 10 criteria and verifies launch certified status', async () => {
  const dodStatus = await LaunchService.getFinalDefinitionOfDoneStatus();

  assert.equal(dodStatus.total_items, 10, 'Must have exactly 10 criteria matching Section 52');
  assert.equal(dodStatus.verified_count, 10, 'All 10 items must be certified');
  assert.equal(dodStatus.completion_percentage, 100);
  assert.equal(dodStatus.zero_financial_discrepancy, true);
  assert.equal(dodStatus.free_tournaments_only_enforced, true);
  assert.equal(dodStatus.is_launch_certified, true, 'Platform must be launch certified');

  // Check individual Section 52 items
  const keys = dodStatus.checklist.map((i) => i.item_key);
  assert.ok(keys.includes('DOD-01-PHASES'));
  assert.ok(keys.includes('DOD-02-LEGAL'));
  assert.ok(keys.includes('DOD-03-LEDGER'));
  assert.ok(keys.includes('DOD-04-AUDIT_DR'));
  assert.ok(keys.includes('DOD-05-PEN_TEST'));
  assert.ok(keys.includes('DOD-06-PILOTS'));
  assert.ok(keys.includes('DOD-07-STORE'));
  assert.ok(keys.includes('DOD-08-DASHBOARDS'));
  assert.ok(keys.includes('DOD-09-DOCS'));
  assert.ok(keys.includes('DOD-10-ROADMAP'));
});

test('Phase 40 Section 52 Final DoD: Allows updating and recertifying a checklist item', async () => {
  const updatedItem = await LaunchService.certifyDoDItem('DOD-03-LEDGER', {
    verified_by: 'Auditor General of Finance',
    verification_notes: 'Recertified: 30 consecutive days of clean 3-way reconciliation drills.',
    evidence_ref: 'backend/src/wallet/wallet.service.js',
  });

  assert.equal(updatedItem.item_key, 'DOD-03-LEDGER');
  assert.equal(updatedItem.status, 'VERIFIED');
  assert.equal(updatedItem.verified_by, 'Auditor General of Finance');
  assert.ok(updatedItem.verification_notes.includes('30 consecutive days'));
});

test('Phase 40 Documentation Artifacts: Verifies transparency report, Q1 2027 roadmap, and DoD artifacts', () => {
  const root = path.resolve(process.cwd());

  const transparencyPath = path.join(root, 'docs/reports/transparency-report-2026-q4.md');
  assert.ok(fs.existsSync(transparencyPath), 'transparency-report-2026-q4.md must exist');
  const transparencyContent = fs.readFileSync(transparencyPath, 'utf8');
  assert.ok(transparencyContent.includes('TR-2026-Q4-001'));
  assert.ok(transparencyContent.includes('100% FREE'));
  assert.ok(transparencyContent.includes('Information Technology'));

  const roadmapPath = path.join(root, 'docs/roadmap/q1-2027-post-launch-roadmap.md');
  assert.ok(fs.existsSync(roadmapPath), 'q1-2027-post-launch-roadmap.md must exist');
  const roadmapContent = fs.readFileSync(roadmapPath, 'utf8');
  assert.ok(roadmapContent.includes('Looking-For-Team'));
  assert.ok(roadmapContent.includes('Caster Studio'));
  assert.ok(roadmapContent.includes('Season 1'));

  const dodPath = path.join(root, 'docs/release/final-definition-of-done.md');
  assert.ok(fs.existsSync(dodPath), 'final-definition-of-done.md must exist');
  const dodContent = fs.readFileSync(dodPath, 'utf8');
  assert.ok(dodContent.includes('Section 52'));
  assert.ok(dodContent.includes('DOD-01-PHASES'));
  assert.ok(dodContent.includes('DOD-10-ROADMAP'));
});

// Clean up DB pool connection
test('Phase 40 Teardown: Closes database pool cleanly', async () => {
  await closePool();
  assert.ok(true);
});
