process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  GENESIS_HASH,
  computeRecordHash,
  computeMerkleRoot,
  createCheckpoint,
  verifyAuditChain,
} from '../../backend/src/audit/audit.service.js';
import { SYSTEM_ROLES, SYSTEM_PERMISSIONS, DEFAULT_FEATURE_FLAGS } from '../../infra/seeds/seed_core.js';

test('Phase 6 Database Foundation: Migration 002 exists and defines all required core tables', () => {
  const migration002Path = path.resolve('infra/migrations/002_core_foundation_and_audit.sql');
  assert.ok(fs.existsSync(migration002Path), 'Migration 002 file must exist');

  const sql = fs.readFileSync(migration002Path, 'utf8');

  const requiredTables = [
    'roles',
    'permissions',
    'role_permissions',
    'user_roles',
    'user_devices',
    'mfa_factors',
    'audit_chain_checkpoints',
    'feature_flags',
  ];

  for (const table of requiredTables) {
    const tableRegex = new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${table}\\b`, 'i');
    assert.ok(tableRegex.test(sql), `Migration 002 must create table: ${table}`);
  }
});

test('Phase 6 Security Gate: Database triggers forbid UPDATE and DELETE on audit_logs', () => {
  const migration002Path = path.resolve('infra/migrations/002_core_foundation_and_audit.sql');
  const sql = fs.readFileSync(migration002Path, 'utf8');

  // Trigger function must raise security exception
  assert.ok(
    sql.includes('prevent_audit_log_tampering()'),
    'Tamper prevention function must be defined'
  );
  assert.ok(
    sql.includes('SECURITY VIOLATION: audit_logs rows are immutable'),
    'Trigger must raise security exception message on attempt to modify or delete'
  );

  // Both UPDATE and DELETE triggers must be attached
  assert.ok(
    sql.includes('BEFORE UPDATE ON audit_logs'),
    'BEFORE UPDATE trigger must be attached to audit_logs'
  );
  assert.ok(
    sql.includes('BEFORE DELETE ON audit_logs'),
    'BEFORE DELETE trigger must be attached to audit_logs'
  );
});

test('Phase 6 Security Gate: Least-privilege DB roles defined without shared superuser', () => {
  const migration002Path = path.resolve('infra/migrations/002_core_foundation_and_audit.sql');
  const sql = fs.readFileSync(migration002Path, 'utf8');

  // Verify role definitions
  assert.ok(sql.includes('vexora_app_role'), 'Application role must be defined');
  assert.ok(sql.includes('vexora_auditor_role'), 'Auditor read-only role must be defined');
  assert.ok(sql.includes('vexora_migration_role'), 'Migration runner role must be defined');

  // Verify explicit revocations on immutable tables
  assert.ok(
    sql.includes('REVOKE UPDATE, DELETE ON audit_logs FROM vexora_app_role'),
    'App role must be forbidden from updating or deleting audit logs'
  );
  assert.ok(
    sql.includes('REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM vexora_auditor_role'),
    'Auditor role must have strictly read-only permissions'
  );
});

test('Phase 6 Cryptography: Audit record hash binds all security and payload fields', () => {
  const baseRecord = {
    prevHash: GENESIS_HASH,
    sequenceNum: 1,
    actorId: '018f45a0-0001-7000-8000-000000000001',
    actorRole: 'PLAYER',
    action: 'TOURNAMENT_JOIN',
    entityType: 'tournament',
    entityId: '018f45a0-0002-7000-8000-000000000002',
    payload: { teamId: 'team_alpha', entryFee: 0 },
    beforeState: { availableSlots: 16 },
    afterState: { availableSlots: 15 },
    reason: 'Player self-registered',
    requestId: 'req_00000001',
    timestamp: '2026-10-03T12:00:00.000Z',
  };

  const hash1 = computeRecordHash(baseRecord);
  assert.equal(typeof hash1, 'string');
  assert.equal(hash1.length, 64, 'SHA-256 hash must be 64 hex characters');

  // Tampering any field must change the hash
  const tamperedPayload = { ...baseRecord, payload: { teamId: 'team_alpha', entryFee: 100 } };
  assert.notEqual(computeRecordHash(tamperedPayload), hash1, 'Altering payload must change hash');

  const tamperedReason = { ...baseRecord, reason: 'Admin forced registration' };
  assert.notEqual(computeRecordHash(tamperedReason), hash1, 'Altering reason must change hash');

  const tamperedActor = { ...baseRecord, actorId: '018f45a0-9999-7000-8000-000000000999' };
  assert.notEqual(computeRecordHash(tamperedActor), hash1, 'Altering actorId must change hash');
});

test('Phase 6 Audit Chain: Sequential hash-linked records verify cleanly', async () => {
  const chain = [];
  let prevHash = GENESIS_HASH;

  for (let i = 1; i <= 5; i++) {
    const record = {
      id: i,
      sequence_num: i,
      actor_id: `user_${i}`,
      actor_role: 'PLAYER',
      action: `ACTION_${i}`,
      entity_type: 'tournament',
      entity_id: `tourn_${i}`,
      payload: { step: i },
      before_state: null,
      after_state: null,
      reason: 'Standard action',
      request_id: `req_${i}`,
      created_at: `2026-10-03T12:0${i}:00.000Z`,
      prev_hash: prevHash,
    };

    const currHash = computeRecordHash({
      prevHash,
      sequenceNum: record.sequence_num,
      actorId: record.actor_id,
      actorRole: record.actor_role,
      action: record.action,
      entityType: record.entity_type,
      entityId: record.entity_id,
      payload: record.payload,
      beforeState: record.before_state,
      afterState: record.after_state,
      reason: record.reason,
      requestId: record.request_id,
      timestamp: record.created_at,
    });

    record.curr_hash = currHash;
    chain.push(record);
    prevHash = currHash;
  }

  const result = await verifyAuditChain(chain);
  assert.equal(result.valid, true);
  assert.equal(result.verifiedCount, 5);
  assert.equal(result.brokenAtId, null);
  assert.equal(result.sev1Alert, false);
});

test('Phase 6 Security Gate: Tampered record breaks hash chain and raises SEV1 alert', async () => {
  const chain = [];
  let prevHash = GENESIS_HASH;

  for (let i = 1; i <= 5; i++) {
    const record = {
      id: i,
      sequence_num: i,
      actor_id: `user_${i}`,
      actor_role: 'PLAYER',
      action: `ACTION_${i}`,
      entity_type: 'wallet',
      entity_id: `wallet_${i}`,
      payload: { amount: 100 },
      before_state: null,
      after_state: null,
      reason: 'Deposit',
      request_id: `req_${i}`,
      created_at: `2026-10-03T12:0${i}:00.000Z`,
      prev_hash: prevHash,
    };

    const currHash = computeRecordHash({
      prevHash,
      sequenceNum: record.sequence_num,
      actorId: record.actor_id,
      actorRole: record.actor_role,
      action: record.action,
      entityType: record.entity_type,
      entityId: record.entity_id,
      payload: record.payload,
      beforeState: record.before_state,
      afterState: record.after_state,
      reason: record.reason,
      requestId: record.request_id,
      timestamp: record.created_at,
    });

    record.curr_hash = currHash;
    chain.push(record);
    prevHash = currHash;
  }

  // Simulate malicious tampering with row 3's payload
  chain[2].payload = { amount: 999999 }; // unauthorized balance edit attempt

  const result = await verifyAuditChain(chain);
  assert.equal(result.valid, false, 'Tampered chain must be detected as invalid');
  assert.equal(result.brokenAtId, 3, 'Must identify exact broken record ID');
  assert.equal(result.sev1Alert, true, 'Tampering must trigger SEV-1 alert flag');
  assert.equal(result.reason, 'PAYLOAD_TAMPERING_DETECTED');
});

test('Phase 6 Merkle Root: Deterministic binary Merkle tree checkpoint computation', () => {
  const leaf1 = crypto.createHash('sha256').update('leaf1').digest('hex');
  const leaf2 = crypto.createHash('sha256').update('leaf2').digest('hex');
  const leaf3 = crypto.createHash('sha256').update('leaf3').digest('hex');

  // Single leaf root is the leaf itself
  assert.equal(computeMerkleRoot([leaf1]), leaf1);

  // Two leaves: root = sha256(leaf1 + leaf2)
  const expectedTwo = crypto.createHash('sha256').update(leaf1 + leaf2).digest('hex');
  assert.equal(computeMerkleRoot([leaf1, leaf2]), expectedTwo);

  // Odd number of leaves: leaf3 is duplicated to balance
  const parent1 = expectedTwo;
  const parent2 = crypto.createHash('sha256').update(leaf3 + leaf3).digest('hex');
  const expectedThree = crypto.createHash('sha256').update(parent1 + parent2).digest('hex');
  assert.equal(computeMerkleRoot([leaf1, leaf2, leaf3]), expectedThree);

  // Create full signed checkpoint
  const checkpoint = createCheckpoint([leaf1, leaf2, leaf3], 1, 3, 101);
  assert.equal(checkpoint.checkpointIndex, 101);
  assert.equal(checkpoint.fromLogId, 1);
  assert.equal(checkpoint.toLogId, 3);
  assert.equal(checkpoint.merkleRoot, expectedThree);
  assert.equal(checkpoint.verifiedCount, 3);
  assert.equal(checkpoint.status, 'VALID');
  assert.ok(checkpoint.signature, 'Checkpoint must be signed with HMAC-SHA256');
});

test('Phase 6 Seeds: Core roles, permissions, and feature flags match Section 16 & 31', () => {
  // Roles
  const roleNames = SYSTEM_ROLES.map(r => r.name);
  assert.ok(roleNames.includes('SUPER_ADMIN'));
  assert.ok(roleNames.includes('ADMIN'));
  assert.ok(roleNames.includes('ORGANISER'));
  assert.ok(roleNames.includes('PLAYER'));
  assert.ok(roleNames.includes('AUDITOR'));

  // Feature flags: free_tournaments_only MUST be true for launch
  const freeOnlyFlag = DEFAULT_FEATURE_FLAGS.find(f => f.key === 'free_tournaments_only');
  assert.ok(freeOnlyFlag, 'free_tournaments_only flag must exist');
  assert.equal(freeOnlyFlag.enabled, true, 'Launch mandate: free tournaments only');

  // Real money wallet MUST be false initially
  const walletFlag = DEFAULT_FEATURE_FLAGS.find(f => f.key === 'real_money_wallet_enabled');
  assert.ok(walletFlag, 'real_money_wallet_enabled flag must exist');
  assert.equal(walletFlag.enabled, false, 'Launch mandate: real money wallet disabled');
});
