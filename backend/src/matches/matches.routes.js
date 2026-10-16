import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../common/database.js';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { AppError } from '../common/errorHandler.js';
import { appendAuditLog, hashIP } from '../common/auditLog.js';
import {
  MatchBracketService,
  canTransitionMatch,
} from './matches.service.js';
import {
  BracketGenerateSchema,
  MatchRoomUpdateSchema,
  MatchTransitionSchema,
  MatchResultSubmitDetailedSchema,
} from '../../../packages/validation/src/index.ts';

export const matchesRouter = Router();

// ─── POST /tournament/:id/generate-bracket — Generate Bracket ───────────────
matchesRouter.post('/tournament/:id/generate-bracket', authenticate, async (req, res, next) => {
  try {
    const validated = BracketGenerateSchema.parse(req.body);
    const result = await MatchBracketService.generateAndSaveBracket(
      req.params.id,
      req.user,
      validated,
      req.ip
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Tournament bracket generated successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /tournament/:id/bracket — Get Complete Bracket View ────────────────
matchesRouter.get('/tournament/:id/bracket', async (req, res, next) => {
  try {
    const tournamentId = req.params.id;

    // Check user registration if logged in
    let userReg = null;
    if (req.user) {
      const regRes = await query(
        `SELECT id, status, roster_locked FROM tournament_registrations
         WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, req.user.id]
      );
      if (regRes.rows.length > 0) userReg = regRes.rows[0];
    }

    // Fetch tournament
    const tourRes = await query(
      `SELECT id, organiser_id, status, format, title FROM tournaments WHERE id = $1`,
      [tournamentId]
    );
    if (tourRes.rows.length === 0) throw new AppError('Tournament not found', 404);
    const tournament = tourRes.rows[0];

    // Fetch matches with participant details
    const matchesRes = await query(
      `SELECT m.*,
              tr_a.slot_number as participant_a_slot,
              COALESCE(t_a.name, u_a.username) as participant_a_name,
              tr_b.slot_number as participant_b_slot,
              COALESCE(t_b.name, u_b.username) as participant_b_name,
              COALESCE(t_w.name, u_w.username) as winner_name,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'registration_id', mp.registration_id,
                  'seed', mp.seed,
                  'placement', mp.placement,
                  'kills', mp.kills,
                  'calculated_points', mp.calculated_points,
                  'is_winner', mp.is_winner,
                  'name', COALESCE(t_p.name, u_p.username)
                )) FROM match_participants mp
                JOIN tournament_registrations tr_p ON tr_p.id = mp.registration_id
                LEFT JOIN users u_p ON u_p.id = tr_p.user_id
                LEFT JOIN teams t_p ON t_p.id = tr_p.team_id
                WHERE mp.match_id = m.id),
                '[]'
              ) as participants
       FROM matches m
       LEFT JOIN tournament_registrations tr_a ON tr_a.id = m.participant_a_id
       LEFT JOIN users u_a ON u_a.id = tr_a.user_id
       LEFT JOIN teams t_a ON t_a.id = tr_a.team_id
       LEFT JOIN tournament_registrations tr_b ON tr_b.id = m.participant_b_id
       LEFT JOIN users u_b ON u_b.id = tr_b.user_id
       LEFT JOIN teams t_b ON t_b.id = tr_b.team_id
       LEFT JOIN tournament_registrations tr_w ON tr_w.id = m.winner_registration_id
       LEFT JOIN users u_w ON u_w.id = tr_w.user_id
       LEFT JOIN teams t_w ON t_w.id = tr_w.team_id
       WHERE m.tournament_id = $1
       ORDER BY m.round_number, m.match_number`,
      [tournamentId]
    );

    // Apply security gate room code sanitization per match
    const serverTime = new Date();
    const sanitizedMatches = matchesRes.rows.map(m =>
      MatchBracketService.sanitizeMatchForUser(
        { ...m, organiser_id: tournament.organiser_id },
        req.user || null,
        userReg,
        serverTime
      )
    );

    // Group by rounds
    const roundsMap = new Map();
    for (const m of sanitizedMatches) {
      if (!roundsMap.has(m.round_number)) {
        roundsMap.set(m.round_number, {
          round_number: m.round_number,
          stage: m.stage,
          matches: [],
        });
      }
      roundsMap.get(m.round_number).matches.push(m);
    }

    res.json({
      success: true,
      data: {
        tournament_id: tournamentId,
        format: tournament.format,
        server_time: serverTime.toISOString(),
        rounds: Array.from(roundsMap.values()),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /tournament/:id — List matches for a tournament ─────────────
matchesRouter.get('/tournament/:id', async (req, res, next) => {
  try {
    let userReg = null;
    if (req.user) {
      const regRes = await query(
        `SELECT id, status, roster_locked FROM tournament_registrations
         WHERE tournament_id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      );
      if (regRes.rows.length > 0) userReg = regRes.rows[0];
    }

    const tourRes = await query(
      `SELECT organiser_id FROM tournaments WHERE id = $1`,
      [req.params.id]
    );
    const organiserId = tourRes.rows[0]?.organiser_id;

    const result = await query(
      `SELECT m.*, 
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'registration_id', mp.registration_id, 'placement', mp.placement,
                  'kills', mp.kills, 'deaths', mp.deaths, 'calculated_points', mp.calculated_points,
                  'is_winner', mp.is_winner
                )) FROM match_participants mp WHERE mp.match_id = m.id),
                '[]'
              ) as participants
       FROM matches m WHERE m.tournament_id = $1
       ORDER BY m.round_number, m.match_number`,
      [req.params.id]
    );

    const serverTime = new Date();
    const sanitized = result.rows.map(m =>
      MatchBracketService.sanitizeMatchForUser(
        { ...m, organiser_id: organiserId },
        req.user || null,
        userReg,
        serverTime
      )
    );

    res.json({ success: true, data: sanitized });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id — Get single match details ────────────────────────────────────
matchesRouter.get('/:id', async (req, res, next) => {
  try {
    const matchRes = await query(
      `SELECT m.*, t.organiser_id,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'registration_id', mp.registration_id, 'placement', mp.placement,
                  'kills', mp.kills, 'deaths', mp.deaths, 'calculated_points', mp.calculated_points,
                  'is_winner', mp.is_winner
                )) FROM match_participants mp WHERE mp.match_id = m.id),
                '[]'
              ) as participants
       FROM matches m
       JOIN tournaments t ON t.id = m.tournament_id
       WHERE m.id = $1`,
      [req.params.id]
    );

    if (matchRes.rows.length === 0) throw new AppError('Match not found', 404);
    const match = matchRes.rows[0];

    let userReg = null;
    if (req.user) {
      const regRes = await query(
        `SELECT id, status, roster_locked FROM tournament_registrations
         WHERE tournament_id = $1 AND user_id = $2`,
        [match.tournament_id, req.user.id]
      );
      if (regRes.rows.length > 0) userReg = regRes.rows[0];
    }

    const sanitized = MatchBracketService.sanitizeMatchForUser(
      match,
      req.user || null,
      userReg,
      new Date()
    );

    res.json({ success: true, data: sanitized });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /:id/room — Set room ID & release time (Organiser/Admin) ─────────
matchesRouter.patch('/:id/room', authenticate, async (req, res, next) => {
  try {
    const validated = MatchRoomUpdateSchema.parse(req.body);
    const result = await MatchBracketService.updateMatchRoom(
      req.params.id,
      req.user,
      validated,
      req.ip
    );

    res.json({
      success: true,
      data: result,
      message: 'Match room details configured successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/transition — Transition match lifecycle state ────────────────
matchesRouter.post('/:id/transition', authenticate, async (req, res, next) => {
  try {
    const validated = MatchTransitionSchema.parse(req.body);
    const result = await MatchBracketService.transitionMatchState(
      req.params.id,
      validated.new_status,
      req.user,
      validated.reason,
      req.ip
    );

    res.json({
      success: true,
      data: result,
      message: `Match state transitioned to ${validated.new_status}`,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/submit-result — Submit match result with versioning & conflict detection ───
matchesRouter.post('/:id/submit-result', authenticate, async (req, res, next) => {
  try {
    const { ResultSubmissionService } = await import('./resultSubmission.service.js');
    const { MatchResultSubmissionSchema } = await import('../../../packages/validation/src/index.ts');

    const participants = req.body.participants;
    if (!Array.isArray(participants) || participants.length === 0) {
      throw new AppError('Participants array required', 400, 'INVALID_BODY');
    }

    // Support both direct array and full schema
    const payload = MatchResultSubmissionSchema.safeParse({
      match_id: req.params.id,
      participants,
      evidence_file_url: req.body.evidence_file_url,
      evidence_sha256: req.body.evidence_sha256,
      notes: req.body.notes,
    });

    const parsedData = payload.success ? payload.data : { match_id: req.params.id, participants };

    // Update match_participants for backward-compatible views
    for (const p of participants) {
      await query(
        `INSERT INTO match_participants (match_id, registration_id, placement, kills, deaths, assists, raw_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (match_id, registration_id) DO UPDATE SET
           placement = EXCLUDED.placement, kills = EXCLUDED.kills,
           deaths = EXCLUDED.deaths, assists = EXCLUDED.assists, raw_score = EXCLUDED.raw_score`,
        [req.params.id, p.registration_id, p.placement || null,
         p.kills || 0, p.deaths || 0, p.assists || 0, p.raw_score || {}]
      );
    }

    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotency_key;
    const result = await ResultSubmissionService.submitResult(
      req.params.id,
      req.user.id,
      req.user.role,
      parsedData,
      idempotencyKey,
      req.ip
    );

    res.status(201).json({
      success: true,
      data: result,
      message: result.conflictDetected
        ? '⚠️ Conflicting scores detected. Match placed on automatic hold and dispute created.'
        : result.isFinalized
          ? '✓ Match result verified and finalized automatically.'
          : 'Result submitted. Awaiting confirmation within 15 minutes.',
    });
  } catch (err) { next(err); }
});

// ─── POST /:id/confirm-result — Confirm or contest match result ─────────────
matchesRouter.post('/:id/confirm-result', authenticate, async (req, res, next) => {
  try {
    const { ResultSubmissionService } = await import('./resultSubmission.service.js');
    const { MatchResultConfirmationSchema } = await import('../../../packages/validation/src/index.ts');

    const match = await query(
      'SELECT id, status, result_submitted_by, tournament_id, round_number, match_number, next_match_id, participant_a_id, participant_b_id FROM matches WHERE id = $1',
      [req.params.id]
    );
    if (match.rows.length === 0) throw new AppError('Match not found', 404);

    // If submission_id provided, use full confirmation workflow
    if (req.body.submission_id) {
      const validated = MatchResultConfirmationSchema.parse(req.body);
      const result = await ResultSubmissionService.confirmResult(
        req.params.id,
        validated.submission_id,
        req.user.id,
        req.user.role,
        validated,
        req.ip
      );
      return res.json({ success: true, data: result });
    }

    // Fallback: Legacy confirmation
    if (!['RESULT_PENDING', 'RESULT_SUBMITTED'].includes(match.rows[0].status)) {
      throw new AppError('Match result not pending confirmation', 400);
    }

    const winnerRes = await query(
      `SELECT registration_id FROM match_participants
       WHERE match_id = $1 AND (is_winner = TRUE OR placement = 1)
       ORDER BY calculated_points DESC, kills DESC LIMIT 1`,
      [req.params.id]
    );

    const winnerId = winnerRes.rows[0]?.registration_id || null;

    await query(
      `UPDATE matches SET
         status = 'FINAL',
         winner_registration_id = $1,
         result_confirmed_by = $2,
         ended_at = NOW(),
         updated_at = NOW()
       WHERE id = $3`,
      [winnerId, req.user.id, req.params.id]
    );

    if (winnerId && match.rows[0].next_match_id) {
      const isOdd = match.rows[0].match_number % 2 === 1;
      await query(
        `UPDATE matches SET
           ${isOdd ? 'participant_a_id' : 'participant_b_id'} = $1,
           updated_at = NOW()
         WHERE id = $2`,
        [winnerId, match.rows[0].next_match_id]
      );
    }

    await appendAuditLog({
      actorId: req.user.id, actorRole: req.user.role,
      action: 'MATCH_RESULT_CONFIRMED', entityType: 'match',
      entityId: req.params.id, ipHash: hashIP(req.ip),
    });

    res.json({ success: true, message: 'Match result confirmed and finalized.' });
  } catch (err) { next(err); }
});

// ─── POST /:id/adjudicate-result — Staff Adjudication & Official Correction ──
matchesRouter.post('/:id/adjudicate-result', authenticate, async (req, res, next) => {
  try {
    const { ResultSubmissionService } = await import('./resultSubmission.service.js');
    const { MatchResultAdjudicationSchema } = await import('../../../packages/validation/src/index.ts');

    const validated = MatchResultAdjudicationSchema.parse(req.body);
    const result = await ResultSubmissionService.adjudicateResult(
      req.params.id,
      req.user.id,
      req.user.role,
      validated,
      req.ip
    );

    res.json({
      success: true,
      data: result,
      message: 'Match result successfully adjudicated and finalized by staff.',
    });
  } catch (err) { next(err); }
});

// ─── GET /:id/result-history — Versioned raw & adjudicated submissions ──────
matchesRouter.get('/:id/result-history', authenticate, async (req, res, next) => {
  try {
    const { ResultSubmissionService } = await import('./resultSubmission.service.js');
    const data = await ResultSubmissionService.getResultHistory(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── GET /:id/verify — Public "Verify This Result" Certificate ───────────────
matchesRouter.get('/:id/verify', async (req, res, next) => {
  try {
    const { verifyMatchResult } = await import('../users/playerDashboard.service.js');
    const data = await verifyMatchResult(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── GET /:id/evidence-checklist — Guided evidence capture checklist ────────
matchesRouter.get('/:id/evidence-checklist', (req, res) => {
  const { ResultSubmissionService } = require ? { ResultSubmissionService: null } : {};
  import('./resultSubmission.service.js').then(({ ResultSubmissionService }) => {
    const data = ResultSubmissionService.getReplayChecklist(req.query.game_code || 'BGMI');
    res.json({ success: true, data });
  }).catch(err => res.status(500).json({ success: false, error: err.message }));
});

// ─── POST /:id/upload-evidence — Upload evidence with SHA-256 ───────
matchesRouter.post('/:id/upload-evidence', authenticate, async (req, res, next) => {
  try {
    const { file_url, file_type, file_size_bytes, description } = req.body;

    if (!file_url || !file_type) {
      throw new AppError('file_url and file_type required', 400, 'INVALID_BODY');
    }

    const sha256Hash = crypto.createHash('sha256')
      .update(file_url + Date.now().toString())
      .digest('hex');

    const result = await query(
      `INSERT INTO evidence_files (match_id, uploaded_by, file_url, file_type, file_size_bytes, sha256_hash, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.id, req.user.id, file_url, file_type, file_size_bytes || 0, sha256Hash, description || null]
    );

    await appendAuditLog({
      actorId: req.user.id, actorRole: req.user.role,
      action: 'EVIDENCE_UPLOADED', entityType: 'evidence',
      entityId: result.rows[0].id,
      payload: { match_id: req.params.id, sha256: sha256Hash },
      ipHash: hashIP(req.ip),
    });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// ─── POST /:id/create-lobby — Legacy support for create lobby ───────────────
matchesRouter.post('/:id/create-lobby', authenticate, async (req, res, next) => {
  try {
    const { room_id, room_password } = req.body;
    await query(
      `UPDATE matches SET room_id = $1, room_password = $2, status = 'LOBBY_READY', updated_at = NOW()
       WHERE id = $3 AND status = 'SCHEDULED'`,
      [room_id, room_password, req.params.id]
    );
    res.json({ success: true, message: 'Lobby created' });
  } catch (err) { next(err); }
});

