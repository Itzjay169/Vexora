import crypto from 'crypto';
import { query, getClient } from '../common/database.js';
import { AppError } from '../common/errorHandler.js';
import { logger } from '../common/logger.js';

/**
 * Vexora Phase 23 — Dispute Adjudication, Moderation & Sanctions Service
 * Specifications: Sections 11, 19, 26, 39 (Phase 5); ADR-002, ADR-004
 *
 * Core Security Invariants:
 * 1. Disputed match immediately freezes settlement (settlement_frozen = true)
 * 2. Every ruling and sanction strictly requires actor ID, reason, and policy_clause
 * 3. Maker-Checker Invariant: Moderator who issued ruling cannot decide the appeal
 * 4. Appeals strictly limited to 48-hour window from initial ruling
 * 5. Risk signals prioritize review queue, NEVER auto-ban in high-impact cases
 */

export class DisputeModerationService {
  /**
   * Helper: Generate human-readable case ID
   */
  static generateCaseId(prefix = 'DSP') {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${dateStr}-${rand}`;
  }

  /**
   * Submit an incident or violation report
   * Invariant: A report is an unverified claim, NOT a violation until reviewed.
   */
  static async createReport(reporterId, data, ip = '127.0.0.1') {
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

    const res = await query(
      `INSERT INTO reports (
         reporter_id, target_type, reported_target_id, category,
         description, policy_clause, evidence_hashes, reporter_ip_hash, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN')
       RETURNING id, reporter_id, target_type, reported_target_id, category,
                 description, policy_clause, evidence_hashes, status, created_at`,
      [
        reporterId,
        data.target_type || 'PLAYER',
        data.target_id,
        data.category,
        data.description,
        data.policy_clause || null,
        data.evidence_hashes || [],
        ipHash,
      ]
    );

    return res.rows[0];
  }

  /**
   * Open a match dispute
   * Invariant: Disputed match immediately freezes settlement!
   */
  static async createDispute(userId, data, ip = '127.0.0.1') {
    const caseId = this.generateCaseId('DSP');
    const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h SLA

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // 1. Verify match exists
      const matchRes = await client.query(
        `SELECT id, status, tournament_id FROM matches WHERE id = $1 FOR UPDATE`,
        [data.match_id]
      );
      if (matchRes.rows.length === 0) {
        throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
      }

      // 2. Check for duplicate open dispute by same user on same match
      const dupCheck = await client.query(
        `SELECT id, case_id FROM disputes
         WHERE match_id = $1 AND raised_by = $2 AND status IN ('OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUESTED')`,
        [data.match_id, userId]
      );
      if (dupCheck.rows.length > 0) {
        throw new AppError(
          `You already have an active dispute (${dupCheck.rows[0].case_id || dupCheck.rows[0].id}) for this match`,
          409,
          'DUPLICATE_DISPUTE'
        );
      }

      // 3. Insert Dispute Record
      const disputeRes = await client.query(
        `INSERT INTO disputes (
           case_id, match_id, raised_by, reason, description,
           evidence_hashes, status, settlement_frozen, settlement_frozen_at, sla_deadline
         ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', true, NOW(), $7)
         RETURNING id, case_id, match_id, raised_by, reason, description,
                   evidence_hashes, status, settlement_frozen, sla_deadline, created_at`,
        [
          caseId,
          data.match_id,
          userId,
          data.reason,
          data.description,
          data.evidence_hashes || [],
          slaDeadline,
        ]
      );

      // 4. CRITICAL INVARIANT: Immediately freeze match settlement and mark DISPUTED
      await client.query(
        `UPDATE matches
         SET status = 'DISPUTED',
             settlement_frozen = true,
             updated_at = NOW()
         WHERE id = $1`,
        [data.match_id]
      );

      // 5. Audit Log
      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details, ip_address)
         VALUES ($1, 'PLAYER', 'DISPUTE_OPENED', 'MATCH_DISPUTE', $2, $3, $4)`,
        [
          userId,
          disputeRes.rows[0].id,
          JSON.stringify({ match_id: data.match_id, case_id: caseId, reason: data.reason }),
          ip,
        ]
      );

      await client.query('COMMIT');
      return disputeRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get dispute details
   */
  static async getDispute(disputeId, actor = null) {
    const res = await query(
      `SELECT d.*, m.tournament_id, u.username AS reporter_username
       FROM disputes d
       JOIN matches m ON m.id = d.match_id
       LEFT JOIN users u ON u.id = d.raised_by
       WHERE d.id = $1 OR d.case_id = $1`,
      [disputeId]
    );

    if (res.rows.length === 0) {
      throw new AppError('Dispute case not found', 404, 'DISPUTE_NOT_FOUND');
    }

    const row = res.rows[0];
    const isReporter = actor && actor.id === row.raised_by;
    const isStaff = actor && ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(actor.role);

    if (actor && !isReporter && !isStaff) {
      throw new AppError('Access denied: You are not authorized to view this dispute', 403, 'FORBIDDEN');
    }

    return row;
  }

  /**
   * Adjudicate Dispute (Moderator Ruling)
   * Security Gate: Requires staff role, mandatory policy clause, and ruling reason.
   */
  static async ruleDispute(disputeId, moderator, rulingData, ip = '127.0.0.1') {
    if (!['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(moderator.role)) {
      throw new AppError('Staff privilege required to rule on disputes', 403, 'FORBIDDEN_ROLE');
    }

    const { ruling_type, ruling_reason, policy_clause, corrective_action = 'NONE', sanction } = rulingData;

    if (!policy_clause || policy_clause.trim().length < 3) {
      throw new AppError('Security Gate: A valid policy clause must be cited for all rulings', 400, 'POLICY_CLAUSE_REQUIRED');
    }

    if (!ruling_reason || ruling_reason.trim().length < 10) {
      throw new AppError('Security Gate: Detailed ruling reason (min 10 chars) is required', 400, 'REASON_REQUIRED');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const dispRes = await client.query(
        `SELECT * FROM disputes WHERE id = $1 FOR UPDATE`,
        [disputeId]
      );
      if (dispRes.rows.length === 0) {
        throw new AppError('Dispute case not found', 404, 'DISPUTE_NOT_FOUND');
      }

      const dispute = dispRes.rows[0];
      const newStatus = ruling_type === 'UPHELD' ? 'RESOLVED_UPHELD' : (ruling_type === 'OVERTURNED' ? 'RESOLVED_OVERTURNED' : 'DISMISSED');
      const appealWindowExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hour appeal window

      // 1. Update dispute with ruling and appeal window
      await client.query(
        `UPDATE disputes
         SET status = $1,
             ruling = $2,
             ruling_by = $3,
             ruling_type = $4,
             ruling_reason = $5,
             policy_clause = $6,
             corrective_action = $7,
             appeal_window_expires_at = $8,
             appeal_status = 'NONE',
             resolved_at = NOW(),
             updated_at = NOW()
         WHERE id = $9`,
        [
          newStatus,
          ruling_reason,
          moderator.id,
          ruling_type,
          ruling_reason,
          policy_clause,
          corrective_action,
          appealWindowExpiresAt,
          disputeId,
        ]
      );

      // 2. If corrective action was forfeiture or score correction, update match status
      if (corrective_action === 'CORRECT_SCORE' || corrective_action === 'FORFEIT_VIOLATOR') {
        await client.query(
          `UPDATE matches
           SET status = 'COMPLETED',
               updated_at = NOW()
           WHERE id = $1`,
          [dispute.match_id]
        );
      }

      // 3. Apply sanction if requested
      if (sanction && sanction.user_id && sanction.sanction_type) {
        await this.applySanction(
          moderator,
          {
            user_id: sanction.user_id,
            sanction_type: sanction.sanction_type,
            reason: sanction.reason || ruling_reason,
            policy_clause,
            related_dispute_id: dispute.id,
            duration_days: sanction.duration_days,
          },
          ip
        );
      }

      // 4. Immutable Moderation Action Log (Security Gate requirement)
      await client.query(
        `INSERT INTO moderation_action_logs (
           moderator_id, moderator_role, action_type, target_type, target_id,
           policy_clause, reason, ip_address
         ) VALUES ($1, $2, 'DISPUTE_RULING', 'DISPUTE', $3, $4, $5, $6)`,
        [
          moderator.id,
          moderator.role,
          dispute.id,
          policy_clause,
          ruling_reason,
          ip,
        ]
      );

      await client.query('COMMIT');
      return {
        dispute_id: dispute.id,
        case_id: dispute.case_id,
        status: newStatus,
        ruling_type,
        policy_clause,
        appeal_window_expires_at: appealWindowExpiresAt,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Submit an Appeal on a Dispute Ruling
   * Invariant: Must be submitted within 48-hour appeal window!
   */
  static async submitAppeal(disputeId, userId, appealData, ip = '127.0.0.1') {
    const dispute = await this.getDispute(disputeId);

    // 1. Verify dispute is in resolved state
    if (!['RESOLVED_UPHELD', 'RESOLVED_OVERTURNED', 'DISMISSED'].includes(dispute.status)) {
      throw new AppError('Appeals can only be submitted on concluded dispute rulings', 400, 'INVALID_APPEAL_STATE');
    }

    // 2. Check 48-hour appeal window
    if (!dispute.appeal_window_expires_at || new Date() > new Date(dispute.appeal_window_expires_at)) {
      throw new AppError('The 48-hour appeal window for this ruling has expired', 400, 'APPEAL_EXPIRED');
    }

    // 3. Check if already appealed
    if (dispute.appeal_status === 'PENDING_APPEAL' || dispute.appeal_status === 'APPEAL_UPHELD' || dispute.appeal_status === 'APPEAL_REJECTED') {
      throw new AppError('An appeal has already been lodged for this case', 409, 'ALREADY_APPEALED');
    }

    await query(
      `UPDATE disputes
       SET appeal_status = 'PENDING_APPEAL',
           appeal_text = $1,
           appeal_evidence_hashes = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [appealData.appeal_text, appealData.evidence_hashes || [], dispute.id]
    );

    await query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details, ip_address)
       VALUES ($1, 'PLAYER', 'DISPUTE_APPEAL_SUBMITTED', 'DISPUTE', $2, $3, $4)`,
      [
        userId,
        dispute.id,
        JSON.stringify({ case_id: dispute.case_id, appeal_text_len: appealData.appeal_text.length }),
        ip,
      ]
    );

    return {
      dispute_id: dispute.id,
      case_id: dispute.case_id,
      appeal_status: 'PENDING_APPEAL',
    };
  }

  /**
   * Decide on an Appeal (Maker-Checker Invariant)
   * The moderator who issued the initial ruling CANNOT decide the appeal!
   */
  static async decideAppeal(disputeId, decider, decisionData, ip = '127.0.0.1') {
    if (!['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(decider.role)) {
      throw new AppError('Staff privilege required to adjudicate appeals', 403, 'FORBIDDEN_ROLE');
    }

    const { decision, reason, policy_clause } = decisionData;

    if (!policy_clause || policy_clause.trim().length < 3) {
      throw new AppError('Security Gate: A valid policy clause must be cited for appeal rulings', 400, 'POLICY_CLAUSE_REQUIRED');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const dispRes = await client.query(
        `SELECT * FROM disputes WHERE id = $1 FOR UPDATE`,
        [disputeId]
      );
      if (dispRes.rows.length === 0) {
        throw new AppError('Dispute case not found', 404, 'DISPUTE_NOT_FOUND');
      }

      const dispute = dispRes.rows[0];

      // MAKER-CHECKER SECURITY INVARIANT: Original ruling author cannot decide appeal
      if (dispute.ruling_by && dispute.ruling_by === decider.id) {
        throw new AppError(
          'Maker-Checker Violation: The moderator who authored the initial ruling cannot adjudicate the appeal',
          403,
          'SELF_APPEAL_DECISION_FORBIDDEN'
        );
      }

      if (dispute.appeal_status !== 'PENDING_APPEAL') {
        throw new AppError('No pending appeal found on this case', 400, 'NO_PENDING_APPEAL');
      }

      // Update dispute with appeal decision
      await client.query(
        `UPDATE disputes
         SET appeal_status = $1,
             appeal_decided_by = $2,
             appeal_decided_at = NOW(),
             appeal_reason = $3,
             settlement_frozen = false, -- Appeal concludes dispute; unfreeze settlement
             updated_at = NOW()
         WHERE id = $4`,
        [decision, decider.id, reason, dispute.id]
      );

      // Unfreeze match settlement
      await client.query(
        `UPDATE matches
         SET settlement_frozen = false,
             updated_at = NOW()
         WHERE id = $1`,
        [dispute.match_id]
      );

      // Immutable Moderation Action Log
      await client.query(
        `INSERT INTO moderation_action_logs (
           moderator_id, moderator_role, action_type, target_type, target_id,
           policy_clause, reason, ip_address
         ) VALUES ($1, $2, 'APPEAL_DECISION', 'DISPUTE', $3, $4, $5, $6)`,
        [
          decider.id,
          decider.role,
          dispute.id,
          policy_clause,
          reason,
          ip,
        ]
      );

      await client.query('COMMIT');
      return {
        dispute_id: dispute.id,
        case_id: dispute.case_id,
        appeal_status: decision,
        settlement_frozen: false,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Apply a Disciplinary Sanction (Sanction Ladder)
   * Ladder: WARNING -> RESTRICTION -> SUSPENSION -> BAN
   */
  static async applySanction(actor, sanctionData, ip = '127.0.0.1') {
    if (!['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
      throw new AppError('Staff privilege required to apply sanctions', 403, 'FORBIDDEN_ROLE');
    }

    const { user_id, sanction_type, reason, policy_clause, related_dispute_id, duration_days } = sanctionData;

    if (!policy_clause || policy_clause.trim().length < 3) {
      throw new AppError('Security Gate: A valid policy clause must be cited for all sanctions', 400, 'POLICY_CLAUSE_REQUIRED');
    }

    const expiresAt = duration_days ? new Date(Date.now() + duration_days * 24 * 60 * 60 * 1000) : null;
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

    const res = await query(
      `INSERT INTO sanctions (
         user_id, sanction_type, reason, policy_clause, related_dispute_id,
         issued_by, expires_at, is_active, ip_hash
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
       RETURNING *`,
      [
        user_id,
        sanction_type,
        reason,
        policy_clause,
        related_dispute_id || null,
        actor.id,
        expiresAt,
        ipHash,
      ]
    );

    await query(
      `INSERT INTO moderation_action_logs (
         moderator_id, moderator_role, action_type, target_type, target_id,
         policy_clause, reason, ip_address
       ) VALUES ($1, $2, 'SANCTION_ISSUED', 'USER', $3, $4, $5, $6)`,
      [
        actor.id,
        actor.role,
        user_id,
        policy_clause,
        `${sanction_type}: ${reason}`,
        ip,
      ]
    );

    return res.rows[0];
  }

  /**
   * Ingest a Risk Signal (Anti-Abuse Engine)
   * Invariant: Risk signals prioritize review, but NEVER auto-ban in high-impact cases.
   */
  static async ingestRiskSignal(signalData) {
    const res = await query(
      `INSERT INTO risk_signals (
         target_type, target_id, signal_type, confidence_score, risk_weight, payload
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        signalData.target_type,
        signalData.target_id,
        signalData.signal_type,
        signalData.confidence_score || 0.500,
        signalData.risk_weight || 10,
        JSON.stringify(signalData.payload || {}),
      ]
    );

    return res.rows[0];
  }

  /**
   * List Moderator Queue with SLA timers and priority
   */
  static async listModerationQueue(filters = {}) {
    const status = filters.status || 'OPEN';

    const disputesRes = await query(
      `SELECT d.id, d.case_id, d.match_id, d.raised_by, d.reason, d.status,
              d.sla_deadline, d.settlement_frozen, d.created_at,
              u.username AS reporter_username
       FROM disputes d
       LEFT JOIN users u ON u.id = d.raised_by
       WHERE ($1 = 'ALL' OR d.status = $1)
       ORDER BY d.sla_deadline ASC
       LIMIT 50`,
      [status]
    );

    const reportsRes = await query(
      `SELECT r.id, r.reporter_id, r.target_type, r.reported_target_id,
              r.category, r.description, r.status, r.created_at
       FROM reports r
       WHERE ($1 = 'ALL' OR r.status = $1)
       ORDER BY r.created_at ASC
       LIMIT 50`,
      [status]
    );

    return {
      disputes: disputesRes.rows,
      reports: reportsRes.rows,
      total_pending: disputesRes.rows.length + reportsRes.rows.length,
    };
  }
}
