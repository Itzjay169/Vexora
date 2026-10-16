import crypto from 'crypto';
import { query } from './database.js';

const GENESIS_HASH = '0'.repeat(64);

/**
 * Append an entry to the tamper-evident audit hash chain.
 * Each record's curr_hash = SHA256(prev_hash + id + actor_id + action + entity + payload + timestamp).
 *
 * @param {Object} params
 * @param {string|null} params.actorId - User performing the action
 * @param {string|null} params.actorRole - Role at time of action
 * @param {string} params.action - Action identifier (e.g. 'USER_LOGIN', 'MATCH_RESULT_SUBMITTED')
 * @param {string} params.entityType - Entity type (e.g. 'tournament', 'match', 'ledger')
 * @param {string|null} params.entityId - Entity primary key
 * @param {Object} params.payload - Additional context data
 * @param {string|null} params.ipHash - SHA256 of requester IP
 * @param {import('pg').PoolClient} [params.client] - Optional transaction client
 */
export async function appendAuditLog({
  actorId = null,
  actorRole = null,
  action,
  entityType,
  entityId = null,
  payload = {},
  ipHash = null,
  client = null,
}) {
  const queryFn = client ? client.query.bind(client) : query;

  // Get the previous hash (last entry in the chain)
  const lastResult = await queryFn(
    'SELECT curr_hash FROM audit_logs ORDER BY id DESC LIMIT 1'
  );
  const prevHash = lastResult.rows.length > 0
    ? lastResult.rows[0].curr_hash
    : GENESIS_HASH;

  // Compute current hash
  const now = new Date().toISOString();
  const hashInput = [
    prevHash,
    actorId || '',
    action,
    entityType,
    entityId || '',
    JSON.stringify(payload),
    now,
  ].join('|');

  const currHash = crypto.createHash('sha256').update(hashInput).digest('hex');

  const insertResult = await queryFn(
    `INSERT INTO audit_logs
       (actor_id, actor_role, action, entity_type, entity_id, payload, ip_hash, prev_hash, curr_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [actorId, actorRole, action, entityType, entityId, payload, ipHash, prevHash, currHash, now]
  );

  return insertResult.rows[0];
}

/**
 * Hash an IP address for privacy-safe logging.
 */
export function hashIP(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + (process.env.AUDIT_MERKLE_SALT || '')).digest('hex');
}

/**
 * Verify the integrity of the audit chain from a starting ID.
 * Returns { valid: boolean, brokenAt: number | null }
 */
export async function verifyAuditChain(fromId = 1) {
  const result = await query(
    'SELECT id, prev_hash, curr_hash FROM audit_logs WHERE id >= $1 ORDER BY id ASC',
    [fromId]
  );

  let expectedPrev = GENESIS_HASH;

  if (fromId > 1) {
    const prev = await query('SELECT curr_hash FROM audit_logs WHERE id = $1', [fromId - 1]);
    if (prev.rows.length > 0) expectedPrev = prev.rows[0].curr_hash;
  }

  for (const row of result.rows) {
    if (row.prev_hash !== expectedPrev) {
      return { valid: false, brokenAt: row.id };
    }
    expectedPrev = row.curr_hash;
  }

  return { valid: true, brokenAt: null };
}
