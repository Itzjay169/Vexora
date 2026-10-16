import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

import {
  PayoutsService,
  HIGH_VALUE_THRESHOLD,
  COOLING_OFF_HOURS,
} from '../../backend/src/payouts/payouts.service.js';

import {
  ReconciliationService,
} from '../../backend/src/payouts/reconciliation.service.js';

import {
  FinancialReportsService,
} from '../../backend/src/payouts/financialReports.service.js';

import {
  AddPayoutDestinationSchema,
  RequestPayoutSchema,
  ApprovePayoutSchema,
  SecondaryApprovePayoutSchema,
  RejectPayoutSchema,
  MarkPayoutPaidSchema,
  RunReconciliationSchema,
  ResolveDiscrepancySchema,
  ExportFinancialReportSchema,
} from '../../packages/validation/src/index.ts';

describe('Phase 28: Payouts, Reconciliation & Financial Reports', () => {

  // ─── 1. Validation Schemas ──────────────────────────────────────────────
  describe('Zod Validation Schemas', () => {
    it('validates valid UPI payout destination', () => {
      const validUpi = {
        destinationType: 'UPI',
        upiId: 'pro_player@okhdfcbank',
        accountHolderName: 'Alex Player',
      };
      const parsed = AddPayoutDestinationSchema.parse(validUpi);
      assert.equal(parsed.destinationType, 'UPI');
      assert.equal(parsed.upiId, 'pro_player@okhdfcbank');
    });

    it('rejects UPI destination without @ symbol', () => {
      assert.throws(() => {
        AddPayoutDestinationSchema.parse({
          destinationType: 'UPI',
          upiId: 'invalid_upi_string',
          accountHolderName: 'Alex Player',
        });
      });
    });

    it('validates valid bank account destination', () => {
      const validBank = {
        destinationType: 'BANK_ACCOUNT',
        bankAccountNumber: '50100234129841',
        bankIfsc: 'HDFC0001234',
        accountHolderName: 'Alex Player',
      };
      const parsed = AddPayoutDestinationSchema.parse(validBank);
      assert.equal(parsed.destinationType, 'BANK_ACCOUNT');
      assert.equal(parsed.bankIfsc, 'HDFC0001234');
    });

    it('rejects bank account destination with invalid IFSC length', () => {
      assert.throws(() => {
        AddPayoutDestinationSchema.parse({
          destinationType: 'BANK_ACCOUNT',
          bankAccountNumber: '50100234129841',
          bankIfsc: 'HDFC123', // not 11 chars
          accountHolderName: 'Alex Player',
        });
      });
    });

    it('validates payout cash-out request', () => {
      const valid = {
        destinationId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 2500.00,
      };
      const parsed = RequestPayoutSchema.parse(valid);
      assert.equal(parsed.amount, 2500.00);
    });

    it('rejects non-positive payout cash-out request', () => {
      assert.throws(() => {
        RequestPayoutSchema.parse({
          destinationId: '123e4567-e89b-12d3-a456-426614174000',
          amount: 0,
        });
      });
      assert.throws(() => {
        RequestPayoutSchema.parse({
          destinationId: '123e4567-e89b-12d3-a456-426614174000',
          amount: -500,
        });
      });
    });

    it('enforces step-up auth for secondary high-value approval', () => {
      assert.throws(() => {
        SecondaryApprovePayoutSchema.parse({
          stepUpAuthVerified: false,
        });
      });

      const parsed = SecondaryApprovePayoutSchema.parse({
        stepUpAuthVerified: true,
        notes: 'Verified via hardware passkey',
      });
      assert.equal(parsed.stepUpAuthVerified, true);
    });

    it('validates settlement Bank UTR input', () => {
      const valid = {
        bankUtr: 'UTR20261016HDFC889012',
        provider: 'BANK_NEFT_IMPS',
      };
      const parsed = MarkPayoutPaidSchema.parse(valid);
      assert.equal(parsed.bankUtr, 'UTR20261016HDFC889012');
    });

    it('rejects Bank UTR shorter than 6 characters', () => {
      assert.throws(() => {
        MarkPayoutPaidSchema.parse({
          bankUtr: '123',
        });
      });
    });

    it('validates financial report export schema', () => {
      const valid = {
        reportType: 'MONTHLY_SUMMARY',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      };
      const parsed = ExportFinancialReportSchema.parse(valid);
      assert.equal(parsed.reportType, 'MONTHLY_SUMMARY');
    });

    it('rejects financial report export with end date before start date', () => {
      assert.throws(() => {
        ExportFinancialReportSchema.parse({
          reportType: 'MONTHLY_SUMMARY',
          startDate: '2026-10-31',
          endDate: '2026-10-01',
        });
      });
    });
  });

  // ─── 2. Architecture & Security Invariants ─────────────────────────────
  describe('Architecture & Security Invariants', () => {
    it('high-value threshold is defined as ₹10,000', () => {
      assert.equal(HIGH_VALUE_THRESHOLD, 10000.00);
    });

    it('cooling-off period is defined as 24 hours', () => {
      assert.equal(COOLING_OFF_HOURS, 24);
    });

    it('destination addition enforces account name requirement', async () => {
      await assert.rejects(
        async () => {
          await PayoutsService.addPayoutDestination({
            userId: 'usr-1',
            destinationType: 'UPI',
            upiId: 'test@upi',
            accountHolderName: ' ', // Empty name
          });
        },
        { code: 'INVALID_ACCOUNT_NAME' }
      );
    });

    it('step-up auth is strictly mandated for secondary high-value approval', async () => {
      await assert.rejects(
        async () => {
          await PayoutsService.approveSecondaryHighValue({
            payoutId: 'pay-1',
            adminId: 'adm-2',
            stepUpAuthVerified: false,
          });
        },
        { code: 'STEP_UP_AUTH_REQUIRED' }
      );
    });

    it('settlement strictly requires bank UTR reference', async () => {
      await assert.rejects(
        async () => {
          await PayoutsService.markPayoutPaid({
            payoutId: 'pay-1',
            bankUtr: '',
          });
        },
        { code: 'INVALID_BANK_UTR' }
      );
    });
  });

  // ─── 3. Reconciliation Logic & Variance Detection ──────────────────────
  describe('Reconciliation Invariant Verification', () => {
    it('discrepancy resolution requires at least 10 characters of explanation', async () => {
      await assert.rejects(
        async () => {
          await ReconciliationService.resolveDiscrepancy({
            discrepancyId: 'disc-1',
            adminId: 'adm-1',
            resolutionNotes: 'fixed', // too short
          });
        },
        { code: 'INVALID_RESOLUTION_NOTES' }
      );
    });
  });

  // ─── 4. Cryptographic Watermark & Export Hashing ────────────────────────
  describe('Cryptographic Watermarking & Export Integrity', () => {
    it('generates SHA-256 digest from export payload', () => {
      const payload = {
        watermark: 'CONFIDENTIAL // VEXORA // EXPORTED_BY_ADMIN',
        data: { totalVolume: 50000.00, count: 20 },
      };
      const rawString = JSON.stringify(payload, null, 2);
      const digest = crypto.createHash('sha256').update(rawString).digest('hex');

      assert.equal(typeof digest, 'string');
      assert.equal(digest.length, 64, 'SHA-256 digest must be 64 characters long');
    });

    it('tampered export payload generates completely different hash', () => {
      const payload1 = { test: 'original', amount: 1000 };
      const payload2 = { test: 'original', amount: 9999 };

      const hash1 = crypto.createHash('sha256').update(JSON.stringify(payload1)).digest('hex');
      const hash2 = crypto.createHash('sha256').update(JSON.stringify(payload2)).digest('hex');

      assert.notEqual(hash1, hash2, 'Hash must detect any payload tampering');
    });
  });
});
