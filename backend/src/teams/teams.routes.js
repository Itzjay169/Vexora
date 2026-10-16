import { Router } from 'express';
import { authenticate } from '../common/auth.middleware.js';
import { AppError } from '../common/errorHandler.js';
import {
  TeamCreateSchema,
  TeamUpdateSchema,
  TeamInviteSchema,
  InviteResponseSchema,
  KickMemberSchema,
  RoleChangeSchema,
  OwnershipTransferSchema,
  TeamBlockSchema,
} from '../../../packages/validation/src/index.ts';
import * as teamsService from './teams.service.js';

export const teamsRouter = Router();

// ─── POST / — Create team ────────────────────────────────────────────────────
teamsRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const data = TeamCreateSchema.parse(req.body);
    const team = await teamsService.createTeam({
      name: data.name,
      tag: data.tag,
      gameId: data.game_id,
      description: data.description,
      region: data.region,
      logoUrl: data.logo_url,
      maxRosterSize: data.max_roster_size,
      minRosterSize: data.min_roster_size,
      socialLinks: data.social_links,
      userId: req.user.id,
      actor: { role: req.user?.role, requestId: req.correlationId },
    });
    res.status(201).json({ success: true, data: team });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// ─── GET /my — Get user's active teams ──────────────────────────────────────
teamsRouter.get('/my', authenticate, async (req, res, next) => {
  try {
    const { query: dbQuery } = await import('../common/database.js');
    const result = await dbQuery(
      `SELECT t.*, tm.role as member_role, g.name as game_name, g.slug as game_slug
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       JOIN games g ON t.game_id = g.id
       WHERE tm.user_id = $1 AND tm.left_at IS NULL AND t.is_active = TRUE
       ORDER BY tm.joined_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// ─── GET /invitations — Get user's pending invitations ──────────────────────
teamsRouter.get('/invitations', authenticate, async (req, res, next) => {
  try {
    const invites = await teamsService.getUserPendingInvites(req.user.id);
    res.json({ success: true, data: invites });
  } catch (err) { next(err); }
});

// ─── POST /invitations/:id/respond — Accept/Decline invite ─────────────────
teamsRouter.post('/invitations/:id/respond', authenticate, async (req, res, next) => {
  try {
    const data = InviteResponseSchema.parse(req.body);
    const result = await teamsService.respondToInvite({
      inviteId: req.params.id,
      userId: req.user.id,
      action: data.action,
      actor: { role: req.user?.role, requestId: req.correlationId },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// ─── GET /history — Get user's team history ─────────────────────────────────
teamsRouter.get('/history', authenticate, async (req, res, next) => {
  try {
    const history = await teamsService.getUserTeamHistory(req.user.id);
    res.json({ success: true, data: history });
  } catch (err) { next(err); }
});

// ─── GET /:id — Team detail with roster ─────────────────────────────────────
teamsRouter.get('/:id', async (req, res, next) => {
  try {
    const team = await teamsService.getTeamDetail(req.params.id);
    res.json({ success: true, data: team });
  } catch (err) { next(err); }
});

// ─── PATCH /:id — Update team details ───────────────────────────────────────
teamsRouter.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const data = TeamUpdateSchema.parse(req.body);
    const team = await teamsService.updateTeam(
      req.params.id, data, req.user.id,
      { role: req.user?.role, requestId: req.correlationId }
    );
    res.json({ success: true, data: team });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// ─── POST /:id/invite — Invite player to team ──────────────────────────────
teamsRouter.post('/:id/invite', authenticate, async (req, res, next) => {
  try {
    const data = TeamInviteSchema.parse(req.body);
    const invite = await teamsService.invitePlayer({
      teamId: req.params.id,
      inviterId: req.user.id,
      inviteeId: data.invitee_id,
      message: data.message,
      roleOffered: data.role_offered,
      actor: { role: req.user?.role, requestId: req.correlationId },
    });
    res.status(201).json({ success: true, data: invite });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// ─── POST /:id/leave — Leave team ───────────────────────────────────────────
teamsRouter.post('/:id/leave', authenticate, async (req, res, next) => {
  try {
    const result = await teamsService.leaveTeam(
      req.params.id, req.user.id,
      { role: req.user?.role, requestId: req.correlationId }
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── POST /:id/kick — Kick member from team ────────────────────────────────
teamsRouter.post('/:id/kick', authenticate, async (req, res, next) => {
  try {
    const data = KickMemberSchema.parse(req.body);
    const result = await teamsService.kickMember(
      req.params.id, data.user_id, data.reason, req.user.id,
      { role: req.user?.role, requestId: req.correlationId }
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// ─── PATCH /:id/members/:userId/role — Change member role ──────────────────
teamsRouter.patch('/:id/members/:userId/role', authenticate, async (req, res, next) => {
  try {
    const data = RoleChangeSchema.parse(req.body);
    const result = await teamsService.changeMemberRole(
      req.params.id, req.params.userId, data.new_role, req.user.id,
      { role: req.user?.role, requestId: req.correlationId }
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// ─── POST /:id/transfer-ownership — Transfer team ownership ────────────────
teamsRouter.post('/:id/transfer-ownership', authenticate, async (req, res, next) => {
  try {
    const data = OwnershipTransferSchema.parse(req.body);
    const result = await teamsService.transferOwnership(
      req.params.id, data.new_owner_id, req.user.id,
      { role: req.user?.role, requestId: req.correlationId }
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// ─── POST /:id/disband — Disband team ──────────────────────────────────────
teamsRouter.post('/:id/disband', authenticate, async (req, res, next) => {
  try {
    const result = await teamsService.disbandTeam(
      req.params.id, req.user.id, req.body.reason,
      { role: req.user?.role, requestId: req.correlationId }
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── GET /:id/transfer-log — Public transfer history ────────────────────────
teamsRouter.get('/:id/transfer-log', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const log = await teamsService.getTransferLog(req.params.id, { limit, offset });
    res.json({ success: true, data: log });
  } catch (err) { next(err); }
});

// ─── POST /:id/block — Block user from team ────────────────────────────────
teamsRouter.post('/:id/block', authenticate, async (req, res, next) => {
  try {
    const data = TeamBlockSchema.parse(req.body);
    const result = await teamsService.blockUser(
      req.params.id, data.user_id, data.reason, req.user.id,
      { role: req.user?.role, requestId: req.correlationId }
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// ─── DELETE /:id/block/:userId — Unblock user ──────────────────────────────
teamsRouter.delete('/:id/block/:userId', authenticate, async (req, res, next) => {
  try {
    const result = await teamsService.unblockUser(req.params.id, req.params.userId, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});
