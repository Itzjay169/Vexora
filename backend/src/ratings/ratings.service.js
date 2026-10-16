/**
 * Vexora Esports Tournament Platform — Organiser Ratings & Participant Reports Service
 *
 * Implements Section 21 of Vexora Specification:
 * - Post-tournament organiser ratings across 3 operational dimensions:
 *   Communication (1-5), Schedule Adherence (1-5), Result Handling (1-5).
 * - Overall score calculation: deterministic average (1.00 to 5.00).
 * - Sample size tracking and breakdown statistics.
 * - Verified participant enforcement (only registered players of completed tournaments).
 * - Review dispute appeals (organisers cannot delete reviews themselves).
 * - Moderator review of flagged reviews (UPHELD -> REMOVED, REJECTED -> VISIBLE).
 * - Organiser reports on participants for conduct violations.
 * - SECURITY GATE: "Ratings alone never trigger automatic punishment" (anti-punishment invariant).
 */

import { query } from '../common/database.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { logger } from '../common/logger.js';

export class RatingsService {
  /**
   * Submit an organiser rating after tournament completion.
   *
   * @param {string} participantId - User ID of the participant
   * @param {string} tournamentId - Tournament ID
   * @param {Object} input - { communication_score, schedule_score, result_score, review_text }
   * @returns {Promise<Object>} Created rating record
   */
  static async submitOrganiserRating(participantId, tournamentId, input) {
    // 1. Verify tournament exists and is in COMPLETED or SETTLED state
    const tourneyRes = await query(
      `SELECT id, organiser_id, status FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tourneyRes.rows.length === 0) {
      const err = new Error('Tournament not found');
      err.code = 'TOURNAMENT_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const tournament = tourneyRes.rows[0];
    const allowedStatuses = ['COMPLETED', 'SETTLED'];
    if (!allowedStatuses.includes(tournament.status)) {
      const err = new Error('Only completed or settled tournaments can be rated');
      err.code = 'TOURNAMENT_NOT_COMPLETED';
      err.status = 400;
      throw err;
    }

    // 2. Prevent organiser from rating their own tournament
    if (tournament.organiser_id === participantId) {
      const err = new Error('Organisers cannot rate their own tournaments');
      err.code = 'SELF_RATING_FORBIDDEN';
      err.status = 400;
      throw err;
    }

    // 3. Verify participant eligibility: must have an approved registration
    const regRes = await query(
      `SELECT id, status FROM registrations
       WHERE tournament_id = $1 AND (user_id = $2 OR team_id IN (
         SELECT team_id FROM team_members WHERE user_id = $2
       ))
       AND status IN ('CONFIRMED', 'CHECKED_IN', 'PLAYED', 'COMPLETED')`,
      [tournamentId, participantId]
    );

    if (regRes.rows.length === 0) {
      const err = new Error('Only verified tournament participants are eligible to submit a rating');
      err.code = 'NOT_A_PARTICIPANT';
      err.status = 403;
      throw err;
    }

    // 4. Verify no duplicate rating exists for this tournament/participant
    const existingRes = await query(
      `SELECT id FROM organiser_ratings WHERE tournament_id = $1 AND participant_id = $2`,
      [tournamentId, participantId]
    );

    if (existingRes.rows.length > 0) {
      const err = new Error('You have already submitted a rating for this tournament');
      err.code = 'RATING_ALREADY_EXISTS';
      err.status = 409;
      throw err;
    }

    // 5. Calculate overall score deterministically: (comm + sched + result) / 3.0
    const comm = Number(input.communication_score);
    const sched = Number(input.schedule_score);
    const result = Number(input.result_score);

    if ([comm, sched, result].some(s => !Number.isInteger(s) || s < 1 || s > 5)) {
      const err = new Error('Rating sub-scores must be integers between 1 and 5');
      err.code = 'INVALID_SUB_SCORES';
      err.status = 400;
      throw err;
    }

    const overallScore = Math.round(((comm + sched + result) / 3.0) * 100) / 100;

    // 6. Insert rating record
    const insertRes = await query(
      `INSERT INTO organiser_ratings (
         tournament_id, organiser_id, participant_id,
         communication_score, schedule_score, result_score, overall_score,
         review_text, is_verified_participant, moderation_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 'VISIBLE')
       RETURNING *`,
      [
        tournamentId,
        tournament.organiser_id,
        participantId,
        comm,
        sched,
        result,
        overallScore,
        input.review_text || null,
      ]
    );

    const rating = insertRes.rows[0];

    // 7. Security Gate: Ratings alone never trigger automatic punishment
    // We log the rating creation but NEVER auto-ban or auto-demote the organiser
    await appendAuditLog({
      actorId: participantId,
      actorRole: 'PLAYER',
      action: 'ORGANISER_RATING_SUBMITTED',
      entityType: 'ORGANISER_RATING',
      entityId: rating.id,
      payload: {
        tournamentId,
        organiserId: tournament.organiser_id,
        overallScore,
        subScores: { comm, sched, result },
        antiPunishmentEnforced: true,
      },
      reason: 'Participant submitted tournament post-event rating',
    });

    return rating;
  }

  /**
   * Retrieve an organiser's ratings with aggregate sample size and breakdown averages.
   *
   * @param {string} organiserId - Organiser user ID
   * @param {Object} [options] - { limit, offset, includeFlagged }
   * @returns {Promise<Object>} { summary, ratings }
   */
  static async getOrganiserRatings(organiserId, options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const offset = Math.max(Number(options.offset) || 0, 0);
    const includeFlagged = Boolean(options.includeFlagged);

    // 1. Fetch ratings summary
    const summaryRes = await query(
      `SELECT
         COUNT(*)::INTEGER AS sample_size,
         COUNT(*) FILTER (WHERE is_verified_participant = true)::INTEGER AS verified_reviews_count,
         COALESCE(ROUND(AVG(communication_score)::NUMERIC, 2), 0.0) AS avg_communication,
         COALESCE(ROUND(AVG(schedule_score)::NUMERIC, 2), 0.0) AS avg_schedule,
         COALESCE(ROUND(AVG(result_score)::NUMERIC, 2), 0.0) AS avg_result,
         COALESCE(ROUND(AVG(overall_score)::NUMERIC, 2), 0.0) AS avg_overall
       FROM organiser_ratings
       WHERE organiser_id = $1 AND moderation_status = 'VISIBLE'`,
      [organiserId]
    );

    const summary = summaryRes.rows[0] || {
      sample_size: 0,
      verified_reviews_count: 0,
      avg_communication: 0,
      avg_schedule: 0,
      avg_result: 0,
      avg_overall: 0,
    };

    // 2. Fetch reviews list
    const statusCondition = includeFlagged
      ? `AND r.moderation_status IN ('VISIBLE', 'FLAGGED')`
      : `AND r.moderation_status = 'VISIBLE'`;

    const ratingsRes = await query(
      `SELECT
         r.id, r.tournament_id, r.organiser_id, r.participant_id,
         r.communication_score, r.schedule_score, r.result_score, r.overall_score,
         r.review_text, r.is_verified_participant, r.moderation_status,
         r.created_at,
         t.name AS tournament_name,
         u.username AS participant_username
       FROM organiser_ratings r
       JOIN tournaments t ON r.tournament_id = t.id
       JOIN users u ON r.participant_id = u.id
       WHERE r.organiser_id = $1 ${statusCondition}
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [organiserId, limit, offset]
    );

    return {
      summary: {
        sample_size: Number(summary.sample_size) || 0,
        verified_reviews_count: Number(summary.verified_reviews_count) || 0,
        avg_communication: Number(summary.avg_communication) || 0,
        avg_schedule: Number(summary.avg_schedule) || 0,
        avg_result: Number(summary.avg_result) || 0,
        avg_overall: Number(summary.avg_overall) || 0,
      },
      ratings: ratingsRes.rows,
      pagination: { limit, offset, count: ratingsRes.rows.length },
    };
  }

  /**
   * Organiser appeal/dispute against an abusive or false review.
   * Note: Organisers cannot delete reviews themselves.
   *
   * @param {string} organiserId - Organiser requesting the appeal
   * @param {string} ratingId - Rating ID to appeal
   * @param {Object} input - { grounds, explanation, evidence_hashes }
   * @returns {Promise<Object>} Created appeal record
   */
  static async appealRating(organiserId, ratingId, input) {
    const ratingRes = await query(
      `SELECT id, organiser_id, tournament_id, moderation_status
       FROM organiser_ratings WHERE id = $1`,
      [ratingId]
    );

    if (ratingRes.rows.length === 0) {
      const err = new Error('Rating not found');
      err.code = 'RATING_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const rating = ratingRes.rows[0];

    // Only the target organiser can appeal
    if (rating.organiser_id !== organiserId) {
      const err = new Error('Only the reviewed organiser can appeal this rating');
      err.code = 'FORBIDDEN_APPEAL';
      err.status = 403;
      throw err;
    }

    // Check if an appeal already exists
    const existingAppeal = await query(
      `SELECT id, status FROM organiser_rating_appeals WHERE rating_id = $1`,
      [ratingId]
    );

    if (existingAppeal.rows.length > 0) {
      const err = new Error('An appeal has already been filed for this rating');
      err.code = 'APPEAL_ALREADY_EXISTS';
      err.status = 409;
      throw err;
    }

    // Create the appeal record
    const appealRes = await query(
      `INSERT INTO organiser_rating_appeals (
         rating_id, organiser_id, grounds, explanation, evidence_hashes, status
       )
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING *`,
      [
        ratingId,
        organiserId,
        input.grounds,
        input.explanation,
        input.evidence_hashes || [],
      ]
    );

    // Update rating moderation status to FLAGGED
    await query(
      `UPDATE organiser_ratings
       SET moderation_status = 'FLAGGED',
           flag_reason = $1,
           flagged_by = $2,
           flagged_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
      [input.explanation, organiserId, ratingId]
    );

    await appendAuditLog({
      actorId: organiserId,
      actorRole: 'ORGANISER',
      action: 'ORGANISER_RATING_APPEALED',
      entityType: 'ORGANISER_RATING_APPEAL',
      entityId: appealRes.rows[0].id,
      payload: { ratingId, grounds: input.grounds },
      reason: input.explanation,
    });

    return appealRes.rows[0];
  }

  /**
   * Moderator review and adjudication of a review appeal.
   *
   * @param {string} moderatorId - ID of reviewing moderator
   * @param {string} appealId - Appeal ID
   * @param {Object} input - { decision: 'UPHELD' | 'REJECTED', reason: string }
   * @returns {Promise<Object>} Adjudicated appeal & updated rating status
   */
  static async adjudicateAppeal(moderatorId, appealId, input) {
    const appealRes = await query(
      `SELECT a.*, r.organiser_id, r.participant_id, r.tournament_id
       FROM organiser_rating_appeals a
       JOIN organiser_ratings r ON a.rating_id = r.id
       WHERE a.id = $1`,
      [appealId]
    );

    if (appealRes.rows.length === 0) {
      const err = new Error('Rating appeal not found');
      err.code = 'APPEAL_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const appeal = appealRes.rows[0];
    if (appeal.status !== 'PENDING') {
      const err = new Error(`Appeal has already been adjudicated with status ${appeal.status}`);
      err.code = 'APPEAL_ALREADY_ADJUDICATED';
      err.status = 400;
      throw err;
    }

    const decision = input.decision; // UPHELD or REJECTED
    const targetStatus = decision === 'UPHELD' ? 'REMOVED' : 'VISIBLE';

    // Update appeal
    const updatedAppeal = await query(
      `UPDATE organiser_rating_appeals
       SET status = $1,
           adjudicated_by = $2,
           adjudicated_at = NOW(),
           decision_reason = $3
       WHERE id = $4
       RETURNING *`,
      [decision, moderatorId, input.reason, appealId]
    );

    // Update rating moderation status
    await query(
      `UPDATE organiser_ratings
       SET moderation_status = $1,
           moderated_by = $2,
           moderated_at = NOW(),
           moderation_notes = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [targetStatus, moderatorId, input.reason, appeal.rating_id]
    );

    // Log to moderation action logs
    await query(
      `INSERT INTO moderation_action_logs (
         actor_id, actor_role, action, target_type, target_id,
         policy_clause, justification, payload
       )
       VALUES ($1, 'MODERATOR', $2, 'ORGANISER_RATING', $3, 'SECTION_21_RATINGS', $4, $5)`,
      [
        moderatorId,
        `APPEAL_${decision}`,
        appeal.rating_id,
        input.reason,
        JSON.stringify({ appealId, decision, targetStatus }),
      ]
    );

    await appendAuditLog({
      actorId: moderatorId,
      actorRole: 'MODERATOR',
      action: 'ORGANISER_RATING_APPEAL_ADJUDICATED',
      entityType: 'ORGANISER_RATING_APPEAL',
      entityId: appealId,
      payload: { decision, targetStatus, ratingId: appeal.rating_id },
      reason: input.reason,
    });

    return {
      appeal: updatedAppeal.rows[0],
      newRatingStatus: targetStatus,
    };
  }

  /**
   * Organiser report against a tournament participant for conduct violations.
   *
   * @param {string} organiserId - Organiser reporting
   * @param {string} tournamentId - Tournament ID
   * @param {Object} input - { participant_id, category, reason, evidence_hashes }
   * @returns {Promise<Object>} Created report record
   */
  static async reportParticipant(organiserId, tournamentId, input) {
    // 1. Verify tournament ownership
    const tourneyRes = await query(
      `SELECT id, organiser_id, status FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tourneyRes.rows.length === 0) {
      const err = new Error('Tournament not found');
      err.code = 'TOURNAMENT_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (tourneyRes.rows[0].organiser_id !== organiserId) {
      const err = new Error('Only the tournament organiser can submit participant conduct reports');
      err.code = 'FORBIDDEN_ORGANISER_REPORT';
      err.status = 403;
      throw err;
    }

    // 2. Verify participant played/registered in tournament
    const regRes = await query(
      `SELECT id FROM registrations
       WHERE tournament_id = $1 AND (user_id = $2 OR team_id IN (
         SELECT team_id FROM team_members WHERE user_id = $2
       ))`,
      [tournamentId, input.participant_id]
    );

    if (regRes.rows.length === 0) {
      const err = new Error('Reported user was not a participant in this tournament');
      err.code = 'NOT_A_PARTICIPANT';
      err.status = 400;
      throw err;
    }

    // 3. Create report in reports table (unverified claim invariant)
    const reportCategoryMap = {
      NO_SHOW: 'ORGANISER_NO_SHOW',
      TOXIC_BEHAVIOR: 'TOXICITY_OR_HARASSMENT',
      LOBBY_DISRUPTION: 'OTHER',
      SUSPECTED_CHEATING: 'CHEATING_OR_EXPLOITS',
      UNAUTHORIZED_RINGER: 'CHEATING_OR_EXPLOITS',
      OTHER: 'OTHER',
    };

    const category = reportCategoryMap[input.category] || 'OTHER';

    const reportRes = await query(
      `INSERT INTO reports (
         reporter_id, target_type, target_id, category, description,
         evidence_hashes, status
       )
       VALUES ($1, 'PLAYER', $2, $3, $4, $5, 'PENDING')
       RETURNING *`,
      [
        organiserId,
        input.participant_id,
        category,
        `[Tournament: ${tournamentId}] [Conduct: ${input.category}] ${input.reason}`,
        input.evidence_hashes || [],
      ]
    );

    await appendAuditLog({
      actorId: organiserId,
      actorRole: 'ORGANISER',
      action: 'ORGANISER_REPORTED_PARTICIPANT',
      entityType: 'REPORT',
      entityId: reportRes.rows[0].id,
      payload: {
        tournamentId,
        participantId: input.participant_id,
        conductViolation: input.category,
      },
      reason: input.reason,
    });

    return reportRes.rows[0];
  }
}
