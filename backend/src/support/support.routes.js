import { Router } from 'express';
import { authenticate } from '../common/auth.middleware.js';
import { AppError } from '../common/errorHandler.js';
import { query } from '../common/database.js';
import { parsePagination, paginatedResponse } from '../common/pagination.js';
import { z } from 'zod';

export const supportRouter = Router();

// All support endpoints require auth
supportRouter.use(authenticate);

// ─── Validation Schemas ──────────────────────────────────────────────────
const createTicketSchema = z.object({
  category: z.enum(['ACCOUNT', 'PAYMENT', 'TOURNAMENT', 'TECHNICAL', 'REPORT_BUG', 'OTHER']),
  subject: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

const replySchema = z.object({
  message: z.string().min(1).max(5000),
});

// ─── GET / — List user's support tickets ─────────────────────────────────
supportRouter.get('/', async (req, res, next) => {
  try {
    const { cursor, limit } = parsePagination(req.query);
    const status = req.query.status;

    let whereClause = 'WHERE t.user_id = $1';
    const params = [req.user.id];

    if (status) {
      params.push(status.toUpperCase());
      whereClause += ` AND t.status = $${params.length}`;
    }

    if (cursor) {
      params.push(cursor.ts, cursor.id);
      whereClause += ` AND (t.created_at, t.id) < ($${params.length - 1}, $${params.length})`;
    }

    params.push(limit + 1);

    const result = await query(
      `SELECT t.id, t.category, t.subject, t.priority, t.status, t.created_at, t.updated_at
       FROM support_tickets t
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ success: true, ...paginatedResponse(result.rows, limit) });
  } catch (err) {
    next(err);
  }
});

// ─── POST / — Create a support ticket ────────────────────────────────────
supportRouter.post('/', async (req, res, next) => {
  try {
    const data = createTicketSchema.parse(req.body);

    const result = await query(
      `INSERT INTO support_tickets (user_id, category, subject, description, priority, status)
       VALUES ($1, $2, $3, $4, $5, 'OPEN')
       RETURNING *`,
      [req.user.id, data.category, data.subject, data.description, data.priority]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});

// ─── GET /:id — Get ticket details with replies ──────────────────────────
supportRouter.get('/:id', async (req, res, next) => {
  try {
    const ticket = await query(
      `SELECT * FROM support_tickets WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (ticket.rows.length === 0) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    const replies = await query(
      `SELECT id, sender_role, message, created_at
       FROM support_replies
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: { ...ticket.rows[0], replies: replies.rows },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/reply — Add a reply to a ticket ──────────────────────────
supportRouter.post('/:id/reply', async (req, res, next) => {
  try {
    const data = replySchema.parse(req.body);

    // Verify ticket belongs to user and is open
    const ticket = await query(
      `SELECT id, status FROM support_tickets WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (ticket.rows.length === 0) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }
    if (ticket.rows[0].status === 'CLOSED') {
      throw new AppError('Cannot reply to a closed ticket', 400, 'TICKET_CLOSED');
    }

    const result = await query(
      `INSERT INTO support_replies (ticket_id, sender_id, sender_role, message)
       VALUES ($1, $2, 'USER', $3)
       RETURNING *`,
      [req.params.id, req.user.id, data.message]
    );

    // Re-open if it was resolved
    await query(
      `UPDATE support_tickets SET status = 'OPEN', updated_at = NOW() WHERE id = $1 AND status = 'RESOLVED'`,
      [req.params.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});
