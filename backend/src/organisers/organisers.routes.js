import { Router } from 'express';
import { authenticate, authorize, requireIdempotencyKey } from '../common/auth.middleware.js';
import { AppError } from '../common/errorHandler.js';
import { OrganiserOperationsService } from './organiserOperations.service.js';
import {
  TournamentAnnouncementCreateSchema,
  TournamentAnnouncementUpdateSchema,
  TournamentIncidentCreateSchema,
  TournamentIncidentResolveSchema,
  MatchdayChecklistUpdateSchema,
  TournamentAdminReviewSchema,
} from '../../../packages/validation/src/index.ts';

const organisersRouter = Router();

// ─── GET /api/v1/organisers/dashboard — Organiser Dashboard Summary ─────────
organisersRouter.get('/dashboard',
  authenticate,
  authorize('ORGANISER', 'ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const data = await OrganiserOperationsService.getOrganiserDashboard(req.user.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/v1/organisers/tournaments/:id/operations — Tournament Ops Center
organisersRouter.get('/tournaments/:id/operations',
  authenticate,
  async (req, res, next) => {
    try {
      const data = await OrganiserOperationsService.getTournamentOperations(
        req.params.id,
        req.user.id,
        req.user.role
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/v1/organisers/tournaments/:id/checklist — Match-Day Checklist ─
organisersRouter.get('/tournaments/:id/checklist',
  authenticate,
  async (req, res, next) => {
    try {
      await OrganiserOperationsService.verifyTournamentOwnership(
        req.params.id,
        req.user.id,
        req.user.role
      );
      const data = await OrganiserOperationsService.getOrInitChecklist(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/v1/organisers/tournaments/:id/checklist — Toggle Checklist Item
organisersRouter.patch('/tournaments/:id/checklist',
  authenticate,
  async (req, res, next) => {
    try {
      const payload = MatchdayChecklistUpdateSchema.parse(req.body);
      const data = await OrganiserOperationsService.updateChecklistItem(
        req.params.id,
        req.user.id,
        req.user.role,
        payload,
        req.ip
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── GET /api/v1/organisers/tournaments/:id/announcements — List Announcements
organisersRouter.get('/tournaments/:id/announcements', async (req, res, next) => {
  try {
    const data = await OrganiserOperationsService.listAnnouncements(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/organisers/tournaments/:id/announcements — Create Announcement
organisersRouter.post('/tournaments/:id/announcements',
  authenticate,
  async (req, res, next) => {
    try {
      const payload = TournamentAnnouncementCreateSchema.parse(req.body);
      const data = await OrganiserOperationsService.createAnnouncement(
        req.params.id,
        req.user.id,
        req.user.role,
        payload,
        req.ip
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── GET /api/v1/organisers/tournaments/:id/incidents — List Incidents ──────
organisersRouter.get('/tournaments/:id/incidents',
  authenticate,
  async (req, res, next) => {
    try {
      const data = await OrganiserOperationsService.listIncidents(
        req.params.id,
        req.user.id,
        req.user.role
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/organisers/tournaments/:id/incidents — Log Incident ───────
organisersRouter.post('/tournaments/:id/incidents',
  authenticate,
  async (req, res, next) => {
    try {
      const payload = TournamentIncidentCreateSchema.parse(req.body);
      const data = await OrganiserOperationsService.logIncident(
        req.params.id,
        req.user.id,
        req.user.role,
        payload,
        req.ip
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── PATCH /api/v1/organisers/incidents/:id — Resolve Incident ──────────────
organisersRouter.patch('/incidents/:id',
  authenticate,
  async (req, res, next) => {
    try {
      const payload = TournamentIncidentResolveSchema.parse(req.body);
      const data = await OrganiserOperationsService.resolveIncident(
        req.params.id,
        req.user.id,
        req.user.role,
        payload,
        req.ip
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── GET /api/v1/organisers/admin/review-queue — Admin Tournament Approval Queue
organisersRouter.get('/admin/review-queue',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'MODERATOR'),
  async (req, res, next) => {
    try {
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

// ─── POST /api/v1/organisers/tournaments/:id/admin-review — Approve/Reject Tournament
organisersRouter.post('/tournaments/:id/admin-review',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
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

import { OrganiserVerificationService } from './organiserVerification.service.js';
import {
  OrganiserApplicationCreateSchema,
  OrganiserReviewDecisionSchema,
  OrganiserTierUpdateSchema,
  OrganiserPublishingHoldSchema,
  KYCAccessQuerySchema,
} from '../../../packages/validation/src/index.ts';

// ─── POST /api/v1/organisers/apply — Submit KYC Verification Application ───
organisersRouter.post('/apply',
  authenticate,
  async (req, res, next) => {
    try {
      const payload = OrganiserApplicationCreateSchema.parse(req.body);
      const data = await OrganiserVerificationService.submitApplication(
        req.user.id,
        payload,
        req.ip
      );
      res.status(201).json({
        success: true,
        message: 'Verification application submitted for review',
        data,
      });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── GET /api/v1/organisers/me/application — Organiser's Own Application ───
organisersRouter.get('/me/application',
  authenticate,
  async (req, res, next) => {
    try {
      const data = await OrganiserVerificationService.getOwnApplication(req.user.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/v1/organisers/me/publishing-eligibility — Check Publishing Caps ─
organisersRouter.get('/me/publishing-eligibility',
  authenticate,
  async (req, res, next) => {
    try {
      const data = await OrganiserVerificationService.checkPublishingEligibility(
        req.user.id,
        { max_participants: parseInt(req.query.max_participants, 10) || 16 }
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/v1/organisers/admin/applications — Admin Review Queue ─────────
organisersRouter.get('/admin/applications',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const data = await OrganiserVerificationService.listApplicationsQueue(req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/v1/organisers/admin/applications/:id — Inspect KYC Application 
// Security Gate: Moderators blocked; requires audited justification reason
organisersRouter.get('/admin/applications/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { reason } = KYCAccessQuerySchema.parse(req.query);
      const data = await OrganiserVerificationService.getApplicationForReview(
        req.params.id,
        req.user,
        reason,
        req.ip,
        req.headers['user-agent']
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Accessing KYC requires a valid business reason (min 5 characters)', 400, 'REASON_REQUIRED', err.errors)
        : err);
    }
  }
);

// ─── POST /api/v1/organisers/admin/applications/:id/review — Approve/Reject ─
organisersRouter.post('/admin/applications/:id/review',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const payload = OrganiserReviewDecisionSchema.parse(req.body);
      const data = await OrganiserVerificationService.reviewApplication(
        req.params.id,
        req.user,
        payload,
        req.ip
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── PATCH /api/v1/organisers/admin/:id/tier — Update Organiser Tier ─────────
organisersRouter.patch('/admin/:id/tier',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const payload = OrganiserTierUpdateSchema.parse(req.body);
      const data = await OrganiserVerificationService.updateTier(
        req.params.id,
        payload.tier,
        req.user,
        payload.reason,
        req.ip
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── POST /api/v1/organisers/admin/:id/publishing-hold — Place/Release Hold ──
organisersRouter.post('/admin/:id/publishing-hold',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const payload = OrganiserPublishingHoldSchema.parse(req.body);
      const data = await OrganiserVerificationService.setPublishingHold(
        req.params.id,
        payload.action,
        payload.reason,
        req.user,
        req.ip
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err.name === 'ZodError'
        ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
        : err);
    }
  }
);

// ─── GET /api/v1/organisers/:id — Public Sanitised Trust Profile ─────────────
organisersRouter.get('/:id', async (req, res, next) => {
  try {
    const data = await OrganiserVerificationService.getPublicProfile(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

organisersRouter.get('/:id/public', async (req, res, next) => {
  try {
    const data = await OrganiserVerificationService.getPublicProfile(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export { organisersRouter };

