import { Router } from 'express';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { adminGate } from '../common/rbac.middleware.js';
import { query } from '../common/database.js';
import { parsePagination, paginatedResponse } from '../common/pagination.js';
import { appendAuditLog, hashIP } from '../common/auditLog.js';
import { SecurityCentreService } from './securityCentre.service.js';
import { validateBody } from '../common/validation.middleware.js';
import {
  BlockedIpCreateSchema,
  BreakGlassRequestSchema,
  BreakGlassDecisionSchema,
} from '@vexora/validation';

export const adminRouter = Router();

// All admin endpoints require authentication + admin gate (strict RBAC check)
adminRouter.use(authenticate, adminGate);

// ─── GET /dashboard — Admin dashboard stats ──────────────────────────────
adminRouter.get('/dashboard', async (req, res, next) => {
  try {
    const [users, tournaments, matches, revenue] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active FROM users`),
      query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'LIVE')::int AS live FROM tournaments`),
      query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed FROM matches`),
      query(`SELECT COALESCE(SUM(amount), 0)::numeric AS total_volume FROM wallet_transactions WHERE type = 'DEPOSIT' AND status = 'COMPLETED'`),
    ]);

    res.json({
      success: true,
      data: {
        users: users.rows[0],
        tournaments: tournaments.rows[0],
        matches: matches.rows[0],
        revenue: revenue.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /users — List all users with pagination ─────────────────────────
adminRouter.get('/users', async (req, res, next) => {
  try {
    const { cursor, limit } = parsePagination(req.query);
    const status = req.query.status;
    const role = req.query.role;
    const search = req.query.q;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status.toUpperCase());
      whereClause += ` AND u.status = $${params.length}`;
    }
    if (role) {
      params.push(role.toUpperCase());
      whereClause += ` AND u.role = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (u.username ILIKE $${params.length} OR u.display_name ILIKE $${params.length})`;
    }
    if (cursor) {
      params.push(cursor.ts, cursor.id);
      whereClause += ` AND (u.created_at, u.id) < ($${params.length - 1}, $${params.length})`;
    }

    params.push(limit + 1);

    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.role, u.status,
              u.email_verified, u.phone_verified, u.created_at
       FROM users u
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ success: true, ...paginatedResponse(result.rows, limit) });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /users/:id/status — Ban/suspend/activate user ─────────────────
adminRouter.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const validStatuses = ['ACTIVE', 'SUSPENDED', 'BANNED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Status must be one of: ${validStatuses.join(', ')}` } });
    }

    const result = await query(
      `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, status`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND' } });
    }

    await appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `USER_STATUS_CHANGED`,
      entityType: 'user',
      entityId: req.params.id,
      payload: { newStatus: status, reason },
      ipHash: hashIP(req.ip),
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── GET /audit-logs — Search audit trail ────────────────────────────────
adminRouter.get('/audit-logs', async (req, res, next) => {
  try {
    const { cursor, limit } = parsePagination(req.query);
    const action = req.query.action;
    const actorId = req.query.actor_id;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (action) {
      params.push(action);
      whereClause += ` AND al.action = $${params.length}`;
    }
    if (actorId) {
      params.push(actorId);
      whereClause += ` AND al.actor_id = $${params.length}`;
    }
    if (cursor) {
      params.push(cursor.ts, cursor.id);
      whereClause += ` AND (al.created_at, al.id) < ($${params.length - 1}, $${params.length})`;
    }

    params.push(limit + 1);

    const result = await query(
      `SELECT al.id, al.actor_id, al.actor_role, al.action,
              al.entity_type, al.entity_id, al.created_at
       FROM audit_logs al
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ success: true, ...paginatedResponse(result.rows, limit) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /feature-flags — List all platform feature flags ────────────────
adminRouter.get('/feature-flags', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT key, enabled, rollout_percent, description, audience, updated_at
       FROM feature_flags
       ORDER BY key ASC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /feature-flags/:key — Toggle or update feature flag ──────────
adminRouter.patch('/feature-flags/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    const { enabled, rollout_percent, reason } = req.body;

    const existing = await query(
      `SELECT * FROM feature_flags WHERE key = $1`,
      [key]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'FLAG_NOT_FOUND', message: `Feature flag ${key} not found` } });
    }

    const currentFlag = existing.rows[0];
    const newEnabled = enabled !== undefined ? Boolean(enabled) : currentFlag.enabled;
    const newRollout = rollout_percent !== undefined ? Number(rollout_percent) : currentFlag.rollout_percent;

    // Financial feature flags require special audit & maker-checker notice
    const isMoneyFlag = key.includes('wallet') || key.includes('money') || key.includes('payout');

    const result = await query(
      `UPDATE feature_flags
       SET enabled = $1, rollout_percent = $2, updated_at = NOW(), updated_by = $3
       WHERE key = $4
       RETURNING key, enabled, rollout_percent, description, updated_at`,
      [newEnabled, newRollout, req.user.id, key]
    );

    await appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FEATURE_FLAG_UPDATED',
      entityType: 'feature_flag',
      entityId: key,
      payload: {
        previousState: { enabled: currentFlag.enabled, rollout_percent: currentFlag.rollout_percent },
        newState: { enabled: newEnabled, rollout_percent: newRollout },
        isMoneyFlag,
        reason,
      },
      reason: reason || `Updated feature flag ${key}`,
      ipHash: hashIP(req.ip),
    });

    res.json({
      success: true,
      data: result.rows[0],
      requiresDualApproval: isMoneyFlag,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /sessions — List active admin sessions ──────────────────────────
adminRouter.get('/sessions', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT us.id, us.user_id, u.username, u.role, us.device_info,
              us.ip_hash, us.status, us.created_at, us.expires_at, us.last_active_at
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE us.user_id = $1 AND us.status = 'ACTIVE' AND us.expires_at > NOW()
       ORDER BY us.created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows.map((s) => ({
        id: s.id,
        username: s.username,
        role: s.role,
        deviceInfo: typeof s.device_info === 'string' ? JSON.parse(s.device_info) : s.device_info,
        ipHash: s.ip_hash,
        createdAt: s.created_at,
        expiresAt: s.expires_at,
        isCurrent: false, // frontend matches by current session ID or token
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /sessions/:id — Revoke a specific admin session ──────────────
adminRouter.delete('/sessions/:id', async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE user_sessions
       SET status = 'REVOKED', revoked_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Active session not found' } });
    }

    await appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'ADMIN_SESSION_REVOKED',
      entityType: 'user_session',
      entityId: req.params.id,
      reason: 'Admin manually revoked session',
      ipHash: hashIP(req.ip),
    });

    res.json({ success: true, message: 'Session successfully revoked' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /sessions/force-logout — Revoke all other admin sessions ───────
adminRouter.post('/sessions/force-logout', async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE user_sessions
       SET status = 'REVOKED', revoked_at = NOW()
       WHERE user_id = $1 AND status = 'ACTIVE'
       RETURNING id`,
      [req.user.id]
    );

    await appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'ADMIN_FORCE_LOGOUT_ALL',
      entityType: 'user_session',
      entityId: req.user.id,
      payload: { revokedCount: result.rows.length },
      reason: 'Admin requested force-logout of all active sessions',
      ipHash: hashIP(req.ip),
    });

    res.json({
      success: true,
      message: `Revoked ${result.rows.length} active sessions`,
      revokedCount: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Security Centre v1 Endpoints (Phase 24)
// ════════════════════════════════════════════════════════════════════════════

// ─── GET /security/overview — Live security dashboard statistics ─────────────
adminRouter.get('/security/overview', async (req, res, next) => {
  try {
    const overview = await SecurityCentreService.getSecurityOverview();
    res.json({ success: true, data: overview });
  } catch (err) {
    next(err);
  }
});

// ─── GET /security/failed-logins — Failed login attempts log ─────────────────
adminRouter.get('/security/failed-logins', async (req, res, next) => {
  try {
    const result = await SecurityCentreService.getFailedLogins({
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /security/blocked-ips — List blocked IP addresses ──────────────────
adminRouter.get('/security/blocked-ips', async (req, res, next) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const blockedIps = await SecurityCentreService.getBlockedIps({ activeOnly });
    res.json({ success: true, data: blockedIps });
  } catch (err) {
    next(err);
  }
});

// ─── POST /security/blocked-ips — Block an IP address ───────────────────────
adminRouter.post(
  '/security/blocked-ips',
  validateBody(BlockedIpCreateSchema),
  async (req, res, next) => {
    try {
      const blocked = await SecurityCentreService.blockIp(req.user.id, req.body);
      res.status(201).json({ success: true, data: blocked });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /security/blocked-ips/:id/unblock — Unblock an IP address ─────────
adminRouter.post('/security/blocked-ips/:id/unblock', async (req, res, next) => {
  try {
    const reason = req.body.reason || 'Admin unblocked IP';
    const unblocked = await SecurityCentreService.unblockIp(req.user.id, req.params.id, reason);
    res.json({ success: true, data: unblocked });
  } catch (err) {
    next(err);
  }
});

// ─── GET /security/admin-sessions — List all active admin sessions ──────────
adminRouter.get('/security/admin-sessions', async (req, res, next) => {
  try {
    const sessions = await SecurityCentreService.getActiveAdminSessions();
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /security/admin-sessions/:id — Force revoke an admin session ────
adminRouter.delete('/security/admin-sessions/:id', async (req, res, next) => {
  try {
    const reason = req.body.reason || 'Revoked via Security Centre';
    const result = await SecurityCentreService.revokeAdminSession(
      req.user.id,
      req.params.id,
      reason
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /security/break-glass — List break-glass requests ──────────────────
adminRouter.get('/security/break-glass', async (req, res, next) => {
  try {
    const requests = await SecurityCentreService.getBreakGlassRequests();
    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
});

// ─── POST /security/break-glass — Request emergency break-glass access ──────
adminRouter.post(
  '/security/break-glass',
  validateBody(BreakGlassRequestSchema),
  async (req, res, next) => {
    try {
      const bgRequest = await SecurityCentreService.requestBreakGlass(
        req.user.id,
        req.user.role,
        req.body
      );
      res.status(201).json({ success: true, data: bgRequest });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /security/break-glass/:id/decision — Maker-Checker adjudication ───
adminRouter.post(
  '/security/break-glass/:id/decision',
  validateBody(BreakGlassDecisionSchema),
  async (req, res, next) => {
    try {
      const result = await SecurityCentreService.adjudicateBreakGlass(
        req.user.id,
        req.params.id,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /security/audit-integrity — Run audit chain verification ──────────
adminRouter.post('/security/audit-integrity', async (req, res, next) => {
  try {
    const records = req.body.records || null;
    const report = await SecurityCentreService.runAuditIntegrityCheck(records);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});


