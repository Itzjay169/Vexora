/**
 * Vexora Break-Glass Access Service — Phase 8
 *
 * Time-boxed emergency access that auto-expires.
 * Break-glass allows a pre-authorized admin to temporarily elevate
 * permissions beyond their normal role for critical operational needs.
 *
 * Safeguards (PDF Section 47):
 *   - All break-glass requests are logged to the tamper-evident audit chain
 *   - Requests expire automatically after a configured duration (max 4 hours)
 *   - Requests require a mandatory reason
 *   - Active break-glass sessions are visible in the Security Centre
 *   - SEV-1 alert on any break-glass activation
 *   - Cannot self-approve (creator !== approver)
 *
 * PDF refs: Section 2, Section 12 (Security Centre), Section 47
 */

import crypto from 'crypto';
import { query, withTransaction } from './database.js';
import { appendAuditLog, hashIP } from './auditLog.js';
import { AppError } from './errorHandler.js';
import { logger } from './logger.js';

// Maximum break-glass duration: 4 hours
const MAX_DURATION_HOURS = 4;
const DEFAULT_DURATION_HOURS = 1;

/**
 * Create a break-glass access request.
 *
 * @param {Object} params
 * @param {string} params.requesterId - Who is requesting elevated access
 * @param {string} params.requesterRole - Current role of the requester
 * @param {string} params.reason - Mandatory justification
 * @param {string[]} params.elevatedPermissions - Specific permissions requested
 * @param {number} [params.durationHours=1] - Requested duration (capped at MAX)
 * @param {string} [params.ipHash] - Hashed IP of requester
 * @returns {Promise<Object>} The created break-glass request
 */
export async function createBreakGlassRequest({
  requesterId,
  requesterRole,
  reason,
  elevatedPermissions = [],
  durationHours = DEFAULT_DURATION_HOURS,
  ipHash = null,
}) {
  if (!reason || reason.trim().length < 10) {
    throw new AppError(
      'Break-glass request requires a detailed reason (minimum 10 characters)',
      400,
      'BREAK_GLASS_REASON_REQUIRED'
    );
  }

  if (elevatedPermissions.length === 0) {
    throw new AppError(
      'Break-glass request must specify the permissions needed',
      400,
      'BREAK_GLASS_PERMISSIONS_REQUIRED'
    );
  }

  // Cap duration
  const effectiveDuration = Math.min(durationHours, MAX_DURATION_HOURS);
  const requestId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + effectiveDuration * 60 * 60 * 1000);

  const result = await query(
    `INSERT INTO break_glass_requests
       (id, requester_id, requester_role, reason, elevated_permissions,
        duration_hours, expires_at, status, ip_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, NOW())
     RETURNING *`,
    [
      requestId, requesterId, requesterRole, reason.trim(),
      JSON.stringify(elevatedPermissions), effectiveDuration,
      expiresAt.toISOString(), ipHash,
    ]
  );

  // Audit log the request
  await appendAuditLog({
    actorId: requesterId,
    actorRole: requesterRole,
    action: 'BREAK_GLASS_REQUESTED',
    entityType: 'break_glass',
    entityId: requestId,
    payload: {
      elevatedPermissions,
      durationHours: effectiveDuration,
      expiresAt: expiresAt.toISOString(),
    },
    reason: reason.trim(),
    ipHash,
  });

  // SEV-1 alert
  logger.error('🚨 SEV-1: Break-glass access REQUESTED', {
    requestId,
    requesterId,
    requesterRole,
    elevatedPermissions,
    durationHours: effectiveDuration,
    reason: reason.trim(),
  });

  return result.rows[0];
}

/**
 * Approve a break-glass request.
 * The approver CANNOT be the same person who created the request (maker-checker).
 *
 * @param {Object} params
 * @param {string} params.requestId - Break-glass request ID
 * @param {string} params.approverId - Who is approving
 * @param {string} params.approverRole - Role of the approver
 * @param {string} [params.ipHash] - Hashed IP of approver
 * @returns {Promise<Object>} The approved break-glass record
 */
export async function approveBreakGlassRequest({
  requestId,
  approverId,
  approverRole,
  ipHash = null,
}) {
  return withTransaction(async (client) => {
    // Fetch the pending request
    const reqResult = await client.query(
      `SELECT * FROM break_glass_requests WHERE id = $1 AND status = 'PENDING'`,
      [requestId]
    );

    if (reqResult.rows.length === 0) {
      throw new AppError('Break-glass request not found or already processed', 404, 'REQUEST_NOT_FOUND');
    }

    const request = reqResult.rows[0];

    // Maker-checker: approver must not be the requester
    if (request.requester_id === approverId) {
      throw new AppError(
        'Cannot approve your own break-glass request (maker-checker violation)',
        403,
        'SELF_APPROVAL_DENIED'
      );
    }

    // Check if already expired
    if (new Date(request.expires_at) < new Date()) {
      await client.query(
        `UPDATE break_glass_requests SET status = 'EXPIRED' WHERE id = $1`,
        [requestId]
      );
      throw new AppError('Break-glass request has expired', 400, 'REQUEST_EXPIRED');
    }

    // Approve
    const updatedResult = await client.query(
      `UPDATE break_glass_requests
       SET status = 'ACTIVE', approved_by = $1, approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approverId, requestId]
    );

    // Audit log the approval
    await appendAuditLog({
      actorId: approverId,
      actorRole: approverRole,
      action: 'BREAK_GLASS_APPROVED',
      entityType: 'break_glass',
      entityId: requestId,
      payload: {
        requesterId: request.requester_id,
        elevatedPermissions: request.elevated_permissions,
        expiresAt: request.expires_at,
      },
      reason: `Approved break-glass for ${request.requester_id}`,
      ipHash,
      client,
    });

    // SEV-1 alert
    logger.error('🚨 SEV-1: Break-glass access ACTIVATED', {
      requestId,
      requesterId: request.requester_id,
      approverId,
      elevatedPermissions: request.elevated_permissions,
      expiresAt: request.expires_at,
    });

    return updatedResult.rows[0];
  });
}

/**
 * Revoke an active break-glass session.
 *
 * @param {string} requestId
 * @param {string} revokerId
 * @param {string} revokerRole
 * @param {string} reason
 */
export async function revokeBreakGlass(requestId, revokerId, revokerRole, reason = 'Manual revocation') {
  const result = await query(
    `UPDATE break_glass_requests
     SET status = 'REVOKED', revoked_by = $1, revoked_at = NOW()
     WHERE id = $2 AND status = 'ACTIVE'
     RETURNING *`,
    [revokerId, requestId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Active break-glass session not found', 404, 'REQUEST_NOT_FOUND');
  }

  await appendAuditLog({
    actorId: revokerId,
    actorRole: revokerRole,
    action: 'BREAK_GLASS_REVOKED',
    entityType: 'break_glass',
    entityId: requestId,
    payload: { reason },
    reason,
  });

  logger.warn('Break-glass access REVOKED', { requestId, revokerId, reason });

  return result.rows[0];
}

/**
 * Check if a user has an active, non-expired break-glass session.
 * If so, return the elevated permissions.
 *
 * @param {string} userId
 * @returns {Promise<{ active: boolean, permissions: string[], expiresAt: string|null }>}
 */
export async function getActiveBreakGlass(userId) {
  const result = await query(
    `SELECT id, elevated_permissions, expires_at
     FROM break_glass_requests
     WHERE requester_id = $1
       AND status = 'ACTIVE'
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return { active: false, permissions: [], expiresAt: null };
  }

  const row = result.rows[0];
  return {
    active: true,
    permissions: typeof row.elevated_permissions === 'string'
      ? JSON.parse(row.elevated_permissions)
      : row.elevated_permissions,
    expiresAt: row.expires_at,
  };
}

/**
 * Expire all break-glass sessions that have passed their expiry.
 * Should be called periodically (e.g., by a BullMQ worker).
 *
 * @returns {Promise<number>} Number of expired sessions
 */
export async function expireBreakGlassSessions() {
  const result = await query(
    `UPDATE break_glass_requests
     SET status = 'EXPIRED'
     WHERE status = 'ACTIVE' AND expires_at <= NOW()
     RETURNING id, requester_id`
  );

  for (const row of result.rows) {
    await appendAuditLog({
      actorId: null,
      actorRole: null,
      action: 'BREAK_GLASS_AUTO_EXPIRED',
      entityType: 'break_glass',
      entityId: row.id,
      payload: { requesterId: row.requester_id },
      reason: 'Auto-expiry by scheduled job',
    });

    logger.info('Break-glass session auto-expired', {
      requestId: row.id,
      requesterId: row.requester_id,
    });
  }

  return result.rows.length;
}

/**
 * List all break-glass requests (for Security Centre).
 *
 * @param {Object} [filters]
 * @param {string} [filters.status] - Filter by status
 * @param {number} [filters.limit=20]
 * @returns {Promise<Object[]>}
 */
export async function listBreakGlassRequests({ status = null, limit = 20 } = {}) {
  let sql = `SELECT * FROM break_glass_requests`;
  const params = [];

  if (status) {
    params.push(status);
    sql += ` WHERE status = $1`;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query(sql, params);
  return result.rows;
}
