/**
 * Vexora Esports Tournament Platform — Analytics Routes
 *
 * Phase 31: Analytics & Dashboards
 * PDF refs: Sections 22, 39 (Phase 8)
 *
 * Endpoints:
 *   GET    /player/me              — Current player's analytics
 *   GET    /player/:id             — Player analytics by ID (public subset)
 *   GET    /player/:id/history     — Player performance history
 *   GET    /organiser/me           — Current organiser's analytics
 *   GET    /organiser/:id          — Organiser analytics by ID
 *   GET    /organiser/:id/history  — Organiser tournament history
 *   GET    /platform/overview      — Admin platform overview
 *   GET    /platform/daily         — Admin daily stats
 *   GET    /games/popularity       — Game popularity rankings
 *   GET    /metrics                — Metric definitions catalogue
 *   POST   /refresh/:viewName      — Trigger materialised view refresh (admin)
 *   POST   /refresh-all            — Refresh all materialised views (admin)
 *   GET    /refresh/history        — Refresh log history (admin)
 *   POST   /export                 — Export analytics data (admin)
 *   GET    /export/history         — Export audit trail (admin)
 */

import { Router } from 'express';
import { authenticate } from '../common/auth.middleware.js';
import { requirePermission } from '../common/rbac.middleware.js';
import { AnalyticsService, MATERIALIZED_VIEWS, FIREBASE_ANALYTICS_EVENTS } from './analytics.service.js';
import { logger } from '../common/logger.js';

export const analyticsRouter = Router();

// All analytics endpoints require auth
analyticsRouter.use(authenticate);

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /player/me — Current player's own analytics ─────────────────────
analyticsRouter.get('/player/me', async (req, res, next) => {
  try {
    const stats = await AnalyticsService.getPlayerStats(req.user.id);
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Player stats not found' },
      });
    }
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /player/:id — Player analytics by ID (public subset) ────────────
analyticsRouter.get('/player/:id', async (req, res, next) => {
  try {
    const stats = await AnalyticsService.getPlayerStats(req.params.id);
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Player not found' },
      });
    }

    // Public subset — no PII, only gameplay stats
    const publicStats = {
      user_id: stats.user_id,
      username: stats.username,
      tournaments_joined: stats.tournaments_joined,
      matches_played: stats.matches_played,
      matches_won: stats.matches_won,
      win_rate_pct: stats.win_rate_pct,
      total_kills: stats.total_kills,
      fair_play_score: stats.fair_play_score,
    };

    res.json({ success: true, data: publicStats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /player/:id/history — Player performance history ────────────────
analyticsRouter.get('/player/:id/history', async (req, res, next) => {
  try {
    const { days = '30' } = req.query;
    const history = await AnalyticsService.getPlayerPerformanceHistory(
      req.params.id,
      Math.min(parseInt(days) || 30, 365)
    );
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ORGANISER ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /organiser/me — Current organiser's analytics ───────────────────
analyticsRouter.get('/organiser/me', async (req, res, next) => {
  try {
    const stats = await AnalyticsService.getOrganiserStats(req.user.id);
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Organiser stats not found' },
      });
    }
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /organiser/:id — Organiser analytics by ID ──────────────────────
analyticsRouter.get('/organiser/:id', async (req, res, next) => {
  try {
    const stats = await AnalyticsService.getOrganiserStats(req.params.id);
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Organiser not found' },
      });
    }
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /organiser/:id/history — Organiser tournament history ───────────
analyticsRouter.get('/organiser/:id/history', async (req, res, next) => {
  try {
    const { days = '90' } = req.query;
    const history = await AnalyticsService.getOrganiserTournamentHistory(
      req.params.id,
      Math.min(parseInt(days) || 90, 365)
    );
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM / ADMIN ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /platform/overview — Admin platform overview ────────────────────
analyticsRouter.get('/platform/overview',
  requirePermission('ANALYTICS_VIEW'),
  async (req, res, next) => {
    try {
      const overview = await AnalyticsService.getPlatformOverview();
      res.json({ success: true, data: overview });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /platform/daily — Admin daily stats ─────────────────────────────
analyticsRouter.get('/platform/daily',
  requirePermission('ANALYTICS_VIEW'),
  async (req, res, next) => {
    try {
      const { days = '30' } = req.query;
      const stats = await AnalyticsService.getDailyStats(
        Math.min(parseInt(days) || 30, 365)
      );
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /games/popularity — Game popularity rankings ────────────────────
analyticsRouter.get('/games/popularity', async (req, res, next) => {
  try {
    const games = await AnalyticsService.getGamePopularity();
    res.json({ success: true, data: games });
  } catch (err) {
    next(err);
  }
});

// ─── GET /metrics — Metric definitions catalogue ─────────────────────────
analyticsRouter.get('/metrics', async (req, res, next) => {
  try {
    const { category } = req.query;
    const metrics = await AnalyticsService.getMetricDefinitions(category || null);
    res.json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

// ─── GET /firebase-events — Firebase Analytics event plan ────────────────
analyticsRouter.get('/firebase-events', async (_req, res) => {
  res.json({ success: true, data: FIREBASE_ANALYTICS_EVENTS });
});

// ═══════════════════════════════════════════════════════════════════════════
// MATERIALISED VIEW REFRESH (Admin Only)
// ═══════════════════════════════════════════════════════════════════════════

// ─── POST /refresh/:viewName — Trigger single view refresh ───────────────
analyticsRouter.post('/refresh/:viewName',
  requirePermission('ANALYTICS_MANAGE'),
  async (req, res, next) => {
    try {
      const result = await AnalyticsService.refreshMaterialisedView(
        req.params.viewName,
        `ADMIN:${req.user.id}`
      );
      res.json({ success: true, data: result });
    } catch (err) {
      if (err.code === 'UNKNOWN_VIEW') {
        return res.status(400).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      next(err);
    }
  }
);

// ─── POST /refresh-all — Refresh all materialised views ──────────────────
analyticsRouter.post('/refresh-all',
  requirePermission('ANALYTICS_MANAGE'),
  async (req, res, next) => {
    try {
      const results = await AnalyticsService.refreshAllViews(`ADMIN:${req.user.id}`);
      res.json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /refresh/history — Refresh log history ──────────────────────────
analyticsRouter.get('/refresh/history',
  requirePermission('ANALYTICS_VIEW'),
  async (req, res, next) => {
    try {
      const { limit = '50' } = req.query;
      const history = await AnalyticsService.getRefreshHistory(
        Math.min(parseInt(limit) || 50, 200)
      );
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT ENGINE (Admin Only — Masked, Watermarked, Logged)
// ═══════════════════════════════════════════════════════════════════════════

// ─── POST /export — Export analytics data ────────────────────────────────
analyticsRouter.post('/export',
  requirePermission('ANALYTICS_EXPORT'),
  async (req, res, next) => {
    try {
      const { reportName, exportType, format, filters } = req.body;

      if (!reportName || !exportType) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'reportName and exportType are required' },
        });
      }

      const result = await AnalyticsService.exportData({
        actorId: req.user.id,
        actorRole: req.user.role || 'ADMIN',
        reportName,
        exportType,
        format: format || 'CSV',
        filters: filters || {},
        ipHash: req.headers['x-forwarded-for'] || req.ip,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      if (err.code === 'UNKNOWN_EXPORT_TYPE') {
        return res.status(400).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      next(err);
    }
  }
);

// ─── GET /export/history — Export audit trail ─────────────────────────────
analyticsRouter.get('/export/history',
  requirePermission('ANALYTICS_VIEW'),
  async (req, res, next) => {
    try {
      const { limit = '50', offset = '0' } = req.query;
      const history = await AnalyticsService.getExportHistory({
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
      });
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }
);
