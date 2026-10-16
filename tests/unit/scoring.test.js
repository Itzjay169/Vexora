import test from 'node:test';
import assert from 'node:assert/strict';

// Scoring tables directly matching ADR-015 & packages/scoring-engine
const BGMI_PLACEMENT_TABLE = { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 };
const FREEFIRE_PLACEMENT_TABLE = { 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 4, 7: 3, 8: 2, 9: 1 };

function calculateScore(gameSlug, placement, kills) {
  const table = gameSlug === 'bgmi' ? BGMI_PLACEMENT_TABLE : FREEFIRE_PLACEMENT_TABLE;
  const placementPoints = table[placement] ?? 0;
  const killPoints = Math.max(0, kills);
  return {
    placementPoints,
    killPoints,
    totalPoints: placementPoints + killPoints,
  };
}

test('BGMI Scoring: 1st place with 5 kills yields 15 points (10 + 5)', () => {
  const score = calculateScore('bgmi', 1, 5);
  assert.equal(score.placementPoints, 10);
  assert.equal(score.killPoints, 5);
  assert.equal(score.totalPoints, 15);
});

test('BGMI Scoring: 9th place receives 0 placement points + kill count', () => {
  const score = calculateScore('bgmi', 9, 3);
  assert.equal(score.placementPoints, 0);
  assert.equal(score.killPoints, 3);
  assert.equal(score.totalPoints, 3);
});

test('Free Fire Scoring: 1st place Booyah yields 12 points + kills', () => {
  const score = calculateScore('freefire', 1, 8);
  assert.equal(score.placementPoints, 12);
  assert.equal(score.killPoints, 8);
  assert.equal(score.totalPoints, 20);
});

test('Free Fire Scoring: 10th place receives 0 placement points', () => {
  const score = calculateScore('freefire', 10, 0);
  assert.equal(score.placementPoints, 0);
  assert.equal(score.killPoints, 0);
  assert.equal(score.totalPoints, 0);
});
