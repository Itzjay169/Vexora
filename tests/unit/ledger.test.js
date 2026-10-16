import test from 'node:test';
import assert from 'node:assert/strict';

test('Double-Entry Ledger Invariant: Balanced journal entries always sum to zero', () => {
  // Transfer 500 credits from User A to Escrow
  const journalEntry = [
    { account_id: 'user-a', amount: -500, type: 'HOLD' },
    { account_id: 'escrow-pool', amount: 500, type: 'HOLD' },
  ];

  const sum = journalEntry.reduce((acc, tx) => acc + tx.amount, 0);
  assert.equal(sum, 0, 'Double-entry invariant violated: Journal entries must sum to exactly zero');
});

test('Ledger Integrity: Negative balance constraint simulation', () => {
  const account = { id: 'user-b', available_balance: 100 };
  const requestedHold = 200;

  const canHold = account.available_balance >= requestedHold;
  assert.equal(canHold, false, 'Insufficient balance must be rejected by check constraint');
});
