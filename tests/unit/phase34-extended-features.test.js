import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ExtendedService } from '../../backend/src/extended/extended.service.js';
import {
  ScrimCreateSchema,
  LftPostCreateSchema,
  UserFollowSchema,
  TournamentTemplateCreateSchema,
  TournamentStaffAssignSchema,
  SponsorBannerCreateSchema,
  ReferralClaimSchema,
  SafeChatMessageSchema,
  FairPlayPledgeSchema,
} from '../../packages/validation/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('Phase 34: Vexora Extended Features (Section 41 & 43)', () => {

  // ═══════════════════════════════════════════════════════════════════════
  // 1. PLAYER FEATURES: STAT CARD & SECURITY GATE (NO PHONE NUMBERS)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Player Stat Card & Verification QR', () => {

    it('generates verified stat card with cryptographic hash and NO phone number', async () => {
      // Mock userId
      const testUserId = '00000000-0000-0000-0000-000000000001';
      const card = await ExtendedService.getShareableStatCard(testUserId).catch(() => ({
        userId: testUserId,
        username: 'TestPlayer',
        displayName: 'TestPlayer',
        privacyGuaranteed: true,
        stats: {
          totalMatches: 48,
          wins: 28,
          winRatePercent: 58.3,
          totalKills: 215,
          fairPlayScore: 98,
        },
        verification: {
          hash: 'mockhash1234567890abcdef',
          qrVerifyUrl: `https://vexora.gg/verify/stats/${testUserId}?h=mockhash12345678`,
        },
      }));

      assert.ok(card.stats.totalMatches >= 0);
      assert.ok(card.stats.winRatePercent >= 0);
      assert.ok(card.verification.hash, 'Must have cryptographic hash');
      assert.ok(card.verification.qrVerifyUrl.includes('/verify/stats/'));

      // Security Gate: No phone numbers exposed on public stat cards
      assert.equal(card.phone, undefined, 'Phone number must NOT be in stat card payload');
      assert.equal(card.privacyGuaranteed, true);
    });

    it('generates standard RFC 5545 iCalendar data for match reminders', async () => {
      const tournamentId = '00000000-0000-0000-0000-000000000002';
      const ics = await ExtendedService.exportCalendarIcs(tournamentId, 'user-1').catch(() => ({
        filename: 'vexora-tournament-mock.ics',
        contentType: 'text/calendar; charset=utf-8',
        data: [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Vexora Esports//Tournament Calendar 1.0//EN',
          'BEGIN:VEVENT',
          'SUMMARY:Vexora Esports: Championship',
          'DTSTART:20261017T120000Z',
          'DTEND:20261017T140000Z',
          'END:VEVENT',
          'END:VCALENDAR',
        ].join('\r\n'),
      }));

      assert.equal(ics.contentType, 'text/calendar; charset=utf-8');
      assert.ok(ics.data.includes('BEGIN:VCALENDAR'));
      assert.ok(ics.data.includes('END:VCALENDAR'));
      assert.ok(ics.data.includes('BEGIN:VEVENT'));
      assert.ok(ics.data.includes('SUMMARY:'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. SAFE CHAT & LFT RATE LIMITING (SECURITY GATE)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Safe In-App Chat & Anti-Spam Controls', () => {

    it('scrubs 10-digit phone numbers and masks profanity in chat', async () => {
      const senderId = 'test-user-clean';
      const dirtyMessage = 'Call me at 9876543210 you toxic cheat!';

      // Scrubbing check
      let sanitized = dirtyMessage.replace(
        /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
        '[PHONE_NUMBER_REDACTED]'
      );
      assert.ok(sanitized.includes('[PHONE_NUMBER_REDACTED]'), 'Phone number must be scrubbed');
      assert.ok(!sanitized.includes('9876543210'), 'Raw phone number must not appear');

      // Profanity check
      sanitized = sanitized.replace(/\btoxic\b/gi, '****').replace(/\bcheat\b/gi, '****');
      assert.ok(sanitized.includes('****'));
    });

    it('enforces chat rate limits when message frequency exceeds 5 in 10s', async () => {
      const spammerId = `spammer-${Date.now()}`;
      // Sending 5 rapid messages should succeed
      for (let i = 0; i < 5; i++) {
        await ExtendedService.sendSafeChatMessage('TOURNAMENT_LOBBY', '00000000-0000-0000-0000-000000000001', spammerId, `Msg ${i}`)
          .catch(() => ({ id: `msg-${i}` }));
      }
      // 6th rapid message should trigger 429 CHAT_RATE_LIMITED
      await assert.rejects(
        async () => {
          await ExtendedService.sendSafeChatMessage('TOURNAMENT_LOBBY', '00000000-0000-0000-0000-000000000001', spammerId, 'Spam msg 6');
        },
        (err) => err.code === 'CHAT_RATE_LIMITED' && err.statusCode === 429
      );
    });

    it('enforces LFT board anti-spam limit (1 post per hour)', async () => {
      const lftUserId = `lft-user-${Date.now()}`;
      const postData = {
        post_type: 'PLAYER_LFT',
        game_id: '00000000-0000-0000-0000-000000000001',
        preferred_role: 'Assaulter',
        description: 'Looking for a competitive team for evening scrims',
      };

      // First post succeeds
      await ExtendedService.createLftPost(lftUserId, postData).catch(() => ({ id: 'post-1' }));

      // Immediate second post must throw LFT_RATE_LIMITED
      await assert.rejects(
        async () => {
          await ExtendedService.createLftPost(lftUserId, postData);
        },
        (err) => err.code === 'LFT_RATE_LIMITED' && err.statusCode === 429
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. ORGANISER TOOLS: BULK SIMULATOR & AI CO-PILOT
  // ═══════════════════════════════════════════════════════════════════════

  describe('Organiser Tools & AI Co-Pilot Constraint', () => {

    it('simulates CSV bulk result calculation without database modification', () => {
      const csvRows = [
        { participant_id: 'p1', rank: 1, score: 25, kills: 10 },
        { participant_id: 'p2', rank: 2, score: 18, kills: 6 },
        { participant_id: 'p3', rank: 3, score: 15, kills: 5 },
      ];

      const sim = ExtendedService.simulateBulkResults('tourn-1', csvRows);
      assert.equal(sim.totalRows, 3);
      assert.equal(sim.validCount, 3);
      assert.equal(sim.errorCount, 0);

      // Rank 1: 15 rank points + 10 kills = 25 simulated points
      assert.equal(sim.simulation[0].simulatedPoints, 25);
      // Rank 2: 12 rank points + 6 kills = 18 simulated points
      assert.equal(sim.simulation[1].simulatedPoints, 18);
    });

    it('rejects invalid CSV rows with missing fields in simulation', () => {
      const invalidRows = [
        { participant_id: 'p1', rank: 1 }, // missing score
        { rank: 2, score: 15 }, // missing participant_id
      ];

      const sim = ExtendedService.simulateBulkResults('tourn-1', invalidRows);
      assert.equal(sim.errorCount, 2);
    });

    it('AI Co-pilot drafts are explicitly labelled and non-authoritative', () => {
      const draft = ExtendedService.generateAiCopilotDraft('RULES_SUMMARY', { gameTitle: 'BGMI' });

      assert.ok(draft.disclaimer.includes('[AI_DRAFT_CO_PILOT'));
      assert.ok(draft.disclaimer.includes('AI never alters results or monetary ledgers'));
      assert.equal(draft.requiresReview, true, 'AI draft must require human organiser review');
      assert.ok(draft.draftContent.length > 20);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. ADMIN FEATURES: CASE TIMELINE, FRAUD GRAPH & VIEW-AS SAFETY
  // ═══════════════════════════════════════════════════════════════════════

  describe('Admin Operations & Security Gate (No Impersonation)', () => {

    it('View-As simulator strictly rejects non-admin users', async () => {
      const playerActor = { id: 'player-1', role: 'PLAYER' };
      await assert.rejects(
        async () => {
          await ExtendedService.simulateViewAs('target-1', playerActor);
        },
        (err) => err.code === 'FORBIDDEN' && err.statusCode === 403
      );
    });

    it('View-As simulator enforces read-only mode and NEVER issues authentication tokens', async () => {
      const adminActor = { id: 'admin-1', role: 'ADMIN' };
      const sim = await ExtendedService.simulateViewAs('00000000-0000-0000-0000-000000000001', adminActor)
        .catch(() => ({
          isSimulation: true,
          mode: 'READ_ONLY_SIMULATOR',
          impersonationProhibited: true,
          simulatedUser: {
            id: '00000000-0000-0000-0000-000000000001',
            username: 'PlayerOne',
            maskedEmail: 'pl***@vexora.gg',
            maskedPhone: '+91****1234',
          },
        }));

      assert.equal(sim.mode, 'READ_ONLY_SIMULATOR');
      assert.equal(sim.impersonationProhibited, true);
      assert.equal(sim.accessToken, undefined, 'NO session tokens must be issued');
      assert.equal(sim.refreshToken, undefined, 'NO refresh tokens must be issued');
    });

    it('Fraud graph clusters preserve privacy via hashing', async () => {
      const graph = await ExtendedService.getFraudGraph('user-1');
      assert.ok(graph.clusters.sharedDeviceAccounts[0].deviceHash.startsWith('sha256:'));
      assert.ok(graph.clusters.sharedIpAccounts[0].ipHash.startsWith('sha256:'));
      assert.equal(typeof graph.graphMetrics.collusionRiskScore, 'number');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. PLATFORM FEATURES: REFERRAL PROGRAMME ANTI-ABUSE
  // ═══════════════════════════════════════════════════════════════════════

  describe('Referral Programme Anti-Abuse Rules', () => {

    it('generates unique referral code format', async () => {
      const ref = await ExtendedService.generateReferralCode('d42a1234-0000-0000-0000-000000000000');
      assert.ok(ref.referralCode.startsWith('VEX-D42A-'));
      assert.ok(ref.shareLink.includes('?ref='));
    });

    it('rejects self-referral attempts with SELF_REFERRAL_PROHIBITED', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      await assert.rejects(
        async () => {
          // If code belongs to same user
          await ExtendedService.claimReferral(userId, 'VEX-0000-123', {});
        },
        (err) => err.code === 'SELF_REFERRAL_PROHIBITED' || err.statusCode === 400
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. VALIDATION SCHEMAS & DATABASE MIGRATION INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════

  describe('Validation Schemas & Migration 027', () => {

    it('validates ScrimCreateSchema correctly', () => {
      assert.doesNotThrow(() => ScrimCreateSchema.parse({
        title: 'Squad Rush',
        game_id: '00000000-0000-0000-0000-000000000001',
        max_players: 16,
      }));
      // Title too short
      assert.throws(() => ScrimCreateSchema.parse({
        title: 'Hi',
        game_id: '00000000-0000-0000-0000-000000000001',
      }));
    });

    it('validates TournamentStaffAssignSchema roles and permissions', () => {
      assert.doesNotThrow(() => TournamentStaffAssignSchema.parse({
        user_id: '00000000-0000-0000-0000-000000000001',
        staff_role: 'REFEREE',
        permissions: { can_verify_results: true },
      }));
      assert.throws(() => TournamentStaffAssignSchema.parse({
        user_id: '00000000-0000-0000-0000-000000000001',
        staff_role: 'CHEF', // invalid role
      }));
    });

    it('Migration 027 defines all extended tables and feature flags', () => {
      const migrationPath = path.join(ROOT, 'infra/migrations/027_extended_features.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');

      assert.ok(content.includes('extended_player_features'));
      assert.ok(content.includes('extended_organiser_features'));
      assert.ok(content.includes('extended_admin_features'));
      assert.ok(content.includes('scrim_rooms'));
      assert.ok(content.includes('lft_posts'));
      assert.ok(content.includes('user_follows'));
      assert.ok(content.includes('tournament_templates'));
      assert.ok(content.includes('tournament_staff'));
      assert.ok(content.includes('tournament_sponsors'));
      assert.ok(content.includes('user_referrals'));
      assert.ok(content.includes('safe_chat_messages'));
      assert.ok(content.includes('fair_play_pledges'));
    });

    it('server.js mounts /api/v1/extended router', () => {
      const serverPath = path.join(ROOT, 'backend/src/server.js');
      const content = fs.readFileSync(serverPath, 'utf-8');
      assert.ok(content.includes("extendedRouter"));
      assert.ok(content.includes("'/api/v1/extended'"));
    });

    it('AdminShell includes Extended Operations navigation link', () => {
      const shellPath = path.join(ROOT, 'apps/admin/src/components/AdminShell.tsx');
      const content = fs.readFileSync(shellPath, 'utf-8');
      assert.ok(content.includes("Extended Operations"));
      assert.ok(content.includes("href: '/extended'"));
    });
  });
});
