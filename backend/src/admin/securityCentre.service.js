/**
 * Vexora Esports Tournament Platform — Admin Security Centre v1 Service
 *
 * Implements Section 12 & Section 47 of Vexora Specification:
 * - Live threat feed & security overview.
 * - Failed-login tracking (timestamp, identifier, IP, user-agent, reason).
 * - Blocked IPs management with threat levels and expiration.
 * - Active admin sessions monitoring and revocation.
 * - Break-glass emergency access requests with Maker-Checker dual approval.
 * - Cryptographic audit hash chain integrity runner.
 */

import { query } from '../common/database.js';
import { appendAuditLog, verifyAuditChain, computeMerkleRoot } from '../audit/audit.service.js';
import { logger } from '../common/logger.js';

export class SecurityCentreService {
  /**
   * Retrieve live security overview statistics.
   *
   * @returns {Promise<Object>} Live security summary
   */
  static async getSecurityOverview() {
    const [failedLoginsRes, blockedIpsRes, adminSessionsRes, breakGlassRes] = await Promise.all([
      query(
        `SELECT COUNT(*)::INTEGER AS count
         FROM login_attempts
         WHERE success = false AND attempted_at >= NOW() - INTERVAL '24 hours'`
      ),
      query(
        `SELECT COUNT(*)::INTEGER AS count
         FROM blocked_ips
         WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())`
      ),
      query(
        `SELECT COUNT(*)::INTEGER AS count
         FROM user_sessions us
         JOIN users u ON us.user_id = u.id
         WHERE u.role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
           AND us.status = 'ACTIVE'
           AND us.expires_at > NOW()`
      ),
      query(
        `SELECT COUNT(*)::INTEGER AS count
         FROM break_glass_requests
         WHERE status = 'PENDING'`
      ),
    ]);

    // Quick verify of the latest 50 audit logs
    const auditChainCheck = await verifyAuditChain(null);

    return {
      failedLoginsLast24h: failedLoginsRes.rows[0]?.count || 0,
      activeBlockedIps: blockedIpsRes.rows[0]?.count || 0,
      activeAdminSessions: adminSessionsRes.rows[0]?.count || 0,
      pendingBreakGlassRequests: breakGlassRes.rows[0]?.count || 0,
      auditChainStatus: auditChainCheck.valid ? 'HEALTHY' : 'COMPROMISED',
      auditChainVerifiedCount: auditChainCheck.verifiedCount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retrieve failed login attempts with security details.
   *
   * @param {Object} [options] - { limit, offset }
   * @returns {Promise<Object>} Failed login logs
   */
  static async getFailedLogins(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 25, 1), 100);
    const offset = Math.max(Number(options.offset) || 0, 0);

    const result = await query(
      `SELECT
         id, identifier, ip_hash, ip_address, failure_reason,
         user_agent, success, attempted_at
       FROM login_attempts
       WHERE success = false
       ORDER BY attempted_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*)::INTEGER AS total FROM login_attempts WHERE success = false`
    );

    return {
      logs: result.rows,
      total: countRes.rows[0]?.total || 0,
      limit,
      offset,
    };
  }

  /**
   * Log a failed login attempt for threat monitoring.
   *
   * @param {Object} details - { identifier, ipHash, ipAddress, userAgent, reason }
   */
  static async logFailedLogin({ identifier, ipHash, ipAddress, userAgent, reason }) {
    await query(
      `INSERT INTO login_attempts (
         identifier, ip_hash, ip_address, user_agent, failure_reason, success, attempted_at
       )
       VALUES ($1, $2, $3, $4, $5, false, NOW())`,
      [identifier, ipHash, ipAddress || null, userAgent || null, reason || 'INVALID_CREDENTIALS']
    );
  }

  /**
   * Retrieve list of blocked IP addresses.
   *
   * @param {Object} [options] - { activeOnly }
   * @returns {Promise<Array>} List of blocked IPs
   */
  static async getBlockedIps(options = {}) {
    const where = options.activeOnly ? `WHERE b.is_active = true` : '';

    const result = await query(
      `SELECT
         b.id, b.ip_address, b.reason, b.threat_level, b.is_active,
         b.blocked_at, b.expires_at, b.unblocked_at, b.unblock_reason,
         u.username AS blocked_by_username
       FROM blocked_ips b
       LEFT JOIN users u ON b.blocked_by = u.id
       ${where}
       ORDER BY b.blocked_at DESC`
    );

    return result.rows;
  }

  /**
   * Block an IP address.
   *
   * @param {string} adminId - Admin ID
   * @param {Object} input - { ip_address, reason, threat_level, duration_hours }
   * @returns {Promise<Object>} Created blocked IP record
   */
  static async blockIp(adminId, input) {
    const durationHours = input.duration_hours ? Number(input.duration_hours) : null;
    const expiresAt = durationHours
      ? new Date(Date.now() + durationHours * 3600 * 1000).toISOString()
      : null;

    const result = await query(
      `INSERT INTO blocked_ips (
         ip_address, reason, threat_level, blocked_by, is_active,
         blocked_at, expires_at
       )
       VALUES ($1, $2, $3, $4, true, NOW(), $5)
       ON CONFLICT (ip_address)
       DO UPDATE SET
         reason = EXCLUDED.reason,
         threat_level = EXCLUDED.threat_level,
         blocked_by = EXCLUDED.blocked_by,
         is_active = true,
         blocked_at = NOW(),
         expires_at = EXCLUDED.expires_at,
         unblocked_at = NULL,
         unblocked_by = NULL,
         unblock_reason = NULL
       RETURNING *`,
      [
        input.ip_address,
        input.reason,
        input.threat_level || 'HIGH',
        adminId,
        expiresAt,
      ]
    );

    await appendAuditLog({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'IP_BLOCKED',
      entityType: 'BLOCKED_IP',
      entityId: result.rows[0].id,
      payload: {
        ipAddress: input.ip_address,
        threatLevel: input.threat_level || 'HIGH',
        durationHours,
      },
      reason: input.reason,
    });

    return result.rows[0];
  }

  /**
   * Unblock an IP address.
   *
   * @param {string} adminId - Admin ID
   * @param {string} ipId - Blocked IP record ID
   * @param {string} reason - Unblock reason
   * @returns {Promise<Object>} Updated record
   */
  static async unblockIp(adminId, ipId, reason) {
    const result = await query(
      `UPDATE blocked_ips
       SET is_active = false,
           unblocked_at = NOW(),
           unblocked_by = $1,
           unblock_reason = $2
       WHERE id = $3 AND is_active = true
       RETURNING *`,
      [adminId, reason, ipId]
    );

    if (result.rows.length === 0) {
      const err = new Error('Blocked IP record not found or already unblocked');
      err.code = 'BLOCKED_IP_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    await appendAuditLog({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'IP_UNBLOCKED',
      entityType: 'BLOCKED_IP',
      entityId: ipId,
      payload: { ipAddress: result.rows[0].ip_address },
      reason,
    });

    return result.rows[0];
  }

  /**
   * Retrieve active admin sessions.
   *
   * @returns {Promise<Array>} List of active admin sessions
   */
  static async getActiveAdminSessions() {
    const result = await query(
      `SELECT
         us.id, us.user_id, u.username, u.role, us.ip_hash,
         us.user_agent, us.status, us.created_at, us.expires_at,
         COALESCE(us.last_activity_at, us.created_at) AS last_active_at
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE u.role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
         AND us.status = 'ACTIVE'
         AND us.expires_at > NOW()
       ORDER BY us.created_at DESC`
    );

    return result.rows;
  }

  /**
   * Force revoke an admin session.
   *
   * @param {string} superAdminId - Super Admin ID performing revocation
   * @param {string} sessionId - Session ID to revoke
   * @param {string} reason - Revocation reason
   * @returns {Promise<Object>} Revoked session summary
   */
  static async revokeAdminSession(superAdminId, sessionId, reason) {
    const result = await query(
      `UPDATE user_sessions
       SET status = 'REVOKED'
       WHERE id = $1 AND status = 'ACTIVE'
       RETURNING id, user_id`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      const err = new Error('Active admin session not found');
      err.code = 'SESSION_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    await appendAuditLog({
      actorId: superAdminId,
      actorRole: 'SUPER_ADMIN',
      action: 'ADMIN_SESSION_FORCE_REVOKED',
      entityType: 'USER_SESSION',
      entityId: sessionId,
      payload: { targetUserId: result.rows[0].user_id },
      reason: reason || 'Security Centre administrative session revocation',
    });

    return { id: sessionId, status: 'REVOKED' };
  }

  /**
   * Retrieve all break-glass emergency access requests.
   *
   * @returns {Promise<Array>} List of break-glass requests
   */
  static async getBreakGlassRequests() {
    const result = await query(
      `SELECT
         bg.id, bg.requester_id, u_req.username AS requester_username,
         bg.requester_role, bg.reason, bg.elevated_permissions,
         bg.duration_hours, bg.expires_at, bg.status,
         bg.approved_by, u_app.username AS approved_by_username,
         bg.approved_at, bg.created_at
       FROM break_glass_requests bg
       JOIN users u_req ON bg.requester_id = u_req.id
       LEFT JOIN users u_app ON bg.approved_by = u_app.id
       ORDER BY bg.created_at DESC`
    );

    return result.rows;
  }

  /**
   * Create a break-glass emergency access request.
   *
   * @param {string} requesterId - Requester user ID
   * @param {string} requesterRole - Current role of requester
   * @param {Object} input - { reason, elevated_permissions, duration_hours }
   * @returns {Promise<Object>} Created break-glass request
   */
  static async requestBreakGlass(requesterId, requesterRole, input) {
    const durationHours = Math.min(Math.max(Number(input.duration_hours) || 1, 1), 24);
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

    const result = await query(
      `INSERT INTO break_glass_requests (
         requester_id, requester_role, reason, elevated_permissions,
         duration_hours, expires_at, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING *`,
      [
        requesterId,
        requesterRole,
        input.reason,
        JSON.stringify(input.elevated_permissions),
        durationHours,
        expiresAt,
      ]
    );

    await appendAuditLog({
      actorId: requesterId,
      actorRole: requesterRole,
      action: 'BREAK_GLASS_REQUESTED',
      entityType: 'BREAK_GLASS_REQUEST',
      entityId: result.rows[0].id,
      payload: {
        elevatedPermissions: input.elevated_permissions,
        durationHours,
      },
      reason: input.reason,
    });

    return result.rows[0];
  }

  /**
   * Adjudicate a break-glass emergency access request with Maker-Checker enforcement.
   *
   * @param {string} approverId - Approver user ID
   * @param {string} requestId - Break-glass request ID
   * @param {Object} input - { decision: 'APPROVE' | 'DENY', justification: string }
   * @returns {Promise<Object>} Adjudicated request
   */
  static async adjudicateBreakGlass(approverId, requestId, input) {
    const reqRes = await query(
      `SELECT * FROM break_glass_requests WHERE id = $1`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      const err = new Error('Break-glass request not found');
      err.code = 'REQUEST_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const bgRequest = reqRes.rows[0];

    if (bgRequest.status !== 'PENDING') {
      const err = new Error(`Request has already been decided with status ${bgRequest.status}`);
      err.code = 'ALREADY_DECIDED';
      err.status = 400;
      throw err;
    }

    // SECURITY GATE & INVARIANT: Maker-Checker constraint
    // Requester CANNOT approve their own break-glass request
    if (bgRequest.requester_id === approverId) {
      const err = new Error('Maker-Checker violation: Requester cannot decide their own break-glass request');
      err.code = 'SELF_BREAK_GLASS_APPROVAL_FORBIDDEN';
      err.status = 403;
      throw err;
    }

    const newStatus = input.decision === 'APPROVE' ? 'ACTIVE' : 'DENIED';

    const result = await query(
      `UPDATE break_glass_requests
       SET status = $1,
           approved_by = $2,
           approved_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newStatus, approverId, requestId]
    );

    await appendAuditLog({
      actorId: approverId,
      actorRole: 'SUPER_ADMIN',
      action: `BREAK_GLASS_${newStatus}`,
      entityType: 'BREAK_GLASS_REQUEST',
      entityId: requestId,
      payload: {
        decision: input.decision,
        status: newStatus,
        requesterId: bgRequest.requester_id,
      },
      reason: input.justification,
    });

    return result.rows[0];
  }

  /**
   * Run cryptographic audit hash chain integrity verification.
   *
   * @param {Array|null} [records] - Optional in-memory records
   * @returns {Promise<Object>} Cryptographic verification report
   */
  static async runAuditIntegrityCheck(records = null) {
    const result = await verifyAuditChain(records);

    let merkleRoot = '0'.repeat(64);
    if (records && records.length > 0) {
      merkleRoot = computeMerkleRoot(records.map((r) => r.curr_hash));
    }

    return {
      integrity: result.valid ? 'VALID' : 'COMPROMISED',
      verifiedCount: result.verifiedCount,
      brokenAtId: result.brokenAtId,
      sev1Alert: result.sev1Alert,
      merkleRoot,
      verifiedAt: new Date().toISOString(),
      algorithm: 'SHA-256 Hash Chain + Merkle Tree',
    };
  }
}
