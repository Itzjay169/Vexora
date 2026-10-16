import { query } from '../common/database.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/errorHandler.js';

/**
 * Vexora Seasons Management Service — Phase 14
 *
 * Implements:
 *   - Season lifecycle: UPCOMING -> ACTIVE -> COMPLETED -> ARCHIVED
 *   - Enforces invariant: Exactly one active season per game title
 *   - Fixed start/end date validation
 *   - Comprehensive audit logging for all mutations
 */

/**
 * Create a new competitive season.
 */
export async function createSeason(data, adminUserId, actor = {}) {
  // 1. Verify game exists
  const game = await query('SELECT id, name, slug FROM games WHERE id = $1', [data.game_id]);
  if (game.rows.length === 0) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // 2. Validate dates
  const startAt = new Date(data.start_at);
  const endAt = new Date(data.end_at);
  if (endAt <= startAt) {
    throw new AppError('End date must be strictly after start date', 400, 'INVALID_SEASON_DATES');
  }

  // 3. Check slug uniqueness for this game
  const existing = await query(
    'SELECT id FROM seasons WHERE game_id = $1 AND slug = $2',
    [data.game_id, data.slug]
  );
  if (existing.rows.length > 0) {
    throw new AppError(`Season with slug "${data.slug}" already exists for this game`, 409, 'SEASON_SLUG_EXISTS');
  }

  // 4. Determine initial status based on start_at
  const now = new Date();
  const initialStatus = startAt > now ? 'UPCOMING' : 'ACTIVE';

  // 5. Insert season
  const result = await query(
    `INSERT INTO seasons (
       game_id, name, slug, season_number, description,
       start_at, end_at, status, is_active, banner_url, rules_config
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9, $10)
     RETURNING *`,
    [
      data.game_id,
      data.name,
      data.slug,
      data.season_number || 1,
      data.description || null,
      data.start_at,
      data.end_at,
      initialStatus,
      data.banner_url || null,
      JSON.stringify(data.rules_config || {}),
    ]
  );
  const season = result.rows[0];

  // 6. Audit log
  await appendAuditLog({
    actorId: adminUserId,
    actorRole: actor.role || 'ADMIN',
    action: 'seasons:create',
    entityType: 'SEASON',
    entityId: season.id,
    afterState: { name: season.name, game_id: season.game_id, slug: season.slug },
    reason: `Created season "${season.name}"`,
    requestId: actor.requestId,
  });

  return season;
}

/**
 * List seasons with optional filtering by game and status.
 */
export async function getSeasons({ gameId, status, limit = 20, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (gameId) {
    params.push(gameId);
    conditions.push(`s.game_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`s.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(Math.min(limit, 100));
  const limitIndex = params.length;
  params.push(offset);
  const offsetIndex = params.length;

  const result = await query(
    `SELECT s.*, g.name as game_name, g.slug as game_slug
     FROM seasons s
     JOIN games g ON s.game_id = g.id
     ${whereClause}
     ORDER BY s.season_number DESC, s.start_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );

  return result.rows;
}

/**
 * Get active season for a game title.
 */
export async function getActiveSeason(gameId) {
  const result = await query(
    `SELECT s.*, g.name as game_name, g.slug as game_slug
     FROM seasons s
     JOIN games g ON s.game_id = g.id
     WHERE s.game_id = $1 AND s.is_active = TRUE`,
    [gameId]
  );
  return result.rows[0] || null;
}

/**
 * Get season by ID.
 */
export async function getSeasonById(seasonId) {
  const result = await query(
    `SELECT s.*, g.name as game_name, g.slug as game_slug
     FROM seasons s
     JOIN games g ON s.game_id = g.id
     WHERE s.id = $1`,
    [seasonId]
  );
  if (result.rows.length === 0) {
    throw new AppError('Season not found', 404, 'SEASON_NOT_FOUND');
  }
  return result.rows[0];
}

/**
 * Update season metadata.
 */
export async function updateSeason(seasonId, updates, adminUserId, actor = {}) {
  const current = await getSeasonById(seasonId);

  const fields = [];
  const values = [];
  const allowed = ['name', 'description', 'banner_url', 'rules_config', 'status', 'start_at', 'end_at'];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      values.push(key === 'rules_config' ? JSON.stringify(updates[key]) : updates[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (fields.length === 0) {
    throw new AppError('No valid update fields provided', 400, 'NO_UPDATE_FIELDS');
  }

  // Validate dates if either changed
  const newStart = updates.start_at ? new Date(updates.start_at) : new Date(current.start_at);
  const newEnd = updates.end_at ? new Date(updates.end_at) : new Date(current.end_at);
  if (newEnd <= newStart) {
    throw new AppError('End date must be strictly after start date', 400, 'INVALID_SEASON_DATES');
  }

  values.push(seasonId);
  fields.push('updated_at = NOW()');

  const result = await query(
    `UPDATE seasons SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );

  await appendAuditLog({
    actorId: adminUserId,
    actorRole: actor.role || 'ADMIN',
    action: 'seasons:update',
    entityType: 'SEASON',
    entityId: seasonId,
    beforeState: current,
    afterState: result.rows[0],
    reason: 'Season details updated',
    requestId: actor.requestId,
  });

  return result.rows[0];
}

/**
 * Activate a season for a game. Enforces single active season invariant.
 */
export async function activateSeason(seasonId, adminUserId, actor = {}) {
  const season = await getSeasonById(seasonId);

  // 1. Deactivate all existing active seasons for this game
  await query(
    'UPDATE seasons SET is_active = FALSE, updated_at = NOW() WHERE game_id = $1 AND is_active = TRUE',
    [season.game_id]
  );

  // 2. Activate the selected season
  const result = await query(
    `UPDATE seasons SET is_active = TRUE, status = 'ACTIVE', updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [seasonId]
  );

  await appendAuditLog({
    actorId: adminUserId,
    actorRole: actor.role || 'ADMIN',
    action: 'seasons:activate',
    entityType: 'SEASON',
    entityId: seasonId,
    reason: `Activated season "${season.name}" for game ${season.game_name}`,
    requestId: actor.requestId,
  });

  return result.rows[0];
}

/**
 * Archive a season.
 */
export async function archiveSeason(seasonId, adminUserId, actor = {}) {
  const season = await getSeasonById(seasonId);

  const result = await query(
    `UPDATE seasons SET is_active = FALSE, status = 'ARCHIVED', updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [seasonId]
  );

  await appendAuditLog({
    actorId: adminUserId,
    actorRole: actor.role || 'ADMIN',
    action: 'seasons:archive',
    entityType: 'SEASON',
    entityId: seasonId,
    reason: `Archived season "${season.name}"`,
    requestId: actor.requestId,
  });

  return result.rows[0];
}
