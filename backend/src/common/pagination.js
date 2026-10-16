/**
 * Cursor-based pagination helper for Vexora API.
 *
 * Implements opaque Base64 cursors over UUIDv7 + timestamp columns for
 * consistent, efficient forward-only pagination without OFFSET.
 */

/**
 * Encode a cursor from a row's pagination fields.
 * @param {{ id: string, created_at: string }} row
 * @returns {string} Base64-encoded cursor
 */
export function encodeCursor(row) {
  const payload = JSON.stringify({ id: row.id, ts: row.created_at });
  return Buffer.from(payload).toString('base64url');
}

/**
 * Decode an opaque cursor string back into its fields.
 * @param {string} cursor
 * @returns {{ id: string, ts: string } | null}
 */
export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const payload = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(payload);
    if (!parsed.id || !parsed.ts) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Parse pagination query parameters with safe defaults and bounds.
 * @param {object} query - Express req.query
 * @returns {{ cursor: object|null, limit: number }}
 */
export function parsePagination(query) {
  const cursor = decodeCursor(query.cursor || query.after);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  return { cursor, limit };
}

/**
 * Build a paginated response envelope.
 * @param {object[]} rows - Query result rows
 * @param {number} limit - Page size
 * @returns {{ data: object[], meta: { nextCursor: string|null, hasMore: boolean } }}
 */
export function paginatedResponse(rows, limit) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && data.length > 0
    ? encodeCursor(data[data.length - 1])
    : null;

  return {
    data,
    meta: {
      nextCursor,
      hasMore,
      count: data.length,
    },
  };
}
