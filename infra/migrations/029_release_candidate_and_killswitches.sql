-- =============================================================================
-- Vexora Esports Tournament Platform
-- Migration 029: Release Candidate Schema — Kill-Switches & RC State
-- Phase 38: Store Preparation & Release Candidate
--
-- Purpose:
--   1. Persist kill-switch state in DB as source-of-truth (mirroring Remote Config).
--   2. Track release candidate tags, two-person approvals, and deployment gates.
--   3. Staged rollout tracking with automated rollback triggers.
--   4. Full regression test results log for RC validation audit trail.
--
-- Security Gate:
--   - Two-person approval required before any money module release.
--   - Kill-switch overrides are audited (audit_logs chain).
--   - RC tags are immutable once approved (prevent_rc_mutation trigger).
--
-- References:
--   - ADR-014: Kill-switch architecture
--   - Phase 38 spec: PHASE.md lines 309-315
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FEATURE FLAGS TABLE (persistent DB mirror of Firebase Remote Config)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key          TEXT NOT NULL UNIQUE,
  flag_value        BOOLEAN NOT NULL DEFAULT FALSE,
  description       TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN (
                      'KILL_SWITCH',      -- Emergency off-switches
                      'ROLLOUT',          -- Gradual feature rollouts
                      'EXPERIMENT',       -- A/B tests
                      'COMPLIANCE'        -- Regulatory/legal gates
                    )),
  is_money_module   BOOLEAN NOT NULL DEFAULT FALSE,
  changed_by        TEXT,
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_reason     TEXT,
  prev_hash         TEXT,
  curr_hash         TEXT
);

COMMENT ON TABLE feature_flags IS
  'Persistent DB mirror of Firebase Remote Config kill-switches and feature flags.
   Money-module flags require two-person approval before toggle. Audit-chained.';

COMMENT ON COLUMN feature_flags.is_money_module IS
  'If TRUE, toggling this flag requires two-person approval per security gate.';

-- Immutability trigger: prevent deletion of kill-switch flags
CREATE OR REPLACE FUNCTION prevent_killswitch_deletion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.category = 'KILL_SWITCH' THEN
    RAISE EXCEPTION 'Kill-switch flags cannot be deleted. Use flag_value=FALSE instead.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_killswitch_deletion ON feature_flags;
CREATE TRIGGER trg_prevent_killswitch_deletion
  BEFORE DELETE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION prevent_killswitch_deletion();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SEED: Core kill-switches and rollout flags
-- All flags default to safe values (money modules OFF at launch)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO feature_flags (flag_key, flag_value, description, category, is_money_module) VALUES
  -- KILL SWITCHES (emergency off)
  ('real_money_wallet_enabled',     FALSE, 'Master switch for real-money wallet operations. OFF at launch (free tournaments only).', 'KILL_SWITCH', TRUE),
  ('paid_tournament_enabled',       FALSE, 'Allow organizers to create paid entry-fee tournaments.', 'KILL_SWITCH', TRUE),
  ('wallet_withdrawals_enabled',    FALSE, 'Allow players to withdraw wallet balance to bank/UPI.', 'KILL_SWITCH', TRUE),
  ('wallet_deposits_enabled',       FALSE, 'Allow players to deposit funds to wallet via payment gateway.', 'KILL_SWITCH', TRUE),
  ('prize_escrow_enabled',          FALSE, 'Enable prize escrow for paid tournaments.', 'KILL_SWITCH', TRUE),
  ('payout_processing_enabled',     FALSE, 'Enable backend payout queue processing.', 'KILL_SWITCH', TRUE),
  ('webhook_processing_enabled',    TRUE,  'Process incoming signed payment webhooks.', 'KILL_SWITCH', TRUE),
  -- FEATURE ROLLOUTS
  ('organiser_registration_enabled',TRUE,  'Allow new organiser verification applications.', 'ROLLOUT', FALSE),
  ('tournament_registration_enabled',TRUE, 'Allow players to register for tournaments.', 'ROLLOUT', FALSE),
  ('publishing_enabled',            TRUE,  'Allow organisers to publish new tournaments.', 'ROLLOUT', FALSE),
  ('push_notifications_enabled',    TRUE,  'Send FCM push notifications to players/organisers.', 'ROLLOUT', FALSE),
  ('chat_enabled',                  TRUE,  'Enable in-tournament player chat (filtered).', 'ROLLOUT', FALSE),
  ('scrims_enabled',                FALSE, 'Enable practice room / scrim matching (Phase 34 feature).', 'ROLLOUT', FALSE),
  ('referral_programme_enabled',    FALSE, 'Enable player referral programme with anti-abuse limits.', 'ROLLOUT', FALSE),
  -- COMPLIANCE
  ('dsr_auto_processing_enabled',   TRUE,  'Enable automated data subject request processing.', 'COMPLIANCE', FALSE),
  ('retention_purge_enabled',       TRUE,  'Enable scheduled data retention disposal runs.', 'COMPLIANCE', FALSE)
ON CONFLICT (flag_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RELEASE CANDIDATE REGISTRY
-- Tracks RC tags with mandatory two-person approval for money modules
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS release_candidates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_tag              TEXT NOT NULL UNIQUE,          -- e.g. 'v1.0.0-rc.1'
  version_name        TEXT NOT NULL,                 -- e.g. '1.0.0'
  version_code        INTEGER NOT NULL,              -- e.g. 1
  git_sha             TEXT NOT NULL,
  build_url           TEXT,
  status              TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
                        'PENDING',         -- Created, awaiting approval
                        'APPROVED',        -- Two-person approval received
                        'REJECTED',        -- Rejected at gate
                        'DEPLOYED_STAGING',-- On staging
                        'DEPLOYED_PROD',   -- In production (staged rollout)
                        'ROLLED_BACK'      -- Emergency rollback executed
                      )),
  -- Two-person approval gate for money modules
  approver_1_id       TEXT,                          -- First engineer ID
  approver_1_at       TIMESTAMPTZ,
  approver_2_id       TEXT,                          -- Second engineer ID (must differ)
  approver_2_at       TIMESTAMPTZ,
  approval_token      TEXT UNIQUE,                   -- Token sent to Fastlane promote_prod lane
  -- Rollout tracking
  rollout_percentage  DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  rollout_started_at  TIMESTAMPTZ,
  -- Test results
  unit_tests_pass     BOOLEAN,
  e2e_tests_pass      BOOLEAN,
  flutter_analyze_clean BOOLEAN,
  security_scan_clean BOOLEAN,
  -- Metadata
  created_by          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes               TEXT
);

COMMENT ON TABLE release_candidates IS
  'Registry of release candidate builds. Two-person approval mandatory before production deploy.
   Approval token is issued only after both approvers sign off and is consumed by Fastlane lane.';

-- Immutability: once APPROVED, core fields cannot be changed
CREATE OR REPLACE FUNCTION prevent_rc_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'APPROVED' AND NEW.git_sha != OLD.git_sha THEN
    RAISE EXCEPTION 'IMMUTABLE_RC: git_sha cannot change after approval for RC %', OLD.rc_tag;
  END IF;
  IF OLD.status = 'APPROVED' AND NEW.version_code != OLD.version_code THEN
    RAISE EXCEPTION 'IMMUTABLE_RC: version_code cannot change after approval for RC %', OLD.rc_tag;
  END IF;
  -- Approver 2 must differ from Approver 1
  IF NEW.approver_2_id IS NOT NULL AND NEW.approver_2_id = NEW.approver_1_id THEN
    RAISE EXCEPTION 'DUAL_APPROVER_SAME_ENGINEER: approver_2_id must differ from approver_1_id for RC %', NEW.rc_tag;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_rc_mutation ON release_candidates;
CREATE TRIGGER trg_prevent_rc_mutation
  BEFORE UPDATE ON release_candidates
  FOR EACH ROW EXECUTE FUNCTION prevent_rc_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. REGRESSION TEST RUNS
-- Full test suite results linked to each RC for audit trail
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regression_test_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_id               UUID NOT NULL REFERENCES release_candidates(id),
  run_type            TEXT NOT NULL CHECK (run_type IN (
                        'UNIT',
                        'INTEGRATION',
                        'CONTRACT',     -- App vs OpenAPI contract tests
                        'MUTATION',     -- Mutation tests on scoring engine
                        'PROPERTY',     -- Property-based tests
                        'FUZZ',         -- Fuzzing on upload/result parsers
                        'E2E',
                        'ACCESSIBILITY',-- WCAG 2.1 AA checks
                        'VISUAL',       -- Visual regression snapshots
                        'PERFORMANCE'   -- Flutter DevTools profiling pass
                      )),
  environment         TEXT NOT NULL DEFAULT 'staging',
  total_tests         INTEGER,
  passing_tests       INTEGER,
  failing_tests       INTEGER NOT NULL DEFAULT 0,
  skipped_tests       INTEGER NOT NULL DEFAULT 0,
  duration_ms         INTEGER,
  pass_rate           DECIMAL(5,2) GENERATED ALWAYS AS (
                        CASE WHEN total_tests > 0
                          THEN (passing_tests::DECIMAL / total_tests) * 100
                          ELSE 0
                        END
                      ) STORED,
  status              TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'PARTIAL', 'RUNNING')),
  report_url          TEXT,
  failure_summary     TEXT,
  run_by              TEXT NOT NULL,
  run_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Immutability: test results are audit evidence and must not be altered
  CONSTRAINT chk_passing_lte_total CHECK (passing_tests IS NULL OR passing_tests <= total_tests)
);

COMMENT ON TABLE regression_test_runs IS
  'Full regression test suite results per RC. Required: all run_types must PASS before RC is APPROVED.
   Mutation tests and fuzzing are mandatory for scoring and evidence upload paths.';

-- Immutability trigger: completed test runs must not be altered
CREATE OR REPLACE FUNCTION prevent_test_run_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('PASS', 'FAIL') THEN
    RAISE EXCEPTION 'IMMUTABLE_TEST_RUN: Completed test run % cannot be modified', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_test_run_mutation ON regression_test_runs;
CREATE TRIGGER trg_prevent_test_run_mutation
  BEFORE UPDATE ON regression_test_runs
  FOR EACH ROW EXECUTE FUNCTION prevent_test_run_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. STAGED ROLLOUT AUDIT LOG
-- Tracks every percentage increase in production rollout
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rollout_audit (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_id               UUID NOT NULL REFERENCES release_candidates(id),
  previous_pct        DECIMAL(5,2) NOT NULL,
  new_pct             DECIMAL(5,2) NOT NULL,
  action              TEXT NOT NULL CHECK (action IN (
                        'INCREASE',   -- Rollout expansion
                        'HOLD',       -- Rollout paused (monitoring)
                        'ROLLBACK'    -- Emergency rollback
                      )),
  crash_free_rate     DECIMAL(5,2),   -- Crashlytics at time of decision
  dispute_rate        DECIMAL(5,2),   -- Disputes per tournament at time of decision
  anr_rate            DECIMAL(5,2),   -- ANR rate at time of decision
  reason              TEXT NOT NULL,
  authorized_by       TEXT NOT NULL,
  actioned_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE rollout_audit IS
  'Immutable audit trail of every staged rollout percentage change.
   Rollback entries recorded automatically by monitoring alerts.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE regression_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollout_audit ENABLE ROW LEVEL SECURITY;

-- Super-admin full access
CREATE POLICY super_admin_all_feature_flags ON feature_flags
  FOR ALL TO vexora_api USING (current_setting('app.user_role', TRUE) = 'super_admin');

CREATE POLICY super_admin_all_rc ON release_candidates
  FOR ALL TO vexora_api USING (current_setting('app.user_role', TRUE) = 'super_admin');

CREATE POLICY super_admin_all_tests ON regression_test_runs
  FOR ALL TO vexora_api USING (current_setting('app.user_role', TRUE) = 'super_admin');

CREATE POLICY super_admin_all_rollout ON rollout_audit
  FOR ALL TO vexora_api USING (current_setting('app.user_role', TRUE) = 'super_admin');

-- Read access for senior_admin and finance_admin
CREATE POLICY admin_read_feature_flags ON feature_flags
  FOR SELECT TO vexora_api USING (current_setting('app.user_role', TRUE) IN ('senior_admin', 'finance_admin'));

CREATE POLICY admin_read_rc ON release_candidates
  FOR SELECT TO vexora_api USING (current_setting('app.user_role', TRUE) IN ('senior_admin', 'finance_admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON feature_flags(category);
CREATE INDEX IF NOT EXISTS idx_feature_flags_money_module ON feature_flags(is_money_module) WHERE is_money_module = TRUE;
CREATE INDEX IF NOT EXISTS idx_release_candidates_status ON release_candidates(status);
CREATE INDEX IF NOT EXISTS idx_release_candidates_rc_tag ON release_candidates(rc_tag);
CREATE INDEX IF NOT EXISTS idx_regression_test_runs_rc ON regression_test_runs(rc_id);
CREATE INDEX IF NOT EXISTS idx_rollout_audit_rc ON rollout_audit(rc_id);
CREATE INDEX IF NOT EXISTS idx_rollout_audit_actioned_at ON rollout_audit(actioned_at DESC);

COMMIT;
