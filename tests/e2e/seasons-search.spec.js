/**
 * Vexora Phase 14 — Playwright E2E: Seasons & Search Security
 *
 * Tests:
 *   1. Search API endpoints respond with structured results
 *   2. Seasons public endpoint lists competitive seasons
 *   3. Mutating season endpoints reject unauthenticated calls
 *   4. Player search projection strictly adheres to data minimisation
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 14 — Search API & Data Minimisation', () => {
  test('GET /api/v1/search requires query string parameter', async ({ request }) => {
    const res = await request.get('/api/v1/search');
    // Validation failure or empty results
    expect([400, 422]).toContain(res.status());
  });

  test('GET /api/v1/search/games returns list for empty/valid search', async ({ request }) => {
    const res = await request.get('/api/v1/search/games?q=bgmi');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('GET /api/v1/search/players ensures zero private field leakage', async ({ request }) => {
    const res = await request.get('/api/v1/search/players?q=player');
    if (res.status() === 200) {
      const body = await res.json();
      const players = body.data || [];
      for (const p of players) {
        expect(p).not.toHaveProperty('email');
        expect(p).not.toHaveProperty('phone');
        expect(p).not.toHaveProperty('password_hash');
        expect(p).not.toHaveProperty('firebase_uid');
      }
    }
  });
});

test.describe('Phase 14 — Seasons API Security', () => {
  test('GET /api/v1/seasons lists seasons publicly', async ({ request }) => {
    const res = await request.get('/api/v1/seasons');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('POST /api/v1/seasons rejects unauthenticated creation request', async ({ request }) => {
    const res = await request.post('/api/v1/seasons', {
      data: {
        game_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Hacker Season',
        slug: 'hacker_season',
        start_at: '2026-10-01T00:00:00Z',
        end_at: '2026-12-01T00:00:00Z',
      },
    });

    expect([401, 403]).toContain(res.status());
  });
});
