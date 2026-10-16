/**
 * Vexora Phase 22 — Unit & Security Test Suite
 * Organiser Verification, Tiers & Trust Profiles
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 10, 39 Phase 5)
 *
 * Tests:
 *   1. Security Gate: Moderator cannot access KYC application details (403 FORBIDDEN_ROLE)
 *   2. Security Gate: Player cannot access KYC application details (403 FORBIDDEN_ROLE)
 *   3. Security Gate: Admin accessing KYC without reason is rejected (400 REASON_REQUIRED)
 *   4. Security Gate: formatPublicProfile strictly projects public metrics and hides all private KYC PII
 *   5. Exit Criterion: Starter tier organiser cannot exceed 32 participants cap (TIER_CAP_EXCEEDED)
 *   6. Exit Criterion: Starter tier organiser passes check when within 32 participants
 *   7. Exit Criterion: Starter tier cannot exceed 1 concurrent active tournament (CONCURRENT_LIMIT_EXCEEDED)
 *   8. Exit Criterion: Publishing hold strictly blocks tournament creation/publishing (PUBLISHING_HELD)
 *   9. Exit Criterion: Automated publishing hold triggers when dispute rate exceeds 5.0%
 *  10. Exit Criterion: Automated publishing hold triggers when trust score drops below 70.0
 *  11. Validation: OrganiserApplicationCreateSchema accepts valid inputs & validates SHA-256 seal
 *  12. Validation: OrganiserApplicationCreateSchema rejects invalid SHA-256 hash length/format
 *  13. Validation: OrganiserReviewDecisionSchema requires rejection_reason when decision is REJECT
 *  14. Validation: OrganiserTierUpdateSchema accepts valid tiers and reasons
 *  15. Validation: OrganiserPublishingHoldSchema accepts HOLD and RELEASE
 *  16. Validation: KYCAccessQuerySchema enforces minimum 5 characters reason
 *  17. Routes: organisersRouter mounts all verification and tier management endpoints
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { OrganiserVerificationService } from '../../backend/src/organisers/organiserVerification.service.js';
import { organisersRouter } from '../../backend/src/organisers/organisers.routes.js';
import { closePool } from '../../backend/src/common/database.js';
import {
  OrganiserApplicationCreateSchema,
  OrganiserReviewDecisionSchema,
  OrganiserTierUpdateSchema,
  OrganiserPublishingHoldSchema,
  KYCAccessQuerySchema,
} from '../../packages/validation/src/index.ts';

const DUMMY_ORGANISER_ID = '00000000-0000-0000-0000-000000000001';
const DUMMY_ADMIN_ID = '00000000-0000-0000-0000-000000000099';
const DUMMY_MODERATOR_ID = '00000000-0000-0000-0000-000000000055';
const VALID_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('Phase 22: Organiser Verification & Tiers', () => {

  // ─── 1. Security Gate: Role-Based KYC Access ───────────────────────────────
  test('Security Gate: Moderator cannot access KYC application details (FORBIDDEN_ROLE)', async () => {
    const moderator = { id: DUMMY_MODERATOR_ID, role: 'MODERATOR' };

    await assert.rejects(
      async () => {
        await OrganiserVerificationService.getApplicationForReview(
          '00000000-0000-0000-0000-000000000010',
          moderator,
          'Reviewing organiser details'
        );
      },
      (err) => {
        assert.equal(err.code, 'FORBIDDEN_ROLE');
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Moderators and unauthorized roles cannot inspect KYC documents/i);
        return true;
      }
    );
  });

  test('Security Gate: Player cannot access KYC application details (FORBIDDEN_ROLE)', async () => {
    const player = { id: DUMMY_ORGANISER_ID, role: 'PLAYER' };

    await assert.rejects(
      async () => {
        await OrganiserVerificationService.getApplicationForReview(
          '00000000-0000-0000-0000-000000000010',
          player,
          'Curious player'
        );
      },
      (err) => {
        assert.equal(err.code, 'FORBIDDEN_ROLE');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  test('Security Gate: Admin accessing KYC without reason is rejected (REASON_REQUIRED)', async () => {
    const admin = { id: DUMMY_ADMIN_ID, role: 'ADMIN' };

    await assert.rejects(
      async () => {
        await OrganiserVerificationService.getApplicationForReview(
          '00000000-0000-0000-0000-000000000010',
          admin,
          '' // Empty reason
        );
      },
      (err) => {
        assert.equal(err.code, 'REASON_REQUIRED');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  // ─── 2. Security Gate: Data Minimisation on Public Profile ─────────────────
  test('Security Gate: formatPublicProfile strictly projects public metrics and hides all private KYC PII', () => {
    const rawDatabaseRow = {
      user_id: DUMMY_ORGANISER_ID,
      business_name: 'Apex Esports Org',
      tier: 'VERIFIED',
      kyc_status: 'APPROVED',
      trust_score: '98.50',
      total_tournaments: 14,
      completed_tournaments: 12,
      cancelled_tournaments: 2,
      disputed_tournaments: 0,
      dispute_rate: '0.0000',
      verified_at: '2026-10-14T10:00:00Z',
      publishing_held: false,
      max_concurrent_tournaments: 5,
      max_participants_cap: 256,
      social_links: '{"twitter":"@apex_esports"}',
      // SENSITIVE PII FIELDS THAT MUST NEVER LEAK:
      id_document_number: 'DOC-99214-X',
      id_document_front_s3_key: 's3://kyc/passports/front_secret.jpg',
      id_document_number_encrypted: 'aes256:iv:tag:cipher',
      contact_phone: '+91 98765 43210',
      tax_id: 'TAX-12345',
      address: 'Private Residence, Secret City',
    };

    const publicProfile = OrganiserVerificationService.formatPublicProfile(rawDatabaseRow, DUMMY_ORGANISER_ID);

    assert.equal(publicProfile.organiser_id, DUMMY_ORGANISER_ID);
    assert.equal(publicProfile.business_name, 'Apex Esports Org');
    assert.equal(publicProfile.tier, 'VERIFIED');
    assert.equal(publicProfile.trust_score, 98.5);
    assert.equal(publicProfile.is_verified, true);
    assert.equal(publicProfile.max_participants_cap, 256);
    assert.equal(publicProfile.max_concurrent_tournaments, 5);

    // Strict assertions: No sensitive PII fields in public projection
    assert.equal(publicProfile.id_document_number, undefined);
    assert.equal(publicProfile.id_document_front_s3_key, undefined);
    assert.equal(publicProfile.id_document_number_encrypted, undefined);
    assert.equal(publicProfile.contact_phone, undefined);
    assert.equal(publicProfile.tax_id, undefined);
    assert.equal(publicProfile.address, undefined);
  });

  // ─── 3. Exit Criteria: Tier-Gated Publishing & Capacity Caps ───────────────
  test('Exit Criterion: Starter tier organiser cannot exceed 32 participants cap (TIER_CAP_EXCEEDED)', () => {
    const starterProfile = OrganiserVerificationService.formatPublicProfile(null, DUMMY_ORGANISER_ID);

    assert.throws(
      () => {
        OrganiserVerificationService.validatePublishingEligibility(
          starterProfile,
          { max_participants: 64 }, // 64 exceeds Starter cap of 32
          0
        );
      },
      (err) => {
        assert.equal(err.code, 'TIER_CAP_EXCEEDED');
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /allows maximum 32 participants/i);
        return true;
      }
    );
  });

  test('Exit Criterion: Starter tier organiser passes check when within 32 participants', () => {
    const starterProfile = OrganiserVerificationService.formatPublicProfile(null, DUMMY_ORGANISER_ID);

    const result = OrganiserVerificationService.validatePublishingEligibility(
      starterProfile,
      { max_participants: 16 },
      0
    );

    assert.equal(result.eligible, true);
    assert.equal(result.tier, 'STARTER');
    assert.equal(result.max_participants_cap, 32);
    assert.equal(result.max_concurrent_tournaments, 1);
  });

  test('Exit Criterion: Starter tier cannot exceed 1 concurrent active tournament (CONCURRENT_LIMIT_EXCEEDED)', () => {
    const starterProfile = OrganiserVerificationService.formatPublicProfile(null, DUMMY_ORGANISER_ID);

    assert.throws(
      () => {
        OrganiserVerificationService.validatePublishingEligibility(
          starterProfile,
          { max_participants: 16 },
          1 // Already has 1 active tournament
        );
      },
      (err) => {
        assert.equal(err.code, 'CONCURRENT_LIMIT_EXCEEDED');
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /maximum of 1 concurrent active tournaments/i);
        return true;
      }
    );
  });

  test('Exit Criterion: Active publishing hold strictly blocks tournament creation/publishing (PUBLISHING_HELD)', () => {
    const heldProfile = {
      ...OrganiserVerificationService.formatPublicProfile(null, DUMMY_ORGANISER_ID),
      publishing_held: true,
      publishing_hold_reason: 'Dispute threshold exceeded',
    };

    assert.throws(
      () => {
        OrganiserVerificationService.validatePublishingEligibility(heldProfile, { max_participants: 16 }, 0);
      },
      (err) => {
        assert.equal(err.code, 'PUBLISHING_HELD');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  // ─── 4. Exit Criteria: Automated Publishing Hold Evaluation ────────────────
  test('Exit Criterion: Automated publishing hold triggers when dispute rate exceeds 5.0%', () => {
    // 2 disputed out of 20 total finished = 10.0% dispute rate (> 5.0% threshold)
    const highDisputeProfile = {
      completed_tournaments: 18,
      disputed_tournaments: 2,
      trust_score: 85.0,
      publishing_held: false,
    };

    const evaluation = OrganiserVerificationService.evaluateDisputeRateHold(highDisputeProfile);
    assert.equal(evaluation.shouldHold, true);
    assert.match(evaluation.holdReason, /Dispute rate \(10\.0%\) exceeds safety threshold/i);
  });

  test('Exit Criterion: Automated publishing hold triggers when trust score drops below 70.0', () => {
    const lowTrustProfile = {
      completed_tournaments: 5,
      disputed_tournaments: 0,
      trust_score: 65.0, // Below 70.0 threshold
      publishing_held: false,
    };

    const evaluation = OrganiserVerificationService.evaluateDisputeRateHold(lowTrustProfile);
    assert.equal(evaluation.shouldHold, true);
    assert.match(evaluation.holdReason, /Trust score \(65\) fell below minimum safety threshold/i);
  });

  test('Exit Criterion: Healthy organiser is not held', () => {
    const healthyProfile = {
      completed_tournaments: 25,
      disputed_tournaments: 0,
      trust_score: 99.0,
      publishing_held: false,
    };

    const evaluation = OrganiserVerificationService.evaluateDisputeRateHold(healthyProfile);
    assert.equal(evaluation.shouldHold, false);
    assert.equal(evaluation.holdReason, null);
  });

  // ─── 5. Validation Schemas ────────────────────────────────────────────────
  test('Validation: OrganiserApplicationCreateSchema accepts valid inputs & validates SHA-256 seal', () => {
    const validPayload = {
      business_name: 'Apex Esports League',
      contact_email: 'admin@apex-esports.gg',
      contact_phone: '+91 98765 43210',
      country: 'IND',
      id_document_type: 'NATIONAL_ID',
      id_document_number: 'DOC-12345-X',
      id_document_front_s3_key: 'kyc/documents/front_001.jpg',
      id_document_front_hash: VALID_SHA256,
      tax_id: 'GSTIN29ABCDE1234F1Z5',
      address: '123 Gamer Avenue, Bengaluru, India',
    };

    const parsed = OrganiserApplicationCreateSchema.parse(validPayload);
    assert.equal(parsed.business_name, 'Apex Esports League');
    assert.equal(parsed.id_document_front_hash, VALID_SHA256);
  });

  test('Validation: OrganiserApplicationCreateSchema rejects invalid SHA-256 hash length/format', () => {
    const invalidPayload = {
      business_name: 'Apex Esports League',
      contact_email: 'admin@apex-esports.gg',
      contact_phone: '+91 98765 43210',
      country: 'IND',
      id_document_type: 'NATIONAL_ID',
      id_document_number: 'DOC-12345-X',
      id_document_front_s3_key: 'kyc/documents/front_001.jpg',
      id_document_front_hash: 'not-a-valid-sha256-hash', // Invalid
    };

    assert.throws(() => {
      OrganiserApplicationCreateSchema.parse(invalidPayload);
    });
  });

  test('Validation: OrganiserReviewDecisionSchema requires rejection_reason when decision is REJECT', () => {
    const validReject = {
      decision: 'REJECT',
      rejection_reason: 'Government ID document appears altered or expired',
    };
    assert.doesNotThrow(() => {
      OrganiserReviewDecisionSchema.parse(validReject);
    });

    const invalidReject = {
      decision: 'REJECT',
      // Missing rejection_reason
    };
    assert.throws(() => {
      OrganiserReviewDecisionSchema.parse(invalidReject);
    });
  });

  test('Validation: OrganiserTierUpdateSchema accepts valid tiers and reasons', () => {
    const valid = {
      tier: 'PARTNER',
      reason: 'Official partner tournament organizer promotion approved',
    };
    const parsed = OrganiserTierUpdateSchema.parse(valid);
    assert.equal(parsed.tier, 'PARTNER');
  });

  test('Validation: OrganiserPublishingHoldSchema accepts HOLD and RELEASE', () => {
    const hold = { action: 'HOLD', reason: 'Emergency dispute investigation' };
    const release = { action: 'RELEASE', reason: 'Disputes resolved amicably' };

    assert.equal(OrganiserPublishingHoldSchema.parse(hold).action, 'HOLD');
    assert.equal(OrganiserPublishingHoldSchema.parse(release).action, 'RELEASE');
  });

  test('Validation: KYCAccessQuerySchema enforces minimum 5 characters reason', () => {
    assert.doesNotThrow(() => {
      KYCAccessQuerySchema.parse({ reason: 'Audit review for Tier 2 application' });
    });

    assert.throws(() => {
      KYCAccessQuerySchema.parse({ reason: 'no' });
    });
  });

  // ─── 6. Route Mounting Checks ─────────────────────────────────────────────
  test('Routes: organisersRouter mounts all verification and tier management endpoints', () => {
    const routes = [];
    for (const layer of organisersRouter.stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        routes.push({ path: layer.route.path, methods });
      }
    }

    const hasApply = routes.some((r) => r.path === '/apply' && r.methods.includes('POST'));
    const hasOwnApp = routes.some((r) => r.path === '/me/application' && r.methods.includes('GET'));
    const hasAdminApps = routes.some((r) => r.path === '/admin/applications' && r.methods.includes('GET'));
    const hasInspectApp = routes.some((r) => r.path === '/admin/applications/:id' && r.methods.includes('GET'));
    const hasReviewApp = routes.some((r) => r.path === '/admin/applications/:id/review' && r.methods.includes('POST'));
    const hasTierUpdate = routes.some((r) => r.path === '/admin/:id/tier' && r.methods.includes('PATCH'));
    const hasPublishingHold = routes.some((r) => r.path === '/admin/:id/publishing-hold' && r.methods.includes('POST'));
    const hasPublicProfile = routes.some((r) => r.path === '/:id' && r.methods.includes('GET'));

    assert.equal(hasApply, true, 'organisersRouter must mount POST /apply');
    assert.equal(hasOwnApp, true, 'organisersRouter must mount GET /me/application');
    assert.equal(hasAdminApps, true, 'organisersRouter must mount GET /admin/applications');
    assert.equal(hasInspectApp, true, 'organisersRouter must mount GET /admin/applications/:id');
    assert.equal(hasReviewApp, true, 'organisersRouter must mount POST /admin/applications/:id/review');
    assert.equal(hasTierUpdate, true, 'organisersRouter must mount PATCH /admin/:id/tier');
    assert.equal(hasPublishingHold, true, 'organisersRouter must mount POST /admin/:id/publishing-hold');
    assert.equal(hasPublicProfile, true, 'organisersRouter must mount GET /:id');
  });

  after(async () => {
    await closePool();
  });
});
