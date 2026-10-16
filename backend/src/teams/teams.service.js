import { query } from '../common/database.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/errorHandler.js';

/**
 * Vexora Teams, Rosters & Transfer Log Service — Phase 13
 *
 * Implements:
 *   - Team CRUD with name/tag uniqueness per game
 *   - Role hierarchy: OWNER > CAPTAIN > MANAGER > PLAYER > SUBSTITUTE
 *   - Roster size limits and capacity enforcement
 *   - Invite/Accept/Leave with consent-based membership (no forced adds)
 *   - Duplicate identity checks (one team per game per player)
 *   - Transfer window rules and public append-only transfer log
 *   - Invite spam rate limiting and block list
 *   - Team history tracking
 */

// ─── Role Hierarchy ─────────────────────────────────────────────────────────

const ROLE_HIERARCHY = Object.freeze({
  OWNER: 5,
  CAPTAIN: 4,
  MANAGER: 3,
  PLAYER: 2,
  SUBSTITUTE: 1,
});

/** Check if a role has management privileges (can edit roster). */
export function canManageRoster(role) {
  return ['OWNER', 'CAPTAIN', 'MANAGER'].includes(role);
}

/** Check if role A outranks role B. */
function outranks(roleA, roleB) {
  return (ROLE_HIERARCHY[roleA] || 0) > (ROLE_HIERARCHY[roleB] || 0);
}

// ─── Team CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a new team. Creator becomes OWNER automatically.
 */
export async function createTeam({ name, tag, gameId, description, region, logoUrl, maxRosterSize, minRosterSize, socialLinks, userId, actor = {} }) {
  // 1. Verify game exists
  const gameResult = await query('SELECT id, name, slug, status FROM games WHERE id = $1', [gameId]);
  if (gameResult.rows.length === 0) throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  if (gameResult.rows[0].status === 'DEPRECATED') throw new AppError('Cannot create team for deprecated game', 400, 'GAME_DEPRECATED');

  // 2. Check user isn't already in an active team for this game
  const existingTeam = await query(
    `SELECT t.id, t.name FROM team_members tm
     JOIN teams t ON tm.team_id = t.id
     WHERE tm.user_id = $1 AND t.game_id = $2 AND tm.left_at IS NULL AND t.is_active = TRUE`,
    [userId, gameId]
  );
  if (existingTeam.rows.length > 0) {
    throw new AppError(
      `You are already a member of team "${existingTeam.rows[0].name}" for this game. Leave that team first.`,
      409,
      'ALREADY_IN_TEAM_FOR_GAME'
    );
  }

  // 3. Create team
  const teamResult = await query(
    `INSERT INTO teams (name, tag, game_id, captain_id, description, region, logo_url, max_roster_size, min_roster_size, social_links)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [name, tag, gameId, userId, description || null, region || null, logoUrl || null,
     maxRosterSize || 10, minRosterSize || 1, JSON.stringify(socialLinks || {})]
  );
  const team = teamResult.rows[0];

  // 4. Add creator as OWNER
  await query(
    `INSERT INTO team_members (team_id, user_id, role, joined_reason) VALUES ($1, $2, 'OWNER', 'CREATED')`,
    [team.id, userId]
  );

  // 5. Record in transfer log
  await recordTransferLog({
    teamId: team.id, userId, action: 'TEAM_CREATED',
    toRole: 'OWNER', reason: 'Team created', performedBy: userId,
  });

  // 6. Audit log
  await appendAuditLog({
    actorId: userId, actorRole: actor.role || 'PLAYER',
    action: 'teams:create', entityType: 'TEAM', entityId: team.id,
    afterState: { name: team.name, tag: team.tag, game_id: gameId },
    reason: 'Team created', requestId: actor.requestId,
  });

  return team;
}

/**
 * Get team details with current active roster.
 */
export async function getTeamDetail(teamId) {
  const teamResult = await query(
    `SELECT t.*, g.name as game_name, g.slug as game_slug,
            u.username as captain_username, u.display_name as captain_display_name
     FROM teams t
     JOIN games g ON t.game_id = g.id
     JOIN users u ON t.captain_id = u.id
     WHERE t.id = $1`,
    [teamId]
  );
  if (teamResult.rows.length === 0) throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
  const team = teamResult.rows[0];

  // Active roster
  const membersResult = await query(
    `SELECT tm.id as membership_id, tm.user_id, tm.role, tm.jersey_number,
            tm.joined_at, tm.joined_reason,
            u.username, u.display_name, u.avatar_url
     FROM team_members tm
     JOIN users u ON tm.user_id = u.id
     WHERE tm.team_id = $1 AND tm.left_at IS NULL
     ORDER BY
       CASE tm.role
         WHEN 'OWNER' THEN 1 WHEN 'CAPTAIN' THEN 2 WHEN 'MANAGER' THEN 3
         WHEN 'PLAYER' THEN 4 WHEN 'SUBSTITUTE' THEN 5 ELSE 6
       END, tm.joined_at ASC`,
    [teamId]
  );

  return { ...team, members: membersResult.rows, roster_count: membersResult.rows.length };
}

/**
 * Update team details. Only OWNER or CAPTAIN can update.
 */
export async function updateTeam(teamId, updates, userId, actor = {}) {
  await assertTeamRole(teamId, userId, ['OWNER', 'CAPTAIN']);

  const fields = [];
  const values = [];
  const allowed = ['name', 'tag', 'description', 'region', 'logo_url', 'max_roster_size', 'min_roster_size', 'social_links', 'transfer_window_open'];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      values.push(key === 'social_links' ? JSON.stringify(updates[key]) : updates[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (fields.length === 0) throw new AppError('No fields to update', 400, 'NO_UPDATE_FIELDS');

  values.push(teamId);
  fields.push('updated_at = NOW()');

  const result = await query(
    `UPDATE teams SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );

  await appendAuditLog({
    actorId: userId, actorRole: actor.role || 'PLAYER',
    action: 'teams:update', entityType: 'TEAM', entityId: teamId,
    payload: { updatedFields: Object.keys(updates) },
    reason: 'Team details updated', requestId: actor.requestId,
  });

  return result.rows[0];
}

// ─── Invite System ──────────────────────────────────────────────────────────

/** Max pending invites per team to prevent spam. */
const MAX_PENDING_INVITES_PER_TEAM = 20;
/** Max invites a single user can send per hour. */
const MAX_INVITES_PER_USER_PER_HOUR = 10;

/**
 * Invite a player to join the team.
 * Only OWNER, CAPTAIN, or MANAGER can send invites.
 * Consent-based: user must accept to join.
 */
export async function invitePlayer({ teamId, inviterId, inviteeId, message, roleOffered = 'PLAYER', actor = {} }) {
  // 1. Verify inviter has management privileges
  await assertTeamRole(teamId, inviterId, ['OWNER', 'CAPTAIN', 'MANAGER']);

  // 2. Verify team exists and is active
  const teamResult = await query('SELECT * FROM teams WHERE id = $1 AND is_active = TRUE', [teamId]);
  if (teamResult.rows.length === 0) throw new AppError('Team not found or disbanded', 404, 'TEAM_NOT_FOUND');
  const team = teamResult.rows[0];

  // 3. Check if invitee is blocked
  const blockResult = await query(
    'SELECT id FROM team_blocks WHERE team_id = $1 AND blocked_user_id = $2',
    [teamId, inviteeId]
  );
  if (blockResult.rows.length > 0) {
    throw new AppError('This user is blocked from this team', 403, 'USER_BLOCKED');
  }

  // 4. Check if invitee exists
  const inviteeResult = await query('SELECT id, username FROM users WHERE id = $1 AND status = \'ACTIVE\'', [inviteeId]);
  if (inviteeResult.rows.length === 0) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  // 5. Check invitee isn't already a member
  const existingMember = await query(
    'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL',
    [teamId, inviteeId]
  );
  if (existingMember.rows.length > 0) {
    throw new AppError('User is already a team member', 409, 'ALREADY_MEMBER');
  }

  // 6. Check duplicate identity: invitee must not be in another team for same game
  const duplicateTeam = await query(
    `SELECT t.name FROM team_members tm
     JOIN teams t ON tm.team_id = t.id
     WHERE tm.user_id = $1 AND t.game_id = $2 AND tm.left_at IS NULL AND t.is_active = TRUE`,
    [inviteeId, team.game_id]
  );
  if (duplicateTeam.rows.length > 0) {
    throw new AppError(
      `Player is already in team "${duplicateTeam.rows[0].name}" for this game`,
      409,
      'PLAYER_IN_ANOTHER_TEAM'
    );
  }

  // 7. Check roster capacity
  const rosterCount = await query(
    'SELECT COUNT(*) as cnt FROM team_members WHERE team_id = $1 AND left_at IS NULL',
    [teamId]
  );
  if (parseInt(rosterCount.rows[0].cnt) >= team.max_roster_size) {
    throw new AppError(`Team roster is full (max: ${team.max_roster_size})`, 409, 'ROSTER_FULL');
  }

  // 8. Check pending invite spam limits
  const pendingCount = await query(
    "SELECT COUNT(*) as cnt FROM team_invitations WHERE team_id = $1 AND status = 'PENDING'",
    [teamId]
  );
  if (parseInt(pendingCount.rows[0].cnt) >= MAX_PENDING_INVITES_PER_TEAM) {
    throw new AppError('Too many pending invitations for this team', 429, 'INVITE_SPAM_LIMIT');
  }

  // 9. Check per-user invite rate limit
  const recentInvites = await query(
    `SELECT COUNT(*) as cnt FROM team_invitations
     WHERE inviter_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [inviterId]
  );
  if (parseInt(recentInvites.rows[0].cnt) >= MAX_INVITES_PER_USER_PER_HOUR) {
    throw new AppError('Invite rate limit exceeded. Try again later.', 429, 'INVITE_RATE_LIMITED');
  }

  // 10. Check for duplicate pending invite
  const existingInvite = await query(
    "SELECT id FROM team_invitations WHERE team_id = $1 AND invitee_id = $2 AND status = 'PENDING'",
    [teamId, inviteeId]
  );
  if (existingInvite.rows.length > 0) {
    throw new AppError('There is already a pending invitation for this player', 409, 'INVITE_ALREADY_PENDING');
  }

  // 11. Create invitation
  const result = await query(
    `INSERT INTO team_invitations (team_id, inviter_id, invitee_id, message, role_offered, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days') RETURNING *`,
    [teamId, inviterId, inviteeId, message || null, roleOffered]
  );

  await appendAuditLog({
    actorId: inviterId, actorRole: actor.role || 'PLAYER',
    action: 'teams:invite', entityType: 'TEAM_INVITATION', entityId: result.rows[0].id,
    payload: { teamId, inviteeId, roleOffered },
    reason: 'Player invited to team', requestId: actor.requestId,
  });

  return result.rows[0];
}

/**
 * Respond to a team invitation. Only the invitee can respond.
 * Consent-based: a player cannot be added without accepting.
 */
export async function respondToInvite({ inviteId, userId, action, actor = {} }) {
  if (!['ACCEPTED', 'DECLINED'].includes(action)) {
    throw new AppError('Invalid action — must be ACCEPTED or DECLINED', 400, 'INVALID_ACTION');
  }

  // 1. Fetch and validate invitation
  const inviteResult = await query(
    `SELECT ti.*, t.game_id, t.name as team_name, t.max_roster_size, t.is_active
     FROM team_invitations ti
     JOIN teams t ON ti.team_id = t.id
     WHERE ti.id = $1 AND ti.invitee_id = $2 AND ti.status = 'PENDING'`,
    [inviteId, userId]
  );
  if (inviteResult.rows.length === 0) {
    throw new AppError('Invitation not found or already responded', 404, 'INVITE_NOT_FOUND');
  }

  const invite = inviteResult.rows[0];

  // 2. Check if invitation expired
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    await query("UPDATE team_invitations SET status = 'EXPIRED' WHERE id = $1", [inviteId]);
    throw new AppError('Invitation has expired', 410, 'INVITE_EXPIRED');
  }

  // 3. Check team is still active
  if (!invite.is_active) {
    throw new AppError('Team has been disbanded', 400, 'TEAM_DISBANDED');
  }

  // 4. Update invitation status
  await query(
    'UPDATE team_invitations SET status = $1, responded_at = NOW() WHERE id = $2',
    [action, inviteId]
  );

  if (action === 'ACCEPTED') {
    // 5. Verify user isn't already in another team for this game
    const duplicateTeam = await query(
      `SELECT t.name FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.user_id = $1 AND t.game_id = $2 AND tm.left_at IS NULL AND t.is_active = TRUE`,
      [userId, invite.game_id]
    );
    if (duplicateTeam.rows.length > 0) {
      throw new AppError(
        `You are already in team "${duplicateTeam.rows[0].name}" for this game`,
        409,
        'ALREADY_IN_TEAM_FOR_GAME'
      );
    }

    // 6. Check roster capacity
    const rosterCount = await query(
      'SELECT COUNT(*) as cnt FROM team_members WHERE team_id = $1 AND left_at IS NULL',
      [invite.team_id]
    );
    if (parseInt(rosterCount.rows[0].cnt) >= invite.max_roster_size) {
      throw new AppError('Team roster is now full', 409, 'ROSTER_FULL');
    }

    // 7. Add member
    await query(
      `INSERT INTO team_members (team_id, user_id, role, joined_reason)
       VALUES ($1, $2, $3, 'INVITED')`,
      [invite.team_id, userId, invite.role_offered || 'PLAYER']
    );

    // 8. Transfer log
    await recordTransferLog({
      teamId: invite.team_id, userId, action: 'JOINED',
      toRole: invite.role_offered || 'PLAYER',
      reason: 'Accepted team invitation', performedBy: userId,
    });
  }

  await appendAuditLog({
    actorId: userId, actorRole: actor.role || 'PLAYER',
    action: `teams:invite_${action.toLowerCase()}`, entityType: 'TEAM_INVITATION', entityId: inviteId,
    payload: { teamId: invite.team_id, action },
    reason: `Player ${action.toLowerCase()} team invitation`, requestId: actor.requestId,
  });

  return { invite_id: inviteId, status: action, team_name: invite.team_name };
}

// ─── Roster Management ─────────────────────────────────────────────────────

/**
 * Leave a team voluntarily. OWNER cannot leave — must transfer ownership first.
 */
export async function leaveTeam(teamId, userId, actor = {}) {
  const membership = await query(
    'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL',
    [teamId, userId]
  );
  if (membership.rows.length === 0) {
    throw new AppError('You are not a member of this team', 404, 'NOT_MEMBER');
  }

  const member = membership.rows[0];
  if (member.role === 'OWNER') {
    throw new AppError('Team owner cannot leave. Transfer ownership first or disband the team.', 400, 'OWNER_CANNOT_LEAVE');
  }

  await query(
    "UPDATE team_members SET left_at = NOW(), left_reason = 'LEFT' WHERE id = $1",
    [member.id]
  );

  await recordTransferLog({
    teamId, userId, action: 'LEFT', fromRole: member.role,
    reason: 'Player left voluntarily', performedBy: userId,
  });

  await appendAuditLog({
    actorId: userId, actorRole: actor.role || 'PLAYER',
    action: 'teams:leave', entityType: 'TEAM', entityId: teamId,
    payload: { role: member.role }, reason: 'Player left team', requestId: actor.requestId,
  });

  return { success: true, left_team: teamId };
}

/**
 * Kick a member from the team. Only OWNER/CAPTAIN/MANAGER can kick.
 * Cannot kick someone of equal or higher rank.
 */
export async function kickMember(teamId, targetUserId, reason, kickerId, actor = {}) {
  const kickerMembership = await assertTeamRole(teamId, kickerId, ['OWNER', 'CAPTAIN', 'MANAGER']);
  
  const targetMembership = await query(
    'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL',
    [teamId, targetUserId]
  );
  if (targetMembership.rows.length === 0) {
    throw new AppError('Target user is not a member of this team', 404, 'NOT_MEMBER');
  }

  const target = targetMembership.rows[0];
  if (!outranks(kickerMembership.role, target.role)) {
    throw new AppError('You cannot kick a member of equal or higher rank', 403, 'INSUFFICIENT_RANK');
  }

  await query(
    "UPDATE team_members SET left_at = NOW(), left_reason = 'KICKED' WHERE id = $1",
    [target.id]
  );

  await recordTransferLog({
    teamId, userId: targetUserId, action: 'KICKED', fromRole: target.role,
    reason: reason || 'Removed by team management', performedBy: kickerId,
  });

  await appendAuditLog({
    actorId: kickerId, actorRole: actor.role || 'PLAYER',
    action: 'teams:kick', entityType: 'TEAM', entityId: teamId,
    payload: { targetUserId, targetRole: target.role, reason },
    reason: 'Member kicked from team', requestId: actor.requestId,
  });

  return { success: true, kicked_user: targetUserId };
}

/**
 * Change a member's role within the team.
 * Only OWNER can promote to CAPTAIN/MANAGER.
 * CAPTAIN can promote/demote PLAYER/SUBSTITUTE.
 */
export async function changeMemberRole(teamId, targetUserId, newRole, changerId, actor = {}) {
  const changerMembership = await assertTeamRole(teamId, changerId, ['OWNER', 'CAPTAIN']);

  const targetMembership = await query(
    'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL',
    [teamId, targetUserId]
  );
  if (targetMembership.rows.length === 0) {
    throw new AppError('Target user is not a member of this team', 404, 'NOT_MEMBER');
  }

  const target = targetMembership.rows[0];
  const oldRole = target.role;

  // Only OWNER can assign CAPTAIN or MANAGER roles
  if (['CAPTAIN', 'MANAGER', 'OWNER'].includes(newRole) && changerMembership.role !== 'OWNER') {
    throw new AppError('Only the team owner can assign leadership roles', 403, 'OWNER_REQUIRED');
  }

  // Cannot change own role (except OWNER transferring ownership via separate flow)
  if (changerId === targetUserId) {
    throw new AppError('Cannot change your own role', 400, 'CANNOT_CHANGE_OWN_ROLE');
  }

  await query(
    'UPDATE team_members SET role = $1 WHERE id = $2',
    [newRole, target.id]
  );

  const action = (ROLE_HIERARCHY[newRole] || 0) > (ROLE_HIERARCHY[oldRole] || 0) ? 'PROMOTED' : 'DEMOTED';

  await recordTransferLog({
    teamId, userId: targetUserId, action,
    fromRole: oldRole, toRole: newRole,
    reason: `Role changed: ${oldRole} → ${newRole}`, performedBy: changerId,
  });

  await appendAuditLog({
    actorId: changerId, actorRole: actor.role || 'PLAYER',
    action: 'teams:role_change', entityType: 'TEAM', entityId: teamId,
    payload: { targetUserId, oldRole, newRole },
    reason: `Member role changed from ${oldRole} to ${newRole}`, requestId: actor.requestId,
  });

  return { success: true, user_id: targetUserId, old_role: oldRole, new_role: newRole };
}

/**
 * Transfer team ownership. Current OWNER becomes CAPTAIN.
 */
export async function transferOwnership(teamId, newOwnerId, currentOwnerId, actor = {}) {
  await assertTeamRole(teamId, currentOwnerId, ['OWNER']);

  const targetMembership = await query(
    'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL',
    [teamId, newOwnerId]
  );
  if (targetMembership.rows.length === 0) {
    throw new AppError('New owner must be a current team member', 400, 'NOT_MEMBER');
  }

  // Demote current owner to CAPTAIN
  await query(
    "UPDATE team_members SET role = 'CAPTAIN' WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL",
    [teamId, currentOwnerId]
  );

  // Promote new owner
  await query(
    "UPDATE team_members SET role = 'OWNER' WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL",
    [teamId, newOwnerId]
  );

  // Update captain_id on teams table
  await query('UPDATE teams SET captain_id = $1, updated_at = NOW() WHERE id = $2', [newOwnerId, teamId]);

  await recordTransferLog({
    teamId, userId: newOwnerId, action: 'PROMOTED',
    fromRole: targetMembership.rows[0].role, toRole: 'OWNER',
    reason: 'Ownership transferred', performedBy: currentOwnerId,
  });

  await recordTransferLog({
    teamId, userId: currentOwnerId, action: 'DEMOTED',
    fromRole: 'OWNER', toRole: 'CAPTAIN',
    reason: 'Ownership transferred', performedBy: currentOwnerId,
  });

  return { success: true, new_owner: newOwnerId, previous_owner: currentOwnerId };
}

/**
 * Disband a team. Only OWNER can disband. Marks all members as left.
 */
export async function disbandTeam(teamId, ownerId, reason, actor = {}) {
  await assertTeamRole(teamId, ownerId, ['OWNER']);

  // Mark all active members as left
  await query(
    "UPDATE team_members SET left_at = NOW(), left_reason = 'DISBANDED' WHERE team_id = $1 AND left_at IS NULL",
    [teamId]
  );

  // Mark team as inactive
  await query(
    'UPDATE teams SET is_active = FALSE, disbanded_at = NOW(), updated_at = NOW() WHERE id = $1',
    [teamId]
  );

  await recordTransferLog({
    teamId, userId: ownerId, action: 'TEAM_DISBANDED',
    reason: reason || 'Team disbanded by owner', performedBy: ownerId,
  });

  await appendAuditLog({
    actorId: ownerId, actorRole: actor.role || 'PLAYER',
    action: 'teams:disband', entityType: 'TEAM', entityId: teamId,
    payload: { reason }, reason: 'Team disbanded', requestId: actor.requestId,
  });

  return { success: true, disbanded_team: teamId };
}

// ─── Block List ─────────────────────────────────────────────────────────────

/**
 * Block a user from the team (prevents future invites).
 */
export async function blockUser(teamId, blockedUserId, reason, blockerId, actor = {}) {
  await assertTeamRole(teamId, blockerId, ['OWNER', 'CAPTAIN', 'MANAGER']);

  await query(
    `INSERT INTO team_blocks (team_id, blocked_user_id, blocked_by, reason)
     VALUES ($1, $2, $3, $4) ON CONFLICT (team_id, blocked_user_id) DO NOTHING`,
    [teamId, blockedUserId, blockerId, reason || null]
  );

  return { success: true, blocked_user: blockedUserId };
}

/**
 * Unblock a user from the team.
 */
export async function unblockUser(teamId, blockedUserId, unblockerId) {
  await assertTeamRole(teamId, unblockerId, ['OWNER', 'CAPTAIN', 'MANAGER']);

  await query('DELETE FROM team_blocks WHERE team_id = $1 AND blocked_user_id = $2', [teamId, blockedUserId]);

  return { success: true, unblocked_user: blockedUserId };
}

// ─── Transfer Log & History ────────────────────────────────────────────────

/**
 * Record an entry in the public, append-only transfer log.
 */
async function recordTransferLog({ teamId, userId, action, fromRole, toRole, reason, performedBy }) {
  await query(
    `INSERT INTO team_transfer_log (team_id, user_id, action, from_role, to_role, reason, performed_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [teamId, userId, action, fromRole || null, toRole || null, reason || null, performedBy]
  );
}

/**
 * Get public transfer log for a team.
 */
export async function getTransferLog(teamId, { limit = 50, offset = 0 } = {}) {
  const result = await query(
    `SELECT tl.*, u.username, u.display_name, u.avatar_url,
            p.username as performed_by_username
     FROM team_transfer_log tl
     JOIN users u ON tl.user_id = u.id
     JOIN users p ON tl.performed_by = p.id
     WHERE tl.team_id = $1
     ORDER BY tl.created_at DESC
     LIMIT $2 OFFSET $3`,
    [teamId, limit, offset]
  );

  return result.rows;
}

/**
 * Get a user's team history across all teams.
 */
export async function getUserTeamHistory(userId) {
  const result = await query(
    `SELECT tm.*, t.name as team_name, t.tag as team_tag, t.game_id,
            g.name as game_name, g.slug as game_slug
     FROM team_members tm
     JOIN teams t ON tm.team_id = t.id
     JOIN games g ON t.game_id = g.id
     WHERE tm.user_id = $1
     ORDER BY tm.joined_at DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Get user's pending invitations.
 */
export async function getUserPendingInvites(userId) {
  const result = await query(
    `SELECT ti.*, t.name as team_name, t.tag as team_tag,
            g.name as game_name, g.slug as game_slug,
            u.username as inviter_username, u.display_name as inviter_display_name
     FROM team_invitations ti
     JOIN teams t ON ti.team_id = t.id
     JOIN games g ON t.game_id = g.id
     JOIN users u ON ti.inviter_id = u.id
     WHERE ti.invitee_id = $1 AND ti.status = 'PENDING' AND ti.expires_at > NOW()
     ORDER BY ti.created_at DESC`,
    [userId]
  );

  return result.rows;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Assert the user has one of the required roles in the team.
 * Returns the membership record if valid.
 */
async function assertTeamRole(teamId, userId, requiredRoles) {
  const result = await query(
    'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL',
    [teamId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('You are not a member of this team', 403, 'NOT_TEAM_MEMBER');
  }

  const member = result.rows[0];
  if (!requiredRoles.includes(member.role)) {
    throw new AppError(
      `This action requires one of: ${requiredRoles.join(', ')}. Your role: ${member.role}`,
      403,
      'INSUFFICIENT_TEAM_ROLE'
    );
  }

  return member;
}
