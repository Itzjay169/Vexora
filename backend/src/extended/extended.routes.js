import { Router } from 'express';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { AppError } from '../common/errorHandler.js';
import { ExtendedService } from './extended.service.js';
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
} from '../../../packages/validation/src/index.ts';
import { z } from 'zod';

export const extendedRouter = Router();

// ─── 1. Player Features ──────────────────────────────────────────────────────

// Shareable stat card (Public or Authenticated)
extendedRouter.get('/stats/:userId/card', async (req, res, next) => {
  try {
    const card = await ExtendedService.getShareableStatCard(req.params.userId);
    res.json({ success: true, data: card });
  } catch (err) {
    next(err);
  }
});

// Scrims & Practice Rooms
extendedRouter.get('/scrims', async (req, res, next) => {
  try {
    const rooms = await ExtendedService.listScrimRooms({
      game_id: req.query.game_id,
      status: req.query.status || 'OPEN',
      limit: parseInt(req.query.limit, 10) || 20,
    });
    res.json({ success: true, count: rooms.length, data: rooms });
  } catch (err) {
    next(err);
  }
});

extendedRouter.post('/scrims', authenticate, async (req, res, next) => {
  try {
    const data = ScrimCreateSchema.parse(req.body);
    const room = await ExtendedService.createScrimRoom(req.user.id, data);
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// Looking-for-Team (LFT) Board
extendedRouter.get('/lft', async (req, res, next) => {
  try {
    const posts = await ExtendedService.listLftPosts({
      game_id: req.query.game_id,
      post_type: req.query.post_type,
      role: req.query.role,
      limit: parseInt(req.query.limit, 10) || 30,
    });
    res.json({ success: true, count: posts.length, data: posts });
  } catch (err) {
    next(err);
  }
});

extendedRouter.post('/lft', authenticate, async (req, res, next) => {
  try {
    const data = LftPostCreateSchema.parse(req.body);
    const post = await ExtendedService.createLftPost(req.user.id, data);
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// Tournament Calendar Export (.ics)
extendedRouter.get('/tournaments/:id/calendar.ics', async (req, res, next) => {
  try {
    const ics = await ExtendedService.exportCalendarIcs(req.params.id, req.query.userId);
    res.setHeader('Content-Type', ics.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${ics.filename}"`);
    res.send(ics.data);
  } catch (err) {
    next(err);
  }
});

// Social Follows
extendedRouter.post('/follows', authenticate, async (req, res, next) => {
  try {
    const data = UserFollowSchema.parse(req.body);
    const result = await ExtendedService.toggleFollow(req.user.id, data.target_type, data.target_id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// Safe In-App Chat
extendedRouter.post('/chat', authenticate, async (req, res, next) => {
  try {
    const data = SafeChatMessageSchema.parse(req.body);
    const msg = await ExtendedService.sendSafeChatMessage(data.channel_type, data.channel_id, req.user.id, data.message);
    res.status(201).json({ success: true, data: msg });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// Fair-Play Pledge
extendedRouter.post('/fair-play/pledge', authenticate, async (req, res, next) => {
  try {
    FairPlayPledgeSchema.parse(req.body);
    const ipHash = req.ip ? req.ip.slice(0, 16) : 'unknown_ip';
    const pledge = await ExtendedService.recordFairPlayPledge(req.user.id, ipHash, req.headers['user-agent']);
    res.status(201).json({ success: true, message: 'Fair Play Pledge accepted and recorded', data: pledge });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// ─── 2. Organiser Features ───────────────────────────────────────────────────

// Tournament Templates
extendedRouter.post('/templates', authenticate, authorize('ORGANISER', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const data = TournamentTemplateCreateSchema.parse(req.body);
    const template = await ExtendedService.createTournamentTemplate(req.user.id, data);
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// Clone Previous Tournament
extendedRouter.post('/tournaments/:id/clone', authenticate, authorize('ORGANISER', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const cloned = await ExtendedService.cloneTournament(req.params.id, req.user.id, req.body.new_start_time);
    res.status(201).json({ success: true, message: 'Tournament cloned into draft', data: cloned });
  } catch (err) {
    next(err);
  }
});

// Co-Organisers and Referees Staff Assignment
extendedRouter.post('/tournaments/:id/staff', authenticate, async (req, res, next) => {
  try {
    const data = TournamentStaffAssignSchema.parse(req.body);
    const staff = await ExtendedService.assignTournamentStaff(req.params.id, req.user, data);
    res.status(201).json({ success: true, data: staff });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// Bulk Result Simulator (Dry-run preview)
extendedRouter.post('/tournaments/:id/results/simulate', authenticate, async (req, res, next) => {
  try {
    const rows = req.body.rows || [];
    const simulation = ExtendedService.simulateBulkResults(req.params.id, rows);
    res.json({ success: true, data: simulation });
  } catch (err) {
    next(err);
  }
});

// Sponsor Banners
extendedRouter.post('/tournaments/:id/sponsors', authenticate, async (req, res, next) => {
  try {
    const data = SponsorBannerCreateSchema.parse(req.body);
    const sponsor = await ExtendedService.submitSponsorBanner(req.params.id, req.user.id, data);
    res.status(201).json({ success: true, message: 'Sponsor banner submitted for review', data: sponsor });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// AI Co-pilot Drafts
extendedRouter.post('/copilot/draft', authenticate, async (req, res, next) => {
  try {
    const { type, context } = req.body;
    const draft = ExtendedService.generateAiCopilotDraft(type, context || {});
    res.json({ success: true, data: draft });
  } catch (err) {
    next(err);
  }
});

// ─── 3. Admin / Operations Features ──────────────────────────────────────────

// Case Management Timeline
extendedRouter.get('/admin/users/:userId/timeline', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'FINANCE', 'SUPPORT_AGENT'), async (req, res, next) => {
  try {
    const timeline = await ExtendedService.getCaseManagementTimeline(req.params.userId);
    res.json({ success: true, data: timeline });
  } catch (err) {
    next(err);
  }
});

// Fraud Graph
extendedRouter.get('/admin/users/:userId/fraud-graph', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'MODERATOR'), async (req, res, next) => {
  try {
    const graph = await ExtendedService.getFraudGraph(req.params.userId);
    res.json({ success: true, data: graph });
  } catch (err) {
    next(err);
  }
});

// Read-Only "View As" Simulator (No Impersonation)
extendedRouter.get('/admin/users/:userId/view-as', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const sim = await ExtendedService.simulateViewAs(req.params.userId, req.user);
    res.json({ success: true, data: sim });
  } catch (err) {
    next(err);
  }
});

// ─── 4. Platform Features: Referral Program ──────────────────────────────────

// Generate Referral Code
extendedRouter.post('/referrals/generate', authenticate, async (req, res, next) => {
  try {
    const referral = await ExtendedService.generateReferralCode(req.user.id);
    res.json({ success: true, data: referral });
  } catch (err) {
    next(err);
  }
});

// Claim Referral Code
extendedRouter.post('/referrals/claim', authenticate, async (req, res, next) => {
  try {
    const data = ReferralClaimSchema.parse(req.body);
    const metadata = {
      refereeIpHash: req.ip ? req.ip.slice(0, 16) : null,
      deviceId: req.headers['x-device-id'] || null,
    };
    const claim = await ExtendedService.claimReferral(req.user.id, data.referral_code, metadata);
    res.status(201).json({ success: true, message: 'Referral code claimed', data: claim });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});
