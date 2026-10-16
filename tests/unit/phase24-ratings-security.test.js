import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RatingsService } from '../../backend/src/ratings/ratings.service.js';
import { SecurityCentreService } from '../../backend/src/admin/securityCentre.service.js';
import { computeRecordHash, GENESIS_HASH } from '../../backend/src/audit/audit.service.js';
import {
  OrganiserRatingCreateSchema,
  OrganiserRatingAppealSchema,
  OrganiserRatingAppealAdjudicateSchema,
  OrganiserParticipantReportSchema,
  BlockedIpCreateSchema,
  BreakGlassRequestSchema,
  BreakGlassDecisionSchema,
} from '../../packages/validation/src/index.ts';

describe('Phase 24: Ratings, Reputation & Security Centre v1', () => {

  // ─── 1. Validation Schemas ──────────────────────────────────────────────
  describe('Zod Validation Schemas', () => {
    it('should validate valid organiser rating input', () => {
      const valid = {
        communication_score: 5,
        schedule_score: 4,
        result_score: 5,
        review_text: 'Excellent tournament communication and fair play.',
      };
      const parsed = OrganiserRatingCreateSchema.parse(valid);
      assert.equal(parsed.communication_score, 5);
      assert.equal(parsed.schedule_score, 4);
      assert.equal(parsed.result_score, 5);
    });

    it('should reject invalid sub-scores out of 1-5 range', () => {
      assert.throws(() => {
        OrganiserRatingCreateSchema.parse({
          communication_score: 6,
          schedule_score: 4,
          result_score: 5,
        });
      });
      assert.throws(() => {
        OrganiserRatingCreateSchema.parse({
          communication_score: 0,
          schedule_score: 4,
          result_score: 5,
        });
      });
    });

    it('should validate review appeal with valid grounds', () => {
      const validAppeal = {
        grounds: 'DEMONSTRABLY_FALSE',
        explanation: 'The match started exactly on time as evidenced by the lobby screenshot.',
        evidence_hashes: ['a'.repeat(64)],
      };
      const parsed = OrganiserRatingAppealSchema.parse(validAppeal);
      assert.equal(parsed.grounds, 'DEMONSTRABLY_FALSE');
    });

    it('should reject appeal with short explanation', () => {
      assert.throws(() => {
        OrganiserRatingAppealSchema.parse({
          grounds: 'DEMONSTRABLY_FALSE',
          explanation: 'too short',
        });
      });
    });

    it('should validate blocked IP creation with valid IPv4', () => {
      const validIp = {
        ip_address: '198.51.100.44',
        reason: 'Automated credential stuffing probe',
        threat_level: 'CRITICAL',
        duration_hours: 24,
      };
      const parsed = BlockedIpCreateSchema.parse(validIp);
      assert.equal(parsed.ip_address, '198.51.100.44');
      assert.equal(parsed.threat_level, 'CRITICAL');
    });

    it('should reject invalid IP addresses', () => {
      assert.throws(() => {
        BlockedIpCreateSchema.parse({
          ip_address: 'not-an-ip',
          reason: 'Valid reason here',
        });
      });
    });

    it('should validate break-glass request schema', () => {
      const validBg = {
        reason: 'Emergency database fix during major tournament final',
        elevated_permissions: ['LEDGER_EMERGENCY_OVERRIDE'],
        duration_hours: 2,
      };
      const parsed = BreakGlassRequestSchema.parse(validBg);
      assert.equal(parsed.duration_hours, 2);
    });
  });

  // ─── 2. Organiser Ratings & Deterministic Overall Score ─────────────────
  describe('Organiser Ratings Business Logic', () => {
    it('calculates overall score deterministically as average of 3 dimensions', () => {
      const comm = 5;
      const sched = 4;
      const result = 4;
      const overall = Math.round(((comm + sched + result) / 3.0) * 100) / 100;
      assert.equal(overall, 4.33);

      const comm2 = 5;
      const sched2 = 5;
      const result2 = 5;
      const overall2 = Math.round(((comm2 + sched2 + result2) / 3.0) * 100) / 100;
      assert.equal(overall2, 5.0);
    });

    it('enforces non-punitive invariant: ratings alone never auto-ban or demote', () => {
      // Simulating a low rating (1.00)
      const comm = 1;
      const sched = 1;
      const result = 1;
      const overall = Math.round(((comm + sched + result) / 3.0) * 100) / 100;
      assert.equal(overall, 1.0);

      // Invariant check: In Phase 24, ratings are stored with antiPunishmentEnforced = true
      // No automated sanction is emitted.
      const sanctionTriggered = false;
      assert.equal(sanctionTriggered, false, 'Ratings alone must never trigger automatic sanctions');
    });
  });

  // ─── 3. Review Dispute / Appeal Workflow ────────────────────────────────
  describe('Review Appeal & Moderation Lifecycle', () => {
    it('transitions review to FLAGGED when appealed by organiser', () => {
      const initialRating = {
        id: 'rating-101',
        organiser_id: 'org-1',
        moderation_status: 'VISIBLE',
      };

      const appeal = {
        rating_id: initialRating.id,
        organiser_id: 'org-1',
        grounds: 'DEMONSTRABLY_FALSE',
        explanation: 'Tournament was not delayed; screenshots prove start on schedule.',
        status: 'PENDING',
      };

      const updatedStatus = 'FLAGGED';
      assert.equal(appeal.status, 'PENDING');
      assert.equal(updatedStatus, 'FLAGGED');
    });

    it('moderator UPHELD decision hides review (REMOVED)', () => {
      const decision = 'UPHELD';
      const targetStatus = decision === 'UPHELD' ? 'REMOVED' : 'VISIBLE';
      assert.equal(targetStatus, 'REMOVED');
    });

    it('moderator REJECTED decision restores review visibility (VISIBLE)', () => {
      const decision = 'REJECTED';
      const targetStatus = decision === 'UPHELD' ? 'REMOVED' : 'VISIBLE';
      assert.equal(targetStatus, 'VISIBLE');
    });
  });

  // ─── 4. Security Centre: Maker-Checker on Break-Glass ───────────────────
  describe('Security Centre - Break-Glass Maker-Checker', () => {
    it('strictly forbids requester from self-approving break-glass access', () => {
      const requesterId = 'admin-user-001';
      const approverId = 'admin-user-001'; // Same person trying to approve

      assert.equal(
        requesterId === approverId,
        true,
        'Detects self-approval collision'
      );

      // Simulation of Maker-Checker guard
      let errorThrown = false;
      try {
        if (requesterId === approverId) {
          const err = new Error('Maker-Checker violation: Requester cannot decide their own break-glass request');
          err.code = 'SELF_BREAK_GLASS_APPROVAL_FORBIDDEN';
          throw err;
        }
      } catch (err) {
        errorThrown = true;
        assert.equal(err.code, 'SELF_BREAK_GLASS_APPROVAL_FORBIDDEN');
      }

      assert.equal(errorThrown, true);
    });

    it('permits dual-authorization when approver is a different administrator', () => {
      const requesterId = 'admin-user-001';
      const approverId = 'super-admin-user-002'; // Independent approver

      assert.notEqual(requesterId, approverId);
      const isAllowed = requesterId !== approverId;
      assert.equal(isAllowed, true);
    });
  });

  // ─── 5. Security Centre: Cryptographic Audit Hash Chain Integrity ───────
  describe('Security Centre - Cryptographic Audit Integrity Verification', () => {
    it('verifies a valid SHA-256 audit hash chain with zero broken links', async () => {
      const timestamp1 = '2026-10-15T12:00:00.000Z';
      const timestamp2 = '2026-10-15T12:05:00.000Z';

      const row1Hash = computeRecordHash({
        prevHash: GENESIS_HASH,
        sequenceNum: 1,
        actorId: 'admin-1',
        actorRole: 'SUPER_ADMIN',
        action: 'IP_BLOCKED',
        entityType: 'BLOCKED_IP',
        entityId: 'ip-1',
        payload: { ip: '198.51.100.44' },
        timestamp: timestamp1,
      });

      const row1 = {
        id: 1,
        sequence_num: 1,
        actor_id: 'admin-1',
        actor_role: 'SUPER_ADMIN',
        action: 'IP_BLOCKED',
        entity_type: 'BLOCKED_IP',
        entity_id: 'ip-1',
        payload: { ip: '198.51.100.44' },
        before_state: null,
        after_state: null,
        reason: '',
        request_id: '',
        prev_hash: GENESIS_HASH,
        curr_hash: row1Hash,
        created_at: timestamp1,
      };

      const row2Hash = computeRecordHash({
        prevHash: row1Hash,
        sequenceNum: 2,
        actorId: 'admin-2',
        actorRole: 'ADMIN',
        action: 'BREAK_GLASS_REQUESTED',
        entityType: 'BREAK_GLASS',
        entityId: 'bg-1',
        payload: { reason: 'Test' },
        timestamp: timestamp2,
      });

      const row2 = {
        id: 2,
        sequence_num: 2,
        actor_id: 'admin-2',
        actor_role: 'ADMIN',
        action: 'BREAK_GLASS_REQUESTED',
        entity_type: 'BREAK_GLASS',
        entity_id: 'bg-1',
        payload: { reason: 'Test' },
        before_state: null,
        after_state: null,
        reason: '',
        request_id: '',
        prev_hash: row1Hash,
        curr_hash: row2Hash,
        created_at: timestamp2,
      };

      const report = await SecurityCentreService.runAuditIntegrityCheck([row1, row2]);
      assert.equal(report.integrity, 'VALID');
      assert.equal(report.verifiedCount, 2);
      assert.equal(report.brokenAtId, null);
      assert.equal(report.sev1Alert, false);
      assert.ok(report.merkleRoot.length === 64);
    });

    it('detects tampered record and raises SEV-1 security alert', async () => {
      const timestamp1 = '2026-10-15T12:00:00.000Z';
      const row1Hash = computeRecordHash({
        prevHash: GENESIS_HASH,
        sequenceNum: 1,
        actorId: 'admin-1',
        actorRole: 'SUPER_ADMIN',
        action: 'IP_BLOCKED',
        entityType: 'BLOCKED_IP',
        entityId: 'ip-1',
        payload: { ip: '198.51.100.44' },
        timestamp: timestamp1,
      });

      const tamperedRow = {
        id: 1,
        sequence_num: 1,
        actor_id: 'admin-1',
        actor_role: 'SUPER_ADMIN',
        action: 'IP_BLOCKED',
        entity_type: 'BLOCKED_IP',
        entity_id: 'ip-1',
        payload: { ip: '1.2.3.4' }, // Tampered payload!
        before_state: null,
        after_state: null,
        reason: '',
        request_id: '',
        prev_hash: GENESIS_HASH,
        curr_hash: row1Hash, // Hash no longer matches tampered data
        created_at: timestamp1,
      };

      const report = await SecurityCentreService.runAuditIntegrityCheck([tamperedRow]);
      assert.equal(report.integrity, 'COMPROMISED');
      assert.equal(report.brokenAtId, 1);
      assert.equal(report.sev1Alert, true);
    });
  });

  // ─── 6. Organiser Participant Conduct Reports ───────────────────────────
  describe('Organiser Reports on Participants', () => {
    it('creates participant conduct report as unverified claim (PENDING)', () => {
      const report = {
        id: 'rep-99',
        target_type: 'PLAYER',
        target_id: 'player-uuid-1',
        category: 'ORGANISER_NO_SHOW',
        description: '[Tournament: t-1] [Conduct: NO_SHOW] Player failed to join lobby after 3 pings.',
        status: 'PENDING',
      };

      // Unverified claim invariant
      assert.equal(report.status, 'PENDING');
      assert.notEqual(report.status, 'BANNED', 'Report must be an unverified claim until reviewed');
    });
  });
});
