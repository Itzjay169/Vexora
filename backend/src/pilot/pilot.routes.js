import { Router } from 'express';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { PilotService } from './pilot.service.js';
import {
  BetaTesterEnrollSchema,
  PilotTournamentCreateSchema,
  PilotEvaluationSchema,
  BetaFeedbackSubmitSchema,
  IncidentRehearsalRecordSchema,
} from '../../../packages/validation/src/index.ts';

export const pilotRouter = Router();

// ─── 1. Public System Status (Transparent) ───────────────────────────────────

// GET /api/v1/pilot/status
pilotRouter.get('/status', async (_req, res, next) => {
  try {
    const status = await PilotService.getSystemStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

// ─── 2. Beta Testers Cohort Management ───────────────────────────────────────

// GET /api/v1/pilot/testers
pilotRouter.get('/testers', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const testers = await PilotService.listBetaTesters(req.query);
    res.json({ success: true, count: testers.length, data: testers });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/pilot/testers
pilotRouter.post('/testers', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const data = BetaTesterEnrollSchema.parse(req.body);
    const tester = await PilotService.enrollBetaTester({
      email: data.email,
      displayName: data.display_name,
      phone: data.phone,
      testerType: data.tester_type,
      distributionChannel: data.distribution_channel,
      deviceModel: data.device_model,
      osVersion: data.os_version,
    });
    res.status(201).json({ success: true, data: tester });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/pilot/testers/activate
pilotRouter.post('/testers/activate', async (req, res, next) => {
  try {
    const { invitation_code, user_id } = req.body;
    const activated = await PilotService.activateTester(invitation_code, user_id);
    res.json({ success: true, message: 'Beta membership activated', data: activated });
  } catch (err) {
    next(err);
  }
});

// ─── 3. Pilot Tournaments Orchestration ─────────────────────────────────────

// GET /api/v1/pilot/tournaments
pilotRouter.get('/tournaments', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR']), async (_req, res, next) => {
  try {
    const pilots = await PilotService.listPilotTournaments();
    res.json({ success: true, count: pilots.length, data: pilots });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/pilot/tournaments
pilotRouter.post('/tournaments', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const data = PilotTournamentCreateSchema.parse(req.body);
    const pilot = await PilotService.createPilotTournament({
      tournamentId: data.tournament_id,
      pilotCode: data.pilot_code,
      gameTitle: data.game_title,
      standbyModeratorName: data.standby_moderator_name,
      incidentChannel: data.incident_channel,
      incidentPhoneBridge: data.incident_phone_bridge,
      targetParticipants: data.target_participants,
    });
    res.status(201).json({ success: true, data: pilot });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/pilot/tournaments/:id/evaluate
pilotRouter.post('/tournaments/:id/evaluate', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const data = PilotEvaluationSchema.parse({ pilot_id: req.params.id, ...req.body });
    const evaluated = await PilotService.evaluatePilotTournament({
      pilotId: req.params.id,
      crashFreeRate: data.crash_free_rate,
      disputesRaised: data.disputes_raised,
      disputesResolved: data.disputes_resolved,
      avgResolutionMinutes: data.avg_resolution_minutes,
      financialDiscrepancyCents: data.financial_discrepancy_cents,
      incidentCount: data.incident_count,
      evaluationNotes: data.evaluation_notes,
    });
    res.json({ success: true, message: 'Pilot tournament evaluated', data: evaluated });
  } catch (err) {
    next(err);
  }
});

// ─── 4. Closed Beta Feedback & GitHub Issues Sync ───────────────────────────

// GET /api/v1/pilot/feedback
pilotRouter.get('/feedback', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR']), async (_req, res, next) => {
  try {
    const feedbackList = await PilotService.listFeedback();
    res.json({ success: true, count: feedbackList.length, data: feedbackList });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/pilot/feedback
pilotRouter.post('/feedback', async (req, res, next) => {
  try {
    const data = BetaFeedbackSubmitSchema.parse(req.body);
    const feedback = await PilotService.submitFeedback({
      authorEmail: data.author_email,
      feedbackType: data.feedback_type,
      severity: data.severity,
      title: data.title,
      description: data.description,
      screenName: data.screen_name,
      deviceTelemetry: data.device_telemetry,
    });
    res.status(201).json({ success: true, message: 'Feedback submitted and logged', data: feedback });
  } catch (err) {
    next(err);
  }
});

// ─── 5. Incident Runbook Rehearsals ─────────────────────────────────────────

// GET /api/v1/pilot/rehearsals
pilotRouter.get('/rehearsals', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (_req, res, next) => {
  try {
    const rehearsals = await PilotService.listRehearsals();
    res.json({ success: true, count: rehearsals.length, data: rehearsals });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/pilot/rehearsals
pilotRouter.post('/rehearsals', authenticate, authorize(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    const data = IncidentRehearsalRecordSchema.parse(req.body);
    const rehearsal = await PilotService.recordRehearsal({
      scenarioName: data.scenario_name,
      scenarioType: data.scenario_type,
      leadEngineer: data.lead_engineer,
      standbyModerator: data.standby_moderator,
      onCallContact: data.on_call_contact,
      escalationContact: data.escalation_contact,
      timeToDetectSeconds: data.time_to_detect_seconds,
      timeToMitigateSeconds: data.time_to_mitigate_seconds,
      outcome: data.outcome,
      killswitchVerified: data.killswitch_verified,
      notes: data.notes,
    });
    res.status(201).json({ success: true, message: 'Incident rehearsal logged', data: rehearsal });
  } catch (err) {
    next(err);
  }
});
