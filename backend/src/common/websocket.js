import { WebSocketServer } from 'ws';
import { logger } from './logger.js';

const HEARTBEAT_INTERVAL = 30000;

/**
 * Sets up the WebSocket server for real-time tournament events.
 * Channels: tournament:{id}, match:{id}, leaderboard:{id}, user:{id}
 */
export function setupWebSocketServer(httpServer) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: 64 * 1024, // 64KB
  });

  // Track subscriptions: Map<channel, Set<ws>>
  const channels = new Map();

  // Heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        logger.debug('Terminating dead WebSocket connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  // Unref so the interval doesn't prevent Node process from exiting
  heartbeatInterval.unref();

  wss.on('close', () => clearInterval(heartbeatInterval));
  httpServer.on('close', () => {
    clearInterval(heartbeatInterval);
    wss.close();
  });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.subscribedChannels = new Set();

    logger.info(`WebSocket connected from ${req.socket.remoteAddress}`);

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(ws, message, channels);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      // Unsubscribe from all channels on disconnect
      ws.subscribedChannels.forEach((channel) => {
        const subs = channels.get(channel);
        if (subs) {
          subs.delete(ws);
          if (subs.size === 0) channels.delete(channel);
        }
      });
    });

    // Welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Welcome to Vexora Real-Time Gateway',
      timestamp: new Date().toISOString(),
    }));
  });

  // Expose broadcast function for use by services
  wss.broadcast = (channel, eventType, payload) => {
    const subs = channels.get(channel);
    if (!subs || subs.size === 0) return;

    const message = JSON.stringify({
      type: eventType,
      channel,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    subs.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  };

  logger.info('🔌 WebSocket server attached at /ws');
  return wss;
}

function handleClientMessage(ws, message, channels) {
  const { action, channel } = message;

  if (action === 'subscribe' && channel) {
    if (!channels.has(channel)) channels.set(channel, new Set());
    channels.get(channel).add(ws);
    ws.subscribedChannels.add(channel);
    ws.send(JSON.stringify({ type: 'subscribed', channel }));
  }

  if (action === 'unsubscribe' && channel) {
    const subs = channels.get(channel);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) channels.delete(channel);
    }
    ws.subscribedChannels.delete(channel);
    ws.send(JSON.stringify({ type: 'unsubscribed', channel }));
  }

  if (action === 'ping') {
    ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
  }
}
