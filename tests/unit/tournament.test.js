import test from 'node:test';
import assert from 'node:assert/strict';

const TOURNAMENT_STATES = [
  'DRAFT',
  'PENDING_REVIEW',
  'SCHEDULED',
  'REGISTRATION_OPEN',
  'CHECK_IN',
  'LIVE',
  'RESULT_PENDING',
  'DISPUTED',
  'COMPLETED',
  'SETTLED',
  'ARCHIVED',
];

const VALID_TRANSITIONS = {
  DRAFT: ['PENDING_REVIEW', 'ARCHIVED'],
  PENDING_REVIEW: ['SCHEDULED', 'DRAFT'],
  SCHEDULED: ['REGISTRATION_OPEN', 'ARCHIVED'],
  REGISTRATION_OPEN: ['CHECK_IN', 'ARCHIVED'],
  CHECK_IN: ['LIVE', 'ARCHIVED'],
  LIVE: ['RESULT_PENDING'],
  RESULT_PENDING: ['COMPLETED', 'DISPUTED'],
  DISPUTED: ['COMPLETED'],
  COMPLETED: ['SETTLED'],
  SETTLED: ['ARCHIVED'],
  ARCHIVED: [],
};

function canTransition(current, next) {
  const allowed = VALID_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

test('Tournament State Machine: Blueprint 11-state sequence transitions', () => {
  assert.equal(TOURNAMENT_STATES.length, 11, 'Must define all 11 tournament states');
  assert.ok(canTransition('DRAFT', 'PENDING_REVIEW'));
  assert.ok(canTransition('PENDING_REVIEW', 'SCHEDULED'));
  assert.ok(canTransition('SCHEDULED', 'REGISTRATION_OPEN'));
  assert.ok(canTransition('REGISTRATION_OPEN', 'CHECK_IN'));
  assert.ok(canTransition('CHECK_IN', 'LIVE'));
  assert.ok(canTransition('LIVE', 'RESULT_PENDING'));
  assert.ok(canTransition('RESULT_PENDING', 'COMPLETED'));
  assert.ok(canTransition('RESULT_PENDING', 'DISPUTED'));
  assert.ok(canTransition('DISPUTED', 'COMPLETED'));
  assert.ok(canTransition('COMPLETED', 'SETTLED'));
  assert.ok(canTransition('SETTLED', 'ARCHIVED'));
});

test('Tournament State Machine: Arbitrary illegal jumps are rejected', () => {
  assert.equal(canTransition('DRAFT', 'LIVE'), false, 'Cannot jump directly from DRAFT to LIVE');
  assert.equal(canTransition('LIVE', 'SETTLED'), false, 'Cannot jump from LIVE to SETTLED without results');
  assert.equal(canTransition('ARCHIVED', 'LIVE'), false, 'Archived tournament cannot return to LIVE');
});
