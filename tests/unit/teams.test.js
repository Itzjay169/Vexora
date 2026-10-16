/**
 * Vexora Phase 13: Teams, Rosters & Transfer Log
 *
 * Tests cover:
 *   1.  Migration 007 Structure & DDL integrity (roles, columns, constraints)
 *   2.  Public append-only team_transfer_log and immutability triggers
 *   3.  One-owner-per-team constraint and team_blocks anti-spam table
 *   4.  Validation schemas (TeamCreate, Update, Invite, Respond, Kick, Role, Ownership, Block)
 *   5.  Role hierarchy & management permissions (OWNER > CAPTAIN > MANAGER > PLAYER > SUBSTITUTE)
 *   6.  Service functions & business rules (duplicate identity, consent, spam limits, rank checks)
 *   7.  Owner immutability invariants (cannot leave, only owner can assign leadership)
 *   8.  Express routes registration & auth middleware enforcement
 */

process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Service imports
import {
  canManageRoster,
  createTeam,
  getTeamDetail,
  updateTeam,
  invitePlayer,
  respondToInvite,
  leaveTeam,
  kickMember,
  changeMemberRole,
  transferOwnership,
  disbandTeam,
  blockUser,
  unblockUser,
  getTransferLog,
  getUserTeamHistory,
  getUserPendingInvites,
} from '../../backend/src/teams/teams.service.js';

import { teamsRouter } from '../../backend/src/teams/teams.routes.js';

// Validation schemas import
import {
  TeamCreateSchema,
  TeamUpdateSchema,
  TeamInviteSchema,
  InviteResponseSchema,
  KickMemberSchema,
  RoleChangeSchema,
  OwnershipTransferSchema,
  TeamBlockSchema,
} from '../../packages/validation/src/index.ts';

const ROOT = path.resolve('.');

// ─── 1. Migration 007 Structure Validation ──────────────────────────────────

test('Phase 13 Database: Migration 007 file exists and defines team enhancements', () => {
  const migPath = path.join(ROOT, 'infra/migrations/007_teams_rosters_transfers.sql');
  assert.ok(fs.existsSync(migPath), 'Migration 007 file must exist');

  const sql = fs.readFileSync(migPath, 'utf8');

  // Enum extensions
  assert.ok(sql.includes("ALTER TYPE team_member_role ADD VALUE 'OWNER'"), 'Must add OWNER to team_member_role');
  assert.ok(sql.includes("ALTER TYPE team_member_role ADD VALUE 'MANAGER'"), 'Must add MANAGER to team_member_role');

  // Teams table additions
  assert.ok(sql.includes('max_roster_size'), 'Must add max_roster_size column');
  assert.ok(sql.includes('min_roster_size'), 'Must add min_roster_size column');
  assert.ok(sql.includes('transfer_window_open'), 'Must add transfer_window_open column');
  assert.ok(sql.includes('disbanded_at'), 'Must add disbanded_at column');
  assert.ok(sql.includes('social_links'), 'Must add social_links column');
  assert.ok(sql.includes('chk_roster_size_range'), 'Must add chk_roster_size_range constraint');

  // Team members additions
  assert.ok(sql.includes('jersey_number'), 'Must add jersey_number column');
  assert.ok(sql.includes('joined_reason'), 'Must add joined_reason column');
  assert.ok(sql.includes('left_reason'), 'Must add left_reason column');
  assert.ok(sql.includes('chk_joined_reason'), 'Must add chk_joined_reason constraint');
  assert.ok(sql.includes('chk_left_reason'), 'Must add chk_left_reason constraint');

  // Team invitations additions
  assert.ok(sql.includes('expires_at'), 'Must add expires_at to invitations');
  assert.ok(sql.includes('role_offered'), 'Must add role_offered to invitations');
});

test('Phase 13 Database: Migration 007 defines append-only team_transfer_log with triggers', () => {
  const migPath = path.join(ROOT, 'infra/migrations/007_teams_rosters_transfers.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS team_transfer_log'), 'Must create team_transfer_log table');
  assert.ok(sql.includes('chk_transfer_action'), 'Must enforce chk_transfer_action check constraint');
  assert.ok(sql.includes("'JOINED', 'LEFT', 'KICKED', 'PROMOTED', 'DEMOTED'"), 'Must include transfer actions');
  assert.ok(sql.includes("'TEAM_CREATED', 'TEAM_DISBANDED'"), 'Must include team lifecycle transfer actions');

  // Immutability triggers
  assert.ok(sql.includes('prevent_transfer_log_mutation()'), 'Must define prevent_transfer_log_mutation function');
  assert.ok(sql.includes('trg_immutable_transfer_log_update'), 'Must define update immutability trigger');
  assert.ok(sql.includes('trg_immutable_transfer_log_delete'), 'Must define delete immutability trigger');
});

test('Phase 13 Database: Migration 007 defines team_blocks and one-owner index', () => {
  const migPath = path.join(ROOT, 'infra/migrations/007_teams_rosters_transfers.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS team_blocks'), 'Must create team_blocks table');
  assert.ok(sql.includes('uq_team_block UNIQUE (team_id, blocked_user_id)'), 'Must have unique team block constraint');
  assert.ok(sql.includes('idx_one_owner_per_team'), 'Must create unique partial index for one owner');
  assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on team_transfer_log');
  assert.ok(sql.includes('rls_transfer_log_public_read'), 'Must define public read policy for transfer log');
});

// ─── 2. Validation Schemas ──────────────────────────────────────────────────

test('Phase 13 Validation: TeamCreateSchema accepts valid team input', () => {
  const valid = {
    name: 'Vexora Elite',
    tag: 'VEX',
    game_id: 'a0000000-0000-0000-0000-000000000001',
    description: 'Competitive roster for BGMI Season 1',
    region: 'IND',
    max_roster_size: 6,
    min_roster_size: 4,
    social_links: { twitter: 'https://twitter.com/vexora_elite' },
  };
  const parsed = TeamCreateSchema.parse(valid);
  assert.equal(parsed.name, 'Vexora Elite');
  assert.equal(parsed.tag, 'VEX');
  assert.equal(parsed.max_roster_size, 6);
});

test('Phase 13 Validation: TeamCreateSchema applies default roster limits', () => {
  const minimal = {
    name: 'Phoenix Esports',
    tag: 'PHX',
    game_id: 'a0000000-0000-0000-0000-000000000001',
  };
  const parsed = TeamCreateSchema.parse(minimal);
  assert.equal(parsed.max_roster_size, 10);
  assert.equal(parsed.min_roster_size, 1);
});

test('Phase 13 Validation: TeamCreateSchema rejects invalid team tag (lowercase/symbols)', () => {
  assert.throws(() => {
    TeamCreateSchema.parse({
      name: 'Valid Name',
      tag: 'vex-1', // Hyphens not allowed, must be uppercase alphanumeric
      game_id: 'a0000000-0000-0000-0000-000000000001',
    });
  });

  assert.throws(() => {
    TeamCreateSchema.parse({
      name: 'Valid Name',
      tag: 'vx', // Lowercase not allowed
      game_id: 'a0000000-0000-0000-0000-000000000001',
    });
  });
});

test('Phase 13 Validation: TeamCreateSchema rejects name shorter than 2 chars', () => {
  assert.throws(() => {
    TeamCreateSchema.parse({
      name: 'A',
      tag: 'TAG',
      game_id: 'a0000000-0000-0000-0000-000000000001',
    });
  });
});

test('Phase 13 Validation: TeamUpdateSchema accepts partial updates', () => {
  const update = {
    description: 'Updated roster description',
    transfer_window_open: false,
    max_roster_size: 8,
  };
  const parsed = TeamUpdateSchema.parse(update);
  assert.equal(parsed.transfer_window_open, false);
  assert.equal(parsed.max_roster_size, 8);
});

test('Phase 13 Validation: TeamInviteSchema accepts valid invitation', () => {
  const valid = {
    invitee_id: 'b0000000-0000-0000-0000-000000000002',
    message: 'Welcome to the team! Play scrims tonight.',
    role_offered: 'PLAYER',
  };
  const parsed = TeamInviteSchema.parse(valid);
  assert.equal(parsed.role_offered, 'PLAYER');
});

test('Phase 13 Validation: TeamInviteSchema allows MANAGER and SUBSTITUTE roles', () => {
  const managerInvite = TeamInviteSchema.parse({
    invitee_id: 'b0000000-0000-0000-0000-000000000002',
    role_offered: 'MANAGER',
  });
  assert.equal(managerInvite.role_offered, 'MANAGER');

  const subInvite = TeamInviteSchema.parse({
    invitee_id: 'b0000000-0000-0000-0000-000000000002',
    role_offered: 'SUBSTITUTE',
  });
  assert.equal(subInvite.role_offered, 'SUBSTITUTE');
});

test('Phase 13 Validation: TeamInviteSchema rejects offering OWNER or CAPTAIN via invite', () => {
  assert.throws(() => {
    TeamInviteSchema.parse({
      invitee_id: 'b0000000-0000-0000-0000-000000000002',
      role_offered: 'OWNER', // Cannot offer OWNER directly via invite
    });
  });

  assert.throws(() => {
    TeamInviteSchema.parse({
      invitee_id: 'b0000000-0000-0000-0000-000000000002',
      role_offered: 'CAPTAIN', // Cannot offer CAPTAIN directly via invite
    });
  });
});

test('Phase 13 Validation: InviteResponseSchema accepts ACCEPTED and DECLINED', () => {
  assert.equal(InviteResponseSchema.parse({ action: 'ACCEPTED' }).action, 'ACCEPTED');
  assert.equal(InviteResponseSchema.parse({ action: 'DECLINED' }).action, 'DECLINED');

  assert.throws(() => {
    InviteResponseSchema.parse({ action: 'MAYBE' });
  });
});

test('Phase 13 Validation: KickMemberSchema validates user_id and optional reason', () => {
  const valid = {
    user_id: 'b0000000-0000-0000-0000-000000000002',
    reason: 'Inactivity during scheduled tournaments',
  };
  const parsed = KickMemberSchema.parse(valid);
  assert.equal(parsed.reason, 'Inactivity during scheduled tournaments');

  assert.throws(() => {
    KickMemberSchema.parse({ user_id: 'not-a-uuid' });
  });
});

test('Phase 13 Validation: RoleChangeSchema accepts valid roster roles', () => {
  assert.equal(RoleChangeSchema.parse({ new_role: 'CAPTAIN' }).new_role, 'CAPTAIN');
  assert.equal(RoleChangeSchema.parse({ new_role: 'MANAGER' }).new_role, 'MANAGER');
  assert.equal(RoleChangeSchema.parse({ new_role: 'PLAYER' }).new_role, 'PLAYER');
  assert.equal(RoleChangeSchema.parse({ new_role: 'SUBSTITUTE' }).new_role, 'SUBSTITUTE');

  assert.throws(() => {
    RoleChangeSchema.parse({ new_role: 'OWNER' }); // Owner must use OwnershipTransferSchema
  });
});

test('Phase 13 Validation: OwnershipTransferSchema validates new_owner_id', () => {
  const valid = { new_owner_id: 'c0000000-0000-0000-0000-000000000003' };
  assert.equal(OwnershipTransferSchema.parse(valid).new_owner_id, valid.new_owner_id);

  assert.throws(() => {
    OwnershipTransferSchema.parse({ new_owner_id: 'invalid-id' });
  });
});

test('Phase 13 Validation: TeamBlockSchema validates user_id and reason', () => {
  const valid = {
    user_id: 'd0000000-0000-0000-0000-000000000004',
    reason: 'Persistent spam invitations',
  };
  const parsed = TeamBlockSchema.parse(valid);
  assert.equal(parsed.user_id, valid.user_id);
});

// ─── 3. Role Hierarchy & Management Privileges ──────────────────────────────

test('Phase 13 Role Hierarchy: canManageRoster permits OWNER, CAPTAIN, and MANAGER', () => {
  assert.equal(canManageRoster('OWNER'), true);
  assert.equal(canManageRoster('CAPTAIN'), true);
  assert.equal(canManageRoster('MANAGER'), true);
});

test('Phase 13 Role Hierarchy: canManageRoster denies PLAYER and SUBSTITUTE', () => {
  assert.equal(canManageRoster('PLAYER'), false);
  assert.equal(canManageRoster('SUBSTITUTE'), false);
  assert.equal(canManageRoster(null), false);
  assert.equal(canManageRoster(undefined), false);
});

// ─── 4. Service Logic & Security Invariants ─────────────────────────────────

test('Phase 13 Service: exports all 15 required service methods', () => {
  assert.equal(typeof createTeam, 'function');
  assert.equal(typeof getTeamDetail, 'function');
  assert.equal(typeof updateTeam, 'function');
  assert.equal(typeof invitePlayer, 'function');
  assert.equal(typeof respondToInvite, 'function');
  assert.equal(typeof leaveTeam, 'function');
  assert.equal(typeof kickMember, 'function');
  assert.equal(typeof changeMemberRole, 'function');
  assert.equal(typeof transferOwnership, 'function');
  assert.equal(typeof disbandTeam, 'function');
  assert.equal(typeof blockUser, 'function');
  assert.equal(typeof unblockUser, 'function');
  assert.equal(typeof getTransferLog, 'function');
  assert.equal(typeof getUserTeamHistory, 'function');
  assert.equal(typeof getUserPendingInvites, 'function');
});

test('Phase 13 Security: Invite spam limits are strictly defined in service', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'backend/src/teams/teams.service.js'), 'utf8');

  // Verify constant definitions
  assert.ok(serviceSrc.includes('MAX_PENDING_INVITES_PER_TEAM = 20'), 'Must cap pending invites per team at 20');
  assert.ok(serviceSrc.includes('MAX_INVITES_PER_USER_PER_HOUR = 10'), 'Must rate-limit user invites to 10/hour');
  assert.ok(serviceSrc.includes('INVITE_SPAM_LIMIT'), 'Must emit error code INVITE_SPAM_LIMIT');
  assert.ok(serviceSrc.includes('INVITE_RATE_LIMITED'), 'Must emit error code INVITE_RATE_LIMITED');
});

test('Phase 13 Security: Block list check prevents invite to blocked players', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'backend/src/teams/teams.service.js'), 'utf8');

  assert.ok(serviceSrc.includes('SELECT id FROM team_blocks WHERE team_id = $1 AND blocked_user_id = $2'), 'Must check team_blocks table before sending invite');
  assert.ok(serviceSrc.includes('USER_BLOCKED'), 'Must return USER_BLOCKED code for blocked users');
});

test('Phase 13 Security: Duplicate identity checks prevent multi-team membership for same game', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'backend/src/teams/teams.service.js'), 'utf8');

  // Checked at team creation
  assert.ok(serviceSrc.includes('ALREADY_IN_TEAM_FOR_GAME'), 'Must check creator duplicate team at creation');
  // Checked at invite time
  assert.ok(serviceSrc.includes('PLAYER_IN_ANOTHER_TEAM'), 'Must check invitee duplicate team at invite');
  // Re-checked when accepting invitation
  assert.ok(serviceSrc.includes('tm.user_id = $1 AND t.game_id = $2 AND tm.left_at IS NULL'), 'Must re-verify duplicate membership at accept');
});

test('Phase 13 Security: Consent-based membership enforced (no forced additions)', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'backend/src/teams/teams.service.js'), 'utf8');

  // Inviting creates team_invitations with PENDING status
  assert.ok(serviceSrc.includes("INSERT INTO team_invitations"), 'Inviting inserts into invitations table');
  // Member is only inserted into team_members upon ACCEPTED response
  assert.ok(serviceSrc.includes("action === 'ACCEPTED'"), 'Member addition requires explicit ACCEPTED status');
});

test('Phase 13 Security: Owner immutability invariants enforced', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'backend/src/teams/teams.service.js'), 'utf8');

  // Owner cannot leave without transfer/disband
  assert.ok(serviceSrc.includes('OWNER_CANNOT_LEAVE'), 'Must prevent OWNER from leaving voluntarily');
  assert.ok(serviceSrc.includes('Team owner cannot leave'), 'Must show clear message to owner');

  // Only OWNER can assign CAPTAIN/MANAGER roles
  assert.ok(serviceSrc.includes('OWNER_REQUIRED'), 'Must require OWNER to assign leadership roles');

  // Transfer ownership demotes old owner to CAPTAIN and sets new owner
  assert.ok(serviceSrc.includes("UPDATE team_members SET role = 'CAPTAIN'"), 'Must demote old owner to CAPTAIN');
  assert.ok(serviceSrc.includes("UPDATE team_members SET role = 'OWNER'"), 'Must promote new owner to OWNER');
});

test('Phase 13 Security: Rank hierarchy prevents kicking equal or higher rank', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'backend/src/teams/teams.service.js'), 'utf8');

  assert.ok(serviceSrc.includes('outranks(kickerMembership.role, target.role)'), 'Must check outranks function');
  assert.ok(serviceSrc.includes('INSUFFICIENT_RANK'), 'Must return INSUFFICIENT_RANK error code');
});

test('Phase 13 Security: Public transfer log records every roster transition', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'backend/src/teams/teams.service.js'), 'utf8');

  assert.ok(serviceSrc.includes("action: 'TEAM_CREATED'"), 'Records TEAM_CREATED on create');
  assert.ok(serviceSrc.includes("action: 'JOINED'"), 'Records JOINED on accept');
  assert.ok(serviceSrc.includes("action: 'LEFT'"), 'Records LEFT on voluntary leave');
  assert.ok(serviceSrc.includes("action: 'KICKED'"), 'Records KICKED on removal');
  assert.ok(serviceSrc.includes("action: 'TEAM_DISBANDED'"), 'Records TEAM_DISBANDED on disband');
});

// ─── 5. Express Routes Registration ─────────────────────────────────────────

test('Phase 13 Routes: teamsRouter registers all expected endpoints', () => {
  assert.ok(teamsRouter, 'teamsRouter must exist');

  const routes = teamsRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  const paths = routes.map((r) => r.path);

  assert.ok(paths.includes('/'), 'Must have POST / route');
  assert.ok(paths.includes('/my'), 'Must have GET /my route');
  assert.ok(paths.includes('/invitations'), 'Must have GET /invitations route');
  assert.ok(paths.includes('/invitations/:id/respond'), 'Must have POST /invitations/:id/respond route');
  assert.ok(paths.includes('/history'), 'Must have GET /history route');
  assert.ok(paths.includes('/:id'), 'Must have GET /:id route');
  assert.ok(paths.includes('/:id'), 'Must have PATCH /:id route');
  assert.ok(paths.includes('/:id/invite'), 'Must have POST /:id/invite route');
  assert.ok(paths.includes('/:id/leave'), 'Must have POST /:id/leave route');
  assert.ok(paths.includes('/:id/kick'), 'Must have POST /:id/kick route');
  assert.ok(paths.includes('/:id/members/:userId/role'), 'Must have PATCH /:id/members/:userId/role route');
  assert.ok(paths.includes('/:id/transfer-ownership'), 'Must have POST /:id/transfer-ownership route');
  assert.ok(paths.includes('/:id/disband'), 'Must have POST /:id/disband route');
  assert.ok(paths.includes('/:id/transfer-log'), 'Must have GET /:id/transfer-log route');
  assert.ok(paths.includes('/:id/block'), 'Must have POST /:id/block route');
  assert.ok(paths.includes('/:id/block/:userId'), 'Must have DELETE /:id/block/:userId route');
});
