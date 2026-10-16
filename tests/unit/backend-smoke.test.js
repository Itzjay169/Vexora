import test from 'node:test';
import assert from 'node:assert/strict';
import { healthRouter } from '../../backend/src/common/health.js';
import { AppError } from '../../backend/src/common/errorHandler.js';

test('Backend Smoke: Health router is defined and handles status check', () => {
  assert.ok(healthRouter, 'Health router must be exported');
  assert.equal(typeof healthRouter, 'function', 'Router must be a middleware function');
});

test('Backend Smoke: AppError generates correct HTTP status and code', () => {
  const err = new AppError('Unauthorized access attempt', 401, 'AUTH_REQUIRED');
  assert.equal(err.statusCode, 401);
  assert.equal(err.code, 'AUTH_REQUIRED');
  assert.equal(err.isOperational, true);
  assert.equal(err.message, 'Unauthorized access attempt');
});

test('Backend Smoke: Module routers exist', async () => {
  const { gamesRouter } = await import('../../backend/src/games/games.routes.js');
  const { scoringRouter } = await import('../../backend/src/scoring/scoring.routes.js');
  assert.ok(gamesRouter, 'Games router must exist');
  assert.ok(scoringRouter, 'Scoring router must exist');
});
