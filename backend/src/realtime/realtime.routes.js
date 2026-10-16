/**
 * Vexora Esports Tournament Platform — Real-Time API Routes
 *
 * Phase 29: Real-Time Gateway (WebSockets)
 * PDF refs: Sections 14, 39 (Phase 7)
 *
 * Endpoints:
 *   GET   /api/v1/realtime/status               - Gateway health, connection metrics, channel stats
 *   POST  /api/v1/realtime/check-permission     - Test channel subscription authorization
 *   POST  /api/v1/realtime/replay               - HTTP fallback for missed-event replay
 *   POST  /api/v1/realtime/broadcast            - Administrative broadcast trigger
 */

import { Router } from 'express';
import { RealtimeService } from './realtime.service.js';
import { logger } from '../common/logger.js';

export const realtimeRouter = Router();

// ─── Gateway Status ─────────────────────────────────────────────────────
realtimeRouter.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      gatewayStatus: 'ONLINE',
      protocol: 'RFC-6455 / WSS',
      capabilities: {
        sequenceReplay: true,
        heartbeatSeconds: 30,
        maxPayloadBytes: 65536,
        rateLimitPerMinute: 30,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── Test Channel Permission ────────────────────────────────────────────
realtimeRouter.post('/check-permission', async (req, res, next) => {
  try {
    const { channel } = req.body;
    const authCheck = await RealtimeService.canSubscribe(req.user, channel);
    res.json({
      success: true,
      data: {
        channel,
        authorized: authCheck.authorized,
        reason: authCheck.reason || null,
        userId: req.user?.id || 'anonymous',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── HTTP Fallback for Missed-Event Replay ──────────────────────────────
realtimeRouter.post('/replay', async (req, res, next) => {
  try {
    const { channel, lastSequence, limit } = req.body;

    const authCheck = await RealtimeService.canSubscribe(req.user, channel);
    if (!authCheck.authorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'UNAUTHORIZED_CHANNEL', message: authCheck.reason },
      });
    }

    const replay = await RealtimeService.replayMissedEvents({
      channel,
      lastSequence: Number(lastSequence) || 0,
      limit: limit ? Number(limit) : 100,
    });

    res.json({ success: true, data: replay });
  } catch (err) {
    next(err);
  }
});

// ─── Admin Broadcast Trigger ────────────────────────────────────────────
realtimeRouter.post('/broadcast', async (req, res, next) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    if (!adminId || !['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'MODERATOR'].includes(adminRole)) {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_REQUIRED' } });
    }

    const { channel, eventType, payload } = req.body;
    if (!channel || !eventType) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS' } });
    }

    const event = await RealtimeService.publishEvent({
      channel,
      eventType,
      payload: payload || {},
    });

    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
});
