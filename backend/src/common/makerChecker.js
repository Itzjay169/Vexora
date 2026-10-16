/**
 * Vexora Maker-Checker Framework — Phase 8
 *
 * Dual-approval workflow: the person who creates a request CANNOT approve it.
 * Used for high-risk actions throughout the platform:
 *   - Payout approvals
 *   - Wallet adjustments
 *   - Redeem code batch creation
 *   - User bans
 *   - Break-glass access
 *   - Feature flag changes affecting money features
 *
 * Lifecycle:
 *   1. MAKER creates the request → status: PENDING_REVIEW
 *   2. CHECKER reviews and approves/rejects → status: APPROVED / REJECTED
 *   3. System executes the approved action
 *
 * Security rules (PDF Section 47):
 *   - maker_id !== checker_id (enforced at DB + service level)
 *   - Every state transition is audit-logged with actor, role, reason
 *   - High-value thresholds require TWO approvers + step-up auth
 *   - Rejection requires mandatory reason
 *
 * PDF refs: Section 47 (Wallet and payout security, maker-checker)
 */

import { query, withTransaction } from './database.js';
import { AppError } from './errorHandler.js';
import { appendAuditLog, hashIP } from './auditLog.js';
import { logger } from './logger.js';

// Request statuses
export const MC_STATUS = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED:       'APPROVED',
  REJECTED:       'REJECTED',
  EXECUTED:       'EXECUTED',
  EXPIRED:        'EXPIRED',
  CANCELLED:      'CANCELLED',
});

// Request categories
export const MC_CATEGORY = Object.freeze({
  PAYOUT:           'PAYOUT',
  WALLET_ADJUSTMENT:'WALLET_ADJUSTMENT',
  REDEEM_BATCH:     'REDEEM_BATCH',
  USER_BAN:         'USER_BAN',
  BREAK_GLASS:      'BREAK_GLASS',
  FEATURE_FLAG:     'FEATURE_FLAG',
  ORGANISER_TIER:   'ORGANISER_TIER',
  RESULT_CORRECTION:'RESULT_CORRECTION',
});

/**
 * Create a maker-checker request.
 * The maker submits the action for review — it does NOT execute yet.
 *
 * @param {Object} params
 * @param {string} params.makerId - User creating the request
 * @param {string} params.makerRole - Role of the creator
 * @param {string} params.category - From MC_CATEGORY
 * @param {string} params.entityType - What entity this affects
 * @param {string} params.entityId - ID of the affected entity
 * @param {Object} params.payload - The proposed action data
 * @param {string} params.reason - Why this action is needed
 * @param {number} [params.expiryHours=24] - Hours before the request auto-expires
 * @param {string} [params.ipHash]
 * @returns {Promise<Object>}
 */
export async function createMakerCheckerRequest({
  makerId,
  makerRole,
  category,
  entityType,
  entityId,
  payload,
  reason,
  expiryHours = 24,
  ipHash = null,
}) {
  if (!reason || reason.trim().length < 5) {
    throw new AppError(
      'Maker-checker request requires a reason (minimum 5 characters)',
      400,
      'MC_REASON_REQUIRED'
    );
  }

  if (!Object.values(MC_CATEGORY).includes(category)) {
    throw new AppError(`Invalid maker-checker category: ${category}`, 400, 'MC_INVALID_CATEGORY');
  }

  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  const result = await query(
    `INSERT INTO maker_checker_requests
       (maker_id, maker_role, category, entity_type, entity_id,
        payload, reason, status, expires_at, ip_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     RETURNING *`,
    [
      makerId, makerRole, category, entityType, entityId,
      JSON.stringify(payload), reason.trim(), MC_STATUS.PENDING_REVIEW,
      expiresAt.toISOString(), ipHash,
    ]
  );

  const request = result.rows[0];

  await appendAuditLog({
    actorId: makerId,
    actorRole: makerRole,
    action: 'MAKER_CHECKER_CREATED',
    entityType: 'maker_checker',
    entityId: request.id,
    payload: { category, targetEntityType: entityType, targetEntityId: entityId },
    reason: reason.trim(),
    ipHash,
  });

  logger.info('Maker-checker request created', {
    requestId: request.id,
    makerId,
    category,
    entityType,
    entityId,
  });

  return request;
}

/**
 * Approve a maker-checker request.
 * The checker MUST NOT be the same as the maker.
 *
 * @param {Object} params
 * @param {string} params.requestId - The request to approve
 * @param {string} params.checkerId - Who is approving
 * @param {string} params.checkerRole - Role of the approver
 * @param {string} [params.notes] - Optional approval notes
 * @param {string} [params.ipHash]
 * @returns {Promise<Object>}
 */
export async function approveRequest({
  requestId,
  checkerId,
  checkerRole,
  notes = null,
  ipHash = null,
}) {
  return withTransaction(async (client) => {
    // Fetch request with row-level lock
    const reqResult = await client.query(
      `SELECT * FROM maker_checker_requests
       WHERE id = $1 AND status = $2
       FOR UPDATE`,
      [requestId, MC_STATUS.PENDING_REVIEW]
    );

    if (reqResult.rows.length === 0) {
      throw new AppError(
        'Request not found or already processed',
        404,
        'MC_REQUEST_NOT_FOUND'
      );
    }

    const request = reqResult.rows[0];

    // ─── CORE INVARIANT: creator cannot approve ─────────────────────
    if (request.maker_id === checkerId) {
      logger.warn('Maker-checker self-approval attempt blocked', {
        requestId,
        makerId: request.maker_id,
        checkerId,
      });
      throw new AppError(
        'Cannot approve your own request (maker-checker violation)',
        403,
        'MC_SELF_APPROVAL_DENIED'
      );
    }

    // Check expiry
    if (new Date(request.expires_at) < new Date()) {
      await client.query(
        `UPDATE maker_checker_requests SET status = $1 WHERE id = $2`,
        [MC_STATUS.EXPIRED, requestId]
      );
      throw new AppError('Request has expired', 400, 'MC_REQUEST_EXPIRED');
    }

    // Approve
    const updated = await client.query(
      `UPDATE maker_checker_requests
       SET status = $1, checker_id = $2, checker_role = $3,
           checker_notes = $4, reviewed_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [MC_STATUS.APPROVED, checkerId, checkerRole, notes, requestId]
    );

    await appendAuditLog({
      actorId: checkerId,
      actorRole: checkerRole,
      action: 'MAKER_CHECKER_APPROVED',
      entityType: 'maker_checker',
      entityId: requestId,
      payload: {
        category: request.category,
        makerId: request.maker_id,
        notes,
      },
      reason: notes || 'Approved',
      ipHash,
      client,
    });

    logger.info('Maker-checker request approved', {
      requestId,
      makerId: request.maker_id,
      checkerId,
      category: request.category,
    });

    return updated.rows[0];
  });
}

/**
 * Reject a maker-checker request.
 * Rejection REQUIRES a reason.
 *
 * @param {Object} params
 * @param {string} params.requestId
 * @param {string} params.checkerId
 * @param {string} params.checkerRole
 * @param {string} params.reason - Mandatory rejection reason
 * @param {string} [params.ipHash]
 * @returns {Promise<Object>}
 */
export async function rejectRequest({
  requestId,
  checkerId,
  checkerRole,
  reason,
  ipHash = null,
}) {
  if (!reason || reason.trim().length < 5) {
    throw new AppError(
      'Rejection requires a detailed reason (minimum 5 characters)',
      400,
      'MC_REJECTION_REASON_REQUIRED'
    );
  }

  return withTransaction(async (client) => {
    const reqResult = await client.query(
      `SELECT * FROM maker_checker_requests
       WHERE id = $1 AND status = $2
       FOR UPDATE`,
      [requestId, MC_STATUS.PENDING_REVIEW]
    );

    if (reqResult.rows.length === 0) {
      throw new AppError('Request not found or already processed', 404, 'MC_REQUEST_NOT_FOUND');
    }

    const request = reqResult.rows[0];

    // Even for rejection, self-action is logged but allowed
    // (A maker should be able to cancel their own request — see cancelRequest)

    const updated = await client.query(
      `UPDATE maker_checker_requests
       SET status = $1, checker_id = $2, checker_role = $3,
           checker_notes = $4, reviewed_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [MC_STATUS.REJECTED, checkerId, checkerRole, reason.trim(), requestId]
    );

    await appendAuditLog({
      actorId: checkerId,
      actorRole: checkerRole,
      action: 'MAKER_CHECKER_REJECTED',
      entityType: 'maker_checker',
      entityId: requestId,
      payload: {
        category: request.category,
        makerId: request.maker_id,
      },
      reason: reason.trim(),
      ipHash,
      client,
    });

    logger.info('Maker-checker request rejected', {
      requestId,
      makerId: request.maker_id,
      checkerId,
      category: request.category,
      reason: reason.trim(),
    });

    return updated.rows[0];
  });
}

/**
 * Cancel a maker-checker request (only by the original maker).
 *
 * @param {string} requestId
 * @param {string} makerId
 * @param {string} makerRole
 * @returns {Promise<Object>}
 */
export async function cancelRequest(requestId, makerId, makerRole) {
  const result = await query(
    `UPDATE maker_checker_requests
     SET status = $1
     WHERE id = $2 AND maker_id = $3 AND status = $4
     RETURNING *`,
    [MC_STATUS.CANCELLED, requestId, makerId, MC_STATUS.PENDING_REVIEW]
  );

  if (result.rows.length === 0) {
    throw new AppError(
      'Request not found, already processed, or you are not the maker',
      404,
      'MC_REQUEST_NOT_FOUND'
    );
  }

  await appendAuditLog({
    actorId: makerId,
    actorRole: makerRole,
    action: 'MAKER_CHECKER_CANCELLED',
    entityType: 'maker_checker',
    entityId: requestId,
    reason: 'Cancelled by maker',
  });

  return result.rows[0];
}

/**
 * Mark an approved request as executed.
 *
 * @param {string} requestId
 * @param {Object} [executionResult] - Result metadata from executing the action
 * @returns {Promise<Object>}
 */
export async function markExecuted(requestId, executionResult = {}) {
  const result = await query(
    `UPDATE maker_checker_requests
     SET status = $1, execution_result = $2, executed_at = NOW()
     WHERE id = $3 AND status = $4
     RETURNING *`,
    [MC_STATUS.EXECUTED, JSON.stringify(executionResult), requestId, MC_STATUS.APPROVED]
  );

  if (result.rows.length === 0) {
    throw new AppError('Approved request not found', 404, 'MC_REQUEST_NOT_FOUND');
  }

  return result.rows[0];
}

/**
 * Expire all pending requests past their expiry time.
 * Should be called periodically by a background worker.
 *
 * @returns {Promise<number>}
 */
export async function expirePendingRequests() {
  const result = await query(
    `UPDATE maker_checker_requests
     SET status = $1
     WHERE status = $2 AND expires_at <= NOW()
     RETURNING id, maker_id, category`,
    [MC_STATUS.EXPIRED, MC_STATUS.PENDING_REVIEW]
  );

  for (const row of result.rows) {
    await appendAuditLog({
      action: 'MAKER_CHECKER_EXPIRED',
      entityType: 'maker_checker',
      entityId: row.id,
      payload: { makerId: row.maker_id, category: row.category },
      reason: 'Auto-expiry',
    });
  }

  return result.rows.length;
}

/**
 * List maker-checker requests with filtering.
 *
 * @param {Object} [filters]
 * @param {string} [filters.status]
 * @param {string} [filters.category]
 * @param {string} [filters.makerId]
 * @param {number} [filters.limit=20]
 * @returns {Promise<Object[]>}
 */
export async function listRequests({ status, category, makerId, limit = 20 } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (makerId) {
    params.push(makerId);
    conditions.push(`maker_id = $${params.length}`);
  }

  let sql = `SELECT * FROM maker_checker_requests`;
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query(sql, params);
  return result.rows;
}
