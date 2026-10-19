-- =============================================================================
-- Vexora Esports Tournament Platform
-- Migration 030: Closed Beta & Pilot Tournaments Schema
-- Phase 39: Closed Beta & Pilot Tournaments
--
-- Purpose:
--   1. Manage closed beta tester cohort (20-50 players, 2-3 verified organisers).
--   2. Orchestrate and record 2-3 complete pilot tournaments end-to-end.
--   3. Standby moderator assignment and live incident channel tracking.
--   4. Closed beta feedback collection and GitHub issue synchronization.
--   5. Incident response runbook rehearsals and killswitch audit logging.
--
-- Security Gate:
--   - Incident runbook rehearsed with confirmed on-call and escalation contacts.
--   - Zero unresolved financial discrepancies (SUM(amount) = 0).
--   - Crash-free user rate >= 99.50% and dispute rate <= 1.50%.
--
-- References:
--   - Section 32: Closed beta & pilot tournament playbooks
--   - Section 35: Launch criteria & operational checklists
--   - Section 39: Phase 10 (Closed Beta & Pilot)
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. BETA TESTERS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beta_testers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE SET NULL,
  email                 TEXT NOT NULL UNIQUE,
  display_name          TEXT NOT NULL,
  phone                 TEXT,
  tester_type           TEXT NOT NULL CHECK (tester_type IN ('PLAYER', 'ORGANISER', 'MODERATOR')),
  distribution_channel  TEXT NOT NULL CHECK (distribution_channel IN (
                          'ANDROID_PLAY_INTERNAL',
                          'FIREBASE_APP_DISTRIBUTION',
                          'IOS_TESTFLIGHT'
                        )),
  device_model          TEXT,
  os_version            TEXT,
  nda_signed_at         TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'INVITED' CHECK (status IN (
                          'INVITED',
                          'ACTIVE',
                          'REVOKED',
                          'COMPLETED'
                        )),
  invitation_code       TEXT NOT NULL UNIQUE,
  enrolled_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_beta_testers_status ON beta_testers(status);
CREATE INDEX IF NOT EXISTS idx_beta_testers_type ON beta_testers(tester_type);
CREATE INDEX IF NOT EXISTS idx_beta_testers_code ON beta_testers(invitation_code);

COMMENT ON TABLE beta_testers IS
  'Whitelisted closed beta cohort members (20-50 players, 2-3 verified organisers).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PILOT TOURNAMENTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pilot_tournaments (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id                 UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE UNIQUE,
  pilot_code                    TEXT NOT NULL UNIQUE, -- e.g. PILOT-BGMI-001, PILOT-FF-002, PILOT-CODM-003
  game_title                    TEXT NOT NULL,
  standby_moderator_id          UUID REFERENCES users(id),
  standby_moderator_name        TEXT NOT NULL,
  incident_channel              TEXT NOT NULL, -- e.g. #incident-pilot-bgmi-001
  incident_phone_bridge         TEXT,
  target_participants           INTEGER NOT NULL DEFAULT 16 CHECK (target_participants > 0),
  actual_participants           INTEGER NOT NULL DEFAULT 0 CHECK (actual_participants >= 0),
  matches_completed             INTEGER NOT NULL DEFAULT 0 CHECK (matches_completed >= 0),
  disputes_raised               INTEGER NOT NULL DEFAULT 0 CHECK (disputes_raised >= 0),
  disputes_resolved             INTEGER NOT NULL DEFAULT 0 CHECK (disputes_resolved >= 0),
  avg_resolution_minutes        NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  financial_discrepancy_cents   NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  incident_count                INTEGER NOT NULL DEFAULT 0 CHECK (incident_count >= 0),
  crash_free_rate               NUMERIC(5,2) NOT NULL DEFAULT 100.00 CHECK (crash_free_rate BETWEEN 0.00 AND 100.00),
  status                        TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN (
                                  'SCHEDULED',
                                  'IN_PROGRESS',
                                  'EVALUATED',
                                  'SETTLED',
                                  'FAILED'
                                )),
  evaluation_notes              TEXT,
  started_at                    TIMESTAMPTZ,
  completed_at                  TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_tournaments_code ON pilot_tournaments(pilot_code);
CREATE INDEX IF NOT EXISTS idx_pilot_tournaments_status ON pilot_tournaments(status);

COMMENT ON TABLE pilot_tournaments IS
  'Tracks complete pilot tournament executions with dedicated standby moderators and incident channels.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. BETA FEEDBACK TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beta_feedback (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_id             UUID REFERENCES beta_testers(id) ON DELETE SET NULL,
  author_email          TEXT NOT NULL,
  feedback_type         TEXT NOT NULL CHECK (feedback_type IN (
                          'BUG',
                          'FEATURE_REQUEST',
                          'UX_FRICTION',
                          'PERFORMANCE',
                          'CRASH'
                        )),
  severity              TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN (
                          'LOW',
                          'MEDIUM',
                          'HIGH',
                          'CRITICAL'
                        )),
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL,
  screen_name           TEXT,
  device_telemetry      JSONB NOT NULL DEFAULT '{}'::jsonb,
  github_issue_number   INTEGER,
  github_issue_url      TEXT,
  status                TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
                          'SUBMITTED',
                          'TRIAGED',
                          'IN_PROGRESS',
                          'RESOLVED',
                          'CLOSED'
                        )),
  resolution_notes      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_type ON beta_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback(status);

COMMENT ON TABLE beta_feedback IS
  'Closed beta feedback queue synced to the platform GitHub repository.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. INCIDENT REHEARSALS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incident_rehearsals (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name               TEXT NOT NULL,
  scenario_type               TEXT NOT NULL CHECK (scenario_type IN (
                                'LEDGER_HOLD_FAILOVER',
                                'WEBHOOK_OUTAGE',
                                'DISPUTE_SPIKE',
                                'KILLSWITCH_TRIGGER',
                                'DSR_ERASURE_DRILL'
                              )),
  lead_engineer               TEXT NOT NULL,
  standby_moderator           TEXT NOT NULL,
  on_call_contact             TEXT NOT NULL,
  escalation_contact          TEXT NOT NULL,
  time_to_detect_seconds      INTEGER NOT NULL CHECK (time_to_detect_seconds >= 0),
  time_to_mitigate_seconds    INTEGER NOT NULL CHECK (time_to_mitigate_seconds >= 0),
  outcome                     TEXT NOT NULL CHECK (outcome IN (
                                'SUCCESS',
                                'PASSED_WITH_OBSERVATIONS',
                                'FAILED'
                              )),
  killswitch_verified         BOOLEAN NOT NULL DEFAULT TRUE,
  runbook_version             TEXT NOT NULL DEFAULT 'v1.0.0',
  notes                       TEXT,
  rehearsed_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_rehearsals_type ON incident_rehearsals(scenario_type);

COMMENT ON TABLE incident_rehearsals IS
  'Audit log of rehearsed incident response scenarios validating kill-switches and on-call escalation.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INITIAL SEEDS FOR CLOSED BETA (Synthetic fixtures only)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO beta_testers (email, display_name, tester_type, distribution_channel, device_model, os_version, nda_signed_at, status, invitation_code) VALUES
  ('beta.organiser1@vexora.gg', 'Elite Gaming Org', 'ORGANISER', 'ANDROID_PLAY_INTERNAL', 'Pixel 8 Pro', 'Android 14', now() - INTERVAL '5 days', 'ACTIVE', 'VEXORA-BETA-ORG-01'),
  ('beta.organiser2@vexora.gg', 'Krafton Community Hub', 'ORGANISER', 'ANDROID_PLAY_INTERNAL', 'Galaxy S23', 'Android 14', now() - INTERVAL '4 days', 'ACTIVE', 'VEXORA-BETA-ORG-02'),
  ('beta.moderator1@vexora.gg', 'Priya Adjudicator', 'MODERATOR', 'ANDROID_PLAY_INTERNAL', 'OnePlus 11', 'Android 13', now() - INTERVAL '5 days', 'ACTIVE', 'VEXORA-BETA-MOD-01'),
  ('beta.player01@vexora.gg', 'ShadowSniper', 'PLAYER', 'ANDROID_PLAY_INTERNAL', 'Galaxy A54', 'Android 13', now() - INTERVAL '3 days', 'ACTIVE', 'VEXORA-BETA-PL-001'),
  ('beta.player02@vexora.gg', 'GhostRider', 'PLAYER', 'ANDROID_PLAY_INTERNAL', 'Redmi Note 12', 'Android 12', now() - INTERVAL '3 days', 'ACTIVE', 'VEXORA-BETA-PL-002'),
  ('beta.player03@vexora.gg', 'HydraLeader', 'PLAYER', 'ANDROID_PLAY_INTERNAL', 'Realme GT Neo', 'Android 13', now() - INTERVAL '3 days', 'ACTIVE', 'VEXORA-BETA-PL-003'),
  ('beta.player04@vexora.gg', 'ApexPredator', 'PLAYER', 'ANDROID_PLAY_INTERNAL', 'Pixel 7a', 'Android 14', now() - INTERVAL '3 days', 'ACTIVE', 'VEXORA-BETA-PL-004'),
  ('beta.player05@vexora.gg', 'ViperQueen', 'PLAYER', 'FIREBASE_APP_DISTRIBUTION', 'OnePlus Nord', 'Android 12', now() - INTERVAL '2 days', 'ACTIVE', 'VEXORA-BETA-PL-005'),
  ('beta.player06@vexora.gg', 'PhantomStrike', 'PLAYER', 'FIREBASE_APP_DISTRIBUTION', 'Galaxy M34', 'Android 13', now() - INTERVAL '2 days', 'ACTIVE', 'VEXORA-BETA-PL-006'),
  ('beta.player07@vexora.gg', 'BulletProof', 'PLAYER', 'FIREBASE_APP_DISTRIBUTION', 'Poco X5 Pro', 'Android 12', now() - INTERVAL '2 days', 'ACTIVE', 'VEXORA-BETA-PL-007'),
  ('beta.player08@vexora.gg', 'CrimsonBlade', 'PLAYER', 'ANDROID_PLAY_INTERNAL', 'Vivo V29', 'Android 13', now() - INTERVAL '2 days', 'ACTIVE', 'VEXORA-BETA-PL-008'),
  ('beta.player09@vexora.gg', 'TitanSlayer', 'PLAYER', 'ANDROID_PLAY_INTERNAL', 'Moto G84', 'Android 13', now() - INTERVAL '2 days', 'ACTIVE', 'VEXORA-BETA-PL-009'),
  ('beta.player10@vexora.gg', 'ThunderBolt', 'PLAYER', 'ANDROID_PLAY_INTERNAL', 'Galaxy S21 FE', 'Android 14', now() - INTERVAL '2 days', 'ACTIVE', 'VEXORA-BETA-PL-010')
ON CONFLICT (email) DO NOTHING;

-- Initial incident rehearsal audit log
INSERT INTO incident_rehearsals (scenario_name, scenario_type, lead_engineer, standby_moderator, on_call_contact, escalation_contact, time_to_detect_seconds, time_to_mitigate_seconds, outcome, killswitch_verified, runbook_version, notes) VALUES
  (
    'Pilot Tournaments Pre-Launch Rehearsal: Wallet Emergency Killswitch & Dispute Spike',
    'KILLSWITCH_TRIGGER',
    'Siddharth Roy (lead-infra@vexora.gg)',
    'Priyadarshini Mohanty (standby-mod@vexora.gg)',
    '+91-98765-43210 (On-Call SRE Bridge)',
    '+91-98765-01234 (VP Engineering / Grievance Officer)',
    14,
    42,
    'SUCCESS',
    TRUE,
    'v1.0.0-phase39',
    'Simulated 5 concurrent duplicate disputes and emergency wallet killswitch flip. Double-entry ledger maintained balance equilibrium (zero variance). Remote Config propagated within 42 seconds.'
  ),
  (
    'Statutory DSR Data Erasure Drill (DPDP Act 2023)',
    'DSR_ERASURE_DRILL',
    'Ananya Mishra (compliance-lead@vexora.gg)',
    'Priyadarshini Mohanty (Grievance Officer)',
    '+91-98765-43210 (On-Call SRE Bridge)',
    '+91-98765-01234 (Legal Counsel)',
    8,
    30,
    'SUCCESS',
    TRUE,
    'v1.0.0-phase39',
    'Data subject request for account erasure processed successfully. PII scrubbed from profile/sessions while 5-year financial ledger entries were preserved per statutory PMLA requirement.'
  )
ON CONFLICT DO NOTHING;

COMMIT;
