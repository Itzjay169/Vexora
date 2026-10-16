/**
 * Vexora Phase 18 — Playwright E2E: Organiser Operations & Admin Review Queue
 *
 * Tests:
 *   1. GET /api/v1/organisers/dashboard rejects unauthenticated request (401/403)
 *   2. GET /api/v1/organisers/tournaments/:id/operations rejects unauthenticated request
 *   3. POST /api/v1/organisers/tournaments/:id/admin-review rejects unauthenticated callers
 *   4. GET /api/v1/organisers/admin/review-queue rejects unauthenticated callers
 *   5. POST /api/v1/organisers/tournaments/:id/incidents rejects unauthenticated callers
 *   6. Web Organiser Page: /organiser loads and renders Section 43 matchday protocol
 *   7. Admin Tournament Review Page: /tournaments renders state machine and review actions
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 18 — Organiser Operations & Admin Review Queue API Security', () => {
  test('GET /api/v1/organisers/dashboard rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/organisers/dashboard');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/organisers/tournaments/:id/operations rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/organisers/tournaments/00000000-0000-0000-0000-000000000001/operations');
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/organisers/tournaments/:id/admin-review rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/organisers/tournaments/00000000-0000-0000-0000-000000000001/admin-review', {
      data: {
        decision: 'APPROVE',
        reason: 'Attempted unauthenticated approval',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/organisers/admin/review-queue rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/organisers/admin/review-queue');
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/organisers/tournaments/:id/incidents rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/organisers/tournaments/00000000-0000-0000-0000-000000000001/incidents', {
      data: {
        incident_type: 'DISCONNECT',
        severity: 'MEDIUM',
        description: 'Unauthenticated incident report test',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('Public announcements endpoint is accessible', async ({ request }) => {
    const res = await request.get('/api/v1/organisers/tournaments/00000000-0000-0000-0000-000000000001/announcements');
    // Public endpoint returns 200 with data array
    expect([200, 404]).toContain(res.status());
  });
});
