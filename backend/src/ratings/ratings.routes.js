/**
 * Vexora Esports Tournament Platform — Organiser Ratings Routes
 */

import { Router } from 'express';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { validateBody } from '../common/validation.middleware.js';
import {
  OrganiserRatingCreateSchema,
  OrganiserRatingAppealSchema,
  OrganiserRatingAppealAdjudicateSchema,
  OrganiserParticipantReportSchema,
} from '@vexora/validation';
import { RatingsService } from './ratings.service.js';

export const ratingsRouter = Router();

// ─── POST /tournaments/:tournamentId — Submit organiser rating ───────────────
ratingsRouter.post(
  '/tournaments/:tournamentId',
  authenticate,
  validateBody(OrganiserRatingCreateSchema),
  async (req, res, next) => {
    try {
      const rating = await RatingsService.submitOrganiserRating(
        req.user.id,
        req.params.tournamentId,
        req.body
      );
      res.status(201).json({ success: true, data: rating });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /organisers/:organiserId — List organiser ratings & sample size ──────
ratingsRouter.get('/organisers/:organiserId', async (req, res, next) => {
  try {
    const data = await RatingsService.getOrganiserRatings(req.params.organiserId, {
      limit: req.query.limit,
      offset: req.query.offset,
      includeFlagged: req.query.includeFlagged === 'true',
    });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/appeal — Organiser appeals a review ───────────────────────────
ratingsRouter.post(
  '/:id/appeal',
  authenticate,
  validateBody(OrganiserRatingAppealSchema),
  async (req, res, next) => {
    try {
      const appeal = await RatingsService.appealRating(
        req.user.id,
        req.params.id,
        req.body
      );
      res.status(201).json({ success: true, data: appeal });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /appeals/:appealId/adjudicate — Moderator reviews appeal ───────────
ratingsRouter.post(
  '/appeals/:appealId/adjudicate',
  authenticate,
  authorize('MODERATOR', 'ADMIN', 'SUPER_ADMIN'),
  validateBody(OrganiserRatingAppealAdjudicateSchema),
  async (req, res, next) => {
    try {
      const result = await RatingsService.adjudicateAppeal(
        req.user.id,
        req.params.appealId,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /tournaments/:tournamentId/report-participant ─────────────────────
ratingsRouter.post(
  '/tournaments/:tournamentId/report-participant',
  authenticate,
  validateBody(OrganiserParticipantReportSchema),
  async (req, res, next) => {
    try {
      const report = await RatingsService.reportParticipant(
        req.user.id,
        req.params.tournamentId,
        req.body
      );
      res.status(201).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
);
