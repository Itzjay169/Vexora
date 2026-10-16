import crypto from 'crypto';
import { query, getClient } from '../common/database.js';
import { AppError } from '../common/errorHandler.js';
import { logger } from '../common/logger.js';

/**
 * Vexora Phase 22 — Organiser Verification & Tiers Service
 * Specifications: Sections 10, 39 Phase 5; ADR-002, ADR-004
 *
 * Tier Capabilities:
 * - STARTER: Free tournaments only, max 32 participants, max 1 concurrent tournament
 * - VERIFIED: Passed KYC & admin review, max 256 participants, max 5 concurrent tournaments
 * - PARTNER: Platform partners, max 2048 participants, max 20 concurrent tournaments
 */

const ENCRYPTION_KEY = crypto.createHash('sha256')
  .update(process.env.JWT_ACCESS_SECRET || 'vexora_encryption_key_placeholder_secret_32')
  .digest();

function encryptField(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(String(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decryptField(ciphertext) {
  if (!ciphertext) return null;
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return ciphertext;
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    logger.warn(`Failed to decrypt field: ${err.message}`);
    return '***PROTECTED***';
  }
}

export class OrganiserVerificationService {
  /**
   * Submit an Organiser KYC Application
   */
  static async submitApplication(userId, data, ip = '127.0.0.1') {
    // 1. Verify user doesn't already have an active pending or approved application
    const existingCheck = await query(
      `SELECT id, status FROM organiser_kyc_applications 
       WHERE organiser_id = $1 AND status IN ('PENDING', 'IN_REVIEW', 'APPROVED')
       ORDER BY submitted_at DESC LIMIT 1`,
      [userId]
    );

    if (existingCheck.rows.length > 0) {
      const existing = existingCheck.rows[0];
      if (existing.status === 'APPROVED') {
        throw new AppError('Organiser is already verified and approved', 400, 'ALREADY_VERIFIED');
      }
      throw new AppError('An active verification application is already pending review', 409, 'APPLICATION_ALREADY_EXISTS');
    }

    // 2. Encrypt sensitive identity fields (Field-Level Encryption)
    const phoneEnc = encryptField(data.contact_phone);
    const idNumberEnc = encryptField(data.id_document_number);
    const taxIdEnc = data.tax_id ? encryptField(data.tax_id) : null;
    const addressEnc = data.address ? encryptField(data.address) : null;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Ensure organiser_profiles record exists
      await client.query(
        `INSERT INTO organiser_profiles (user_id, business_name, tier, kyc_status, social_links)
         VALUES ($1, $2, 'STARTER', 'PENDING', $3)
         ON CONFLICT (user_id) DO UPDATE SET
           business_name = EXCLUDED.business_name,
           kyc_status = 'PENDING',
           social_links = EXCLUDED.social_links,
           updated_at = NOW()`,
        [userId, data.business_name, JSON.stringify(data.social_links || {})]
      );

      // Insert KYC application
      const insertResult = await client.query(
        `INSERT INTO organiser_kyc_applications (
           organiser_id, business_name, contact_email, contact_phone_encrypted,
           country, id_document_type, id_document_number_encrypted,
           id_document_front_s3_key, id_document_front_hash,
           id_document_back_s3_key, id_document_back_hash,
           tax_id_encrypted, address_encrypted, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PENDING')
         RETURNING id, organiser_id, business_name, contact_email, country, id_document_type,
                   id_document_front_hash, status, submitted_at`,
        [
          userId,
          data.business_name,
          data.contact_email,
          phoneEnc,
          data.country.toUpperCase(),
          data.id_document_type,
          idNumberEnc,
          data.id_document_front_s3_key,
          data.id_document_front_hash.toLowerCase(),
          data.id_document_back_s3_key || null,
          data.id_document_back_hash ? data.id_document_back_hash.toLowerCase() : null,
          taxIdEnc,
          addressEnc,
        ]
      );

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details, ip_address)
         VALUES ($1, 'ORGANISER', 'ORGANISER_KYC_SUBMITTED', 'ORGANISER_APPLICATION', $2, $3, $4)`,
        [
          userId,
          insertResult.rows[0].id,
          JSON.stringify({ business_name: data.business_name, doc_type: data.id_document_type }),
          ip,
        ]
      );

      await client.query('COMMIT');
      return insertResult.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get Public Sanitised Organiser Trust Profile (No KYC PII)
   */
  static async getPublicProfile(organiserId) {
    const res = await query(
      `SELECT op.user_id AS organiser_id,
              op.business_name,
              op.tier,
              op.kyc_status,
              op.trust_score,
              op.total_tournaments,
              op.completed_tournaments,
              op.cancelled_tournaments,
              op.disputed_tournaments,
              COALESCE(op.dispute_rate, 0.0000) AS dispute_rate,
              op.verified_at,
              COALESCE(op.publishing_held, false) AS publishing_held,
              COALESCE(op.max_concurrent_tournaments, 1) AS max_concurrent_tournaments,
              COALESCE(op.max_participants_cap, 32) AS max_participants_cap,
              op.social_links,
              op.created_at
       FROM organiser_profiles op
       WHERE op.user_id = $1`,
      [organiserId]
    );

    if (res.rows.length === 0) {
      return this.formatPublicProfile(null, organiserId);
    }

    return this.formatPublicProfile(res.rows[0], organiserId);
  }

  /**
   * Sanitise and project public trust profile (Guarantees zero PII leakage)
   */
  static formatPublicProfile(rawRow, fallbackId = 'unknown') {
    if (!rawRow) {
      return {
        organiser_id: fallbackId,
        business_name: 'Independent Organiser',
        tier: 'STARTER',
        kyc_status: 'NOT_SUBMITTED',
        trust_score: 100.0,
        total_tournaments: 0,
        completed_tournaments: 0,
        cancelled_tournaments: 0,
        disputed_tournaments: 0,
        dispute_rate: 0.0,
        verified_at: null,
        publishing_held: false,
        max_concurrent_tournaments: 1,
        max_participants_cap: 32,
        social_links: {},
        is_verified: false,
      };
    }

    return {
      organiser_id: rawRow.organiser_id || rawRow.user_id || fallbackId,
      business_name: rawRow.business_name || 'Independent Organiser',
      tier: rawRow.tier || 'STARTER',
      kyc_status: rawRow.kyc_status || 'NOT_SUBMITTED',
      trust_score: parseFloat(rawRow.trust_score ?? 100.0),
      total_tournaments: parseInt(rawRow.total_tournaments ?? 0, 10),
      completed_tournaments: parseInt(rawRow.completed_tournaments ?? 0, 10),
      cancelled_tournaments: parseInt(rawRow.cancelled_tournaments ?? 0, 10),
      disputed_tournaments: parseInt(rawRow.disputed_tournaments ?? 0, 10),
      dispute_rate: parseFloat(rawRow.dispute_rate ?? 0.0),
      verified_at: rawRow.verified_at || null,
      publishing_held: Boolean(rawRow.publishing_held),
      publishing_hold_reason: rawRow.publishing_hold_reason || null,
      max_concurrent_tournaments: parseInt(rawRow.max_concurrent_tournaments ?? 1, 10),
      max_participants_cap: parseInt(rawRow.max_participants_cap ?? 32, 10),
      social_links: typeof rawRow.social_links === 'string' ? JSON.parse(rawRow.social_links) : (rawRow.social_links || {}),
      is_verified: rawRow.tier === 'VERIFIED' || rawRow.tier === 'PARTNER',
    };
  }

  /**
   * Get Organiser's Own Current Application
   */
  static async getOwnApplication(userId) {
    const res = await query(
      `SELECT id, organiser_id, business_name, contact_email, country,
              id_document_type, id_document_front_hash, id_document_back_hash,
              status, rejection_reason, submitted_at, reviewed_at
       FROM organiser_kyc_applications
       WHERE organiser_id = $1
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [userId]
    );

    if (res.rows.length === 0) {
      return null;
    }
    return res.rows[0];
  }

  /**
   * Security Gate: Get KYC Application Details for Review
   * Strictly verifies actor permissions and writes an immutable audit access entry.
   */
  static async getApplicationForReview(applicationId, actor, reason, ip = '127.0.0.1', userAgent = '') {
    // SECURITY GATE 1: Moderators and players CANNOT see KYC data
    if (!actor || ['MODERATOR', 'PLAYER'].includes(actor.role)) {
      throw new AppError(
        'Access denied: Moderators and unauthorized roles cannot inspect KYC documents',
        403,
        'FORBIDDEN_ROLE'
      );
    }

    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
      throw new AppError('Administrative privilege required', 403, 'FORBIDDEN_ROLE');
    }

    // SECURITY GATE 2: Access requires an explicit justification
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      throw new AppError(
        'Accessing sensitive identity documents requires an explicit business justification (min 5 characters)',
        400,
        'REASON_REQUIRED'
      );
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const appRes = await client.query(
        `SELECT * FROM organiser_kyc_applications WHERE id = $1`,
        [applicationId]
      );

      if (appRes.rows.length === 0) {
        throw new AppError('KYC Application not found', 404, 'APPLICATION_NOT_FOUND');
      }

      const app = appRes.rows[0];

      // Record immutable KYC Access Log
      await client.query(
        `INSERT INTO kyc_access_logs (
           actor_id, actor_role, target_application_id, target_organiser_id,
           access_reason, ip_address, user_agent
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          actor.id,
          actor.role,
          app.id,
          app.organiser_id,
          reason.trim(),
          ip,
          userAgent || 'Vexora-Admin/1.0',
        ]
      );

      await client.query('COMMIT');

      // Decrypt sensitive fields for the reviewer
      return {
        id: app.id,
        organiser_id: app.organiser_id,
        business_name: app.business_name,
        contact_email: app.contact_email,
        contact_phone: decryptField(app.contact_phone_encrypted),
        country: app.country,
        id_document_type: app.id_document_type,
        id_document_number: decryptField(app.id_document_number_encrypted),
        id_document_front_s3_key: app.id_document_front_s3_key,
        id_document_front_hash: app.id_document_front_hash,
        id_document_back_s3_key: app.id_document_back_s3_key,
        id_document_back_hash: app.id_document_back_hash,
        tax_id: decryptField(app.tax_id_encrypted),
        address: decryptField(app.address_encrypted),
        status: app.status,
        rejection_reason: app.rejection_reason,
        reviewer_notes: app.reviewer_notes,
        submitted_at: app.submitted_at,
        reviewed_at: app.reviewed_at,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * List Pending Applications for Admin Review Queue
   */
  static async listApplicationsQueue(filters = {}) {
    const status = filters.status || 'PENDING';
    const limit = Math.min(parseInt(filters.limit, 10) || 50, 100);
    const offset = parseInt(filters.offset, 10) || 0;

    const res = await query(
      `SELECT ka.id, ka.organiser_id, ka.business_name, ka.contact_email, ka.country,
              ka.id_document_type, ka.id_document_front_hash, ka.status,
              ka.submitted_at, ka.reviewed_at,
              op.tier AS current_tier, op.trust_score, op.total_tournaments
       FROM organiser_kyc_applications ka
       LEFT JOIN organiser_profiles op ON op.user_id = ka.organiser_id
       WHERE ($1 = 'ALL' OR ka.status = $1)
       ORDER BY ka.submitted_at ASC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    return res.rows;
  }

  /**
   * Admin Review Decision: Approve, Reject, or Request Resubmission
   */
  static async reviewApplication(applicationId, reviewer, decisionData, ip = '127.0.0.1') {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(reviewer.role)) {
      throw new AppError('Administrative privilege required to review applications', 403, 'FORBIDDEN_ROLE');
    }

    const { decision, rejection_reason, reviewer_notes, target_tier = 'VERIFIED' } = decisionData;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const appRes = await client.query(
        `SELECT * FROM organiser_kyc_applications WHERE id = $1 FOR UPDATE`,
        [applicationId]
      );

      if (appRes.rows.length === 0) {
        throw new AppError('KYC Application not found', 404, 'APPLICATION_NOT_FOUND');
      }

      const app = appRes.rows[0];
      const newStatus = decision === 'APPROVE' ? 'APPROVED' : (decision === 'REJECT' ? 'REJECTED' : 'RESUBMISSION_REQUESTED');

      // Update application
      await client.query(
        `UPDATE organiser_kyc_applications
         SET status = $1,
             reviewed_by = $2,
             reviewed_at = NOW(),
             rejection_reason = $3,
             reviewer_notes = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [newStatus, reviewer.id, rejection_reason || null, reviewer_notes || null, applicationId]
      );

      if (decision === 'APPROVE') {
        // Promote organiser tier and configure caps
        const maxConcurrent = target_tier === 'PARTNER' ? 20 : 5;
        const maxParticipants = target_tier === 'PARTNER' ? 2048 : 256;

        await client.query(
          `UPDATE organiser_profiles
           SET tier = $1,
               kyc_status = 'APPROVED',
               verified_at = NOW(),
               tier_updated_at = NOW(),
               approved_by = $2,
               approved_at = NOW(),
               publishing_held = false,
               publishing_hold_reason = null,
               max_concurrent_tournaments = $3,
               max_participants_cap = $4,
               updated_at = NOW()
           WHERE user_id = $5`,
          [target_tier, reviewer.id, maxConcurrent, maxParticipants, app.organiser_id]
        );

        // Update user role to ORGANISER if currently PLAYER
        await client.query(
          `UPDATE users SET role = 'ORGANISER' WHERE id = $1 AND role = 'PLAYER'`,
          [app.organiser_id]
        );
      } else {
        await client.query(
          `UPDATE organiser_profiles
           SET kyc_status = $1,
               updated_at = NOW()
           WHERE user_id = $2`,
          [newStatus, app.organiser_id]
        );
      }

      // Record audit log
      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details, ip_address)
         VALUES ($1, $2, 'ORGANISER_KYC_REVIEWED', 'ORGANISER_APPLICATION', $3, $4, $5)`,
        [
          reviewer.id,
          reviewer.role,
          applicationId,
          JSON.stringify({ decision, target_tier, rejection_reason }),
          ip,
        ]
      );

      await client.query('COMMIT');
      return {
        application_id: applicationId,
        status: newStatus,
        organiser_id: app.organiser_id,
        tier: decision === 'APPROVE' ? target_tier : 'STARTER',
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Validate Publishing Eligibility (Pure business logic)
   */
  static validatePublishingEligibility(profile, requestedTournament = {}, activeCount = 0) {
    if (profile.publishing_held) {
      throw new AppError(
        `Tournament publishing is currently held: ${profile.publishing_hold_reason || 'Administrative review required'}`,
        403,
        'PUBLISHING_HELD'
      );
    }

    const requestedCap = requestedTournament.max_participants || 16;
    if (requestedCap > profile.max_participants_cap) {
      throw new AppError(
        `Organiser tier '${profile.tier}' allows maximum ${profile.max_participants_cap} participants per tournament (requested: ${requestedCap}). Apply for verification to increase capacity.`,
        403,
        'TIER_CAP_EXCEEDED'
      );
    }

    if (activeCount >= profile.max_concurrent_tournaments) {
      throw new AppError(
        `Organiser tier '${profile.tier}' permits a maximum of ${profile.max_concurrent_tournaments} concurrent active tournaments (currently active: ${activeCount}).`,
        403,
        'CONCURRENT_LIMIT_EXCEEDED'
      );
    }

    return {
      eligible: true,
      tier: profile.tier,
      max_participants_cap: profile.max_participants_cap,
      max_concurrent_tournaments: profile.max_concurrent_tournaments,
      active_tournaments: activeCount,
    };
  }

  /**
   * Evaluate Dispute Rate and Trust Score Holds (Pure business logic)
   */
  static evaluateDisputeRateHold(profile) {
    const completed = profile.completed_tournaments || 0;
    const disputed = profile.disputed_tournaments || 0;
    const totalFinished = completed + disputed;

    let shouldHold = false;
    let holdReason = null;

    if (totalFinished >= 3) {
      const calculatedDisputeRate = disputed / totalFinished;
      if (calculatedDisputeRate > 0.05) {
        shouldHold = true;
        holdReason = `Automated Hold: Dispute rate (${(calculatedDisputeRate * 100).toFixed(1)}%) exceeds safety threshold (5.0%)`;
      }
    }

    if (profile.trust_score < 70.0) {
      shouldHold = true;
      holdReason = `Automated Hold: Trust score (${profile.trust_score}) fell below minimum safety threshold (70.0)`;
    }

    return { shouldHold, holdReason };
  }

  /**
   * Check Publishing Eligibility for an Organiser
   * Enforces Tier caps and publishing holds.
   */
  static async checkPublishingEligibility(organiserId, requestedTournament = {}) {
    const profile = await this.getPublicProfile(organiserId);

    const activeTournamentsRes = await query(
      `SELECT COUNT(*)::int AS active_count
       FROM tournaments
       WHERE organiser_id = $1 AND status IN ('REGISTRATION_OPEN', 'CHECK_IN', 'IN_PROGRESS', 'LIVE')`,
      [organiserId]
    );
    const activeCount = activeTournamentsRes.rows[0]?.active_count || 0;

    return this.validatePublishingEligibility(profile, requestedTournament, activeCount);
  }

  /**
   * Rule-Based Automated Holds & Demotion Evaluation
   * Triggered after tournament disputes or completions.
   */
  static async evaluateAutomatedHolds(organiserId) {
    const profile = await this.getPublicProfile(organiserId);
    const { shouldHold, holdReason } = this.evaluateDisputeRateHold(profile);

    if (shouldHold && !profile.publishing_held) {
      await query(
        `UPDATE organiser_profiles
         SET publishing_held = true,
             publishing_hold_reason = $1,
             publishing_hold_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $2`,
        [holdReason, organiserId]
      );
      logger.warn(`Organiser ${organiserId} placed on automated publishing hold: ${holdReason}`);
      return { held: true, reason: holdReason };
    }

    return { held: profile.publishing_held, reason: profile.publishing_hold_reason };
  }

  /**
   * Admin Update Tier (STARTER, VERIFIED, PARTNER)
   */
  static async updateTier(organiserId, newTier, actor, reason, ip = '127.0.0.1') {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
      throw new AppError('Administrative privilege required', 403, 'FORBIDDEN_ROLE');
    }

    const maxConcurrent = newTier === 'PARTNER' ? 20 : (newTier === 'VERIFIED' ? 5 : 1);
    const maxParticipants = newTier === 'PARTNER' ? 2048 : (newTier === 'VERIFIED' ? 256 : 32);

    await query(
      `UPDATE organiser_profiles
       SET tier = $1,
           max_concurrent_tournaments = $2,
           max_participants_cap = $3,
           tier_updated_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $4`,
      [newTier, maxConcurrent, maxParticipants, organiserId]
    );

    await query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, 'ORGANISER_TIER_UPDATED', 'ORGANISER', $3, $4, $5)`,
      [
        actor.id,
        actor.role,
        organiserId,
        JSON.stringify({ new_tier: newTier, reason, max_concurrent: maxConcurrent }),
        ip,
      ]
    );

    return { organiser_id: organiserId, tier: newTier, max_concurrent: maxConcurrent, max_participants: maxParticipants };
  }

  /**
   * Admin Place or Release Publishing Hold
   */
  static async setPublishingHold(organiserId, action, reason, actor, ip = '127.0.0.1') {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
      throw new AppError('Administrative privilege required', 403, 'FORBIDDEN_ROLE');
    }

    const isHold = action === 'HOLD';

    await query(
      `UPDATE organiser_profiles
       SET publishing_held = $1,
           publishing_hold_reason = $2,
           publishing_hold_at = $3,
           updated_at = NOW()
       WHERE user_id = $4`,
      [isHold, isHold ? reason : null, isHold ? new Date() : null, organiserId]
    );

    await query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, 'ORGANISER_PUBLISHING_HOLD', 'ORGANISER', $3, $4, $5)`,
      [actor.id, actor.role, organiserId, JSON.stringify({ action, reason }), ip]
    );

    return { organiser_id: organiserId, publishing_held: isHold, reason: isHold ? reason : null };
  }
}
