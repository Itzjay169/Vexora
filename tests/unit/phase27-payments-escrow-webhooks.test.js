import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

import {
  PaymentService,
  PAYMENT_PROVIDERS,
  WEBHOOK_REPLAY_TOLERANCE_MS,
  ORDER_EXPIRY_MINUTES,
} from '../../backend/src/payments/payment.service.js';

import {
  PrizeEscrowService,
} from '../../backend/src/payments/prizeEscrow.service.js';

import {
  CreatePaymentOrderSchema,
  ProcessRefundSchema,
  LockPrizeEscrowSchema,
  SettlePrizeEscrowSchema,
  ProcessEntryPaymentSchema,
  RefundEntryFeeSchema,
  RegionalConfigUpdateSchema,
} from '../../packages/validation/src/index.ts';

describe('Phase 27: Payments, Prize Escrow & Paid Tournament Flow', () => {

  // ─── 1. Validation Schemas ──────────────────────────────────────────────
  describe('Zod Validation Schemas', () => {
    it('validates valid payment order creation', () => {
      const valid = {
        provider: 'RAZORPAY',
        amount: 250.00,
        purpose: 'DEPOSIT',
      };
      const parsed = CreatePaymentOrderSchema.parse(valid);
      assert.equal(parsed.provider, 'RAZORPAY');
      assert.equal(parsed.amount, 250.00);
      assert.equal(parsed.purpose, 'DEPOSIT');
    });

    it('rejects payment order with non-positive amount', () => {
      assert.throws(() => {
        CreatePaymentOrderSchema.parse({
          provider: 'RAZORPAY',
          amount: 0,
        });
      });
      assert.throws(() => {
        CreatePaymentOrderSchema.parse({
          provider: 'RAZORPAY',
          amount: -50,
        });
      });
    });

    it('rejects unsupported payment provider', () => {
      assert.throws(() => {
        CreatePaymentOrderSchema.parse({
          provider: 'PAYPAL_UNSUPPORTED',
          amount: 100,
        });
      });
    });

    it('validates refund request schema', () => {
      const valid = {
        amount: 100.00,
        reason: 'Tournament cancelled by organiser due to network issues',
      };
      const parsed = ProcessRefundSchema.parse(valid);
      assert.equal(parsed.amount, 100.00);
      assert.ok(parsed.reason.length >= 5);
    });

    it('rejects refund request with reason shorter than 5 chars', () => {
      assert.throws(() => {
        ProcessRefundSchema.parse({
          amount: 50.00,
          reason: 'bad',
        });
      });
    });

    it('validates prize escrow lock schema', () => {
      const valid = {
        tournamentId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        escrowAmount: 5000.00,
      };
      const parsed = LockPrizeEscrowSchema.parse(valid);
      assert.equal(parsed.tournamentId, '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
      assert.equal(parsed.escrowAmount, 5000.00);
    });

    it('rejects prize escrow lock with invalid UUID or non-positive amount', () => {
      assert.throws(() => {
        LockPrizeEscrowSchema.parse({
          tournamentId: 'not-a-uuid',
          escrowAmount: 5000.00,
        });
      });
      assert.throws(() => {
        LockPrizeEscrowSchema.parse({
          tournamentId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          escrowAmount: -100,
        });
      });
    });

    it('validates tournament entry payment schema', () => {
      const valid = {
        tournamentId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        registrationId: '123e4567-e89b-12d3-a456-426614174000',
        entryFee: 50.00,
      };
      const parsed = ProcessEntryPaymentSchema.parse(valid);
      assert.equal(parsed.entryFee, 50.00);
    });

    it('validates regional config update schema', () => {
      const valid = {
        regionCode: 'IN-TN',
        countryCode: 'IN',
        killSwitchOn: true,
        killSwitchReason: 'State regulatory pause',
        maxEntryFee: 0,
        maxPrizePool: 0,
        allowedProviders: [],
      };
      const parsed = RegionalConfigUpdateSchema.parse(valid);
      assert.equal(parsed.regionCode, 'IN-TN');
      assert.equal(parsed.killSwitchOn, true);
    });
  });

  // ─── 2. Webhook Signature Verification (HMAC-SHA256) ───────────────────
  describe('HMAC-SHA256 Webhook Verification', () => {
    const testSecret = 'whsec_vexora_test_secret_key_889123';
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_ABC123XYZ',
            amount: 50000,
            currency: 'INR',
            order_id: 'order_DEF456UVW',
          },
        },
      },
    });

    it('accepts authentic HMAC-SHA256 signature from provider', () => {
      const validSignature = crypto
        .createHmac('sha256', testSecret)
        .update(payload)
        .digest('hex');

      const isValid = PaymentService.verifyWebhookSignature(payload, validSignature, testSecret);
      assert.equal(isValid, true, 'Valid signature should verify successfully');
    });

    it('rejects tampered payload with valid signature', () => {
      const validSignature = crypto
        .createHmac('sha256', testSecret)
        .update(payload)
        .digest('hex');

      const tamperedPayload = payload.replace('50000', '99999');
      const isValid = PaymentService.verifyWebhookSignature(tamperedPayload, validSignature, testSecret);
      assert.equal(isValid, false, 'Tampered payload must fail signature verification');
    });

    it('rejects incorrect webhook secret', () => {
      const wrongSecret = 'whsec_attacker_fake_secret_key';
      const validSignature = crypto
        .createHmac('sha256', testSecret)
        .update(payload)
        .digest('hex');

      const isValid = PaymentService.verifyWebhookSignature(payload, validSignature, wrongSecret);
      assert.equal(isValid, false, 'Wrong secret must fail signature verification');
    });

    it('returns false for missing signature or secret', () => {
      assert.equal(PaymentService.verifyWebhookSignature(payload, null, testSecret), false);
      assert.equal(PaymentService.verifyWebhookSignature(payload, '', testSecret), false);
      assert.equal(PaymentService.verifyWebhookSignature(payload, 'sig', null), false);
      assert.equal(PaymentService.verifyWebhookSignature(payload, 'sig', ''), false);
    });
  });

  // ─── 3. Timestamp Replay Defense ────────────────────────────────────────
  describe('Timestamp Replay Defense', () => {
    it('accepts current timestamp within 5 minutes', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      assert.equal(PaymentService.isWebhookTimestampValid(nowSec), true);

      // 2 minutes ago
      const twoMinsAgo = nowSec - 120;
      assert.equal(PaymentService.isWebhookTimestampValid(twoMinsAgo), true);
    });

    it('rejects stale timestamp older than 5 minutes', () => {
      const sixMinsAgo = Math.floor(Date.now() / 1000) - (6 * 60);
      assert.equal(PaymentService.isWebhookTimestampValid(sixMinsAgo), false);

      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
      assert.equal(PaymentService.isWebhookTimestampValid(oneHourAgo), false);
    });

    it('rejects timestamps significantly in the future (> 1 minute)', () => {
      const tenMinsInFuture = Math.floor(Date.now() / 1000) + 600;
      assert.equal(PaymentService.isWebhookTimestampValid(tenMinsInFuture), false);
    });

    it('handles ISO string timestamps correctly', () => {
      const recentIso = new Date().toISOString();
      assert.equal(PaymentService.isWebhookTimestampValid(recentIso), true);

      const oldIso = new Date(Date.now() - 600000).toISOString(); // 10 minutes ago
      assert.equal(PaymentService.isWebhookTimestampValid(oldIso), false);
    });
  });

  // ─── 4. Architectural Constants & Guardrails ───────────────────────────
  describe('Architecture & Security Invariants', () => {
    it('supported payment providers include RAZORPAY and CASHFREE', () => {
      assert.ok(PAYMENT_PROVIDERS.includes('RAZORPAY'));
      assert.ok(PAYMENT_PROVIDERS.includes('CASHFREE'));
      assert.equal(PAYMENT_PROVIDERS.length, 2);
    });

    it('replay tolerance is 5 minutes (300,000 ms)', () => {
      assert.equal(WEBHOOK_REPLAY_TOLERANCE_MS, 5 * 60 * 1000);
    });

    it('payment order expiry is set to 30 minutes', () => {
      assert.equal(ORDER_EXPIRY_MINUTES, 30);
    });
  });

  // ─── 5. Published Refund Rules ─────────────────────────────────────────
  describe('Published Refund Policy Contract', () => {
    it('returns structured refund policy with mandatory legal clauses', () => {
      const policy = PrizeEscrowService.getPublishedRefundPolicy();
      assert.ok(policy.policy_version);
      assert.equal(policy.rules.cancellation_window_hours, 2);
      assert.equal(policy.rules.organiser_cancellation_refund_pct, 100);
      assert.equal(policy.rules.system_failure_refund_pct, 100);
      assert.equal(policy.rules.disqualification_refund_pct, 0);
      assert.ok(policy.legal_disclaimer);
    });
  });
});
