/**
 * Vexora Phase 25 — Playwright E2E: Double-Entry Ledger & Wallet Service
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 8, 16, 39 Phase 6, 47)
 *
 * Tests:
 *   1. GET /api/v1/wallet/balance rejects unauthenticated request (401/403)
 *   2. GET /api/v1/wallet/transactions rejects unauthenticated request (401/403)
 *   3. POST /api/v1/wallet/holds rejects unauthenticated request (401/403)
 *   4. POST /api/v1/wallet/releases rejects unauthenticated request (401/403)
 *   5. POST /api/v1/wallet/adjustments/request rejects unauthenticated request (401/403)
 *   6. POST /api/v1/wallet/adjustments/:id/adjudicate rejects unauthenticated request (401/403)
 *   7. GET /api/v1/wallet/verify-invariants rejects unauthenticated request (401/403)
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 25 — Double-Entry Ledger & Wallet Endpoints', () => {
  const dummyId = '00000000-0000-0000-0000-000000000001';

  test('GET /api/v1/wallet/balance rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/wallet/balance');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/wallet/transactions rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/wallet/transactions');
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/wallet/holds rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/wallet/holds', {
      data: {
        tournament_id: dummyId,
        amount: 50.0,
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/wallet/releases rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/wallet/releases', {
      data: {
        tournament_id: dummyId,
        amount: 50.0,
        reason: 'Tournament check-in completed',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/wallet/adjustments/request rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/wallet/adjustments/request', {
      data: {
        wallet_id: dummyId,
        amount: 100.0,
        direction: 'CREDIT',
        reason: 'Unauthorized adjustment attempt',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/wallet/adjustments/:id/adjudicate rejects unauthenticated request', async ({ request }) => {
    const res = await request.post(`/api/v1/wallet/adjustments/${dummyId}/adjudicate`, {
      data: {
        decision: 'APPROVE',
        justification: 'Unauthorized approval attempt',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/wallet/verify-invariants rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/wallet/verify-invariants');
    expect([401, 403]).toContain(res.status());
  });
});
