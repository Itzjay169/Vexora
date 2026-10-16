import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RealtimeService,
  EVENT_CATALOGUE,
  MAX_MESSAGES_PER_MINUTE,
  MAX_PAYLOAD_BYTES,
  HEARTBEAT_INTERVAL_MS,
} from '../../backend/src/realtime/realtime.service.js';

import {
  RealtimeChannelAuthorizeSchema,
  RealtimeReplayRequestSchema,
  RealtimeBroadcastSchema,
} from '../../packages/validation/src/index.ts';

describe('Phase 29: Real-Time Gateway & WebSocket Architecture', () => {

  // ─── 1. Section 14 Event Catalogue ─────────────────────────────────────
  describe('Section 14 Event Catalogue', () => {
    it('contains all 11 canonical real-time event definitions', () => {
      assert.equal(EVENT_CATALOGUE.TOURNAMENT_REGISTRATION, 'tournament.registration');
      assert.equal(EVENT_CATALOGUE.TOURNAMENT_STATUS_CHANGE, 'tournament.status_change');
      assert.equal(EVENT_CATALOGUE.MATCH_START, 'match.start');
      assert.equal(EVENT_CATALOGUE.RESULT_SUBMITTED, 'match.result_submitted');
      assert.equal(EVENT_CATALOGUE.RESULT_FINALISED, 'match.result_finalised');
      assert.equal(EVENT_CATALOGUE.DISPUTE_OPENED, 'dispute.opened');
      assert.equal(EVENT_CATALOGUE.DISPUTE_UPDATED, 'dispute.updated');
      assert.equal(EVENT_CATALOGUE.WALLET_TRANSACTION, 'wallet.transaction');
      assert.equal(EVENT_CATALOGUE.PAYOUT_STATUS, 'payout.status');
      assert.equal(EVENT_CATALOGUE.ANNOUNCEMENT, 'announcement.broadcast');
      assert.equal(EVENT_CATALOGUE.LEADERBOARD_UPDATE, 'leaderboard.update');
      assert.equal(Object.keys(EVENT_CATALOGUE).length, 11);
    });
  });

  // ─── 2. Channel Authorization Security Gate ───────────────────────────
  describe('Channel Authorization & Anti-Eavesdropping Security Gate', () => {
    const playerAlice = { id: 'usr-alice-1', role: 'PLAYER' };
    const playerBob = { id: 'usr-bob-2', role: 'PLAYER' };
    const adminUser = { id: 'usr-admin-3', role: 'SUPER_ADMIN' };
    const financeUser = { id: 'usr-finance-4', role: 'FINANCE' };

    it('allows public channel access for anonymous users', async () => {
      const res1 = await RealtimeService.canSubscribe(null, 'leaderboard:bgmi-s3');
      assert.equal(res1.authorized, true);

      const res2 = await RealtimeService.canSubscribe(null, 'announcement:public');
      assert.equal(res2.authorized, true);
    });

    it('rejects unauthenticated subscription to private channels', async () => {
      const res = await RealtimeService.canSubscribe(null, 'wallet:usr-alice-1');
      assert.equal(res.authorized, false);
      assert.ok(res.reason.includes('Authentication required'));
    });

    it('allows a user to subscribe to their OWN wallet channel', async () => {
      const res = await RealtimeService.canSubscribe(playerAlice, 'wallet:usr-alice-1');
      assert.equal(res.authorized, true);
    });

    it('SECURITY GATE: strictly prevents user from subscribing to another user wallet', async () => {
      const res = await RealtimeService.canSubscribe(playerBob, 'wallet:usr-alice-1');
      assert.equal(res.authorized, false);
      assert.ok(res.reason.includes('FORBIDDEN'));
      assert.ok(res.reason.includes('another user wallet'));
    });

    it('allows finance staff or super admin to monitor wallet channels for reconciliation', async () => {
      const res1 = await RealtimeService.canSubscribe(financeUser, 'wallet:usr-alice-1');
      assert.equal(res1.authorized, true);

      const res2 = await RealtimeService.canSubscribe(adminUser, 'wallet:usr-alice-1');
      assert.equal(res2.authorized, true);
    });

    it('strictly forbids normal players from subscribing to admin channels', async () => {
      const res = await RealtimeService.canSubscribe(playerAlice, 'admin:disputes');
      assert.equal(res.authorized, false);
      assert.ok(res.reason.includes('Admin role required'));
    });

    it('allows administrators to subscribe to admin channels', async () => {
      const res = await RealtimeService.canSubscribe(adminUser, 'admin:disputes');
      assert.equal(res.authorized, true);
    });

    it('rejects subscription to unknown channel namespaces', async () => {
      const res = await RealtimeService.canSubscribe(playerAlice, 'secret_backdoor_namespace:123');
      assert.equal(res.authorized, false);
      assert.equal(res.reason, 'Unknown channel namespace');
    });
  });

  // ─── 3. Per-Connection Rate Limiting ──────────────────────────────────
  describe('Per-Connection Rate Limiter', () => {
    it('allows up to 30 messages per minute per socket', () => {
      const socketMap = new Map();
      const socketId = 'sock_test_001';

      // 30 messages should all be allowed
      for (let i = 0; i < 30; i++) {
        const allowed = RealtimeService.checkSocketRateLimit(socketMap, socketId);
        assert.equal(allowed, true, `Message #${i + 1} should be permitted`);
      }

      // 31st message should be blocked
      const blocked = RealtimeService.checkSocketRateLimit(socketMap, socketId);
      assert.equal(blocked, false, '31st message within 1 minute must be rate-limited');
    });

    it('distinct sockets have independent rate limit buckets', () => {
      const socketMap = new Map();
      const socketA = 'sock_A';
      const socketB = 'sock_B';

      for (let i = 0; i < 30; i++) {
        RealtimeService.checkSocketRateLimit(socketMap, socketA);
      }
      // Socket A is now rate-limited
      assert.equal(RealtimeService.checkSocketRateLimit(socketMap, socketA), false);

      // Socket B is clean and permitted
      assert.equal(RealtimeService.checkSocketRateLimit(socketMap, socketB), true);
    });
  });

  // ─── 4. Architectural Constants & Limits ──────────────────────────────
  describe('Gateway Architectural Constants & Guardrails', () => {
    it('maximum messages per minute is 30', () => {
      assert.equal(MAX_MESSAGES_PER_MINUTE, 30);
    });

    it('maximum payload bytes is 64KB (65536 bytes)', () => {
      assert.equal(MAX_PAYLOAD_BYTES, 64 * 1024);
    });

    it('heartbeat interval is 30 seconds (30000 ms)', () => {
      assert.equal(HEARTBEAT_INTERVAL_MS, 30000);
    });
  });

  // ─── 5. Zod Validation Schemas ────────────────────────────────────────
  describe('Zod Validation Schemas', () => {
    it('validates channel authorization input', () => {
      const valid = { channel: 'tournament:trn-7701' };
      const parsed = RealtimeChannelAuthorizeSchema.parse(valid);
      assert.equal(parsed.channel, 'tournament:trn-7701');
    });

    it('rejects channel shorter than 3 characters', () => {
      assert.throws(() => {
        RealtimeChannelAuthorizeSchema.parse({ channel: 'ab' });
      });
    });

    it('validates missed-event replay request', () => {
      const valid = {
        channel: 'tournament:trn-7701',
        lastSequence: 8415,
        limit: 50,
      };
      const parsed = RealtimeReplayRequestSchema.parse(valid);
      assert.equal(parsed.lastSequence, 8415);
      assert.equal(parsed.limit, 50);
    });

    it('applies defaults to replay request', () => {
      const parsed = RealtimeReplayRequestSchema.parse({
        channel: 'tournament:trn-7701',
      });
      assert.equal(parsed.lastSequence, 0);
      assert.equal(parsed.limit, 100);
    });

    it('validates administrative event broadcast schema', () => {
      const valid = {
        channel: 'announcement:public',
        eventType: 'announcement.broadcast',
        payload: { message: 'Lobby 4 starting' },
      };
      const parsed = RealtimeBroadcastSchema.parse(valid);
      assert.equal(parsed.eventType, 'announcement.broadcast');
    });
  });
});
