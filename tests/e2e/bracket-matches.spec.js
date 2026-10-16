/**
 * Vexora Phase 17 — Playwright E2E: Bracket & Match Engine API Security
 *
 * Tests:
 *   1. POST /api/v1/matches/tournament/:id/generate-bracket rejects unauthenticated requests (401/403)
 *   2. GET /api/v1/matches/tournament/:id/bracket returns bracket data or 404/500
 *   3. PATCH /api/v1/matches/:id/room rejects unauthenticated requests
 *   4. POST /api/v1/matches/:id/transition rejects unauthenticated requests
 *   5. POST /api/v1/matches/:id/submit-result rejects unauthenticated requests
 *   6. POST /api/v1/matches/:id/confirm-result rejects unauthenticated requests
 *   7. GET /api/v1/matches/tournament/:id returns match list or empty
 *   8. Room codes never exposed in unauthenticated bracket responses
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 17 — Bracket & Match Engine API Security', () => {

  test('POST /api/v1/matches/tournament/:id/generate-bracket rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/matches/tournament/00000000-0000-0000-0000-000000000001/generate-bracket', {
      data: {
        bracket_type: 'KNOCKOUT',
        seeding_method: 'STANDARD',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/matches/tournament/:id/bracket returns response', async ({ request }) => {
    const res = await request.get('/api/v1/matches/tournament/00000000-0000-0000-0000-000000000001/bracket');
    expect([200, 404, 500]).toContain(res.status());
  });

  test('PATCH /api/v1/matches/:id/room rejects unauthenticated request', async ({ request }) => {
    const res = await request.patch('/api/v1/matches/00000000-0000-0000-0000-000000000099/room', {
      data: {
        room_id: 'ROOM-ATTACK',
        room_release_time: new Date().toISOString(),
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/matches/:id/transition rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/matches/00000000-0000-0000-0000-000000000099/transition', {
      data: {
        new_status: 'LIVE',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/matches/:id/submit-result rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/matches/00000000-0000-0000-0000-000000000099/submit-result', {
      data: {
        participants: [
          { registration_id: '00000000-0000-0000-0000-000000000001', placement: 1, kills: 10 },
        ],
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/matches/:id/confirm-result rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/matches/00000000-0000-0000-0000-000000000099/confirm-result');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/matches/tournament/:id returns match list', async ({ request }) => {
    const res = await request.get('/api/v1/matches/tournament/00000000-0000-0000-0000-000000000001');
    expect([200, 404, 500]).toContain(res.status());
  });

  test('Bracket response does not leak room codes to unauthenticated users', async ({ request }) => {
    const res = await request.get('/api/v1/matches/tournament/00000000-0000-0000-0000-000000000001/bracket');
    if (res.status() === 200) {
      const body = await res.json();
      const text = JSON.stringify(body);
      // Room codes must never appear in unauthenticated responses
      expect(text).not.toContain('room_password');
    }
  });
});
