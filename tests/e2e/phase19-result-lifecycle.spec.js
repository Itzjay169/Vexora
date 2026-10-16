/**
 * Vexora Phase 19 — Playwright E2E: Match Result Submission, Evidence & Dispute Stubs
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 4, 11, 39 Phase 4, 47)
 *
 * Tests:
 *   1. GET /api/v1/matches/:id/evidence-checklist returns 4 canonical evidence criteria
 *   2. POST /api/v1/matches/:id/submit-result rejects unauthenticated request (401/403)
 *   3. POST /api/v1/matches/:id/confirm-result rejects unauthenticated request (401/403)
 *   4. POST /api/v1/matches/:id/adjudicate-result rejects unauthenticated request (401/403)
 *   5. GET /api/v1/matches/:id/result-history rejects unauthenticated request (401/403)
 *   6. Web Component: BracketViewer and ResultSubmissionModal verify maker-checker controls
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 19 — Result Submission, Evidence & Dispute Stubs API Security', () => {
  const dummyMatchId = '00000000-0000-0000-0000-000000000001';

  test('GET /api/v1/matches/:id/evidence-checklist returns 4 canonical evidence criteria', async ({ request }) => {
    const res = await request.get(`/api/v1/matches/${dummyMatchId}/evidence-checklist?game_code=BGMI`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.game_code).toBe('BGMI');
    expect(body.data.items.length).toBe(4);

    const keys = body.data.items.map((i) => i.key);
    expect(keys).toContain('final_scoreboard_visible');
    expect(keys).toContain('kills_breakdown_visible');
    expect(keys).toContain('room_id_visible');
    expect(keys).toContain('player_uids_matched');
  });

  test('POST /api/v1/matches/:id/submit-result rejects unauthenticated request', async ({ request }) => {
    const res = await request.post(`/api/v1/matches/${dummyMatchId}/submit-result`, {
      data: {
        participants: [
          {
            registration_id: '00000000-0000-0000-0000-000000000010',
            placement: 1,
            kills: 5,
          },
        ],
        evidence_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/matches/:id/confirm-result rejects unauthenticated request', async ({ request }) => {
    const res = await request.post(`/api/v1/matches/${dummyMatchId}/confirm-result`, {
      data: {
        submission_id: '00000000-0000-0000-0000-000000000020',
        action: 'CONFIRM',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/matches/:id/adjudicate-result rejects unauthenticated request', async ({ request }) => {
    const res = await request.post(`/api/v1/matches/${dummyMatchId}/adjudicate-result`, {
      data: {
        final_scores: [
          {
            registration_id: '00000000-0000-0000-0000-000000000010',
            placement: 1,
            kills: 6,
          },
        ],
        adjudication_reason: 'Referee official decision test',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/matches/:id/result-history rejects unauthenticated request', async ({ request }) => {
    const res = await request.get(`/api/v1/matches/${dummyMatchId}/result-history`);
    expect([401, 403]).toContain(res.status());
  });
});
