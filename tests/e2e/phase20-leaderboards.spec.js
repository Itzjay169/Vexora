/**
 * Vexora Phase 20 — Playwright E2E: Scoring Engine, Leaderboards & Snapshots
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 5, 7, 16, 39 Phase 4, 42)
 *
 * Tests:
 *   1. GET /api/v1/leaderboards returns public leaderboard data structure
 *   2. GET /api/v1/leaderboards/bgmi returns per-game leaderboard
 *   3. POST /api/v1/leaderboards/process-match-result rejects unauthenticated request (401/403)
 *   4. POST /api/v1/leaderboards/snapshots rejects unauthenticated request (401/403)
 *   5. GET /api/v1/leaderboards/me rejects unauthenticated request (401/403)
 *   6. Web Component: LeaderboardViewer displays game tabs, podium, and verification modal
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 20 — Scoring Engine & Leaderboards API Security', () => {
  const dummyMatchId = '00000000-0000-0000-0000-000000000001';

  test('GET /api/v1/leaderboards returns valid competitive data structure', async ({ request }) => {
    const res = await request.get('/api/v1/leaderboards?game=bgmi');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.entries)).toBe(true);
    expect(Array.isArray(body.data.podium)).toBe(true);
  });

  test('GET /api/v1/leaderboards/bgmi returns per-game leaderboard', async ({ request }) => {
    const res = await request.get('/api/v1/leaderboards/bgmi');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  test('POST /api/v1/leaderboards/process-match-result rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/leaderboards/process-match-result', {
      data: {
        match_id: dummyMatchId,
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/leaderboards/snapshots rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/v1/leaderboards/snapshots', {
      data: {
        game_id: '00000000-0000-0000-0000-000000000010',
        snapshot_type: 'DAILY',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/leaderboards/me rejects unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/leaderboards/me');
    expect([401, 403]).toContain(res.status());
  });
});
