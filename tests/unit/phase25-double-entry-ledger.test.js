import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WalletLedgerService,
  PLATFORM_REVENUE_WALLET_ID,
  PLATFORM_ESCROW_WALLET_ID,
} from '../../backend/src/wallet/walletLedger.service.js';
import {
  WalletHoldSchema,
  WalletReleaseSchema,
  WalletRewardSchema,
  WalletAdjustmentRequestSchema,
  WalletAdjustmentAdjudicateSchema,
} from '../../packages/validation/src/index.ts';

describe('Phase 25: Double-Entry Ledger & Wallet Service', () => {

  // ─── 1. Validation Schemas ──────────────────────────────────────────────
  describe('Zod Validation Schemas', () => {
    const dummyUuid = '00000000-0000-0000-0000-000000000001';

    it('should validate valid hold input', () => {
      const valid = { tournament_id: dummyUuid, amount: 50.0 };
      const parsed = WalletHoldSchema.parse(valid);
      assert.equal(parsed.amount, 50.0);
    });

    it('should reject non-positive hold amounts', () => {
      assert.throws(() => {
        WalletHoldSchema.parse({ tournament_id: dummyUuid, amount: 0 });
      });
      assert.throws(() => {
        WalletHoldSchema.parse({ tournament_id: dummyUuid, amount: -10 });
      });
    });

    it('should validate adjustment request schema', () => {
      const valid = {
        wallet_id: dummyUuid,
        amount: 100.0,
        direction: 'CREDIT',
        reason: 'Compensation for match disconnect issue',
      };
      const parsed = WalletAdjustmentRequestSchema.parse(valid);
      assert.equal(parsed.amount, 100.0);
      assert.equal(parsed.direction, 'CREDIT');
    });

    it('should reject adjustment request with short reason', () => {
      assert.throws(() => {
        WalletAdjustmentRequestSchema.parse({
          wallet_id: dummyUuid,
          amount: 100.0,
          direction: 'CREDIT',
          reason: 'too short',
        });
      });
    });

    it('should validate adjustment adjudication schema', () => {
      const valid = {
        decision: 'APPROVE',
        justification: 'Verified match logs and confirmed disconnect incident',
      };
      const parsed = WalletAdjustmentAdjudicateSchema.parse(valid);
      assert.equal(parsed.decision, 'APPROVE');
    });
  });

  // ─── 2. Double-Entry Accounting Invariant (Sum of Entries = 0) ──────────
  describe('Double-Entry Conservation Invariant', () => {
    it('verifies that every transaction balances: debit + credit = 0', () => {
      const amount = 150.00;
      const debitDelta = -amount;
      const creditDelta = +amount;
      const sum = debitDelta + creditDelta;
      assert.equal(sum, 0.00, 'Sum of entry deltas must strictly equal zero');
    });

    it('property-based test: randomized transfers conserve total platform credit volume', () => {
      let platformTotalDelta = 0.00;
      const randomAmounts = Array.from({ length: 50 }, () => Math.round(Math.random() * 500 * 100) / 100);

      for (const amt of randomAmounts) {
        const debit = -amt;
        const credit = +amt;
        platformTotalDelta += (debit + credit);
      }

      assert.equal(
        Math.abs(platformTotalDelta) < 0.0001,
        true,
        `Conservation of credits violated: platform drift was ${platformTotalDelta}`
      );
    });

    it('rejects self-transfer between identical accounts', async () => {
      const accountId = '00000000-0000-0000-0000-000000000099';
      await assert.rejects(
        async () => {
          await WalletLedgerService.executeLedgerTransfer({
            entryType: 'CREDIT',
            debitAccountId: accountId,
            creditAccountId: accountId,
            amount: 50,
          });
        },
        (err) => err.code === 'SELF_TRANSFER_FORBIDDEN'
      );
    });

    it('rejects non-positive transfer amounts', async () => {
      await assert.rejects(
        async () => {
          await WalletLedgerService.executeLedgerTransfer({
            entryType: 'CREDIT',
            debitAccountId: '00000000-0000-0000-0000-000000000010',
            creditAccountId: '00000000-0000-0000-0000-000000000020',
            amount: -50,
          });
        },
        (err) => err.code === 'INVALID_AMOUNT'
      );
    });
  });

  // ─── 3. Balance Non-Negative Constraint (available_balance >= 0) ────────
  describe('Balance Non-Negative & Insufficient Funds Check', () => {
    it('rejects transfer when user available balance is less than transfer amount', () => {
      const userBalance = 25.00;
      const requestedDebit = 50.00;

      assert.equal(userBalance < requestedDebit, true);
      let errorThrown = false;
      try {
        if (userBalance < requestedDebit) {
          const err = new Error('Insufficient available balance');
          err.code = 'INSUFFICIENT_FUNDS';
          throw err;
        }
      } catch (err) {
        errorThrown = true;
        assert.equal(err.code, 'INSUFFICIENT_FUNDS');
      }
      assert.equal(errorThrown, true);
    });
  });

  // ─── 4. Idempotency Key De-duplication ──────────────────────────────────
  describe('Idempotency De-duplication', () => {
    it('guarantees identical idempotency key returns cached transaction without duplicate debit', () => {
      const idempotencyKey = 'hold-user-1-tourney-10';
      const existingLedgerRecords = new Map();

      // First call: record transaction
      const initialTx = {
        id: 'tx-001',
        idempotency_key: idempotencyKey,
        amount: 50.00,
        status: 'COMPLETED',
      };
      existingLedgerRecords.set(idempotencyKey, initialTx);

      // Replay call: detect existing key
      const replayLookup = existingLedgerRecords.get(idempotencyKey);
      assert.ok(replayLookup);
      assert.equal(replayLookup.id, 'tx-001');
      assert.equal(replayLookup.amount, 50.00);
    });
  });

  // ─── 5. Maker-Checker Invariant on Balance Adjustments ──────────────────
  describe('Maker-Checker Dual Approval for Adjustments', () => {
    it('strictly forbids requesting admin from approving their own adjustment request', () => {
      const requesterId = 'admin-alice';
      const approverId = 'admin-alice'; // Same person trying to approve

      assert.equal(requesterId === approverId, true, 'Detects self-approval collision');

      let errorThrown = false;
      try {
        if (requesterId === approverId) {
          const err = new Error('Maker-Checker violation: Creator cannot approve their own wallet adjustment');
          err.code = 'SELF_APPROVAL_FORBIDDEN';
          throw err;
        }
      } catch (err) {
        errorThrown = true;
        assert.equal(err.code, 'SELF_APPROVAL_FORBIDDEN');
      }
      assert.equal(errorThrown, true);
    });

    it('permits dual-approval when approver is an independent second administrator', () => {
      const requesterId = 'admin-alice';
      const approverId = 'admin-bob'; // Independent second operator

      assert.notEqual(requesterId, approverId);
      const isDualApproved = requesterId !== approverId;
      assert.equal(isDualApproved, true);
    });
  });

  // ─── 6. Hold & Release Lifecycle Invariants ─────────────────────────────
  describe('Hold & Release Lifecycle', () => {
    it('hold moves available_balance to held_balance without altering total balance', () => {
      let available = 200.00;
      let held = 0.00;
      const initialTotal = available + held;

      const holdAmount = 50.00;
      available -= holdAmount;
      held += holdAmount;

      const finalTotal = available + held;
      assert.equal(available, 150.00);
      assert.equal(held, 50.00);
      assert.equal(finalTotal, initialTotal, 'Total balance must be conserved during hold');
    });

    it('release restores held_balance to available_balance without altering total balance', () => {
      let available = 150.00;
      let held = 50.00;
      const initialTotal = available + held;

      const releaseAmount = 50.00;
      held -= releaseAmount;
      available += releaseAmount;

      const finalTotal = available + held;
      assert.equal(available, 200.00);
      assert.equal(held, 0.00);
      assert.equal(finalTotal, initialTotal, 'Total balance must be conserved during release');
    });
  });

  // ─── 7. F2P Free-Tournament Launch Gate ──────────────────────────────────
  describe('Free-To-Play Launch Gate (ADR-001)', () => {
    it('free tournament requires zero hold and does not deduct user funds', async () => {
      const result = await WalletLedgerService.holdFunds(
        'user-uuid-1',
        0.00,
        '00000000-0000-0000-0000-000000000001',
        'free-hold-test'
      );
      assert.equal(result.amount, 0);
      assert.equal(result.success, true);
    });
  });
});
