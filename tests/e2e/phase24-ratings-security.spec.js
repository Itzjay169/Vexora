/**
 * Vexora Phase 24 — Playwright E2E: Ratings, Reputation & Security Centre v1
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 12, 21, 39 Phase 5, 47)
 *
 * Tests:
 *   1. POST /api/v1/ratings/tournaments/:id rejects unauthenticated rating submission (401/403)
 *   2. POST /api/v1/ratings/:id/appeal rejects unauthenticated review appeal (401/403)
 *   3. POST /api/v1/ratings/appeals/:id/adjudicate rejects unauthorized/non-moderator review (401/403)
 *   4. POST /api/v1/ratings/tournaments/:id/report-participant rejects unauthenticated participant report (401/403)
 *   5. GET /api/v1/admin/security/overview rejects unauthenticated request (401/403)
 *   6. GET /api/v1/admin/security/failed-logins rejects unauthenticated request (401/403)
 *   7. GET /api/v1/admin/security/blocked-ips rejects unauthenticated request (401/403)
 *   8. POST /api/v1/admin/security/blocked-ips rejects unauthenticated request (401/403)
 *   9. GET /api/v1/admin/security/break-glass rejects unauthenticated request (401/403)
 *  10. POST /api/v1/admin/security/audit-integrity rejects unauthenticated request (401/403)
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 24 — Ratings, Reputation & Security Centre Endpoints', () => {
  const dummyId = '00000000-0000-0000-0000-000000000001';

  test('POST /api/v1/ratings/tournaments/:id rejects unauthenticated rating submission', async ({ request }) => {
    const res = await request.post(`/api/v1/ratings/tournaments/${dummyId}`, {
      data: {
        communication_score: 5,
        schedule_score: 5,
        result_score: 5,
        review_text: 'Unauthenticated rating test',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/ratings/:id/appeal rejects unauthenticated review appeal', async ({ request }) => {
    const res = await request.post(`/api/v1/ratings/${dummyId}/appeal`, {
      data: {
        grounds: 'DEMONSTRABLY_FALSE',
        explanation: 'Unauthenticated review dispute attempt',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/ratings/appeals/:id/adjudicate rejects unauthenticated adjudication', async ({ request }) => {
    const res = await request.post(`/api/v1/ratings/appeals/${dummyId}/adjudicate`, {
      data: {
        decision: 'UPHELD',
        reason: 'Unauthenticated appeal ruling attempt',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/ratings/tournaments/:id/report-participant rejects unauthenticated participant report', async ({ request }) => {
    const res = await request.post(`/api/v1/ratings/tournaments/${dummyId}/report-participant`, {
      data: {
        participant_id: dummyId,
        category: 'NO_SHOW',
        reason: 'Unauthenticated conduct report attempt',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/admin/security/overview rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/admin/security/overview');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/admin/security/failed-logins rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/admin/security/failed-logins');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/admin/security/blocked-ips rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/admin/security/blocked-ips');
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/admin/security/blocked-ips rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/admin/security/blocked-ips', {
      data: {
        ip_address: '198.51.100.44',
        reason: 'Unauthenticated IP block attempt',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/admin/security/break-glass rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/admin/security/break-glass');
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/admin/security/audit-integrity rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/admin/security/audit-integrity', {
      data: {},
    });
    expect([401, 403]).toContain(res.status());
  });
});
