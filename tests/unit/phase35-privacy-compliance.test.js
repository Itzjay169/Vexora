import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ComplianceService } from '../../backend/src/compliance/compliance.service.js';
import {
  ConsentType,
  UserConsentUpdateSchema,
  GuardianConsentSubmitSchema,
  DataSubjectRequestType,
  DataSubjectRequestCreateSchema,
  DataCorrectionSchema,
  StatutoryTakedownLegalBasis,
  StatutoryTakedownCreateSchema,
  SupportedLocale,
} from '../../packages/validation/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('Phase 35: Privacy, Compliance, Localisation & Accessibility', () => {

  // ═══════════════════════════════════════════════════════════════════════
  // 1. DATA MAP & RECORD OF PROCESSING ACTIVITIES (ROPA)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Record of Processing Activities (ROPA & Vendors)', () => {
    it('returns processing register with statutory legal bases and retention schedules', async () => {
      const ropa = await ComplianceService.getProcessingRegister();
      assert.ok(Array.isArray(ropa));
      assert.ok(ropa.length >= 4);

      const identityCat = ropa.find((r) => r.category_name.includes('Identity'));
      assert.ok(identityCat, 'Must contain Identity processing category');
      assert.equal(identityCat.legal_basis, 'CONTRACTUAL_NECESSITY');
      assert.ok(identityCat.retention_period.includes('180 days'));

      const ledgerCat = ropa.find((r) => r.category_name.includes('Financial'));
      assert.ok(ledgerCat, 'Must contain Financial & Ledger category');
      assert.equal(ledgerCat.legal_basis, 'LEGAL_OBLIGATION');
      assert.ok(ledgerCat.retention_period.includes('5 years'));
    });

    it('returns vendor processor registry with DPA status and country of storage', async () => {
      const vendors = await ComplianceService.listVendors();
      assert.ok(Array.isArray(vendors));
      assert.ok(vendors.length >= 4);

      const awsVendor = vendors.find((v) => v.vendor_name.includes('AWS'));
      assert.ok(awsVendor);
      assert.equal(awsVendor.country_of_storage, 'India');
      assert.equal(awsVendor.dpa_signed, true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. GRANULAR REVOCABLE CONSENTS (DPDP ACT 2023)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Granular Revocable Consents', () => {
    it('validates all supported consent types via schema', () => {
      const validTypes = [
        'ANALYTICS',
        'MARKETING_NOTIFICATIONS',
        'LOCATION_TELEMETRY',
        'MATCH_NOTIFICATIONS',
        'THIRD_PARTY_SHARING',
      ];

      for (const t of validTypes) {
        const parsed = ConsentType.safeParse(t);
        assert.ok(parsed.success, `Consent type ${t} should be valid`);
      }

      assert.equal(ConsentType.safeParse('unrestricted_tracking').success, false);
    });

    it('allows granting and revoking granular consents with IP rotating salt', async () => {
      const testUserId = '00000000-0000-0000-0000-000000000035';

      // 1. Grant marketing_push consent
      const grantResult = await ComplianceService.updateUserConsent({
        userId: testUserId,
        consentType: 'marketing_push',
        isGranted: true,
        ipAddress: '103.21.244.2',
        userAgent: 'Mozilla/5.0 Mobile',
      });

      assert.equal(grantResult.consent_type, 'marketing_push');
      assert.equal(grantResult.is_granted, true);
      assert.ok(grantResult.ip_hash, 'Must store hashed IP with rotating salt');

      // 2. Revoke marketing_push consent
      const revokeResult = await ComplianceService.updateUserConsent({
        userId: testUserId,
        consentType: 'marketing_push',
        isGranted: false,
        ipAddress: '103.21.244.2',
      });

      assert.equal(revokeResult.is_granted, false);
      assert.ok(revokeResult.revoked_at, 'Must record revocation timestamp');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. GUARDIAN CONSENT FOR MINORS (DPDP ACT SEC 9)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Guardian Consent for Minors', () => {
    it('validates guardian consent submission schema', () => {
      const validPayload = {
        minor_dob: '2010-05-15',
        guardian_name: 'Rajesh Sharma',
        guardian_email: 'rajesh.sharma@example.com',
        guardian_phone: '+919876543210',
      };
      const parsed = GuardianConsentSubmitSchema.safeParse(validPayload);
      assert.ok(parsed.success);

      // Missing required minor_dob
      const invalidPayload = {
        guardian_name: 'Rajesh Sharma',
      };
      assert.equal(GuardianConsentSubmitSchema.safeParse(invalidPayload).success, false);
    });

    it('submits and verifies guardian consent via cryptographic token', async () => {
      const minorUserId = '00000000-0000-0000-0000-000000000016';

      const consentReq = await ComplianceService.submitGuardianConsent({
        minorUserId,
        guardianName: 'Sunita Das',
        guardianEmail: 'sunita.das@example.com',
        guardianPhone: '+919123456789',
        relationship: 'MOTHER',
      });

      assert.equal(consentReq.status, 'PENDING');
      assert.ok(consentReq.verification_token, 'Must generate verification token');
      assert.ok(new Date(consentReq.token_expires_at) > new Date());

      // Verify consent using token
      const verified = await ComplianceService.verifyGuardianConsent(consentReq.verification_token);
      assert.equal(verified.status, 'VERIFIED');
      assert.ok(verified.verified_at);
    });

    it('rejects invalid or expired guardian verification tokens', async () => {
      await assert.rejects(
        async () => {
          await ComplianceService.verifyGuardianConsent('invalid-non-existent-token-123');
        },
        { message: /Invalid or expired/ }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. DATA SUBJECT RIGHTS (DSR): EXPORT & ACCOUNT ERASURE SECURITY GATE
  // ═══════════════════════════════════════════════════════════════════════

  describe('Data Subject Rights (DSR) & Security Gate Invariant', () => {
    it('creates DSR request with statutory 30-day SLA deadline', async () => {
      const testUserId = '00000000-0000-0000-0000-000000000035';

      const dsr = await ComplianceService.createDataSubjectRequest({
        userId: testUserId,
        requestType: 'DATA_EXPORT',
        reason: 'User requesting portability archive',
      });

      assert.equal(dsr.status, 'PENDING');
      assert.equal(dsr.request_type, 'DATA_EXPORT');
      assert.ok(dsr.sla_deadline, 'Must calculate SLA deadline');

      // 30 days in future check
      const slaDate = new Date(dsr.sla_deadline);
      const minExpectedSla = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000);
      assert.ok(slaDate >= minExpectedSla, 'SLA must be at least 29+ days');
    });

    it('exports sanitized personal data package in machine-readable JSON', async () => {
      const testUserId = '00000000-0000-0000-0000-000000000035';
      const pkg = await ComplianceService.exportUserData(testUserId);

      assert.ok(pkg.metadata);
      assert.equal(pkg.metadata.regulatoryBasis, 'DPDP_ACT_2023_SEC_11');
      assert.ok(pkg.userProfile);
      assert.ok(pkg.activitySummary);

      // Security Check: No password hashes or secrets in export
      assert.equal(pkg.userProfile.password_hash, undefined);
      assert.equal(pkg.userProfile.mfa_secret, undefined);
    });

    it('SECURITY GATE: Right to Erasure scrubs PII while retaining statutory financial ledger & audit logs', async () => {
      const testUserId = '00000000-0000-0000-0000-000000000035';

      const erasureResult = await ComplianceService.executeAccountErasure(testUserId);

      // 1. Check PII is scrubbed
      assert.equal(erasureResult.success, true);
      assert.equal(erasureResult.status, 'ERASED_AND_PSEUDONYMISED');
      assert.ok(erasureResult.piiScrubbed.username.startsWith('deleted_user_'));
      assert.ok(erasureResult.piiScrubbed.email.includes('@deleted.vexora.gg'));
      assert.equal(erasureResult.piiScrubbed.phone, null);
      assert.equal(erasureResult.piiScrubbed.avatar, null);

      // 2. CRITICAL SECURITY GATE INVARIANT:
      // PMLA 5-year ledger preservation & IT Rules 180-day cold archive
      assert.equal(erasureResult.complianceInvariant.financialLedgerPreserved, true);
      assert.equal(erasureResult.complianceInvariant.financialRetentionYears, 5);
      assert.equal(erasureResult.complianceInvariant.itRulesArchiveDays, 180);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. RETENTION SCHEDULE DISPOSAL RUNNER
  // ═══════════════════════════════════════════════════════════════════════

  describe('Automated Retention Schedule Disposal Purge', () => {
    it('executes disposal runner, purges expired records, and produces signed audit report', async () => {
      const report = await ComplianceService.runRetentionDisposalJob();

      assert.ok(report.id);
      assert.equal(report.policy_id, 'POL-AUTO-RETENTION-2026');
      assert.ok(report.items_purged_count >= 0);
      assert.ok(report.audit_signature, 'Disposal report must be cryptographically signed');
      assert.ok(report.preservation_notes.includes('5y'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. PSEUDONYMISATION WITH ROTATING SALTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Rotating Salt Pseudonymisation', () => {
    it('generates consistent hash for same epoch and different hash across epochs', () => {
      const ip = '192.168.1.100';

      const dateA = new Date('2026-10-01T00:00:00Z');
      const dateB = new Date('2026-10-15T00:00:00Z');
      const dateNextMonth = new Date('2026-11-01T00:00:00Z');

      const saltA = ComplianceService.getRotatingSalt(dateA);
      const saltB = ComplianceService.getRotatingSalt(dateB);
      const saltNextMonth = ComplianceService.getRotatingSalt(dateNextMonth);

      assert.equal(saltA, saltB, 'Same month must have identical salt');
      assert.notEqual(saltA, saltNextMonth, 'Different months must have different rotating salts');

      const hashA = ComplianceService.hashIpWithRotatingSalt(ip, saltA);
      const hashNext = ComplianceService.hashIpWithRotatingSalt(ip, saltNextMonth);

      assert.notEqual(hashA, hashNext, 'Hashes must rotate across epochs to prevent cross-epoch tracking');
    });

    it('hashes device identifier consistently within salt epoch', () => {
      const deviceId = 'hardware-uuid-8892-ab12';
      const hash1 = ComplianceService.hashDevice(deviceId);
      const hash2 = ComplianceService.hashDevice(deviceId);

      assert.equal(hash1, hash2);
      assert.equal(hash1.length, 64, 'SHA-256 output must be 64 hex characters');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 7. STATUTORY TAKEDOWNS & GRIEVANCE OFFICER (IT RULES 2021)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Statutory Takedown & Grievance Officer', () => {
    it('returns official Resident Grievance Officer contact info with SLAs', () => {
      const officer = ComplianceService.getGrievanceOfficerDetails();

      assert.equal(officer.officerName, 'Priyadarshini Mohanty');
      assert.ok(officer.email.includes('grievance-officer@vexora.gg'));
      assert.equal(officer.responseSlaHours.emergencyImpersonationOrNudity, 24);
      assert.equal(officer.responseSlaHours.courtOrGovtOrder, 36);
      assert.equal(officer.responseSlaHours.generalGrievance, 72);
      assert.ok(officer.officeAddress.includes('Bhubaneswar'));
    });

    it('validates statutory takedown submission schema and requires legal basis and targeted content', () => {
      const validNotice = {
        legal_basis: 'RULE_3_2_B_IMPERSONATION_SEXUAL',
        complainant_name: 'Vikram Seth',
        complainant_email: 'vikram.s@example.com',
        targeted_content: {
          content_type: 'PROFILE_AVATAR',
          content_id: 'avatar-user-1234',
          description: 'Impersonating another player with fake avatar',
        },
      };

      const parsed = StatutoryTakedownCreateSchema.safeParse(validNotice);
      assert.ok(parsed.success);

      // Rejects missing targeted_content
      const invalidNotice = {
        legal_basis: 'RULE_3_2_B_IMPERSONATION_SEXUAL',
        complainant_name: 'Vikram Seth',
        complainant_email: 'vikram.s@example.com',
      };
      assert.equal(StatutoryTakedownCreateSchema.safeParse(invalidNotice).success, false);
    });

    it('enforces 24-hour statutory SLA for Rule 3(2)(b) emergency takedowns', async () => {
      const notice = await ComplianceService.submitStatutoryTakedown({
        complainantName: 'Rohan Mehta',
        complainantEmail: 'rohan.mehta@example.com',
        targetContentType: 'USER_AVATAR',
        targetContentId: 'avatar-8812',
        legalBasis: 'RULE_3_2_B_IMPERSONATION_SEXUAL',
        declarationTrue: true,
      });

      assert.equal(notice.status, 'UNDER_REVIEW');
      assert.equal(notice.legal_basis, 'RULE_3_2_B_IMPERSONATION_SEXUAL');

      const slaDate = new Date(notice.sla_deadline);
      const createdDate = new Date(notice.created_at);
      const diffHours = (slaDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60);

      assert.equal(Math.round(diffHours), 24, 'Rule 3(2)(b) must enforce 24-hour SLA');
    });

    it('allows admin resolution of takedown with audit notes', async () => {
      const notice = await ComplianceService.submitStatutoryTakedown({
        complainantName: 'Legal Team',
        complainantEmail: 'legal@apex.in',
        targetContentType: 'TOURNAMENT_BANNER',
        targetContentId: 'banner-9912',
        legalBasis: 'COPYRIGHT_INFRINGEMENT',
        declarationTrue: true,
      });

      const resolved = await ComplianceService.resolveTakedown({
        takedownId: notice.id,
        adminActorId: 'admin-mod-001',
        action: 'REMOVED',
        notes: 'Infringing trademark banner taken down.',
      });

      assert.equal(resolved.status, 'TAKEDOWN_EXECUTED');
      assert.equal(resolved.action_taken, 'REMOVED');
      assert.equal(resolved.reviewed_by, 'admin-mod-001');
      assert.ok(resolved.resolved_at);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 8. LOCALISATION & ACCESSIBILITY (WCAG 2.1 AA)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Localisation Catalogs & Regional Formats', () => {
    it('provides complete translation dictionaries for English, Hindi, and Odia', () => {
      for (const loc of ['en', 'hi', 'or']) {
        const catalog = ComplianceService.getTranslations(loc);
        assert.equal(catalog.locale, loc);
        assert.ok(catalog.appName);
        assert.ok(catalog.privacy.title);
        assert.ok(catalog.privacy.rightsTitle);
        assert.ok(catalog.privacy.exportData);
        assert.ok(catalog.privacy.deleteAccount);
        assert.ok(catalog.privacy.retentionNotice);
        assert.ok(catalog.accessibility.contrastHigh);
      }
    });

    it('formats regional Indian currency (INR)', () => {
      const formatted = ComplianceService.formatRegionalCurrency(5000);
      assert.ok(formatted.includes('5,000') || formatted.includes('₹'));
    });
  });
});
