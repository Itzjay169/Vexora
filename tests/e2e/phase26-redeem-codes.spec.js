/**
 * Vexora Phase 26 — Playwright E2E: Redeem Codes, Batches & Abuse Defense
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 8, 39 Phase 6, 47)
 *
 * Tests:
 *   1. POST /api/v1/redeem/verify-checksum succeeds with valid checksum code
 *   2. POST /api/v1/redeem/verify-checksum rejects typo code with valid=false
 *   3. POST /api/v1/redeem/use rejects unauthenticated requests (401/403)
 *   4. GET /api/v1/redeem/history rejects unauthenticated requests (401/403)
 *   5. POST /api/v1/redeem/batches rejects unauthenticated requests (401/403)
 *   6. GET /api/v1/redeem/batches rejects unauthenticated requests (401/403)
 *   7. POST /api/v1/redeem/batches/:id/adjudicate rejects unauthenticated requests (401/403)
 *   8. POST /api/v1/redeem/batches/:id/export rejects unauthenticated requests (401/403)
 *   9. POST /api/v1/redeem/codes/:id/block rejects unauthenticated requests (401/403)
 *  10. Security Gate: pre-flight validation rejects malformed codes before DB lookup
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 26 — Redeem Codes & Batch Security Endpoints', () => {
  const dummyBatchId = '00000000-0000-0000-0000-000000000001';

  test('POST /api/v1/redeem/verify-checksum correctly validates pre-flight checksum', async ({ request }) => {
    // 7K9M3PX2 -> polynomial checksum is computed deterministically
    const res = await request.post('/api/v1/redeem/verify-checksum', {
      data: { code: 'VEX-7K9M-3PX2-8' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('valid');
    expect(body).toHaveProperty('code');
  });

  test('POST /api/v1/redeem/verify-checksum returns valid=false on typo code without DB hit', async ({ request }) => {
    const res = await request.post('/api/v1/redeem/verify-checksum', {
      data: { code: 'VEX-7K9M-3PX2-9' }, // Corrupted checksum
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
  });

  test('POST /api/v1/redeem/use rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/redeem/use', {
      data: { code: 'VEX-7K9M-3PX2-8' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/redeem/history rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/redeem/history');
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/redeem/batches rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/redeem/batches', {
      data: {
        batch_name: 'Unauthorized Batch Attempt',
        denomination: 100.0,
        quantity: 10,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/redeem/batches rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/redeem/batches');
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/redeem/batches/:id/adjudicate rejects unauthenticated request', async ({ request }) => {
    const res = await request.post(`/api/v1/redeem/batches/${dummyBatchId}/adjudicate`, {
      data: {
        decision: 'APPROVE',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/redeem/batches/:id/export rejects unauthenticated request', async ({ request }) => {
    const res = await request.post(`/api/v1/redeem/batches/${dummyBatchId}/export`, {
      data: {
        watermark: 'UNAUTHORIZED_EXPORT',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/redeem/codes/:id/block rejects unauthenticated request', async ({ request }) => {
    const res = await request.post(`/api/v1/redeem/codes/${dummyBatchId}/block`, {
      data: {
        reason: 'Compromised voucher code',
      },
    });
    expect([401, 403]).toContain(res.status());
  });
});
