import { Router } from 'express';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { AppError } from '../common/errorHandler.js';
import { parsePagination, paginatedResponse } from '../common/pagination.js';
import { SupportService } from './support.service.js';
import {
  CreateTicketSchema,
  TicketReplySchema,
  TicketEscalateSchema,
  TicketAssignSchema,
  TicketStatusUpdateSchema,
  CsatSurveySchema,
  CannedReplySchema,
} from '../../../packages/validation/src/index.ts';
import { z } from 'zod';

export const supportRouter = Router();

// All support endpoints require authentication
supportRouter.use(authenticate);

// ─── 1. List Tickets (GET / and GET /tickets) ────────────────────────────────
async function handleListTickets(req, res, next) {
  try {
    const { cursor, limit } = parsePagination(req.query);
    const { status, category, priority, assignedTo, escalatedTo, breachedOnly } = req.query;

    const result = await SupportService.listTickets({
      userId: req.user.id,
      role: req.user.role,
      status,
      category,
      priority,
      assignedTo,
      escalatedTo,
      breachedOnly: breachedOnly === 'true',
      cursor,
      limit,
    });

    res.json({
      success: true,
      data: result.items,
      pagination: {
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      },
    });
  } catch (err) {
    next(err);
  }
}

supportRouter.get('/', handleListTickets);
supportRouter.get('/tickets', handleListTickets);

// ─── 2. Create Ticket (POST / and POST /tickets) ─────────────────────────────
async function handleCreateTicket(req, res, next) {
  try {
    const data = CreateTicketSchema.parse(req.body);

    const ticket = await SupportService.createTicket({
      userId: req.user.id,
      category: data.category,
      subject: data.subject,
      description: data.description,
      priority: data.priority,
      relatedEntityType: data.relatedEntityType,
      relatedEntityId: data.relatedEntityId,
      attachments: data.attachments,
    });

    res.status(201).json({
      success: true,
      message: `Support ticket ${ticket.ticket_number} created with active SLA tracking`,
      data: ticket,
    });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
}

supportRouter.post('/', handleCreateTicket);
supportRouter.post('/tickets', handleCreateTicket);

// ─── 3. SLA Breach Alerts Endpoints ──────────────────────────────────────────
// List SLA breach alerts
supportRouter.get('/tickets/breaches', authorize('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT', 'MODERATOR', 'FINANCE'), async (req, res, next) => {
  try {
    const acknowledged = req.query.acknowledged === 'true';
    const limit = parseInt(req.query.limit, 10) || 50;
    const alerts = await SupportService.listSlaBreachAlerts({ acknowledged, limit });
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    next(err);
  }
});

// Trigger SLA breach check (worker / cron endpoint)
supportRouter.post('/tickets/breaches/check', authorize('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT'), async (_req, res, next) => {
  try {
    const alerts = await SupportService.checkSlaBreaches();
    res.json({
      success: true,
      message: `SLA breach check completed: ${alerts.length} new breaches identified`,
      alertsGenerated: alerts.length,
      data: alerts,
    });
  } catch (err) {
    next(err);
  }
});

// Acknowledge SLA breach alert
supportRouter.post('/tickets/breaches/:id/ack', authorize('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT', 'FINANCE'), async (req, res, next) => {
  try {
    const alert = await SupportService.acknowledgeSlaAlert(req.params.id, req.user.id);
    res.json({
      success: true,
      message: 'SLA breach alert acknowledged',
      data: alert,
    });
  } catch (err) {
    next(err);
  }
});

// ─── 4. Canned Replies Endpoints ─────────────────────────────────────────────
supportRouter.get('/canned-replies', async (req, res, next) => {
  try {
    const { category, activeOnly } = req.query;
    const replies = await SupportService.getCannedReplies({
      category,
      activeOnly: activeOnly !== 'false',
    });
    res.json({ success: true, count: replies.length, data: replies });
  } catch (err) {
    next(err);
  }
});

supportRouter.post('/canned-replies', authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const data = CannedReplySchema.parse(req.body);
    const reply = await SupportService.createCannedReply(req.user, data);
    res.status(201).json({ success: true, data: reply });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});

// ─── 5. Security Gate: Limited User Context for Support ──────────────────────
supportRouter.get('/users/:userId/context', authorize('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT', 'MODERATOR', 'FINANCE'), async (req, res, next) => {
  try {
    const context = await SupportService.getUserContextForSupport(req.params.userId, req.user.role);
    res.json({ success: true, data: context });
  } catch (err) {
    next(err);
  }
});

// ─── 6. Single Ticket Operations ─────────────────────────────────────────────
// Get ticket details
async function handleGetTicket(req, res, next) {
  try {
    const details = await SupportService.getTicketDetails(req.params.id, req.user);
    res.json({ success: true, data: details });
  } catch (err) {
    next(err);
  }
}

supportRouter.get('/:id', handleGetTicket);
supportRouter.get('/tickets/:id', handleGetTicket);

// Reply or add internal note
async function handleReplyTicket(req, res, next) {
  try {
    const data = TicketReplySchema.parse(req.body);
    const reply = await SupportService.addReply(req.params.id, req.user, data);
    res.status(201).json({
      success: true,
      message: data.isInternal ? 'Internal staff note recorded' : 'Reply sent to ticket',
      data: reply,
    });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
}

supportRouter.post('/:id/reply', handleReplyTicket);
supportRouter.post('/tickets/:id/reply', handleReplyTicket);

// Escalate ticket to finance / moderation
supportRouter.post('/tickets/:id/escalate', authorize('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT', 'MODERATOR'), async (req, res, next) => {
  try {
    const data = TicketEscalateSchema.parse(req.body);
    const escalatedTicket = await SupportService.escalateTicket(req.params.id, req.user, data);
    res.json({
      success: true,
      message: `Ticket successfully escalated to ${data.escalateTo}`,
      data: escalatedTicket,
    });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});

// Assign ticket
supportRouter.post('/tickets/:id/assign', authorize('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT'), async (req, res, next) => {
  try {
    const data = TicketAssignSchema.parse(req.body);
    const assigned = await SupportService.assignTicket(req.params.id, req.user, data);
    res.json({
      success: true,
      message: `Ticket successfully assigned`,
      data: assigned,
    });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});

// Update status (RESOLVED, CLOSED, etc.)
supportRouter.patch('/tickets/:id/status', authorize('ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT', 'MODERATOR', 'FINANCE'), async (req, res, next) => {
  try {
    const data = TicketStatusUpdateSchema.parse(req.body);
    const updated = await SupportService.updateTicketStatus(req.params.id, req.user, data);
    res.json({
      success: true,
      message: `Ticket status updated to ${data.status}`,
      data: updated,
    });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});

// Submit CSAT survey
supportRouter.post('/tickets/:id/csat', async (req, res, next) => {
  try {
    const data = CsatSurveySchema.parse(req.body);
    const survey = await SupportService.submitCsatSurvey(req.params.id, req.user.id, data);
    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! CSAT survey recorded.',
      data: survey,
    });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});
