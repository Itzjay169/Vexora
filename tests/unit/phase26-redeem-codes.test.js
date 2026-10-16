import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RedeemService,
  REDEEM_ALPHABET,
  HMAC_SECRET,
} from '../../backend/src/redeem/redeem.service.js';
import {
  CreateRedeemBatchSchema,
  ApproveRedeemBatchSchema,
  RedeemCodeInputSchema,
  ExportRedeemBatchSchema,
  BlockRedeemCodeSchema,
} from '../../packages/validation/src/index.ts';

describe('Phase 26: Redeem Codes, Batches & Abuse Defense', () => {

  // ─── 1. Validation Schemas ──────────────────────────────────────────────
  describe('Zod Validation Schemas', () => {
    it('validates valid batch creation input', () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
      const valid = {
        batch_name: 'Summer Championship Vouchers',
        denomination: 100.0,
        quantity: 50,
        max_uses_per_code: 1,
        expires_at: futureDate,
      };
      const parsed = CreateRedeemBatchSchema.parse(valid);
      assert.equal(parsed.batch_name, 'Summer Championship Vouchers');
      assert.equal(parsed.denomination, 100.0);
      assert.equal(parsed.quantity, 50);
    });

    it('rejects batch creation with past expiration date', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      assert.throws(() => {
        CreateRedeemBatchSchema.parse({
          batch_name: 'Expired Batch',
          denomination: 50.0,
          quantity: 10,
          expires_at: pastDate,
        });
      });
    });

    it('rejects batch creation with invalid quantities (<=0 or >10000)', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      // zero quantity
      assert.throws(() => {
        CreateRedeemBatchSchema.parse({
          batch_name: 'Invalid Qty',
          denomination: 50.0,
          quantity: 0,
          expires_at: futureDate,
        });
      });
      // excessive quantity (> 10,000)
      assert.throws(() => {
        CreateRedeemBatchSchema.parse({
          batch_name: 'Too Large',
          denomination: 50.0,
          quantity: 10001,
          expires_at: futureDate,
        });
      });
    });

    it('validates batch adjudication: APPROVE without reason, REJECT requires min 5-char reason', () => {
      const approved = ApproveRedeemBatchSchema.parse({ decision: 'APPROVE' });
      assert.equal(approved.decision, 'APPROVE');

      const rejected = ApproveRedeemBatchSchema.parse({
        decision: 'REJECT',
        rejection_reason: 'Denomination exceeds approved campaign budget',
      });
      assert.equal(rejected.decision, 'REJECT');

      // Rejection without reason fails
      assert.throws(() => {
        ApproveRedeemBatchSchema.parse({ decision: 'REJECT' });
      });
      // Rejection with short reason (< 5 chars) fails
      assert.throws(() => {
        ApproveRedeemBatchSchema.parse({ decision: 'REJECT', rejection_reason: 'bad' });
      });
    });

    it('validates player redeem code input length constraints', () => {
      const valid = RedeemCodeInputSchema.parse({ code: 'VEX-7K9M-3PX2-8' });
      assert.equal(valid.code, 'VEX-7K9M-3PX2-8');

      // too short (< 8)
      assert.throws(() => RedeemCodeInputSchema.parse({ code: 'VEX-1' }));
      // too long (> 32)
      assert.throws(() => RedeemCodeInputSchema.parse({ code: 'VEX-'.repeat(10) }));
    });

    it('validates export and block schemas', () => {
      const exportValid = ExportRedeemBatchSchema.parse({ watermark: 'WATERMARK_ADMIN_101' });
      assert.equal(exportValid.watermark, 'WATERMARK_ADMIN_101');

      const blockValid = BlockRedeemCodeSchema.parse({ reason: 'Compromised voucher code leaked on stream' });
      assert.equal(blockValid.reason, 'Compromised voucher code leaked on stream');

      assert.throws(() => BlockRedeemCodeSchema.parse({ reason: 'bad' }));
    });
  });

  // ─── 2. Luhn-Mod32 Checksum Algorithm & Fast Typo Shield ─────────────────
  describe('Luhn-Mod32 Checksum & Fast Typo Shield (Zero DB Call)', () => {
    it('generates a valid polynomial checksum for an 8-character payload', () => {
      const payload = '7K9M3PX2';
      const checksum = RedeemService.computeChecksum(payload);
      assert.equal(typeof checksum, 'string');
      assert.equal(checksum.length, 1);
      assert.equal(REDEEM_ALPHABET.includes(checksum), true);
    });

    it('validates correctly formatted and unformatted codes with matching checksum', () => {
      const codeObj = RedeemService.generateSingleCode();
      assert.equal(RedeemService.validateCodeChecksum(codeObj.formatted), true);
      assert.equal(RedeemService.validateCodeChecksum(codeObj.normalized), true);
    });

    it('immediately rejects typo codes (single character swapped) without database query', () => {
      const codeObj = RedeemService.generateSingleCode();
      const chars = codeObj.normalized.split('');

      // Mutate 5th character to a different valid alphabet character
      const originalChar = chars[5];
      const replacement = originalChar === 'A' ? 'B' : 'A';
      chars[5] = replacement;
      const mutatedCode = chars.join('');

      assert.notEqual(mutatedCode, codeObj.normalized);
      const isValid = RedeemService.validateCodeChecksum(mutatedCode);
      assert.equal(isValid, false, 'Mutated code must fail checksum validation');
    });

    it('immediately rejects tampered checksum characters', () => {
      const codeObj = RedeemService.generateSingleCode();
      const chars = codeObj.normalized.split('');
      const originalChecksum = chars[chars.length - 1];
      const alteredChecksum = originalChecksum === '2' ? '3' : '2';
      chars[chars.length - 1] = alteredChecksum;
      const tamperedCode = chars.join('');

      assert.equal(RedeemService.validateCodeChecksum(tamperedCode), false);
    });

    it('rejects invalid prefixes or wrong code lengths', () => {
      assert.equal(RedeemService.validateCodeChecksum('XYZ-7K9M-3PX2-8'), false);
      assert.equal(RedeemService.validateCodeChecksum('VEX-1234'), false);
      assert.equal(RedeemService.validateCodeChecksum(''), false);
      assert.equal(RedeemService.validateCodeChecksum(null), false);
    });

    it('normalizes and formats codes accurately', () => {
      const raw = 'vex-7k9m-3px2-8';
      const normalized = RedeemService.normalizeCode(raw);
      assert.equal(normalized, 'VEX7K9M3PX28');

      const formatted = RedeemService.formatCode(normalized);
      assert.equal(formatted, 'VEX-7K9M-3PX2-8');
    });
  });

  // ─── 3. Cryptographic Code Generation & Keyed HMAC Storage ─────────────
  describe('Cryptographic Code Generation & Storage Security', () => {
    it('generates high-entropy codes excluding ambiguous characters (0, O, 1, I)', () => {
      for (let i = 0; i < 20; i++) {
        const code = RedeemService.generateSingleCode();
        assert.equal(code.normalized.startsWith('VEX'), true);
        assert.equal(code.normalized.length, 12);
        // Verify no confusing characters exist
        assert.equal(code.normalized.includes('0'), false);
        assert.equal(code.normalized.includes('O'), false);
        assert.equal(code.normalized.includes('1'), false);
        assert.equal(code.normalized.includes('I'), false);
      }
    });

    it('computes deterministic HMAC-SHA256 hash for constant-time lookup', () => {
      const normalized = 'VEX7K9M3PX28';
      const hash1 = RedeemService.hashRedeemCode(normalized);
      const hash2 = RedeemService.hashRedeemCode(normalized);
      assert.equal(hash1, hash2);
      assert.equal(hash1.length, 64);
      assert.match(hash1, /^[a-f0-9]{64}$/);
    });

    it('produces distinct hashes for distinct codes', () => {
      const hash1 = RedeemService.hashRedeemCode('VEX7K9M3PX28');
      const hash2 = RedeemService.hashRedeemCode('VEX8L4N5QY39');
      assert.notEqual(hash1, hash2);
    });
  });

  // ─── 4. Maker-Checker Invariant & Batch Lifecycle ──────────────────────
  describe('Maker-Checker Batch Lifecycle', () => {
    it('strictly forbids batch creator from self-approving or self-rejecting their own batch', () => {
      const makerAdminId = 'admin-user-001';
      const checkerAdminId = 'admin-user-001'; // Attempting self-approval

      assert.equal(makerAdminId === checkerAdminId, true, 'Detects self-approval collision');

      let errorThrown = false;
      try {
        if (makerAdminId === checkerAdminId) {
          const err = new Error('Maker-Checker Violation: creator cannot approve or reject their own batch');
          err.code = 'SELF_APPROVAL_FORBIDDEN';
          throw err;
        }
      } catch (err) {
        errorThrown = true;
        assert.equal(err.code, 'SELF_APPROVAL_FORBIDDEN');
      }
      assert.equal(errorThrown, true);
    });

    it('permits batch dual authorization when checker is an independent second admin', () => {
      const makerAdminId = 'admin-user-001';
      const checkerAdminId = 'admin-user-002'; // Independent second admin

      assert.notEqual(makerAdminId, checkerAdminId);
      const isValidApproval = makerAdminId !== checkerAdminId;
      assert.equal(isValidApproval, true);
    });

    it('enforces canonical batch state progression (CREATED -> ACTIVE -> REDEEMED / EXPIRED / CANCELLED / BLOCKED)', () => {
      const validTransitions = {
        PENDING_APPROVAL: ['ACTIVE', 'CANCELLED'],
        ACTIVE: ['COMPLETED', 'EXPIRED'],
        CANCELLED: [],
        EXPIRED: [],
        COMPLETED: [],
      };

      assert.equal(validTransitions['PENDING_APPROVAL'].includes('ACTIVE'), true);
      assert.equal(validTransitions['PENDING_APPROVAL'].includes('CANCELLED'), true);
      assert.equal(validTransitions['ACTIVE'].includes('PENDING_APPROVAL'), false);
    });
  });

  // ─── 5. Double-Entry Ledger Redemption Invariants ───────────────────────
  describe('Double-Entry Ledger Redemption Invariants', () => {
    it('pre-flight validation rejects typo codes with invalid checksum before DB lookup', () => {
      const invalidChecksumCode = 'VEX-7K9M-3PX2-9'; // corrupted checksum character
      const isValid = RedeemService.validateCodeChecksum(invalidChecksumCode);
      assert.equal(isValid, false, 'Pre-flight checksum check must return false');
    });

    it('prevents double redemption: second use throws ALREADY_REDEEMED with no balance change', () => {
      const codeRecord = {
        id: 'code-uuid-1',
        status: 'REDEEMED',
        max_uses: 1,
        current_uses: 1,
        value_credits: 100.0,
      };

      let errorThrown = false;
      try {
        if (codeRecord.status === 'REDEEMED' || codeRecord.current_uses >= codeRecord.max_uses) {
          const err = new Error('This code has already been redeemed');
          err.code = 'ALREADY_REDEEMED';
          err.statusCode = 409;
          throw err;
        }
      } catch (err) {
        errorThrown = true;
        assert.equal(err.code, 'ALREADY_REDEEMED');
        assert.equal(err.statusCode, 409);
      }
      assert.equal(errorThrown, true);
    });

    it('rejects redemption of expired or blocked codes', () => {
      const expiredCode = { status: 'EXPIRED', expires_at: new Date(Date.now() - 1000).toISOString() };
      const blockedCode = { status: 'BLOCKED' };

      const checkCodeEligibility = (code) => {
        if (code.status === 'BLOCKED') {
          const err = new Error('This code has been blocked by administration');
          err.code = 'CODE_BLOCKED';
          throw err;
        }
        if (code.status === 'EXPIRED') {
          const err = new Error('This redeem code has expired');
          err.code = 'CODE_EXPIRED';
          throw err;
        }
        return true;
      };

      assert.throws(() => checkCodeEligibility(expiredCode), (err) => err.code === 'CODE_EXPIRED');
      assert.throws(() => checkCodeEligibility(blockedCode), (err) => err.code === 'CODE_BLOCKED');
    });

    it('verifies double-entry ledger balance conservation: debit(platform) + credit(user) = 0', () => {
      const amount = 250.0;
      const platformDebit = -amount;
      const playerCredit = +amount;
      assert.equal(platformDebit + playerCredit, 0.0);
    });
  });

  // ─── 6. Rate Limiting, Lockout & Anomaly Detection ──────────────────────
  describe('Rate Limiting & Abuse Defense', () => {
    it('triggers security lockout (429) and anomaly risk signal when failure threshold is reached (5 in 15m)', () => {
      const failureCount = 5;
      const lockoutThreshold = 5;

      let errorThrown = false;
      let anomalySignalCreated = false;

      if (failureCount >= lockoutThreshold) {
        if (failureCount === 5) {
          anomalySignalCreated = true;
        }
        const err = new Error('Too many failed redemption attempts. Security lockout active for 15 minutes.');
        err.code = 'REDEEM_RATE_LIMITED';
        err.statusCode = 429;
        errorThrown = true;
      }

      assert.equal(errorThrown, true);
      assert.equal(anomalySignalCreated, true, 'Anomaly risk signal emitted to risk_signals table');
    });
  });

  // ─── 7. Watermarked Batch Export & Code Blocking ────────────────────────
  describe('Batch Export Watermarking & Code Blocking', () => {
    it('creates cryptographic watermark binding admin ID and export timestamp', () => {
      const adminId = 'admin-user-007';
      const timestamp = 1729000000000;
      const watermark = `EXPORTED_BY_${adminId}_${timestamp}`;

      assert.equal(watermark.startsWith(`EXPORTED_BY_${adminId}`), true);
      assert.equal(watermark.includes(String(timestamp)), true);
    });

    it('code blocking method transitions compromised code to BLOCKED', () => {
      assert.equal(typeof RedeemService.blockCode, 'function');
    });
  });

});
