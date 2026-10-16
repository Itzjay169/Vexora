/**
 * Vexora RBAC Permission Matrix — Phase 8
 *
 * This module defines the COMPLETE permission matrix as code.
 * It is the single source of truth for all role-based access decisions.
 *
 * Design principles:
 *   - DENY BY DEFAULT: if a permission isn't listed, it's denied
 *   - Resource ownership is checked separately (see resourceAuth.js)
 *   - Break-glass access temporarily elevates permissions (see breakGlass.js)
 *   - Maker-checker is orthogonal to RBAC (see makerChecker.js)
 *
 * PDF refs: Section 2 (Permission Matrix), Section 47 (Security)
 */

// ─── System Roles ───────────────────────────────────────────────────────────
export const ROLES = Object.freeze({
  PLAYER:        'PLAYER',
  TEAM_CAPTAIN:  'TEAM_CAPTAIN',
  ORGANISER:     'ORGANISER',
  MODERATOR:     'MODERATOR',
  FINANCE:       'FINANCE',
  ADMIN:         'ADMIN',
  SUPER_ADMIN:   'SUPER_ADMIN',
  SUPPORT_AGENT: 'SUPPORT_AGENT',
  AUDITOR:       'AUDITOR',
});

// ─── All Permissions (module:action format) ─────────────────────────────────
export const PERMISSIONS = Object.freeze({
  // Auth module
  AUTH_LOGIN:             'auth:login',
  AUTH_MFA_MANAGE:        'auth:mfa_manage',
  AUTH_SESSION_LIST:      'auth:session_list',
  AUTH_SESSION_REVOKE:    'auth:session_revoke',

  // Users module
  USERS_VIEW_OWN:        'users:view_own',
  USERS_EDIT_OWN:        'users:edit_own',
  USERS_VIEW_ANY:        'users:view_any',
  USERS_EDIT_ANY:        'users:edit_any',
  USERS_BAN:             'users:ban',
  USERS_DELETE:          'users:delete',

  // Games module
  GAMES_VIEW:            'games:view',
  GAMES_CREATE:          'games:create',
  GAMES_EDIT:            'games:edit',
  GAMES_DELETE:          'games:delete',
  GAMES_SCORING_MANAGE:  'games:scoring_manage',

  // Teams module
  TEAMS_VIEW:            'teams:view',
  TEAMS_CREATE:          'teams:create',
  TEAMS_EDIT_OWN:        'teams:edit_own',
  TEAMS_MANAGE_ROSTER:   'teams:manage_roster',
  TEAMS_EDIT_ANY:        'teams:edit_any',

  // Tournaments module
  TOURNAMENTS_VIEW:      'tournaments:view',
  TOURNAMENTS_CREATE:    'tournaments:create',
  TOURNAMENTS_EDIT_OWN:  'tournaments:edit_own',
  TOURNAMENTS_PUBLISH:   'tournaments:publish',
  TOURNAMENTS_APPROVE:   'tournaments:approve',
  TOURNAMENTS_REGISTER:  'tournaments:register',
  TOURNAMENTS_CANCEL:    'tournaments:cancel',
  TOURNAMENTS_EDIT_ANY:  'tournaments:edit_any',

  // Matches module
  MATCHES_VIEW:          'matches:view',
  MATCHES_SUBMIT_RESULT: 'matches:submit_result',
  MATCHES_VERIFY_RESULT: 'matches:verify_result',
  MATCHES_MANAGE_LOBBY:  'matches:manage_lobby',
  MATCHES_OVERRIDE:      'matches:override',

  // Scoring module
  SCORING_VIEW:          'scoring:view',
  SCORING_SIMULATE:      'scoring:simulate',

  // Leaderboards
  LEADERBOARDS_VIEW:     'leaderboards:view',

  // Wallet module
  WALLET_VIEW_OWN:       'wallet:view_own',
  WALLET_DEPOSIT:        'wallet:deposit',
  WALLET_VIEW_ANY:       'wallet:view_any',
  WALLET_ADJUSTMENT:     'wallet:adjustment',

  // Redeem module
  REDEEM_USE:            'redeem:use',
  REDEEM_CREATE_BATCH:   'redeem:create_batch',
  REDEEM_MANAGE:         'redeem:manage',

  // Payouts module
  PAYOUTS_REQUEST:       'payouts:request',
  PAYOUTS_APPROVE:       'payouts:approve',
  PAYOUTS_VIEW_ALL:      'payouts:view_all',

  // Disputes module
  DISPUTES_CREATE:       'disputes:create',
  DISPUTES_VIEW_OWN:     'disputes:view_own',
  DISPUTES_RESOLVE:      'disputes:resolve',
  DISPUTES_VIEW_ALL:     'disputes:view_all',

  // Moderation module
  MODERATION_VIEW:       'moderation:view',
  MODERATION_SANCTION:   'moderation:sanction',
  MODERATION_APPEAL:     'moderation:appeal',

  // Notifications module
  NOTIFICATIONS_VIEW_OWN:  'notifications:view_own',
  NOTIFICATIONS_SEND:      'notifications:send',
  NOTIFICATIONS_MANAGE:    'notifications:manage',

  // Admin module
  ADMIN_DASHBOARD:       'admin:dashboard',
  ADMIN_USERS:           'admin:users',
  ADMIN_SYSTEM:          'admin:system',
  ADMIN_FEATURE_FLAGS:   'admin:feature_flags',

  // Audit module
  AUDIT_READ:            'audit:read',
  AUDIT_VERIFY:          'audit:verify',

  // Support module
  SUPPORT_CREATE_TICKET: 'support:create_ticket',
  SUPPORT_VIEW_OWN:      'support:view_own',
  SUPPORT_MANAGE:        'support:manage',

  // Achievements module
  ACHIEVEMENTS_VIEW:     'achievements:view',
  ACHIEVEMENTS_MANAGE:   'achievements:manage',

  // Risk module
  RISK_VIEW:             'risk:view',
  RISK_MANAGE:           'risk:manage',

  // Webhooks module
  WEBHOOKS_VIEW:         'webhooks:view',
  WEBHOOKS_MANAGE:       'webhooks:manage',

  // Organiser module
  ORGANISERS_APPLY:        'organisers:apply',
  ORGANISERS_VIEW_OWN:     'organisers:view_own',
  ORGANISERS_VIEW_ANY:     'organisers:view_any',
  ORGANISERS_APPROVE:      'organisers:approve',
  ORGANISERS_MANAGE_TIERS: 'organisers:manage_tiers',

  // Break-glass
  BREAK_GLASS_REQUEST:   'break_glass:request',
  BREAK_GLASS_APPROVE:   'break_glass:approve',
});

// ─── Permission Matrix: Role → Set of Permissions ───────────────────────────
// This is the authoritative source for all RBAC decisions.

const ROLE_PERMISSIONS = Object.freeze({
  // ─── Player: own data, participate in tournaments ─────────────────
  [ROLES.PLAYER]: new Set([
    PERMISSIONS.AUTH_LOGIN,
    PERMISSIONS.AUTH_MFA_MANAGE,
    PERMISSIONS.AUTH_SESSION_LIST,
    PERMISSIONS.AUTH_SESSION_REVOKE,
    PERMISSIONS.USERS_VIEW_OWN,
    PERMISSIONS.USERS_EDIT_OWN,
    PERMISSIONS.GAMES_VIEW,
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_CREATE,
    PERMISSIONS.TEAMS_EDIT_OWN,
    PERMISSIONS.TOURNAMENTS_VIEW,
    PERMISSIONS.TOURNAMENTS_REGISTER,
    PERMISSIONS.MATCHES_VIEW,
    PERMISSIONS.MATCHES_SUBMIT_RESULT,
    PERMISSIONS.SCORING_VIEW,
    PERMISSIONS.LEADERBOARDS_VIEW,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.WALLET_DEPOSIT,
    PERMISSIONS.REDEEM_USE,
    PERMISSIONS.PAYOUTS_REQUEST,
    PERMISSIONS.DISPUTES_CREATE,
    PERMISSIONS.DISPUTES_VIEW_OWN,
    PERMISSIONS.NOTIFICATIONS_VIEW_OWN,
    PERMISSIONS.SUPPORT_CREATE_TICKET,
    PERMISSIONS.SUPPORT_VIEW_OWN,
    PERMISSIONS.ACHIEVEMENTS_VIEW,
    PERMISSIONS.ORGANISERS_APPLY,
  ]),

  // ─── Team Captain: Player permissions + roster management ─────────
  [ROLES.TEAM_CAPTAIN]: new Set([
    PERMISSIONS.AUTH_LOGIN,
    PERMISSIONS.AUTH_MFA_MANAGE,
    PERMISSIONS.AUTH_SESSION_LIST,
    PERMISSIONS.AUTH_SESSION_REVOKE,
    PERMISSIONS.USERS_VIEW_OWN,
    PERMISSIONS.USERS_EDIT_OWN,
    PERMISSIONS.GAMES_VIEW,
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_CREATE,
    PERMISSIONS.TEAMS_EDIT_OWN,
    PERMISSIONS.TEAMS_MANAGE_ROSTER,
    PERMISSIONS.TOURNAMENTS_VIEW,
    PERMISSIONS.TOURNAMENTS_REGISTER,
    PERMISSIONS.MATCHES_VIEW,
    PERMISSIONS.MATCHES_SUBMIT_RESULT,
    PERMISSIONS.SCORING_VIEW,
    PERMISSIONS.LEADERBOARDS_VIEW,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.WALLET_DEPOSIT,
    PERMISSIONS.REDEEM_USE,
    PERMISSIONS.PAYOUTS_REQUEST,
    PERMISSIONS.DISPUTES_CREATE,
    PERMISSIONS.DISPUTES_VIEW_OWN,
    PERMISSIONS.NOTIFICATIONS_VIEW_OWN,
    PERMISSIONS.SUPPORT_CREATE_TICKET,
    PERMISSIONS.SUPPORT_VIEW_OWN,
    PERMISSIONS.ACHIEVEMENTS_VIEW,
    PERMISSIONS.ORGANISERS_APPLY,
  ]),

  // ─── Organiser: own tournaments, lobbies, announcements ───────────
  [ROLES.ORGANISER]: new Set([
    PERMISSIONS.AUTH_LOGIN,
    PERMISSIONS.AUTH_MFA_MANAGE,
    PERMISSIONS.AUTH_SESSION_LIST,
    PERMISSIONS.AUTH_SESSION_REVOKE,
    PERMISSIONS.USERS_VIEW_OWN,
    PERMISSIONS.USERS_EDIT_OWN,
    PERMISSIONS.GAMES_VIEW,
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TOURNAMENTS_VIEW,
    PERMISSIONS.TOURNAMENTS_CREATE,
    PERMISSIONS.TOURNAMENTS_EDIT_OWN,
    PERMISSIONS.TOURNAMENTS_PUBLISH,
    PERMISSIONS.TOURNAMENTS_CANCEL,
    PERMISSIONS.MATCHES_VIEW,
    PERMISSIONS.MATCHES_SUBMIT_RESULT,
    PERMISSIONS.MATCHES_VERIFY_RESULT,
    PERMISSIONS.MATCHES_MANAGE_LOBBY,
    PERMISSIONS.SCORING_VIEW,
    PERMISSIONS.SCORING_SIMULATE,
    PERMISSIONS.LEADERBOARDS_VIEW,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.WALLET_DEPOSIT,
    PERMISSIONS.REDEEM_USE,
    PERMISSIONS.PAYOUTS_REQUEST,
    PERMISSIONS.DISPUTES_CREATE,
    PERMISSIONS.DISPUTES_VIEW_OWN,
    PERMISSIONS.NOTIFICATIONS_VIEW_OWN,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.SUPPORT_CREATE_TICKET,
    PERMISSIONS.SUPPORT_VIEW_OWN,
    PERMISSIONS.ACHIEVEMENTS_VIEW,
    PERMISSIONS.ORGANISERS_VIEW_OWN,
  ]),

  // ─── Moderator: disputes, reports, sanctions (no finance, no KYC) ─
  [ROLES.MODERATOR]: new Set([
    PERMISSIONS.AUTH_LOGIN,
    PERMISSIONS.AUTH_MFA_MANAGE,
    PERMISSIONS.AUTH_SESSION_LIST,
    PERMISSIONS.AUTH_SESSION_REVOKE,
    PERMISSIONS.USERS_VIEW_OWN,
    PERMISSIONS.USERS_VIEW_ANY,
    PERMISSIONS.GAMES_VIEW,
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TOURNAMENTS_VIEW,
    PERMISSIONS.MATCHES_VIEW,
    PERMISSIONS.MATCHES_VERIFY_RESULT,
    PERMISSIONS.MATCHES_OVERRIDE,
    PERMISSIONS.SCORING_VIEW,
    PERMISSIONS.LEADERBOARDS_VIEW,
    PERMISSIONS.DISPUTES_VIEW_ALL,
    PERMISSIONS.DISPUTES_RESOLVE,
    PERMISSIONS.MODERATION_VIEW,
    PERMISSIONS.MODERATION_SANCTION,
    PERMISSIONS.MODERATION_APPEAL,
    PERMISSIONS.NOTIFICATIONS_VIEW_OWN,
    PERMISSIONS.SUPPORT_VIEW_OWN,
    PERMISSIONS.ACHIEVEMENTS_VIEW,
    PERMISSIONS.RISK_VIEW,
    PERMISSIONS.AUDIT_READ,
  ]),

  // ─── Finance/Admin: wallet, payouts, reconciliation ───────────────
  [ROLES.FINANCE]: new Set([
    PERMISSIONS.AUTH_LOGIN,
    PERMISSIONS.AUTH_MFA_MANAGE,
    PERMISSIONS.AUTH_SESSION_LIST,
    PERMISSIONS.AUTH_SESSION_REVOKE,
    PERMISSIONS.USERS_VIEW_OWN,
    PERMISSIONS.USERS_VIEW_ANY,
    PERMISSIONS.GAMES_VIEW,
    PERMISSIONS.TOURNAMENTS_VIEW,
    PERMISSIONS.MATCHES_VIEW,
    PERMISSIONS.SCORING_VIEW,
    PERMISSIONS.LEADERBOARDS_VIEW,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.WALLET_VIEW_ANY,
    PERMISSIONS.WALLET_ADJUSTMENT,
    PERMISSIONS.REDEEM_CREATE_BATCH,
    PERMISSIONS.REDEEM_MANAGE,
    PERMISSIONS.PAYOUTS_VIEW_ALL,
    PERMISSIONS.PAYOUTS_APPROVE,
    PERMISSIONS.NOTIFICATIONS_VIEW_OWN,
    PERMISSIONS.SUPPORT_VIEW_OWN,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.ADMIN_DASHBOARD,
  ]),

  // ─── Admin: platform ops, tournament approval, user moderation ────
  [ROLES.ADMIN]: new Set([
    PERMISSIONS.AUTH_LOGIN,
    PERMISSIONS.AUTH_MFA_MANAGE,
    PERMISSIONS.AUTH_SESSION_LIST,
    PERMISSIONS.AUTH_SESSION_REVOKE,
    PERMISSIONS.USERS_VIEW_OWN,
    PERMISSIONS.USERS_VIEW_ANY,
    PERMISSIONS.USERS_EDIT_ANY,
    PERMISSIONS.USERS_BAN,
    PERMISSIONS.GAMES_VIEW,
    PERMISSIONS.GAMES_CREATE,
    PERMISSIONS.GAMES_EDIT,
    PERMISSIONS.GAMES_SCORING_MANAGE,
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_EDIT_ANY,
    PERMISSIONS.TOURNAMENTS_VIEW,
    PERMISSIONS.TOURNAMENTS_APPROVE,
    PERMISSIONS.TOURNAMENTS_EDIT_ANY,
    PERMISSIONS.TOURNAMENTS_CANCEL,
    PERMISSIONS.MATCHES_VIEW,
    PERMISSIONS.MATCHES_VERIFY_RESULT,
    PERMISSIONS.MATCHES_OVERRIDE,
    PERMISSIONS.SCORING_VIEW,
    PERMISSIONS.SCORING_SIMULATE,
    PERMISSIONS.LEADERBOARDS_VIEW,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.WALLET_VIEW_ANY,
    PERMISSIONS.REDEEM_MANAGE,
    PERMISSIONS.PAYOUTS_VIEW_ALL,
    PERMISSIONS.DISPUTES_VIEW_ALL,
    PERMISSIONS.DISPUTES_RESOLVE,
    PERMISSIONS.MODERATION_VIEW,
    PERMISSIONS.MODERATION_SANCTION,
    PERMISSIONS.MODERATION_APPEAL,
    PERMISSIONS.NOTIFICATIONS_VIEW_OWN,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.NOTIFICATIONS_MANAGE,
    PERMISSIONS.ADMIN_DASHBOARD,
    PERMISSIONS.ADMIN_USERS,
    PERMISSIONS.ADMIN_FEATURE_FLAGS,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.ACHIEVEMENTS_VIEW,
    PERMISSIONS.ACHIEVEMENTS_MANAGE,
    PERMISSIONS.RISK_VIEW,
    PERMISSIONS.RISK_MANAGE,
    PERMISSIONS.WEBHOOKS_VIEW,
    PERMISSIONS.ORGANISERS_VIEW_ANY,
    PERMISSIONS.ORGANISERS_APPROVE,
    PERMISSIONS.ORGANISERS_MANAGE_TIERS,
  ]),

  // ─── Super Admin: FULL access (all permissions) ───────────────────
  [ROLES.SUPER_ADMIN]: new Set([
    ...Object.values(PERMISSIONS),
  ]),

  // ─── Support Agent: tickets, limited user context ─────────────────
  [ROLES.SUPPORT_AGENT]: new Set([
    PERMISSIONS.AUTH_LOGIN,
    PERMISSIONS.AUTH_MFA_MANAGE,
    PERMISSIONS.AUTH_SESSION_LIST,
    PERMISSIONS.AUTH_SESSION_REVOKE,
    PERMISSIONS.USERS_VIEW_OWN,
    PERMISSIONS.USERS_VIEW_ANY,
    PERMISSIONS.GAMES_VIEW,
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TOURNAMENTS_VIEW,
    PERMISSIONS.MATCHES_VIEW,
    PERMISSIONS.SCORING_VIEW,
    PERMISSIONS.LEADERBOARDS_VIEW,
    PERMISSIONS.DISPUTES_VIEW_ALL,
    PERMISSIONS.NOTIFICATIONS_VIEW_OWN,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.SUPPORT_VIEW_OWN,
    PERMISSIONS.ACHIEVEMENTS_VIEW,
  ]),

  // ─── Auditor: read-only audit logs and financial ledger ───────────
  [ROLES.AUDITOR]: new Set([
    PERMISSIONS.AUTH_LOGIN,
    PERMISSIONS.AUTH_MFA_MANAGE,
    PERMISSIONS.AUTH_SESSION_LIST,
    PERMISSIONS.AUTH_SESSION_REVOKE,
    PERMISSIONS.USERS_VIEW_OWN,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.AUDIT_VERIFY,
    PERMISSIONS.WALLET_VIEW_ANY,
    PERMISSIONS.PAYOUTS_VIEW_ALL,
    PERMISSIONS.LEADERBOARDS_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW_OWN,
  ]),
});

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check if a role has a specific permission.
 * DENY BY DEFAULT: returns false for any unknown role or permission.
 *
 * @param {string} role - The role to check
 * @param {string} permission - The permission to check
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms) return false;
  return rolePerms.has(permission);
}

/**
 * Get all permissions for a given role.
 *
 * @param {string} role
 * @returns {string[]}
 */
export function getPermissionsForRole(role) {
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms) return [];
  return [...rolePerms];
}

/**
 * Get all roles that have a specific permission.
 *
 * @param {string} permission
 * @returns {string[]}
 */
export function getRolesWithPermission(permission) {
  return Object.entries(ROLE_PERMISSIONS)
    .filter(([, perms]) => perms.has(permission))
    .map(([role]) => role);
}

/**
 * Check if a role is an admin-level role (can access /admin/* routes).
 *
 * @param {string} role
 * @returns {boolean}
 */
export function isAdminRole(role) {
  return hasPermission(role, PERMISSIONS.ADMIN_DASHBOARD);
}

/**
 * Get the full permission matrix as a serializable object (for tests/exports).
 *
 * @returns {Object.<string, string[]>}
 */
export function getPermissionMatrix() {
  const matrix = {};
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    matrix[role] = [...perms].sort();
  }
  return matrix;
}

/**
 * List all defined roles.
 * @returns {string[]}
 */
export function getAllRoles() {
  return Object.values(ROLES);
}

/**
 * List all defined permissions.
 * @returns {string[]}
 */
export function getAllPermissions() {
  return Object.values(PERMISSIONS);
}
