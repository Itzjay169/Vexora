import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { logger } from './common/logger.js';
import { errorHandler, notFoundHandler } from './common/errorHandler.js';
import { apiLimiter } from './common/rateLimiter.js';
import { correlationId, requestLogger } from './common/correlationId.js';
import { authRouter } from './auth/auth.routes.js';
import { usersRouter } from './users/users.routes.js';
import { gamesRouter } from './games/games.routes.js';
import { teamsRouter } from './teams/teams.routes.js';
import { organisersRouter } from './organisers/organisers.routes.js';
import { tournamentsRouter } from './tournaments/tournaments.routes.js';
import { matchesRouter } from './matches/matches.routes.js';
import { scoringRouter } from './scoring/scoring.routes.js';
import { leaderboardsRouter } from './leaderboards/leaderboards.routes.js';
import { walletRouter } from './wallet/wallet.routes.js';
import { redeemRouter } from './redeem/redeem.routes.js';
import { payoutsRouter } from './payouts/payouts.routes.js';
import { disputesRouter } from './disputes/disputes.routes.js';
import { moderationRouter } from './moderation/moderation.routes.js';
import { notificationsRouter } from './notifications/notifications.routes.js';
import { adminRouter } from './admin/admin.routes.js';
import { auditRouter } from './audit/audit.routes.js';
import { supportRouter } from './support/support.routes.js';
import { achievementsRouter } from './achievements/achievements.routes.js';
import { riskRouter } from './risk/risk.routes.js';
import { webhooksRouter } from './webhooks/webhooks.routes.js';
import { seasonsRouter } from './seasons/seasons.routes.js';
import { searchRouter } from './search/search.routes.js';
import { ratingsRouter } from './ratings/ratings.routes.js';
import { paymentsRouter } from './payments/payments.routes.js';
import { realtimeRouter } from './realtime/realtime.routes.js';
import { analyticsRouter } from './analytics/analytics.routes.js';
import { extendedRouter } from './extended/extended.routes.js';
import { complianceRouter } from './compliance/compliance.routes.js';
import { setupWebSocketServer } from './common/websocket.js';
import { healthRouter } from './common/health.js';

const app = express();
const httpServer = createServer(app);

// ─── Global Middleware (Order Matters) ──────────────────────────────────

// 1. Correlation ID — must be first so all downstream middleware has the ID
app.use(correlationId);

// 2. Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// 3. CORS — strict origin allowlist
app.use(cors({
  origin: [
    process.env.CLIENT_WEB_URL || 'http://localhost:3000',
    process.env.ADMIN_WEB_URL || 'http://localhost:3001',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-ID', 'X-Correlation-ID'],
}));

// 4. Body parsing & compression
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 5. Structured request logging (replaces morgan)
app.use(requestLogger);

// 6. Global rate limiting on /api/*
app.use('/api/', apiLimiter);

// ─── API Routes (/api/v1/*) ─────────────────────────────────────────────
app.use('/api/v1/health',         healthRouter);
app.use('/api/v1/auth',           authRouter);
app.use('/api/v1/users',          usersRouter);
app.use('/api/v1/games',          gamesRouter);
app.use('/api/v1/teams',          teamsRouter);
app.use('/api/v1/organisers',     organisersRouter);
app.use('/api/v1/tournaments',    tournamentsRouter);
app.use('/api/v1/matches',        matchesRouter);
app.use('/api/v1/scoring',        scoringRouter);
app.use('/api/v1/leaderboards',   leaderboardsRouter);
app.use('/api/v1/wallet',         walletRouter);
app.use('/api/v1/redeem',         redeemRouter);
app.use('/api/v1/payouts',        payoutsRouter);
app.use('/api/v1/disputes',       disputesRouter);
app.use('/api/v1/moderation',     moderationRouter);
app.use('/api/v1/notifications',  notificationsRouter);
app.use('/api/v1/admin',          adminRouter);
app.use('/api/v1/audit',          auditRouter);
app.use('/api/v1/support',        supportRouter);
app.use('/api/v1/achievements',   achievementsRouter);
app.use('/api/v1/risk',           riskRouter);
app.use('/api/v1/webhooks',       webhooksRouter);
app.use('/api/v1/seasons',        seasonsRouter);
app.use('/api/v1/search',         searchRouter);
app.use('/api/v1/ratings',        ratingsRouter);
app.use('/api/v1/payments',       paymentsRouter);
app.use('/api/v1/realtime',       realtimeRouter);
app.use('/api/v1/analytics',      analyticsRouter);
app.use('/api/v1/extended',       extendedRouter);
app.use('/api/v1/compliance',     complianceRouter);

// ─── OpenAPI Spec Endpoint ──────────────────────────────────────────────
app.get('/api/v1/docs/openapi.json', (_req, res) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'Vexora Esports Tournament Platform API',
      version: '1.0.0',
    },
    servers: [
      { url: `http://localhost:${process.env.PORT || 4000}/api/v1` },
    ],
    paths: {
      '/health': { get: { summary: 'System health check' } },
      '/auth/register': { post: { summary: 'Register new user' } },
      '/auth/login': { post: { summary: 'Authenticate and get tokens' } },
      '/auth/refresh': { post: { summary: 'Rotate access token' } },
      '/tournaments': { get: { summary: 'List tournaments' }, post: { summary: 'Create tournament' } },
      '/wallet/balance': { get: { summary: 'Get user balance' } },
      '/audit/verify': { get: { summary: 'Verify audit hash chain' } },
    },
  });
});

// ─── Error Handling ─────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── WebSocket Server ───────────────────────────────────────────────────
setupWebSocketServer(httpServer);

// ─── Server Startup ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

const isMain = process.argv[1] && (
  process.argv[1].endsWith('server.js') ||
  process.argv[1].includes('server.js')
);

if (isMain || process.env.AUTO_START_SERVER === 'true') {
  httpServer.listen(PORT, () => {
    logger.info(`🚀 Vexora API server running on port ${PORT}`);
    logger.info(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 Health check: http://localhost:${PORT}/api/v1/health`);
    logger.info(`📖 OpenAPI spec: http://localhost:${PORT}/api/v1/docs/openapi.json`);
    logger.info(`📡 Modules: auth, users, games, teams, organisers, tournaments, matches, scoring, leaderboards, wallet, redeem, payouts, disputes, moderation, notifications, admin, audit, support, achievements, risk, webhooks`);
  });
}

export { app, httpServer };
