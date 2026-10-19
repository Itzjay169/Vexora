import { Router } from 'express';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { ReleaseService } from './release.service.js';
import {
  ReleaseCandidateCreateSchema,
  ReleaseCandidateApproveStep1Schema,
  ReleaseCandidateApproveStep2Schema,
  FeatureFlagSetSchema,
  RegressionTestRunLogSchema,
  RolloutRecordSchema,
} from '../../../packages/validation/src/index.ts';

export const releaseRouter = Router();

// ─── 1. Feature Flags & Kill-Switches ────────────────────────────────────────

// GET /api/v1/release/flags
releaseRouter.get('/flags', async (_req, res, next) => {
  try {
    const flags = await ReleaseService.getAllFlags();
    res.json({ success: true, count: flags.length, data: flags });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/release/flags/:key
releaseRouter.get('/flags/:key', async (req, res, next) => {
  try {
    const value = await ReleaseService.getFlagValue(req.params.key);
    res.json({ success: true, flag_key: req.params.key, flag_value: value });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/release/flags
// Toggle/set feature flag. Money modules strictly mandate two-person approval.
releaseRouter.post('/flags', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const data = FeatureFlagSetSchema.parse(req.body);
    const updated = await ReleaseService.setFlag({
      flagKey: data.flag_key,
      newValue: data.new_value,
      changedById: req.user.id,
      reason: data.reason,
      approver1Id: data.approver1_id,
      approver2Id: data.approver2_id,
    });
    res.json({ success: true, message: 'Feature flag updated', data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── 2. Release Candidate Registry ───────────────────────────────────────────

// GET /api/v1/release/candidates
releaseRouter.get('/candidates', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (_req, res, next) => {
  try {
    const flags = await ReleaseService.getAllFlags();
    res.json({
      success: true,
      data: {
        active_rc: 'v1.0.0-rc.1',
        status: 'PENDING_DUAL_APPROVAL',
        release_channel: 'PLAY_INTERNAL_TESTING',
        v1_launch_mandate: 'FREE_TOURNAMENTS_ONLY',
        money_kill_switches_active: flags.filter((f) => f.is_money_module && !f.flag_value).length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/release/candidates
releaseRouter.post('/candidates', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const data = ReleaseCandidateCreateSchema.parse(req.body);
    const rc = await ReleaseService.createRC({
      rcTag: data.rc_tag,
      versionName: data.version_name,
      versionCode: data.version_code,
      gitSha: data.git_sha,
      buildUrl: data.build_url,
      createdBy: req.user.id,
      notes: data.notes,
    });
    res.status(201).json({ success: true, data: rc });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/release/candidates/:id/approve-step1
releaseRouter.post('/candidates/:id/approve-step1', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    ReleaseCandidateApproveStep1Schema.parse({ rc_id: req.params.id, ...req.body });
    const approved = await ReleaseService.approveRC_step1({
      rcId: req.params.id,
      approverId: req.user.id,
    });
    res.json({ success: true, message: 'RC sign-off step 1 recorded', data: approved });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/release/candidates/:id/approve-step2
// Second sign-off: validates Approver 2 != Approver 1, verifies money flags are off, emits Fastlane approval token
releaseRouter.post('/candidates/:id/approve-step2', authenticate, authorize(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    ReleaseCandidateApproveStep2Schema.parse({ rc_id: req.params.id, ...req.body });
    const approved = await ReleaseService.approveRC_step2({
      rcId: req.params.id,
      approverId: req.user.id,
    });
    res.json({ success: true, message: 'RC dual approval complete. Fastlane token issued.', data: approved });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/release/candidates/:id/validation-summary
releaseRouter.get('/candidates/:id/validation-summary', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const summary = await ReleaseService.getRCValidationSummary(req.params.id);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/release/candidates/:id/tests
releaseRouter.post('/candidates/:id/tests', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const data = RegressionTestRunLogSchema.parse({ rc_id: req.params.id, ...req.body });
    const run = await ReleaseService.logTestRun({
      rcId: req.params.id,
      runType: data.run_type,
      environment: data.environment,
      totalTests: data.total_tests,
      passingTests: data.passing_tests,
      failingTests: data.failing_tests,
      status: data.status,
      reportUrl: data.report_url,
      failureSummary: data.failure_summary,
      runBy: req.user.id,
    });
    res.status(201).json({ success: true, data: run });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/release/candidates/:id/rollout
releaseRouter.post('/candidates/:id/rollout', authenticate, authorize(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    const data = RolloutRecordSchema.parse({ rc_id: req.params.id, ...req.body });
    const entry = await ReleaseService.recordRollout({
      rcId: req.params.id,
      previousPct: data.previous_pct,
      newPct: data.new_pct,
      action: data.action,
      crashFreeRate: data.crash_free_rate,
      disputeRate: data.dispute_rate,
      anrRate: data.anr_rate,
      reason: data.reason,
      authorizedBy: req.user.id,
    });
    res.json({ success: true, message: 'Rollout percentage updated', data: entry });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/release/store-checklist
releaseRouter.get('/store-checklist', async (_req, res) => {
  res.json({
    success: true,
    data: {
      target_platform: ['GOOGLE_PLAY', 'APPLE_APP_STORE'],
      app_id: 'com.vexora.vexora_mobile',
      version: '1.0.0+1',
      target_sdk: 34,
      min_sdk: 21,
      v1_monetization_policy: 'FREE_ONLY',
      privacy_labels: {
        data_safety_form_ready: true,
        encrypted_in_transit: true,
        in_app_account_deletion_url: 'Settings > Privacy > Delete Account',
        dpdp_act_2023_compliant: true,
      },
      permissions: {
        camera_justification: 'Match screenshot evidence upload only',
        biometric_justification: 'Biometric authorization for wallet cashout',
        notifications_justification: 'Tournament start and match lobby alerts',
        location_collected: false,
        contacts_collected: false,
      },
      age_rating: {
        rating: 'Everyone (E) / PEGI 3+',
        skill_based_gaming_certified: true,
        gambling_elements: false,
      },
      dual_approval_gate_enforced: true,
    },
  });
});
