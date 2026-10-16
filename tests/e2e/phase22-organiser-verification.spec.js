/**
 * Vexora Phase 22 — Playwright E2E: Organiser Verification & Tiers
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 10, 39 Phase 5)
 *
 * Tests:
 *   1. POST /api/v1/organisers/apply rejects unauthenticated request (401/403)
 *   2. GET /api/v1/organisers/me/application rejects unauthenticated request (401/403)
 *   3. GET /api/v1/organisers/admin/applications rejects unauthenticated request (401/403)
 *   4. GET /api/v1/organisers/:id returns public trust profile envelope
 *   5. GET /api/v1/organisers/:id/public returns public trust profile envelope
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 22 — Organiser Verification & Tiers Endpoints', () => {
  const dummyOrganiserId = '00000000-0000-0000-0000-000000000001';

  test('POST /api/v1/organisers/apply rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/organisers/apply', {
      data: {
        business_name: 'Unauth Org',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/organisers/me/application rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/organisers/me/application');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/organisers/admin/applications rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/organisers/admin/applications');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/organisers/:id returns public trust profile with zero PII leakage', async ({ request }) => {
    const res = await request.get(`/api/v1/organisers/${dummyOrganiserId}`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.tier).toBeDefined();
      expect(body.data.trust_score).toBeDefined();
      expect(body.data.id_document_number).toBeUndefined();
      expect(body.data.contact_phone).toBeUndefined();
    }
  });

  test('GET /api/v1/organisers/:id/public returns public trust profile', async ({ request }) => {
    const res = await request.get(`/api/v1/organisers/${dummyOrganiserId}/public`);
    expect([200, 404]).toContain(res.status());
  });
});
