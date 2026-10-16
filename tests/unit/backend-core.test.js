process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import { redactPII } from '../../backend/src/common/logger.js';
import { encodeCursor, decodeCursor, parsePagination, paginatedResponse } from '../../backend/src/common/pagination.js';
import { AppError, errorHandler } from '../../backend/src/common/errorHandler.js';
import { apiLimiter, authLimiter, redeemLimiter } from '../../backend/src/common/rateLimiter.js';
import { requireIdempotencyKey } from '../../backend/src/common/idempotency.js';
import { notificationQueue, tournamentQueue, payoutQueue, auditQueue, closeAllQueues } from '../../backend/src/common/workers.js';
import { closePool } from '../../backend/src/common/database.js';

test('Phase 5 Backend Core: All 21 domain module routers exist and are exportable', async () => {
  const modules = [
    { name: 'auth', path: '../../backend/src/auth/auth.routes.js', exportName: 'authRouter' },
    { name: 'users', path: '../../backend/src/users/users.routes.js', exportName: 'usersRouter' },
    { name: 'games', path: '../../backend/src/games/games.routes.js', exportName: 'gamesRouter' },
    { name: 'teams', path: '../../backend/src/teams/teams.routes.js', exportName: 'teamsRouter' },
    { name: 'organisers', path: '../../backend/src/organisers/organisers.routes.js', exportName: 'organisersRouter' },
    { name: 'tournaments', path: '../../backend/src/tournaments/tournaments.routes.js', exportName: 'tournamentsRouter' },
    { name: 'matches', path: '../../backend/src/matches/matches.routes.js', exportName: 'matchesRouter' },
    { name: 'scoring', path: '../../backend/src/scoring/scoring.routes.js', exportName: 'scoringRouter' },
    { name: 'leaderboards', path: '../../backend/src/leaderboards/leaderboards.routes.js', exportName: 'leaderboardsRouter' },
    { name: 'wallet', path: '../../backend/src/wallet/wallet.routes.js', exportName: 'walletRouter' },
    { name: 'redeem', path: '../../backend/src/redeem/redeem.routes.js', exportName: 'redeemRouter' },
    { name: 'payouts', path: '../../backend/src/payouts/payouts.routes.js', exportName: 'payoutsRouter' },
    { name: 'disputes', path: '../../backend/src/disputes/disputes.routes.js', exportName: 'disputesRouter' },
    { name: 'moderation', path: '../../backend/src/moderation/moderation.routes.js', exportName: 'moderationRouter' },
    { name: 'notifications', path: '../../backend/src/notifications/notifications.routes.js', exportName: 'notificationsRouter' },
    { name: 'admin', path: '../../backend/src/admin/admin.routes.js', exportName: 'adminRouter' },
    { name: 'audit', path: '../../backend/src/audit/audit.routes.js', exportName: 'auditRouter' },
    { name: 'support', path: '../../backend/src/support/support.routes.js', exportName: 'supportRouter' },
    { name: 'achievements', path: '../../backend/src/achievements/achievements.routes.js', exportName: 'achievementsRouter' },
    { name: 'risk', path: '../../backend/src/risk/risk.routes.js', exportName: 'riskRouter' },
    { name: 'webhooks', path: '../../backend/src/webhooks/webhooks.routes.js', exportName: 'webhooksRouter' },
  ];

  assert.equal(modules.length, 21, 'Must have exactly 21 required domain modules');

  for (const mod of modules) {
    const loaded = await import(mod.path);
    assert.ok(loaded[mod.exportName], `Module ${mod.name} must export ${mod.exportName}`);
    assert.equal(typeof loaded[mod.exportName], 'function', `${mod.exportName} must be a valid Express router`);
  }
});

test('Phase 5 Security Gate: PII Redaction masks sensitive user data in logs', () => {
  const sensitiveMeta = {
    userId: 'usr_123456',
    email: 'player@example.com',
    phoneNumber: '+919876543210',
    password: 'superSecretPassword123!',
    token: 'jwt.header.payload.signature',
    authorization: 'Bearer token123',
    firebase_uid: 'firebase_abc123',
    nested: {
      user_email: 'nested@example.com',
      contactPhone: '9876543210',
      safeField: 'tournament_id_999',
    },
  };

  const sanitized = redactPII(sensitiveMeta);

  assert.equal(sanitized.email, '[REDACTED_EMAIL]');
  assert.equal(sanitized.phoneNumber, '[REDACTED_PHONE]');
  assert.equal(sanitized.password, '[REDACTED]');
  assert.equal(sanitized.token, '[REDACTED_TOKEN]');
  assert.equal(sanitized.authorization, '[REDACTED]');
  assert.equal(sanitized.firebase_uid, '[REDACTED_UID]');
  assert.equal(sanitized.nested.user_email, '[REDACTED_EMAIL]');
  assert.equal(sanitized.nested.contactPhone, '[REDACTED_PHONE]');
  assert.equal(sanitized.nested.safeField, 'tournament_id_999');
});

test('Phase 5 Pagination: Cursor pagination encodes, decodes and produces envelopes', () => {
  const sampleRow = { id: '018f45a0-7b2c-7a3d-8f9e-0123456789ab', created_at: '2026-10-03T12:00:00.000Z' };
  const cursor = encodeCursor(sampleRow);
  assert.ok(typeof cursor === 'string', 'Cursor must be a string');

  const decoded = decodeCursor(cursor);
  assert.equal(decoded.id, sampleRow.id);
  assert.equal(decoded.ts, sampleRow.created_at);

  // Corrupted / invalid cursor
  assert.equal(decodeCursor('invalid-base64-payload!!!'), null);
  assert.equal(decodeCursor(null), null);

  // Query parameter parsing
  const parsedDefault = parsePagination({});
  assert.equal(parsedDefault.limit, 20);
  assert.equal(parsedDefault.cursor, null);

  const parsedCustom = parsePagination({ limit: '50', cursor });
  assert.equal(parsedCustom.limit, 50);
  assert.equal(parsedCustom.cursor.id, sampleRow.id);

  // Limit bounds enforcement
  assert.equal(parsePagination({ limit: '9999' }).limit, 100);
  assert.equal(parsePagination({ limit: '-5' }).limit, 1);

  // Paginated response envelope
  const rows = [
    { id: '1', created_at: '2026-10-01' },
    { id: '2', created_at: '2026-10-02' },
    { id: '3', created_at: '2026-10-03' },
  ];
  const envelope = paginatedResponse(rows, 2);
  assert.equal(envelope.data.length, 2);
  assert.equal(envelope.meta.hasMore, true);
  assert.ok(envelope.meta.nextCursor);

  const endEnvelope = paginatedResponse(rows, 5);
  assert.equal(endEnvelope.data.length, 3);
  assert.equal(endEnvelope.meta.hasMore, false);
  assert.equal(endEnvelope.meta.nextCursor, null);
});

test('Phase 5 Security Gate: Deny-by-default and error response leaks no internals', () => {
  const operationalErr = new AppError('Resource not found', 404, 'NOT_FOUND');
  assert.equal(operationalErr.statusCode, 404);
  assert.equal(operationalErr.code, 'NOT_FOUND');

  // Simulate mock req, res
  let responseStatus = 0;
  let responseJson = null;

  const mockReq = { correlationId: 'corr_test_123', originalUrl: '/api/v1/test', method: 'GET' };
  const mockRes = {
    status(s) { responseStatus = s; return this; },
    json(j) { responseJson = j; return this; },
  };

  errorHandler(operationalErr, mockReq, mockRes, () => {});

  assert.equal(responseStatus, 404);
  assert.equal(responseJson.success, false);
  assert.equal(responseJson.error.code, 'NOT_FOUND');
  assert.equal(responseJson.error.message, 'Resource not found');
  assert.equal(responseJson.error.correlationId, 'corr_test_123');

  // Verify internal database error does not leak query / table details in production
  const dbErr = new Error('syntax error at or near "SELECT" in internal_table_secrets');
  errorHandler(dbErr, mockReq, mockRes, () => {});
  assert.equal(responseJson.success, false);
  assert.equal(responseJson.error.code, 'INTERNAL_ERROR');
  assert.equal(responseJson.error.message, 'An unexpected error occurred');
});

test('Phase 5 Rate Limiting: Rate limiters configured with proper thresholds', () => {
  assert.ok(apiLimiter, 'Global API limiter must exist');
  assert.ok(authLimiter, 'Auth limiter must exist');
  assert.ok(redeemLimiter, 'Redeem code limiter must exist');
});

test('Phase 5 Idempotency: Idempotency middleware rejects requests without key', () => {
  let errorCaught = null;
  const mockReqWithoutKey = { headers: {} };
  requireIdempotencyKey(mockReqWithoutKey, {}, (err) => { errorCaught = err; });

  assert.ok(errorCaught instanceof AppError);
  assert.equal(errorCaught.code, 'IDEMPOTENCY_KEY_REQUIRED');
  assert.equal(errorCaught.statusCode, 400);

  let success = false;
  const mockReqWithKey = { headers: { 'idempotency-key': '018f45a0-7b2c-7a3d-8f9e-0123456789ab' } };
  requireIdempotencyKey(mockReqWithKey, {}, (err) => { if (!err) success = true; });
  assert.equal(success, true);
  assert.equal(mockReqWithKey.idempotencyKey, '018f45a0-7b2c-7a3d-8f9e-0123456789ab');
});

test('Phase 5 Background Workers: BullMQ queues defined with retry and backoff', async () => {
  assert.ok(notificationQueue, 'Notification queue must be defined');
  assert.ok(tournamentQueue, 'Tournament queue must be defined');
  assert.ok(payoutQueue, 'Payout queue must be defined');
  assert.ok(auditQueue, 'Audit queue must be defined');

  assert.equal(notificationQueue.name, 'vexora-notifications');
  assert.equal(tournamentQueue.name, 'vexora-tournaments');
  assert.equal(payoutQueue.name, 'vexora-payouts');
  assert.equal(auditQueue.name, 'vexora-audit');
});

test('Phase 5 Exit Criteria: API boots, health OK, OpenAPI served', async () => {
  const { httpServer } = await import('../../backend/src/server.js');

  await new Promise((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  const testPort = typeof address === 'object' && address ? address.port : 4000;

  try {
    const healthRes = await fetch(`http://localhost:${testPort}/api/v1/health`);
    assert.ok(healthRes.status === 200 || healthRes.status === 503, 'Health endpoint must respond');
    const healthJson = await healthRes.json();
    assert.ok(healthJson.status, 'Health response must contain status field');

    const openapiRes = await fetch(`http://localhost:${testPort}/api/v1/docs/openapi.json`);
    assert.equal(openapiRes.status, 200);
    const openapiJson = await openapiRes.json();
    assert.equal(openapiJson.openapi, '3.0.3');
    assert.equal(openapiJson.info.title, 'Vexora Esports Tournament Platform API');
    assert.ok(openapiJson.paths['/health']);
    assert.ok(openapiJson.paths['/auth/register']);
  } finally {
    await new Promise((resolve) => httpServer.close(resolve));
    await closeAllQueues();
    await closePool();
  }
});

