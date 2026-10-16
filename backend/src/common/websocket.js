import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import { logger } from './logger.js';
import {
  RealtimeService,
  HEARTBEAT_INTERVAL_MS,
  MAX_PAYLOAD_BYTES,
} from '../realtime/realtime.service.js';

/**
 * Vexora Real-Time Gateway (Phase 29)
 * WebSocket server with token authentication, server-side channel authorization,
 * monotonic sequence numbers, missed-event replay, and rate limiting.
 */
export function setupWebSocketServer(httpServer) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: MAX_PAYLOAD_BYTES, // 64KB
  });

  // Track channel subscriptions: Map<channel, Set<ws>>
  const channels = new Map();

  // Track socket rate limits: Map<socketId, number[]>
  const socketMessageTimestamps = new Map();

  // Statistics
  const stats = {
    totalConnections: 0,
    activeConnections: 0,
    totalBroadcasts: 0,
    totalReplays: 0,
  };

  // ─── Heartbeat Mechanism ──────────────────────────────────────────────
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        logger.debug('Terminating stale WebSocket connection', { socketId: ws.socketId });
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  heartbeatInterval.unref();

  wss.on('close', () => clearInterval(heartbeatInterval));
  httpServer.on('close', () => {
    clearInterval(heartbeatInterval);
    wss.close();
  });

  // ─── Connection Handler ───────────────────────────────────────────────
  wss.on('connection', async (ws, req) => {
    const socketId = `sock_${crypto.randomUUID().slice(0, 8)}`;
    ws.socketId = socketId;
    ws.isAlive = true;
    ws.subscribedChannels = new Set();

    stats.totalConnections++;
    stats.activeConnections++;

    // Parse token from URL query string if present (e.g. /ws?token=xyz)
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');
    ws.user = RealtimeService.verifyConnectionToken(token);

    logger.info('WebSocket client connected', {
      socketId,
      userId: ws.user?.id || 'anonymous',
      ip: req.socket.remoteAddress,
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // ─── Inbound Message Router ─────────────────────────────────────────
    ws.on('message', async (data) => {
      // 1. Rate Limiting Check
      if (!RealtimeService.checkSocketRateLimit(socketMessageTimestamps, socketId)) {
        ws.send(JSON.stringify({
          type: 'error',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many messages sent. Please slow down (limit: 30 msgs/min).',
        }));
        return;
      }

      try {
        const message = JSON.parse(data.toString());
        await handleClientMessage(ws, message, channels, stats);
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', code: 'INVALID_JSON', message: err.message }));
      }
    });

    // ─── Disconnect Cleanup ─────────────────────────────────────────────
    ws.on('close', () => {
      stats.activeConnections = Math.max(0, stats.activeConnections - 1);
      socketMessageTimestamps.delete(socketId);

      ws.subscribedChannels.forEach((channel) => {
        const subs = channels.get(channel);
        if (subs) {
          subs.delete(ws);
          if (subs.size === 0) channels.delete(channel);
        }
      });

      logger.debug('WebSocket disconnected', { socketId });
    });

    // Welcome handshake with server capabilities
    ws.send(JSON.stringify({
      type: 'connected',
      socketId,
      authenticated: Boolean(ws.user),
      userId: ws.user?.id || null,
      message: 'Connected to Vexora Real-Time Gateway',
      capabilities: {
        sequenceReplay: true,
        heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
        maxPayloadBytes: MAX_PAYLOAD_BYTES,
      },
      timestamp: new Date().toISOString(),
    }));
  });

  // ─── Server-Side Broadcast with Outbox Sequence Allocation ────────────
  wss.broadcast = async (channel, eventType, payload) => {
    try {
      // 1. Commit event to outbox to allocate monotonic sequence number
      const outboxEvent = await RealtimeService.publishEvent({
        channel,
        eventType,
        payload,
      });

      stats.totalBroadcasts++;

      // 2. Deliver to all active WebSocket subscribers
      const subs = channels.get(channel);
      if (!subs || subs.size === 0) return outboxEvent;

      const wireMessage = JSON.stringify(outboxEvent);

      subs.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(wireMessage);
        }
      });

      return outboxEvent;
    } catch (err) {
      logger.error('Failed to broadcast real-time event', { channel, eventType, error: err.message });
      throw err;
    }
  };

  // Expose statistics getter
  wss.getStats = () => ({
    ...stats,
    channelCount: channels.size,
    channels: Array.from(channels.keys()),
  });

  logger.info('🔌 Vexora Real-Time Gateway (Phase 29) attached at /ws');
  return wss;
}

// ─── Message Handler ────────────────────────────────────────────────────
async function handleClientMessage(ws, message, channels, stats) {
  const { action, channel, lastSequence, token } = message;

  // 1. In-band re-authentication / token upgrade
  if (action === 'authenticate' && token) {
    ws.user = RealtimeService.verifyConnectionToken(token);
    ws.send(JSON.stringify({
      type: 'authenticated',
      success: Boolean(ws.user),
      userId: ws.user?.id || null,
      role: ws.user?.role || null,
    }));
    return;
  }

  // 2. Channel Subscription with Server-Side Authorization & Replay
  if (action === 'subscribe' && channel) {
    // Check channel authorization
    const authCheck = await RealtimeService.canSubscribe(ws.user, channel);

    if (!authCheck.authorized) {
      ws.send(JSON.stringify({
        type: 'error',
        code: 'UNAUTHORIZED_CHANNEL',
        channel,
        message: authCheck.reason || 'You do not have permission to join this channel',
      }));
      return;
    }

    // Register subscription
    if (!channels.has(channel)) channels.set(channel, new Set());
    channels.get(channel).add(ws);
    ws.subscribedChannels.add(channel);

    ws.send(JSON.stringify({
      type: 'subscribed',
      channel,
      timestamp: new Date().toISOString(),
    }));

    // If client provided a lastSequence, automatically trigger missed-event replay!
    if (lastSequence !== undefined && lastSequence !== null) {
      const replay = await RealtimeService.replayMissedEvents({
        channel,
        lastSequence: Number(lastSequence),
      });

      if (replay.events.length > 0) {
        stats.totalReplays += replay.events.length;
        ws.send(JSON.stringify({
          type: 'replay_batch',
          channel,
          events: replay.events,
          count: replay.count,
          hasMore: replay.hasMore,
        }));
      }
    }
    return;
  }

  // 3. Channel Unsubscription
  if (action === 'unsubscribe' && channel) {
    const subs = channels.get(channel);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) channels.delete(channel);
    }
    ws.subscribedChannels.delete(channel);
    ws.send(JSON.stringify({ type: 'unsubscribed', channel }));
    return;
  }

  // 4. Standalone Missed-Event Replay Request
  if (action === 'replay' && channel) {
    const authCheck = await RealtimeService.canSubscribe(ws.user, channel);
    if (!authCheck.authorized) {
      ws.send(JSON.stringify({ type: 'error', code: 'UNAUTHORIZED_CHANNEL', channel }));
      return;
    }

    const replay = await RealtimeService.replayMissedEvents({
      channel,
      lastSequence: Number(lastSequence) || 0,
    });

    stats.totalReplays += replay.events.length;
    ws.send(JSON.stringify({
      type: 'replay_batch',
      channel,
      events: replay.events,
      count: replay.count,
      hasMore: replay.hasMore,
    }));
    return;
  }

  // 5. Ping
  if (action === 'ping') {
    ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
    return;
  }
}
