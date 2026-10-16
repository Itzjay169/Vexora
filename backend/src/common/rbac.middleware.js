/**
 * Vexora RBAC Middleware — Phase 8
 *
 * Express middleware for enforcing the permission matrix.
 * Works with the existing `authenticate` middleware — must run AFTER it
 * so that `req.user` is populated.
 *
 * Design:
 *   - `requirePermission(permission)` — checks the matrix (deny-by-default)
 *   - `requireAnyPermission(...permissions)` — allows if the user has any one
 *   - `requireAllPermissions(...permissions)` — requires all listed permissions
 *   - `denyRoles(...roles)` — explicitly block specific roles (e.g. prevent PLAYER from /admin)
 *   - `adminGate` — composite guard that blocks non-admin roles entirely
 *
 * These are composable Express middleware factories:
 *   router.get('/endpoint', authenticate, requirePermission('admin:dashboard'), handler)
 *
 * PDF refs: Section 2, Section 47
 */

import { AppError } from './errorHandler.js';
import { hasPermission, isAdminRole, PERMISSIONS, ROLES } from './rbac.js';
import { appendAuditLog, hashIP } from './auditLog.js';
import { logger } from './logger.js';

/**
 * Load the user's effective roles from the database.
 * The JWT contains a single `role` field from the `users` table,
 * but Phase 8 RBAC uses the `user_roles` junction table for granular control.
 * Falls back to the JWT role if no DB roles are assigned.
 *
 * @param {import('express').Request} req
 */
async function resolveEffectiveRoles(req) {
  // If already resolved in this request lifecycle, skip
  if (req._rbacResolved) return;

  // Use the JWT-embedded role as the primary role
  // In future phases, this will query the user_roles table for multiple roles
  const roles = [];
  if (req.user && req.user.role) {
    roles.push(req.user.role);
  }

  // Check for break-glass elevation
  if (req._breakGlassElevation) {
    roles.push(...req._breakGlassElevation.elevatedRoles);
  }

  req.user.roles = roles;
  req._rbacResolved = true;
}

/**
 * Middleware: require a specific permission.
 * Deny-by-default — if the user's role doesn't have the permission, return 403.
 *
 * @param {string} permission - Permission key from PERMISSIONS enum
 * @returns {import('express').RequestHandler}
 */
export function requirePermission(permission) {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      }

      await resolveEffectiveRoles(req);

      // Check if any of the user's roles grant the permission
      const allowed = req.user.roles.some(role => hasPermission(role, permission));

      if (!allowed) {
        logger.warn('RBAC denied', {
          userId: req.user.id,
          roles: req.user.roles,
          requiredPermission: permission,
          path: req.originalUrl,
          method: req.method,
        });
        return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: require at least one of the listed permissions.
 *
 * @param  {...string} permissions
 * @returns {import('express').RequestHandler}
 */
export function requireAnyPermission(...permissions) {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      }

      await resolveEffectiveRoles(req);

      const allowed = permissions.some(perm =>
        req.user.roles.some(role => hasPermission(role, perm))
      );

      if (!allowed) {
        logger.warn('RBAC denied (any-of)', {
          userId: req.user.id,
          roles: req.user.roles,
          requiredPermissions: permissions,
          path: req.originalUrl,
        });
        return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: require ALL of the listed permissions.
 *
 * @param  {...string} permissions
 * @returns {import('express').RequestHandler}
 */
export function requireAllPermissions(...permissions) {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      }

      await resolveEffectiveRoles(req);

      const allowed = permissions.every(perm =>
        req.user.roles.some(role => hasPermission(role, perm))
      );

      if (!allowed) {
        logger.warn('RBAC denied (all-of)', {
          userId: req.user.id,
          roles: req.user.roles,
          requiredPermissions: permissions,
          path: req.originalUrl,
        });
        return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: explicitly deny access for specific roles.
 *
 * @param  {...string} blockedRoles
 * @returns {import('express').RequestHandler}
 */
export function denyRoles(...blockedRoles) {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      }

      await resolveEffectiveRoles(req);

      const blocked = req.user.roles.some(role => blockedRoles.includes(role));

      if (blocked) {
        logger.warn('RBAC role-deny', {
          userId: req.user.id,
          roles: req.user.roles,
          blockedRoles,
          path: req.originalUrl,
        });
        return next(new AppError('Access denied for your role', 403, 'ROLE_DENIED'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: admin gate — only roles with admin:dashboard access can proceed.
 * This is the primary guard for all /admin/* routes.
 * A normal user token must NEVER pass this gate (Security Gate requirement).
 */
export function adminGate(req, _res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
  }

  const role = req.user.role;

  if (!isAdminRole(role)) {
    logger.warn('Admin gate blocked', {
      userId: req.user.id,
      role,
      path: req.originalUrl,
      method: req.method,
    });
    return next(new AppError('Admin access required', 403, 'ADMIN_REQUIRED'));
  }

  next();
}

/**
 * Middleware: require MFA verification for the current session.
 * Used as step-up authentication for high-risk admin actions.
 *
 * @returns {import('express').RequestHandler}
 */
export function requireStepUpAuth(req, _res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
  }

  // Check if the token includes MFA verification claim
  // In production, this would verify a recent MFA challenge
  const mfaVerified = req.user.mfa_verified || req.headers['x-mfa-token'];

  if (!mfaVerified) {
    return next(new AppError(
      'Step-up authentication required. Please complete MFA verification.',
      403,
      'STEP_UP_AUTH_REQUIRED'
    ));
  }

  next();
}

// Re-export for convenience
export { PERMISSIONS, ROLES };
