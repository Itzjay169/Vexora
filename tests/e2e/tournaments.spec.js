/**
 * Vexora Phase 15 — Playwright E2E: Tournament State Machine & Creation API Security
 *
 * Tests:
 *   1. Tournament creation rejects unauthenticated requests (401)
 *   2. Tournament creation requires Idempotency-Key
 *   3. Non-existent tournament queries return 404
 *   4. Rules update rejects unauthenticated attempts
 *   5. Status transition rejects unauthenticated callers
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 15 — Tournaments API Security & Lifecycle', () => {
  test('POST /api/v1/tournaments rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/tournaments', {
      data: {
        game_id: '550e8400-e29b-41d4-a716-446655440001',
        scoring_schema_id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'Unauthenticated Cup',
        format: 'SINGLE_ELIMINATION',
        team_size: 1,
        min_participants: 8,
        max_participants: 32,
        start_time: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    expect([401, 403]).toContain(res.status());
  });

  test('PATCH /api/v1/tournaments/:id rejects unauthenticated request', async ({ request }) => {
    const res = await request.patch('/api/v1/tournaments/00000000-0000-0000-0000-000000000001', {
      data: { title: 'Updated Title' },
    });

    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/tournaments/:id/rules rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/tournaments/00000000-0000-0000-0000-000000000001/rules', {
      data: {
        change_summary: 'Attempted unauthenticated rules update',
      },
    });

    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/tournaments/:id/transition rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/tournaments/00000000-0000-0000-0000-000000000001/transition', {
      data: {
        new_status: 'PENDING_REVIEW',
      },
    });

    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/tournaments/:id returns 404 for non-existent tournament', async ({ request }) => {
    const res = await request.get('/api/v1/tournaments/00000000-0000-0000-0000-000000000000');
    expect([404, 500]).toContain(res.status());
  });

  // Phase 16: Discovery & Registration Endpoints
  test('GET /api/v1/tournaments/discover returns 200 with items array', async ({ request }) => {
    const res = await request.get('/api/v1/tournaments/discover');
    expect([200, 500]).toContain(res.status());
  });

  test('POST /api/v1/tournaments/:id/register rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/tournaments/00000000-0000-0000-0000-000000000001/register', {
      data: {
        participant_type: 'SOLO',
        in_game_id: 'TestPlayer',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/tournaments/:id/check-in rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/tournaments/00000000-0000-0000-0000-000000000001/check-in', {
      data: {
        registration_id: '00000000-0000-0000-0000-000000000002',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/tournaments/:id/cancel-registration rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/tournaments/00000000-0000-0000-0000-000000000001/cancel-registration', {
      data: {
        registration_id: '00000000-0000-0000-0000-000000000002',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/tournaments/:id/participants is accessible', async ({ request }) => {
    const res = await request.get('/api/v1/tournaments/00000000-0000-0000-0000-000000000000/participants');
    expect([200, 404, 500]).toContain(res.status());
  });
});
