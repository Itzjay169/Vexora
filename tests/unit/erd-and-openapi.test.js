import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('Database ERD: Specification covers all Section 16 core tables and Vexora extra tables', () => {
  const erdPath = path.join(ROOT, 'docs/database/erd.md');
  assert.ok(fs.existsSync(erdPath), 'docs/database/erd.md must exist');

  const content = fs.readFileSync(erdPath, 'utf8');

  // Section 16 Core Tables
  const coreTables = [
    'users', 'user_roles', 'games', 'game_modes', 'teams', 'team_members',
    'organiser_profiles', 'organiser_documents', 'tournaments', 'tournament_rules',
    'registrations', 'matches', 'match_results', 'scores', 'leaderboard_entries',
    'seasons', 'wallet_accounts', 'ledger_transactions', 'redeem_codes',
    'payout_requests', 'reports', 'disputes', 'evidence', 'notifications', 'audit_logs'
  ];

  for (const table of coreTables) {
    assert.ok(content.includes(`\`${table}\``), `Core table \`${table}\` missing from ERD documentation`);
  }

  // Vexora Extra Tables
  const extraTables = [
    'user_devices', 'user_sessions', 'mfa_factors', 'feature_flags',
    'support_tickets', 'ticket_events', 'kyc_cases', 'achievements',
    'user_achievements', 'audit_chain_checkpoints', 'webhook_events', 'risk_events'
  ];

  for (const table of extraTables) {
    assert.ok(content.includes(`\`${table}\``), `Extra table \`${table}\` missing from ERD documentation`);
  }

  // Schema Invariants
  assert.ok(content.includes('UUIDv7'), 'ERD must specify UUIDv7 primary keys');
  assert.ok(content.includes('Double-Entry'), 'ERD must specify double-entry ledger design');
});

test('OpenAPI Specification: Covers all Section 17 /v1 API endpoint groups', () => {
  const openapiPath = path.join(ROOT, 'docs/api/openapi.yaml');
  assert.ok(fs.existsSync(openapiPath), 'docs/api/openapi.yaml must exist');

  const content = fs.readFileSync(openapiPath, 'utf8');
  assert.ok(content.includes('openapi: 3.0.3'), 'Must be OpenAPI 3.0.3');

  const requiredPaths = [
    '/health',
    '/auth/session',
    '/auth/refresh',
    '/users/me',
    '/games',
    '/teams',
    '/organisers/apply',
    '/tournaments',
    '/matches/{id}',
    '/results/{matchId}/submit',
    '/leaderboards/{gameSlug}/{seasonId}',
    '/wallet/balance',
    '/redeem',
    '/payouts/request',
    '/disputes',
    '/support/tickets',
    '/admin/maker-checker/queue',
    '/admin/audit/verify',
    '/webhooks/{provider}'
  ];

  for (const p of requiredPaths) {
    assert.ok(content.includes(`${p}:`), `Missing endpoint path in OpenAPI: ${p}`);
  }
});

test('STRIDE Threat Model: Complete analysis across all 6 threat categories', () => {
  const threatPath = path.join(ROOT, 'docs/threat-models/STRIDE-auth-wallet-results.md');
  assert.ok(fs.existsSync(threatPath), 'STRIDE threat model file must exist');

  const content = fs.readFileSync(threatPath, 'utf8');
  assert.ok(content.includes('Spoofing'), 'Must analyze Spoofing');
  assert.ok(content.includes('Tampering'), 'Must analyze Tampering');
  assert.ok(content.includes('Repudiation'), 'Must analyze Repudiation');
  assert.ok(content.includes('Information Disclosure'), 'Must analyze Information Disclosure');
  assert.ok(content.includes('Denial of Service'), 'Must analyze Denial of Service');
  assert.ok(content.includes('Elevation of Privilege'), 'Must analyze Elevation of Privilege');
});
