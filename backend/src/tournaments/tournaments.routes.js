import { Router } from 'express';
import { query, withTransaction } from '../common/database.js';
import { authenticate, authorize, requireIdempotencyKey } from '../common/auth.middleware.js';
import { AppError } from '../common/errorHandler.js';
import { TournamentService, TOURNAMENT_STATES } from './tournaments.service.js';
import { TournamentRegistrationService } from './tournamentRegistrations.service.js';
import {
  TournamentCreateSchema,
  TournamentUpdateSchema,
  TournamentRuleUpdateSchema,
  TournamentTransitionSchema,
  TournamentRegisterSchema,
  TournamentCheckInSchema,
  TournamentDiscoveryQuerySchema,
} from '../../../packages/validation/src/index.ts';

export const tournamentsRouter = Router();

// ─── GET / — Discover tournaments ────────────────────────────────────
tournamentsRouter.get('/', async (req, res, next) => {
  try {
    const tournaments = await TournamentService.listTournaments({
      game_id: req.query.game_id,
      status: req.query.status,
      format: req.query.format,
      region: req.query.region,
      organiser_id: req.query.organiser_id,
      limit: req.query.limit,
      offset: req.query.offset || (req.query.page ? (parseInt(req.query.page, 10) - 1) * (parseInt(req.query.limit, 10) || 20) : 0),
    });

    res.json({ success: true, data: tournaments });
  } catch (err) {
    next(err);
  }
});

// ─── GET /states — Get canonical 11 states ────────────────────────────
tournamentsRouter.get('/meta/states', (req, res) => {
  res.json({ success: true, data: TOURNAMENT_STATES });
});

// ─── GET /:id — Tournament details ───────────────────────────────────
tournamentsRouter.get('/:id', async (req, res, next) => {
  try {
    const tournament = await TournamentService.getById(req.params.id);
    res.json({ success: true, data: tournament });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/rules — Historical versioned rules log ─────────────────
tournamentsRouter.get('/:id/rules', async (req, res, next) => {
  try {
    const history = await TournamentService.getRulesHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

// ─── POST / — Create tournament draft (Organiser / Admin) ────────────
tournamentsRouter.post('/',
  authenticate,
  authorize('ORGANISER', 'ADMIN', 'SUPER_ADMIN'),
  requireIdempotencyKey,
  async (req, res, next) => {
    try {
      const data = TournamentCreateSchema.parse(req.body);
      const tournament = await TournamentService.createDraft(
        req.user.id,
        data,
        req.idempotencyKey,
        req.ip
      );

      res.status(201).json({ success: true, data: tournament });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── PATCH /:id — Update tournament draft ────────────────────────────
tournamentsRouter.patch('/:id',
  authenticate,
  async (req, res, next) => {
    try {
      const updateData = TournamentUpdateSchema.parse(req.body);
      const updated = await TournamentService.updateDraft(
        req.params.id,
        req.user.id,
        req.user.role,
        updateData,
        req.ip
      );

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── POST /:id/rules — Versioned rules update ────────────────────────
tournamentsRouter.post('/:id/rules',
  authenticate,
  async (req, res, next) => {
    try {
      const rulesData = TournamentRuleUpdateSchema.parse(req.body);
      const newRule = await TournamentService.updateRules(
        req.params.id,
        req.user.id,
        req.user.role,
        rulesData,
        req.ip
      );

      res.status(201).json({ success: true, data: newRule });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── POST /:id/submit-review — Submit draft to review queue ──────────
tournamentsRouter.post('/:id/submit-review',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await TournamentService.transitionStatus(
        req.params.id,
        'PENDING_REVIEW',
        req.user.id,
        req.user.role,
        { reason: 'Organiser submitted tournament for review' },
        req.ip
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /:id/transition — Transition state machine ─────────────────
tournamentsRouter.post('/:id/transition',
  authenticate,
  async (req, res, next) => {
    try {
      const { new_status, reason } = TournamentTransitionSchema.parse(req.body);
      const result = await TournamentService.transitionStatus(
        req.params.id,
        new_status,
        req.user.id,
        req.user.role,
        { reason },
        req.ip
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── GET /discover — Filtered tournament discovery with deep links & QR ──
tournamentsRouter.get('/discover', async (req, res, next) => {
  try {
    const filters = TournamentDiscoveryQuerySchema.parse(req.query);
    const result = await TournamentRegistrationService.discoverTournaments(filters);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err.name === 'ZodError'
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err);
  }
});

// ─── GET /:id/participants — Confirmed & waitlisted rosters ───────────
tournamentsRouter.get('/:id/participants', async (req, res, next) => {
  try {
    const participants = await TournamentRegistrationService.getParticipants(req.params.id);
    res.json({ success: true, data: participants });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/my-registration — Active user registration ──────────────
tournamentsRouter.get('/:id/my-registration',
  authenticate,
  async (req, res, next) => {
    try {
      const reg = await TournamentRegistrationService.getMyRegistration(req.params.id, req.user.id);
      res.json({ success: true, data: reg });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /:id/register — Register participant with concurrency safety ─
tournamentsRouter.post('/:id/register',
  authenticate,
  requireIdempotencyKey,
  async (req, res, next) => {
    try {
      const payload = TournamentRegisterSchema.parse(req.body);
      const result = await TournamentRegistrationService.registerParticipant(
        req.params.id,
        req.user.id,
        req.user.role,
        payload,
        req.idempotencyKey,
        req.ip
      );

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── POST /:id/cancel-registration — Cancel registration & auto-promote waitlist ─
tournamentsRouter.post('/:id/cancel-registration',
  authenticate,
  async (req, res, next) => {
    try {
      const registrationId = req.body.registration_id;
      if (!registrationId) {
        throw new AppError('registration_id is required', 400, 'REGISTRATION_ID_REQUIRED');
      }

      const result = await TournamentRegistrationService.cancelRegistration(
        req.params.id,
        registrationId,
        req.user.id,
        req.user.role,
        req.ip
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /:id/check-in — Check-in confirmed participant ──────────────
tournamentsRouter.post('/:id/check-in',
  authenticate,
  async (req, res, next) => {
    try {
      const { registration_id } = TournamentCheckInSchema.parse(req.body);
      const result = await TournamentRegistrationService.checkInParticipant(
        req.params.id,
        registration_id,
        req.user.id,
        req.user.role,
        req.ip
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── GET /admin/review-queue — Admin Tournament Approval Queue ───────
tournamentsRouter.get('/admin/review-queue',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'MODERATOR'),
  async (req, res, next) => {
    try {
      const { OrganiserOperationsService } = await import('../organisers/organiserOperations.service.js');
      const data = await OrganiserOperationsService.getPendingReviewQueue(
        req.user.id,
        req.user.role
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /:id/admin-review — Admin Approve or Reject Tournament ──────
tournamentsRouter.post('/:id/admin-review',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { TournamentAdminReviewSchema } = await import('../../../packages/validation/src/index.ts');
      const { OrganiserOperationsService } = await import('../organisers/organiserOperations.service.js');
      const payload = TournamentAdminReviewSchema.parse(req.body);
      const data = await OrganiserOperationsService.reviewTournament(
        req.params.id,
        req.user.id,
        req.user.role,
        payload,
        req.ip
      );
      res.json(data);
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);


