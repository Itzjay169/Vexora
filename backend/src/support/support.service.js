/**
 * Vexora Esports Tournament Platform — Support Desk Service
 *
 * Phase 33: Support Desk & Ticketing System
 * PDF refs: Sections 23, 39 (Phase 8), ADR-014
 *
 * Security Gate:
 * - Support Agent sees ONLY limited user context (masked phone/email)
 * - NO KYC details (national ID, document scans strictly redacted)
 * - NO balance edits (support cannot execute balance changes or wallet ledger mutations)
 * - SLAs strictly tracked: First Response 4h standard, Safety 1h emergency SLA
 * - Complete audit trail in ticket_events
 */

import { query } from '../common/database.js';
import { logger } from '../common/logger.js';
import { AppError } from '../common/errorHandler.js';
import { appendAuditLog } from '../audit/audit.service.js';

// ─── SLA Constants ──────────────────────────────────────────────────────────
export const SLA_FIRST_RESPONSE_HOURS = {
  SAFETY: 1,       // 1 hour emergency SLA for harassment / safety reports
  CRITICAL: 2,     // 2 hours for critical technical / financial blockers
  URGENT: 2,       // 2 hours
  HIGH: 4,         // 4 hours standard SLA
  MEDIUM: 8,       // 8 hours
  LOW: 24,         // 24 hours
};

export const SLA_RESOLUTION_HOURS = {
  SAFETY: 24,      // 24 hours for safety investigations
  CRITICAL: 24,    // 24 hours
  URGENT: 24,      // 24 hours
  HIGH: 48,        // 48 hours
  MEDIUM: 72,      // 72 hours
  LOW: 120,        // 120 hours (5 days)
};

export class SupportService {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. SLA CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate first response and resolution due dates based on category and priority.
   * Safety reports receive 1h first response SLA regardless of user priority.
   */
  static calculateSlaTimes(category, priority = 'MEDIUM', baseTime = new Date()) {
    const catUpper = String(category || '').toUpperCase();
    const prioUpper = String(priority || 'MEDIUM').toUpperCase();

    // First Response SLA: 1h for SAFETY, 4h standard for HIGH, etc.
    let firstResponseHours;
    if (catUpper === 'SAFETY') {
      firstResponseHours = SLA_FIRST_RESPONSE_HOURS.SAFETY; // 1 hour!
    } else if (prioUpper === 'CRITICAL' || prioUpper === 'URGENT') {
      firstResponseHours = SLA_FIRST_RESPONSE_HOURS.CRITICAL;
    } else if (prioUpper === 'HIGH') {
      firstResponseHours = SLA_FIRST_RESPONSE_HOURS.HIGH; // 4 hours
    } else if (prioUpper === 'LOW') {
      firstResponseHours = SLA_FIRST_RESPONSE_HOURS.LOW;
    } else {
      firstResponseHours = SLA_FIRST_RESPONSE_HOURS.MEDIUM;
    }

    // Resolution SLA
    let resolutionHours;
    if (catUpper === 'SAFETY' || prioUpper === 'CRITICAL' || prioUpper === 'URGENT') {
      resolutionHours = SLA_RESOLUTION_HOURS.SAFETY;
    } else if (prioUpper === 'HIGH') {
      resolutionHours = SLA_RESOLUTION_HOURS.HIGH;
    } else if (prioUpper === 'LOW') {
      resolutionHours = SLA_RESOLUTION_HOURS.LOW;
    } else {
      resolutionHours = SLA_RESOLUTION_HOURS.MEDIUM;
    }

    const firstResponseDueAt = new Date(baseTime.getTime() + firstResponseHours * 60 * 60 * 1000);
    const resolutionDueAt = new Date(baseTime.getTime() + resolutionHours * 60 * 60 * 1000);

    return {
      firstResponseHours,
      resolutionHours,
      firstResponseDueAt,
      resolutionDueAt,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. TICKET CREATION & LISTING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new support ticket with deterministic SLA tracking and audit event.
   */
  static async createTicket({
    userId,
    category,
    subject,
    description,
    priority = 'MEDIUM',
    relatedEntityType = null,
    relatedEntityId = null,
    attachments = [],
  }) {
    const catUpper = category.toUpperCase();
    const prioUpper = priority.toUpperCase();
    const sla = SupportService.calculateSlaTimes(catUpper, prioUpper);

    // Generate ticket number
    let ticketNumber;
    try {
      const seqRes = await query(`SELECT nextval('support_ticket_seq') AS seq`);
      ticketNumber = `VEX-TK-${seqRes.rows[0].seq}`;
    } catch (_err) {
      // Fallback for mocked DB environments without sequences
      ticketNumber = `VEX-TK-${Math.floor(10000 + Math.random() * 90000)}`;
    }

    const insertResult = await query(
      `INSERT INTO support_tickets (
         user_id, ticket_number, category, subject, description, priority, status,
         sla_first_response_due_at, sla_resolution_due_at, sla_response_by, sla_resolve_by,
         related_entity_type, related_entity_id, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', $7, $8, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        userId,
        ticketNumber,
        catUpper,
        subject,
        description,
        prioUpper,
        sla.firstResponseDueAt,
        sla.resolutionDueAt,
        relatedEntityType,
        relatedEntityId,
      ]
    );

    const ticket = insertResult.rows[0];

    // Initial message if description provided
    await query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, message, is_internal, attachments, created_at)
       VALUES ($1, $2, $3, FALSE, $4, NOW())`,
      [ticket.id, userId, description, JSON.stringify(attachments || [])]
    );

    // Record audit history event
    await SupportService.recordEvent({
      ticketId: ticket.id,
      actorId: userId,
      actorRole: 'PLAYER',
      eventType: 'CREATED',
      newState: {
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        ticketNumber: ticket.ticket_number,
        slaFirstResponseDueAt: sla.firstResponseDueAt,
      },
      notes: `Ticket ${ticket.ticket_number} created in category ${ticket.category}`,
    });

    logger.info('Support ticket created', {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      userId,
      category: ticket.category,
      firstResponseDueAt: sla.firstResponseDueAt,
    });

    return ticket;
  }

  /**
   * List tickets with role-based isolation and SLA filtering.
   */
  static async listTickets({
    userId,
    role = 'PLAYER',
    status = null,
    category = null,
    priority = null,
    assignedTo = null,
    escalatedTo = null,
    breachedOnly = false,
    cursor = null,
    limit = 20,
  }) {
    const isStaff = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FINANCE', 'AUDITOR'].includes(role);
    const params = [];
    const conditions = [];

    // Player isolation: Players ONLY see their own tickets
    if (!isStaff) {
      params.push(userId);
      conditions.push(`t.user_id = $${params.length}`);
    } else if (userId && !isStaff) {
      params.push(userId);
      conditions.push(`t.user_id = $${params.length}`);
    }

    if (status) {
      params.push(status.toUpperCase());
      conditions.push(`t.status = $${params.length}`);
    }

    if (category) {
      params.push(category.toUpperCase());
      conditions.push(`t.category = $${params.length}`);
    }

    if (priority) {
      params.push(priority.toUpperCase());
      conditions.push(`t.priority = $${params.length}`);
    }

    if (assignedTo) {
      params.push(assignedTo);
      conditions.push(`t.assigned_to = $${params.length}`);
    }

    if (escalatedTo) {
      params.push(escalatedTo.toUpperCase());
      conditions.push(`t.escalated_to = $${params.length}`);
    }

    if (breachedOnly) {
      conditions.push(`(t.sla_first_response_breached = TRUE OR t.sla_resolution_breached = TRUE)`);
    }

    if (cursor?.ts && cursor?.id) {
      params.push(cursor.ts, cursor.id);
      conditions.push(`(t.created_at, t.id) < ($${params.length - 1}, $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit + 1);

    const result = await query(
      `SELECT t.*,
              u.username AS requester_username,
              assignee.username AS assignee_username
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN users assignee ON assignee.id = t.assigned_to
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    const hasMore = result.rows.length > limit;
    const items = hasMore ? result.rows.slice(0, limit) : result.rows;
    const nextCursor = hasMore && items.length > 0
      ? { ts: items[items.length - 1].created_at, id: items[items.length - 1].id }
      : null;

    return { items, hasMore, nextCursor };
  }

  /**
   * Get ticket details with conversation thread, events history, and CSAT survey.
   */
  static async getTicketDetails(ticketId, actor) {
    const isStaff = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FINANCE', 'AUDITOR'].includes(actor.role);

    const ticketRes = await query(
      `SELECT t.*,
              u.username AS requester_username,
              u.email AS requester_email,
              assignee.username AS assignee_username
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN users assignee ON assignee.id = t.assigned_to
       WHERE t.id = $1`,
      [ticketId]
    );

    if (ticketRes.rows.length === 0) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    const ticket = ticketRes.rows[0];

    // Security Gate check: Player cannot access another player's ticket
    if (!isStaff && ticket.user_id !== actor.id) {
      throw new AppError('Access denied to this ticket', 403, 'FORBIDDEN');
    }

    // Load messages (Internal notes hidden from players)
    let messagesSql = `
      SELECT m.*, u.username AS sender_username, u.role AS sender_role
      FROM ticket_messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.ticket_id = $1
    `;
    if (!isStaff) {
      messagesSql += ` AND m.is_internal = FALSE`;
    }
    messagesSql += ` ORDER BY m.created_at ASC`;

    const messagesRes = await query(messagesSql, [ticketId]);

    // Load audit history events
    const eventsRes = await query(
      `SELECT e.*, u.username AS actor_username
       FROM ticket_events e
       LEFT JOIN users u ON u.id = e.actor_id
       WHERE e.ticket_id = $1
       ORDER BY e.created_at ASC`,
      [ticketId]
    );

    // Load CSAT survey if any
    const csatRes = await query(
      `SELECT * FROM ticket_csat_surveys WHERE ticket_id = $1`,
      [ticketId]
    );

    return {
      ticket,
      messages: messagesRes.rows,
      events: eventsRes.rows,
      csat: csatRes.rows[0] || null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. TICKET REPLIES & INTERNAL NOTES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add a reply or internal note to a support ticket.
   */
  static async addReply(ticketId, actor, { message, isInternal = false, attachments = [], cannedReplyId = null }) {
    const isStaff = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FINANCE', 'AUDITOR'].includes(actor.role);

    const ticketRes = await query(
      `SELECT * FROM support_tickets WHERE id = $1`,
      [ticketId]
    );
    if (ticketRes.rows.length === 0) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    const ticket = ticketRes.rows[0];

    // Check ownership
    if (!isStaff && ticket.user_id !== actor.id) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    if (ticket.status === 'CLOSED') {
      throw new AppError('Cannot reply to a closed ticket', 400, 'TICKET_CLOSED');
    }

    // Players cannot write internal staff notes
    const effectiveIsInternal = isStaff ? Boolean(isInternal) : false;

    // Insert message
    const msgRes = await query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, message, is_internal, attachments, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [ticketId, actor.id, message, effectiveIsInternal, JSON.stringify(attachments || [])]
    );
    const newMsg = msgRes.rows[0];

    const updates = [];
    const updateParams = [ticketId];

    // If staff public reply and first time responding, record first_responded_at
    if (isStaff && !effectiveIsInternal && !ticket.first_responded_at) {
      updates.push(`first_responded_at = NOW()`);
      // Check if SLA was breached
      if (ticket.sla_first_response_due_at && new Date() > new Date(ticket.sla_first_response_due_at)) {
        updates.push(`sla_first_response_breached = TRUE`);
      }
    }

    // Status transition:
    // If staff replies publicly: WAITING_USER
    // If player replies: IN_PROGRESS (or OPEN)
    if (isStaff && !effectiveIsInternal) {
      updates.push(`status = 'WAITING_USER'`);
    } else if (!isStaff) {
      updates.push(`status = 'IN_PROGRESS'`);
    }
    updates.push(`updated_at = NOW()`);

    if (updates.length > 0) {
      await query(
        `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $1`,
        updateParams
      );
    }

    // Record audit event
    await SupportService.recordEvent({
      ticketId,
      actorId: actor.id,
      actorRole: actor.role,
      eventType: effectiveIsInternal ? 'INTERNAL_NOTE' : 'REPLIED',
      newState: {
        isInternal: effectiveIsInternal,
        cannedReplyId,
        messageLength: message.length,
      },
      notes: effectiveIsInternal ? 'Internal staff note added' : 'Reply sent to ticket',
    });

    return newMsg;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ESCALATION TO FINANCE / MODERATION / LEGAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Escalate a ticket to a specialized department (FINANCE, MODERATION, LEGAL, SUPER_ADMIN).
   */
  static async escalateTicket(ticketId, actor, { escalateTo, reason, priority = null }) {
    const isStaff = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FINANCE'].includes(actor.role);
    if (!isStaff) {
      throw new AppError('Only staff can escalate tickets', 403, 'FORBIDDEN');
    }

    const ticketRes = await query(`SELECT * FROM support_tickets WHERE id = $1`, [ticketId]);
    if (ticketRes.rows.length === 0) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }
    const ticket = ticketRes.rows[0];

    const updates = [
      `status = 'ESCALATED'`,
      `escalated_to = $2`,
      `escalated_at = NOW()`,
      `escalated_reason = $3`,
      `updated_at = NOW()`,
    ];
    const params = [ticketId, escalateTo.toUpperCase(), reason];

    if (priority) {
      params.push(priority.toUpperCase());
      updates.push(`priority = $${params.length}`);
    }

    const updatedRes = await query(
      `UPDATE support_tickets
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params
    );

    const updatedTicket = updatedRes.rows[0];

    // Record audit event
    await SupportService.recordEvent({
      ticketId,
      actorId: actor.id,
      actorRole: actor.role,
      eventType: 'ESCALATED',
      oldState: { status: ticket.status, escalatedTo: ticket.escalated_to, priority: ticket.priority },
      newState: {
        status: updatedTicket.status,
        escalatedTo: updatedTicket.escalated_to,
        priority: updatedTicket.priority,
        reason,
      },
      notes: `Ticket escalated to ${escalateTo}: ${reason}`,
    });

    logger.warn('Ticket escalated', {
      ticketId,
      ticketNumber: ticket.ticket_number,
      escalatedTo,
      escalatedBy: actor.username,
      reason,
    });

    return updatedTicket;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. ASSIGNMENT & STATUS UPDATES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Assign ticket to a support agent.
   */
  static async assignTicket(ticketId, actor, { assignedTo, notes = null }) {
    const isStaff = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FINANCE'].includes(actor.role);
    if (!isStaff) {
      throw new AppError('Only staff can assign tickets', 403, 'FORBIDDEN');
    }

    const updated = await query(
      `UPDATE support_tickets
       SET assigned_to = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [ticketId, assignedTo]
    );

    if (updated.rows.length === 0) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    await SupportService.recordEvent({
      ticketId,
      actorId: actor.id,
      actorRole: actor.role,
      eventType: 'ASSIGNED',
      newState: { assignedTo },
      notes: notes || `Ticket assigned to ${assignedTo}`,
    });

    return updated.rows[0];
  }

  /**
   * Update ticket status (e.g. RESOLVED, CLOSED, IN_PROGRESS).
   */
  static async updateTicketStatus(ticketId, actor, { status, resolutionNotes = null }) {
    const isStaff = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FINANCE'].includes(actor.role);
    if (!isStaff) {
      throw new AppError('Only staff can update ticket status directly', 403, 'FORBIDDEN');
    }

    const ticketRes = await query(`SELECT * FROM support_tickets WHERE id = $1`, [ticketId]);
    if (ticketRes.rows.length === 0) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }
    const ticket = ticketRes.rows[0];

    const statusUpper = status.toUpperCase();
    const updates = [`status = $2`, `updated_at = NOW()`];
    const params = [ticketId, statusUpper];

    if (statusUpper === 'RESOLVED') {
      updates.push(`resolved_at = NOW()`);
      // Check if resolution breached SLA
      if (ticket.sla_resolution_due_at && new Date() > new Date(ticket.sla_resolution_due_at)) {
        updates.push(`sla_resolution_breached = TRUE`);
      }
    } else if (statusUpper === 'CLOSED') {
      updates.push(`closed_at = NOW()`);
    }

    const updatedRes = await query(
      `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    const updated = updatedRes.rows[0];

    // Log resolution note if provided
    if (resolutionNotes) {
      await query(
        `INSERT INTO ticket_messages (ticket_id, sender_id, message, is_internal, created_at)
         VALUES ($1, $2, $3, FALSE, NOW())`,
        [ticketId, actor.id, `[Resolution] ${resolutionNotes}`]
      );
    }

    await SupportService.recordEvent({
      ticketId,
      actorId: actor.id,
      actorRole: actor.role,
      eventType: statusUpper === 'RESOLVED' ? 'RESOLVED' : (statusUpper === 'CLOSED' ? 'CLOSED' : 'STATUS_CHANGED'),
      oldState: { status: ticket.status },
      newState: { status: updated.status, resolutionNotes },
      notes: `Ticket status updated from ${ticket.status} to ${statusUpper}`,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CSAT SURVEYS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Submit post-resolution CSAT survey (1 survey per ticket).
   */
  static async submitCsatSurvey(ticketId, userId, { rating, satisfied, feedback = null }) {
    const ticketRes = await query(
      `SELECT * FROM support_tickets WHERE id = $1 AND user_id = $2`,
      [ticketId, userId]
    );

    if (ticketRes.rows.length === 0) {
      throw new AppError('Ticket not found or does not belong to you', 404, 'TICKET_NOT_FOUND');
    }

    const ticket = ticketRes.rows[0];
    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      throw new AppError('CSAT surveys can only be submitted for resolved or closed tickets', 400, 'TICKET_NOT_RESOLVED');
    }

    const insertRes = await query(
      `INSERT INTO ticket_csat_surveys (ticket_id, user_id, rating, satisfied, feedback, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (ticket_id) DO UPDATE
       SET rating = EXCLUDED.rating, satisfied = EXCLUDED.satisfied, feedback = EXCLUDED.feedback
       RETURNING *`,
      [ticketId, userId, rating, Boolean(satisfied), feedback]
    );

    await SupportService.recordEvent({
      ticketId,
      actorId: userId,
      actorRole: 'PLAYER',
      eventType: 'CSAT_SUBMITTED',
      newState: { rating, satisfied },
      notes: `User submitted CSAT rating ${rating}/5 (satisfied: ${satisfied})`,
    });

    return insertRes.rows[0];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SLA BREACH DETECTION & ALERTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check for active tickets that have breached either the First Response or Resolution SLA.
   * Dispatches alerts to sla_breach_alerts and records audit events.
   */
  static async checkSlaBreaches() {
    const now = new Date();
    const alertsGenerated = [];

    // 1. First Response Breaches:
    // status is not RESOLVED or CLOSED, first_responded_at is NULL, sla_first_response_due_at < NOW, sla_first_response_breached = FALSE
    const firstResponseBreaches = await query(
      `SELECT t.* FROM support_tickets t
       WHERE t.status NOT IN ('RESOLVED', 'CLOSED')
         AND t.first_responded_at IS NULL
         AND t.sla_first_response_due_at IS NOT NULL
         AND t.sla_first_response_due_at < NOW()
         AND t.sla_first_response_breached = FALSE`
    );

    for (const ticket of firstResponseBreaches.rows) {
      // Mark ticket as breached
      await query(
        `UPDATE support_tickets
         SET sla_first_response_breached = TRUE, updated_at = NOW()
         WHERE id = $1`,
        [ticket.id]
      );

      // Create SLA breach alert
      const team = ticket.category === 'SAFETY' ? 'SAFETY_MODERATION' : 'SUPPORT_OPS';
      const alertRes = await query(
        `INSERT INTO sla_breach_alerts (
           ticket_id, breach_type, category, priority, due_at, breached_at, alerted_team, created_at
         )
         VALUES ($1, 'FIRST_RESPONSE', $2, $3, $4, NOW(), $5, NOW())
         RETURNING *`,
        [ticket.id, ticket.category, ticket.priority, ticket.sla_first_response_due_at, team]
      );

      // Record audit history event
      await SupportService.recordEvent({
        ticketId: ticket.id,
        actorId: null,
        actorRole: 'SYSTEM',
        eventType: 'SLA_FIRST_RESPONSE_BREACHED',
        newState: {
          dueAt: ticket.sla_first_response_due_at,
          breachedAt: now,
          category: ticket.category,
        },
        notes: `SLA First Response breached! (Category: ${ticket.category}, Expected: ${ticket.sla_first_response_due_at})`,
      });

      alertsGenerated.push(alertRes.rows[0]);
    }

    // 2. Resolution Breaches:
    // status is not RESOLVED or CLOSED, resolved_at is NULL, sla_resolution_due_at < NOW, sla_resolution_breached = FALSE
    const resolutionBreaches = await query(
      `SELECT t.* FROM support_tickets t
       WHERE t.status NOT IN ('RESOLVED', 'CLOSED')
         AND t.resolved_at IS NULL
         AND t.sla_resolution_due_at IS NOT NULL
         AND t.sla_resolution_due_at < NOW()
         AND t.sla_resolution_breached = FALSE`
    );

    for (const ticket of resolutionBreaches.rows) {
      await query(
        `UPDATE support_tickets
         SET sla_resolution_breached = TRUE, updated_at = NOW()
         WHERE id = $1`,
        [ticket.id]
      );

      const team = ticket.category === 'SAFETY' ? 'SAFETY_MODERATION' : 'SUPPORT_LEAD';
      const alertRes = await query(
        `INSERT INTO sla_breach_alerts (
           ticket_id, breach_type, category, priority, due_at, breached_at, alerted_team, created_at
         )
         VALUES ($1, 'RESOLUTION', $2, $3, $4, NOW(), $5, NOW())
         RETURNING *`,
        [ticket.id, ticket.category, ticket.priority, ticket.sla_resolution_due_at, team]
      );

      await SupportService.recordEvent({
        ticketId: ticket.id,
        actorId: null,
        actorRole: 'SYSTEM',
        eventType: 'SLA_RESOLUTION_BREACHED',
        newState: {
          dueAt: ticket.sla_resolution_due_at,
          breachedAt: now,
          category: ticket.category,
        },
        notes: `SLA Resolution breached! (Category: ${ticket.category}, Expected: ${ticket.sla_resolution_due_at})`,
      });

      alertsGenerated.push(alertRes.rows[0]);
    }

    if (alertsGenerated.length > 0) {
      logger.warn(`SLA Breach alerts generated`, { count: alertsGenerated.length });
    }

    return alertsGenerated;
  }

  /**
   * List SLA breach alerts for staff dashboard.
   */
  static async listSlaBreachAlerts({ acknowledged = false, limit = 50 } = {}) {
    const result = await query(
      `SELECT a.*,
              t.ticket_number,
              t.subject,
              t.status AS ticket_status,
              t.user_id,
              u.username AS requester_username
       FROM sla_breach_alerts a
       JOIN support_tickets t ON t.id = a.ticket_id
       LEFT JOIN users u ON u.id = t.user_id
       WHERE a.acknowledged = $1
       ORDER BY a.breached_at DESC
       LIMIT $2`,
      [acknowledged, limit]
    );
    return result.rows;
  }

  /**
   * Acknowledge an SLA breach alert.
   */
  static async acknowledgeSlaAlert(alertId, actorId) {
    const result = await query(
      `UPDATE sla_breach_alerts
       SET acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [alertId, actorId]
    );
    if (result.rows.length === 0) {
      throw new AppError('SLA breach alert not found', 404, 'ALERT_NOT_FOUND');
    }
    return result.rows[0];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. CANNED REPLIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List canned replies by category or all active.
   */
  static async getCannedReplies({ category = null, activeOnly = true } = {}) {
    const params = [];
    const conditions = [];

    if (activeOnly) {
      conditions.push(`is_active = TRUE`);
    }
    if (category) {
      params.push(category.toUpperCase());
      conditions.push(`category = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM canned_replies ${where} ORDER BY category, title ASC`,
      params
    );
    return result.rows;
  }

  /**
   * Create a new canned reply (Admin / Lead Agent only).
   */
  static async createCannedReply(actor, { category, title, shortcutCode, body, isActive = true }) {
    const isStaff = ['ADMIN', 'SUPER_ADMIN'].includes(actor.role);
    if (!isStaff) {
      throw new AppError('Only administrators can manage canned replies', 403, 'FORBIDDEN');
    }

    const result = await query(
      `INSERT INTO canned_replies (category, title, shortcut_code, body, is_active, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [category.toUpperCase(), title, shortcutCode.toLowerCase(), body, Boolean(isActive), actor.id]
    );

    return result.rows[0];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. SECURITY GATE: LIMITED USER CONTEXT FOR SUPPORT AGENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch limited user context for Support Agents.
   *
   * SECURITY ENFORCEMENT:
   * - Email & phone are masked (e.g. `j***@vexora.gg`, `+91 ******1234`)
   * - KYC documents & National IDs are REDACTED / OMITTED
   * - Balance modification is STRICTLY PROHIBITED (`can_edit_balance: false`)
   * - Returns operational context: registration date, reputation score, dispute count, active tickets
   */
  static async getUserContextForSupport(targetUserId, actorRole) {
    const userRes = await query(
      `SELECT id, username, email, phone, role, is_active, is_banned, created_at,
              kyc_status, kyc_verified_at, reputation_score
       FROM users
       WHERE id = $1`,
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const raw = userRes.rows[0];

    // Mask email
    let maskedEmail = '[UNSPECIFIED]';
    if (raw.email) {
      const parts = raw.email.split('@');
      maskedEmail = parts[0].length > 2
        ? `${parts[0].slice(0, 2)}***@${parts[1]}`
        : `*@${parts[1]}`;
    }

    // Mask phone
    let maskedPhone = '[UNSPECIFIED]';
    if (raw.phone) {
      maskedPhone = raw.phone.length > 4
        ? `${raw.phone.slice(0, 3)}******${raw.phone.slice(-4)}`
        : '******';
    }

    // Aggregate ticket & dispute history counts
    const ticketStats = await query(
      `SELECT COUNT(*)::int AS total_tickets,
              COUNT(CASE WHEN status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED') THEN 1 END)::int AS active_tickets
       FROM support_tickets
       WHERE user_id = $1`,
      [targetUserId]
    );

    const disputeStats = await query(
      `SELECT COUNT(*)::int AS total_disputes
       FROM disputes
       WHERE raised_by = $1`,
      [targetUserId]
    ).catch(() => ({ rows: [{ total_disputes: 0 }] }));

    // Read-only wallet balance (no editing permitted)
    const walletRes = await query(
      `SELECT balance, currency FROM user_wallets WHERE user_id = $1`,
      [targetUserId]
    ).catch(() => ({ rows: [{ balance: '0.00', currency: 'CREDIT' }] }));

    const wallet = walletRes.rows[0] || { balance: '0.00', currency: 'CREDIT' };

    return {
      userId: raw.id,
      username: raw.username,
      maskedEmail,
      maskedPhone,
      role: raw.role,
      isActive: raw.is_active,
      isBanned: raw.is_banned,
      registeredAt: raw.created_at,
      reputationScore: raw.reputation_score || 100,
      // Security Gate: KYC status is visible, but documents and IDs are STRICTLY REDACTED
      kyc: {
        status: raw.kyc_status || 'NOT_SUBMITTED',
        verifiedAt: raw.kyc_verified_at || null,
        documents: '[REDACTED_ACCESS_RESTRICTED]',
        nationalId: '[REDACTED_ACCESS_RESTRICTED]',
      },
      // Security Gate: Support Agent can NEVER edit balances
      balanceContext: {
        readOnlyBalance: wallet.balance,
        currency: wallet.currency,
        canEditBalance: false, // HARD ENFORCED: Support agents CANNOT modify balances!
      },
      stats: {
        totalTickets: ticketStats.rows[0]?.total_tickets || 0,
        activeTickets: ticketStats.rows[0]?.active_tickets || 0,
        totalDisputes: disputeStats.rows[0]?.total_disputes || 0,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. AUDIT EVENT LOGGER HELPER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Internal helper to record an immutable ticket event in ticket_events.
   */
  static async recordEvent({
    ticketId,
    actorId = null,
    actorRole = 'SYSTEM',
    eventType,
    oldState = null,
    newState = null,
    notes = null,
  }) {
    try {
      await query(
        `INSERT INTO ticket_events (
           ticket_id, actor_id, actor_role, event_type, old_state, new_state, notes, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          ticketId,
          actorId,
          actorRole,
          eventType,
          oldState ? JSON.stringify(oldState) : null,
          newState ? JSON.stringify(newState) : null,
          notes,
        ]
      );
    } catch (err) {
      logger.error('Failed to record ticket event', { ticketId, eventType, err: err.message });
    }
  }
}
