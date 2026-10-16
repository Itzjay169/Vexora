/**
 * Vexora Esports Tournament Platform — Achievements Routes
 *
 * Phase 32: Achievements, Gamification & Retention
 *
 * Security Gate: No client-facing endpoint can directly award badges.
 * The POST /admin/award endpoint requires ACHIEVEMENTS_MANAGE permission.
 */

import { Router } from 'express';
import { authenticate } from '../common/auth.middleware.js';
import { requirePermission } from '../common/rbac.middleware.js';
import { AchievementsService } from './achievements.service.js';

export const achievementsRouter = Router();
achievementsRouter.use(authenticate);

// ─── GET /catalogue — All achievements ──────────────────────────────────
achievementsRouter.get('/catalogue', async (req, res, next) => {
  try {
    const { category } = req.query;
    const achievements = await AchievementsService.getAchievementCatalogue(category || null);
    res.json({ success: true, data: achievements });
  } catch (err) { next(err); }
});

// ─── GET /me — My earned achievements ───────────────────────────────────
achievementsRouter.get('/me', async (req, res, next) => {
  try {
    const achievements = await AchievementsService.getUserAchievements(req.user.id);
    res.json({ success: true, data: achievements });
  } catch (err) { next(err); }
});

// ─── GET /user/:id — Public achievements for a user ────────────────────
achievementsRouter.get('/user/:id', async (req, res, next) => {
  try {
    const achievements = await AchievementsService.getUserAchievements(req.params.id);
    const displayed = achievements.filter(a => a.is_displayed);
    res.json({ success: true, data: displayed });
  } catch (err) { next(err); }
});

// ─── GET /missions — Active missions ────────────────────────────────────
achievementsRouter.get('/missions', async (req, res, next) => {
  try {
    const { type } = req.query;
    const missions = await AchievementsService.getActiveMissions(type || null);
    res.json({ success: true, data: missions });
  } catch (err) { next(err); }
});

// ─── GET /missions/me — My mission progress ─────────────────────────────
achievementsRouter.get('/missions/me', async (req, res, next) => {
  try {
    const progress = await AchievementsService.getUserMissionProgress(req.user.id);
    res.json({ success: true, data: progress });
  } catch (err) { next(err); }
});

// ─── GET /streaks/me — My streaks ───────────────────────────────────────
achievementsRouter.get('/streaks/me', async (req, res, next) => {
  try {
    const streaks = await AchievementsService.getUserStreaks(req.user.id);
    res.json({ success: true, data: streaks });
  } catch (err) { next(err); }
});

// ─── GET /seasons/me — My season snapshots ──────────────────────────────
achievementsRouter.get('/seasons/me', async (req, res, next) => {
  try {
    const snapshots = await AchievementsService.getSeasonSnapshots(req.user.id);
    res.json({ success: true, data: snapshots });
  } catch (err) { next(err); }
});

// ─── GET /self-exclusion — Responsible gaming settings ───────────────────
achievementsRouter.get('/self-exclusion', async (req, res, next) => {
  try {
    const settings = await AchievementsService.getSelfExclusionSettings(req.user.id);
    res.json({ success: true, data: settings || { message: 'No limits set' } });
  } catch (err) { next(err); }
});

// ─── PUT /self-exclusion — Update self-exclusion limits ─────────────────
achievementsRouter.put('/self-exclusion', async (req, res, next) => {
  try {
    const result = await AchievementsService.updateSelfExclusionSettings(req.user.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── POST /admin/evaluate — Force-evaluate achievements (admin) ─────────
achievementsRouter.post('/admin/evaluate',
  requirePermission('ACHIEVEMENTS_MANAGE'),
  async (req, res, next) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'userId required' } });
      const awarded = await AchievementsService.evaluateAndAward(userId, {});
      res.json({ success: true, data: { awarded: awarded.length, badges: awarded } });
    } catch (err) { next(err); }
  }
);
