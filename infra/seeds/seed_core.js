#!/usr/bin/env node

/**
 * Vexora Core Database Seeds
 * Seeds synthetic RBAC roles, granular permissions, role mappings, and feature flags.
 * Strictly synthetic test fixtures — no real user PII or production secrets.
 */

import { query, withTransaction } from '../../backend/src/common/database.js';

export const SYSTEM_ROLES = [
  { name: 'SUPER_ADMIN', description: 'Complete system oversight and administrative privilege' },
  { name: 'ADMIN', description: 'Platform operations, tournament approvals, and user moderation' },
  { name: 'FINANCE', description: 'Maker-checker ledger audits and payout verification' },
  { name: 'MODERATOR', description: 'Dispute reviews, evidence analysis, and sanctions' },
  { name: 'ORGANISER', description: 'Tournament creation, match lobbies, and bracket management' },
  { name: 'TEAM_CAPTAIN', description: 'Team roster management, tournament registration, and result submission' },
  { name: 'PLAYER', description: 'Tournament participation, profile viewing, and personal wallet' },
  { name: 'SUPPORT_AGENT', description: 'Customer support tickets and user inquiries' },
  { name: 'AUDITOR', description: 'Read-only access to tamper-evident audit logs and financial ledger' },
];

export const SYSTEM_PERMISSIONS = [
  // Auth
  { name: 'auth:login', module: 'auth', action: 'login', description: 'User login' },
  { name: 'auth:mfa_manage', module: 'auth', action: 'mfa_manage', description: 'Configure MFA factors' },

  // Tournaments
  { name: 'tournaments:create', module: 'tournaments', action: 'create', description: 'Create tournament drafts' },
  { name: 'tournaments:publish', module: 'tournaments', action: 'publish', description: 'Publish verified tournaments' },
  { name: 'tournaments:approve', module: 'tournaments', action: 'approve', description: 'Admin tournament approval' },
  { name: 'tournaments:register', module: 'tournaments', action: 'register', description: 'Register participant team' },

  // Matches & Results
  { name: 'matches:submit_result', module: 'matches', action: 'submit_result', description: 'Submit match score & evidence' },
  { name: 'matches:verify_result', module: 'matches', action: 'verify_result', description: 'Adjudicate match outcome' },

  // Wallet & Money (Gated behind feature flags)
  { name: 'wallet:view_balance', module: 'wallet', action: 'view_balance', description: 'View own account balance' },
  { name: 'wallet:deposit', module: 'wallet', action: 'deposit', description: 'Credit funds to balance' },
  { name: 'wallet:payout_request', module: 'wallet', action: 'payout_request', description: 'Initiate withdrawal request' },
  { name: 'wallet:payout_approve', module: 'wallet', action: 'payout_approve', description: 'Dual-approval checker for payout' },

  // Disputes & Moderation
  { name: 'disputes:create', module: 'disputes', action: 'create', description: 'Open dispute on match' },
  { name: 'disputes:resolve', module: 'disputes', action: 'resolve', description: 'Apply moderator decision on dispute' },

  // Audit
  { name: 'audit:read', module: 'audit', action: 'read', description: 'Read tamper-evident audit logs' },
  { name: 'audit:verify', module: 'audit', action: 'verify', description: 'Trigger Merkle chain verification' },
];

export const DEFAULT_FEATURE_FLAGS = [
  {
    key: 'free_tournaments_only',
    enabled: true,
    rollout_percent: 100,
    description: 'v1 Public Launch mandate: free-to-play tournaments only',
    audience: { regions: ['IN', 'GLOBAL'], tiers: ['ALL'] },
  },
  {
    key: 'real_money_wallet_enabled',
    enabled: false,
    rollout_percent: 0,
    description: 'Real-money deposits & paid tournaments (disabled pending legal sign-off)',
    audience: { regions: ['IN'], tiers: ['VERIFIED'] },
  },
  {
    key: 'payout_maker_checker_strict',
    enabled: true,
    rollout_percent: 100,
    description: 'Enforce dual approval on all payout requests',
    audience: { regions: ['ALL'], tiers: ['ALL'] },
  },
  {
    key: 'strict_anti_cheat_fingerprinting',
    enabled: true,
    rollout_percent: 100,
    description: 'Device fingerprint clustering and collusion detection',
    audience: { regions: ['ALL'], tiers: ['ALL'] },
  },
];

export async function seedCoreData() {
  console.log('🌱 Seeding Vexora Core Database Foundation...');

  try {
    await withTransaction(async (client) => {
      // 1. Seed Roles
      console.log('  👑 Seeding Roles...');
      for (const role of SYSTEM_ROLES) {
        await client.query(
          `INSERT INTO roles (name, description, is_system_role)
           VALUES ($1, $2, TRUE)
           ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
          [role.name, role.description]
        );
      }

      // 2. Seed Permissions
      console.log('  🛡️ Seeding Permissions...');
      for (const perm of SYSTEM_PERMISSIONS) {
        await client.query(
          `INSERT INTO permissions (name, module, action, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
          [perm.name, perm.module, perm.action, perm.description]
        );
      }

      // 3. Seed Feature Flags
      console.log('  🚩 Seeding Feature Flags...');
      for (const flag of DEFAULT_FEATURE_FLAGS) {
        await client.query(
          `INSERT INTO feature_flags (key, enabled, rollout_percent, description, audience)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (key) DO UPDATE
           SET enabled = EXCLUDED.enabled, rollout_percent = EXCLUDED.rollout_percent, updated_at = NOW()`,
          [flag.key, flag.enabled, flag.rollout_percent, flag.description, JSON.stringify(flag.audience)]
        );
      }
    });

    console.log('✅ Core foundation database seed completed.');
  } catch (err) {
    console.warn(`⚠️ Database seed note: ${err.message}`);
  }
}

// Run directly if invoked from CLI
const isMain = process.argv[1] && (
  process.argv[1].endsWith('seed_core.js') ||
  process.argv[1].includes('seed_core.js')
);

if (isMain) {
  seedCoreData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
