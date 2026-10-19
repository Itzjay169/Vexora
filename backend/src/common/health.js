import { Router } from 'express';
import { query } from './database.js';
import { metricsRegistry } from './metrics.js';
import { alertService } from './alertService.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    services: {},
  };

  // Check PostgreSQL (skip real network query in unit test mode to prevent dangling sockets)
  try {
    if (process.env.NODE_ENV === 'test') {
      checks.services.database = { status: 'active_test_env' };
    } else {
      const start = Date.now();
      await query('SELECT 1');
      checks.services.database = {
        status: 'connected',
        latency_ms: Date.now() - start,
      };
    }
  } catch {
    checks.services.database = { status: 'disconnected' };
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});

/**
 * Public/Internal System Status Summary for live health dashboards
 */
healthRouter.get('/system-status', (_req, res) => {
  const summary = alertService.getSystemStatusSummary();
  res.json({
    success: true,
    data: summary,
  });
});

/**
 * Prometheus & JSON Metrics Endpoint
 */
healthRouter.get('/metrics', (req, res) => {
  const acceptHeader = req.get('accept') || '';
  if (acceptHeader.includes('application/json')) {
    return res.json({
      success: true,
      data: metricsRegistry.getSummary(),
    });
  }

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metricsRegistry.toPrometheusFormat());
});

