import { AppError } from './errorHandler.js';
import { query } from './database.js';
import { logger } from './logger.js';

/**
 * Idempotency-Key deduplication middleware.
 *
 * For mutation endpoints (POST, PUT, PATCH), this middleware:
 * 1. Requires an Idempotency-Key header (UUID format, min 8 chars).
 * 2. Checks a PostgreSQL `idempotency_store` table for duplicate keys.
 * 3. If a prior result exists and is completed, returns the cached response (replay).
 * 4. If a prior result is in-progress, returns 409 Conflict.
 * 5. If new, registers the key and allows the request to proceed.
 *
 * After the handler completes, call `markIdempotencyComplete` to store the result.
 */
export function requireIdempotencyKey(req, _res, next) {
  const key = req.headers['idempotency-key'];
  if (!key || key.trim().length < 8) {
    return next(new AppError(
      'Idempotency-Key header is required (min 8 characters, UUIDv4 recommended)',
      400,
      'IDEMPOTENCY_KEY_REQUIRED'
    ));
  }
  req.idempotencyKey = key.trim();
  next();
}

/**
 * Check for existing idempotency key in the store.
 * If found and completed, returns the cached response body.
 * If found and in-progress, throws 409.
 * If not found, registers and returns null (proceed with handler).
 *
 * @param {string} key - The idempotency key
 * @param {string} endpoint - The route path for scoping
 * @returns {Promise<object|null>} Cached response or null
 */
export async function checkIdempotency(key, endpoint) {
  try {
    const existing = await query(
      `SELECT status, response_body, response_status FROM idempotency_store
       WHERE idempotency_key = $1 AND endpoint = $2`,
      [key, endpoint]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.status === 'COMPLETED') {
        logger.info('Idempotency replay: returning cached response', { key, endpoint });
        return { body: row.response_body, statusCode: row.response_status };
      }
      if (row.status === 'IN_PROGRESS') {
        throw new AppError(
          'A request with this Idempotency-Key is already being processed',
          409,
          'IDEMPOTENCY_CONFLICT'
        );
      }
    }

    // Register as in-progress (may fail on unique constraint = concurrent duplicate)
    try {
      await query(
        `INSERT INTO idempotency_store (idempotency_key, endpoint, status, created_at)
         VALUES ($1, $2, 'IN_PROGRESS', NOW())`,
        [key, endpoint]
      );
    } catch (insertErr) {
      if (insertErr.code === '23505') { // unique_violation
        throw new AppError(
          'Duplicate Idempotency-Key detected (concurrent request)',
          409,
          'IDEMPOTENCY_CONFLICT'
        );
      }
      throw insertErr;
    }

    return null;
  } catch (err) {
    if (err instanceof AppError) throw err;
    // If idempotency_store table doesn't exist yet, let the request through
    logger.warn('Idempotency store not available, proceeding without dedup', { key });
    return null;
  }
}

/**
 * Mark an idempotency key as completed and cache the response.
 * @param {string} key
 * @param {string} endpoint
 * @param {number} statusCode
 * @param {object} responseBody
 */
export async function markIdempotencyComplete(key, endpoint, statusCode, responseBody) {
  try {
    await query(
      `UPDATE idempotency_store
       SET status = 'COMPLETED', response_status = $3, response_body = $4, completed_at = NOW()
       WHERE idempotency_key = $1 AND endpoint = $2`,
      [key, endpoint, statusCode, JSON.stringify(responseBody)]
    );
  } catch (err) {
    logger.warn('Failed to mark idempotency complete', { key, endpoint, error: err.message });
  }
}
