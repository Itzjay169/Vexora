import { Router } from 'express';
import { authenticate } from '../common/auth.middleware.js';
import { query } from '../common/database.js';
import { parsePagination, paginatedResponse } from '../common/pagination.js';
import { notificationQueue } from '../common/workers.js';

export const notificationsRouter = Router();

// All notification endpoints require auth
notificationsRouter.use(authenticate);

// ─── GET / — List user's notifications ───────────────────────────────────
notificationsRouter.get('/', async (req, res, next) => {
  try {
    const { cursor, limit } = parsePagination(req.query);
    const unreadOnly = req.query.unread === 'true';

    let whereClause = 'WHERE n.user_id = $1';
    const params = [req.user.id];

    if (unreadOnly) {
      whereClause += ' AND n.read_at IS NULL';
    }

    if (cursor) {
      params.push(cursor.ts, cursor.id);
      whereClause += ` AND (n.created_at, n.id) < ($${params.length - 1}, $${params.length})`;
    }

    params.push(limit + 1);

    const result = await query(
      `SELECT n.id, n.type, n.title, n.body, n.data, n.read_at, n.created_at
       FROM notifications n
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ success: true, ...paginatedResponse(result.rows, limit) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /unread-count — Unread notification count ───────────────────────
notificationsRouter.get('/unread-count', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT COUNT(*)::int AS count FROM notifications
       WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id]
    );

    res.json({ success: true, data: { unreadCount: result.rows[0].count } });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /:id/read — Mark notification as read ─────────────────────────
notificationsRouter.patch('/:id/read', async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE notifications SET read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL
       RETURNING id, read_at`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, message: 'Already read or not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /read-all — Mark all notifications as read ─────────────────────
notificationsRouter.post('/read-all', async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE notifications SET read_at = NOW()
       WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id]
    );

    res.json({ success: true, data: { markedRead: result.rowCount } });
  } catch (err) {
    next(err);
  }
});
