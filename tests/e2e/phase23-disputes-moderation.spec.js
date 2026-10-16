/**
 * Vexora Phase 23 — Playwright E2E: Reports, Disputes, Moderation & Sanctions
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 11, 19, 26, 39 Phase 5)
 *
 * Tests:
 *   1. POST /api/v1/disputes rejects unauthenticated request (401/403)
 *   2. GET /api/v1/disputes rejects unauthenticated request (401/403)
 *   3. POST /api/v1/moderation/reports rejects unauthenticated request (401/403)
 *   4. GET /api/v1/moderation/queue rejects unauthenticated request (401/403)
 *   5. POST /api/v1/moderation/sanctions rejects unauthenticated request (401/403)
 *   6. GET /api/v1/moderation/cases returns valid sanction ladder and case structure
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 23 — Disputes & Moderation Security Endpoints', () => {
  const dummyMatchId = '00000000-0000-0000-0000-000000000001';

  test('POST /api/v1/disputes rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/disputes', {
      data: {
        match_id: dummyMatchId,
        reason: 'WRONG_SCORE',
        description: 'Unauthenticated dispute attempt',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/disputes rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/disputes');
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/moderation/reports rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/moderation/reports', {
      data: {
        target_id: dummyMatchId,
        category: 'CHEATING',
        description: 'Unauthenticated report submission',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/moderation/queue rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/moderation/queue');
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/moderation/sanctions rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/moderation/sanctions', {
      data: {
        user_id: dummyMatchId,
        sanction_type: 'WARNING',
        reason: 'Unauthenticated sanction attempt',
        policy_clause: 'Clause 7.1',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/moderation/cases returns sanction ladder metadata', async ({ request }) => {
    const res = await request.get('/api/v1/moderation/cases');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.sanctionLadder).toBeDefined();
    expect(body.data.sanctionLadder).toContain('WARNING');
    expect(body.data.sanctionLadder).toContain('BAN');
  });
});
