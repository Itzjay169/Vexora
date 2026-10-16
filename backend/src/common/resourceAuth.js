/**
 * Vexora Resource-Level Authorization — Phase 8
 *
 * Prevents IDOR (Insecure Direct Object Reference) attacks by verifying
 * that the authenticated user actually owns or has legitimate access to
 * the resource they are trying to access or modify.
 *
 * This module is SEPARATE from RBAC (which checks role/permission).
 * Resource auth answers: "Does this user own THIS specific resource?"
 *
 * Design:
 *   - Each checker queries the DB to verify ownership
 *   - Returns 404 (not 403) for resources the user can't see — prevents enumeration
 *   - Admin/SuperAdmin roles bypass ownership checks (view_any/edit_any permissions)
 *   - Organiser access is scoped to their own tournaments and matches
 *
 * PDF refs: Section 2 (IDOR prevention), Section 47 (resource-level checks)
 */

import { query } from './database.js';
import { AppError } from './errorHandler.js';
import { hasPermission, PERMISSIONS } from './rbac.js';
import { logger } from './logger.js';

/**
 * Check if the user has "view/edit any" permission for a given module,
 * which bypasses the ownership check.
 *
 * @param {string} role
 * @param {string} viewAnyPermission
 * @returns {boolean}
 */
function canAccessAny(role, viewAnyPermission) {
  return hasPermission(role, viewAnyPermission);
}

/**
 * Middleware factory: verify that the user owns the resource identified
 * by `req.params[paramName]`.
 *
 * @param {Object} opts
 * @param {string} opts.table - Table name to query
 * @param {string} opts.ownerColumn - Column that stores the owner user ID
 * @param {string} [opts.paramName='id'] - Route parameter name for the resource ID
 * @param {string} [opts.bypassPermission] - Permission that bypasses the ownership check
 * @param {string} [opts.resourceName] - Human-readable name for error messages
 * @returns {import('express').RequestHandler}
 */
export function requireOwnership({
  table,
  ownerColumn,
  paramName = 'id',
  bypassPermission = null,
  resourceName = 'resource',
}) {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      }

      const resourceId = req.params[paramName];
      if (!resourceId) {
        return next(new AppError(`${resourceName} ID required`, 400, 'RESOURCE_ID_REQUIRED'));
      }

      // Admin bypass: if the user has the bypass permission, skip ownership check
      if (bypassPermission && canAccessAny(req.user.role, bypassPermission)) {
        return next();
      }

      // Query the resource to verify ownership
      const result = await query(
        `SELECT ${ownerColumn} FROM ${table} WHERE id = $1`,
        [resourceId]
      );

      if (result.rows.length === 0) {
        // Return 404 (not 403) to prevent resource enumeration
        return next(new AppError(`${resourceName} not found`, 404, 'RESOURCE_NOT_FOUND'));
      }

      const ownerId = result.rows[0][ownerColumn];

      if (ownerId !== req.user.id) {
        logger.warn('Resource ownership check failed', {
          userId: req.user.id,
          role: req.user.role,
          resourceTable: table,
          resourceId,
          ownerId,
          path: req.originalUrl,
        });
        // Still return 404 to prevent enumeration
        return next(new AppError(`${resourceName} not found`, 404, 'RESOURCE_NOT_FOUND'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// ─── Pre-configured Ownership Guards ────────────────────────────────────────

/**
 * Verify the user owns the tournament (organiser_id = req.user.id).
 * Admins with TOURNAMENTS_EDIT_ANY bypass the check.
 */
export const requireTournamentOwnership = requireOwnership({
  table: 'tournaments',
  ownerColumn: 'organiser_id',
  paramName: 'id',
  bypassPermission: PERMISSIONS.TOURNAMENTS_EDIT_ANY,
  resourceName: 'Tournament',
});

/**
 * Verify the user is captain of the team (captain_id = req.user.id).
 * Admins with TEAMS_EDIT_ANY bypass the check.
 */
export const requireTeamOwnership = requireOwnership({
  table: 'teams',
  ownerColumn: 'captain_id',
  paramName: 'id',
  bypassPermission: PERMISSIONS.TEAMS_EDIT_ANY,
  resourceName: 'Team',
});

/**
 * Verify the user owns the wallet account (owner_id = req.user.id).
 * Finance admins with WALLET_VIEW_ANY bypass the check.
 */
export const requireWalletOwnership = requireOwnership({
  table: 'wallet_accounts',
  ownerColumn: 'owner_id',
  paramName: 'id',
  bypassPermission: PERMISSIONS.WALLET_VIEW_ANY,
  resourceName: 'Wallet',
});

/**
 * Verify the user owns the support ticket (user_id = req.user.id).
 * Support agents with SUPPORT_MANAGE bypass the check.
 */
export const requireTicketOwnership = requireOwnership({
  table: 'support_tickets',
  ownerColumn: 'user_id',
  paramName: 'id',
  bypassPermission: PERMISSIONS.SUPPORT_MANAGE,
  resourceName: 'Support ticket',
});

/**
 * Verify the user raised the dispute (raised_by = req.user.id).
 * Moderators with DISPUTES_RESOLVE bypass the check.
 */
export const requireDisputeOwnership = requireOwnership({
  table: 'disputes',
  ownerColumn: 'raised_by',
  paramName: 'id',
  bypassPermission: PERMISSIONS.DISPUTES_RESOLVE,
  resourceName: 'Dispute',
});

/**
 * Verify the user owns the organiser profile (user_id = req.user.id).
 * Admins with ORGANISERS_VIEW_ANY bypass the check.
 */
export const requireOrganiserOwnership = requireOwnership({
  table: 'organiser_profiles',
  ownerColumn: 'user_id',
  paramName: 'id',
  bypassPermission: PERMISSIONS.ORGANISERS_VIEW_ANY,
  resourceName: 'Organiser profile',
});

/**
 * Middleware: verify the user owns a payout request.
 * Finance admins with PAYOUTS_VIEW_ALL bypass the check.
 */
export const requirePayoutOwnership = requireOwnership({
  table: 'payout_requests',
  ownerColumn: 'user_id',
  paramName: 'id',
  bypassPermission: PERMISSIONS.PAYOUTS_VIEW_ALL,
  resourceName: 'Payout request',
});

/**
 * Middleware factory: verify the user is a participant in a match.
 * Checks tournament_registrations to verify user involvement.
 *
 * @param {string} [paramName='id'] - Route parameter for match ID
 * @returns {import('express').RequestHandler}
 */
export function requireMatchParticipation(paramName = 'id') {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      }

      // Admins, moderators, and organisers can access any match
      if (hasPermission(req.user.role, PERMISSIONS.MATCHES_OVERRIDE) ||
          hasPermission(req.user.role, PERMISSIONS.MATCHES_MANAGE_LOBBY)) {
        return next();
      }

      const matchId = req.params[paramName];
      if (!matchId) {
        return next(new AppError('Match ID required', 400, 'RESOURCE_ID_REQUIRED'));
      }

      // Check if the user is a participant in this match through registrations
      const result = await query(
        `SELECT 1 FROM match_participants mp
         JOIN tournament_registrations tr ON mp.registration_id = tr.id
         WHERE mp.match_id = $1
           AND (tr.user_id = $2 OR tr.team_id IN (
             SELECT team_id FROM team_members WHERE user_id = $2 AND left_at IS NULL
           ))
         LIMIT 1`,
        [matchId, req.user.id]
      );

      if (result.rows.length === 0) {
        return next(new AppError('Match not found', 404, 'RESOURCE_NOT_FOUND'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: ensure the requested user profile belongs to the authenticated user,
 * unless the requester has users:view_any permission.
 */
export function requireSelfOrViewAny(paramName = 'id') {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      }

      const targetUserId = req.params[paramName];

      // If viewing own data, allow
      if (targetUserId === req.user.id) {
        return next();
      }

      // Otherwise, need view_any permission
      if (canAccessAny(req.user.role, PERMISSIONS.USERS_VIEW_ANY)) {
        return next();
      }

      return next(new AppError('User not found', 404, 'RESOURCE_NOT_FOUND'));
    } catch (err) {
      next(err);
    }
  };
}
