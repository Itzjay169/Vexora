import { query } from '../common/database.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/errorHandler.js';

/**
 * Vexora Player Profiles & In-Game ID Service — Phase 12
 *
 * Implements:
 *   - Public profile with strict zero-leak data minimisation (ADR-006, ADR-009)
 *   - Private profile visibility controls (PUBLIC, PRIVATE, FRIENDS_ONLY)
 *   - Favourite games selection
 *   - Per-game in-game ID / UID linking with database-enforced UNIQUENESS
 *   - Proof upload linkage for tournament UID verification
 *   - Media upload tracking with SHA-256 ingress hashes
 */

// ─── Profile Management ─────────────────────────────────────────────────────

/**
 * Get public player profile adhering to zero-leak data minimisation.
 * Never exposes phone, email, date of birth, firebase UID, IP, or devices.
 */
export async function getPublicProfile(username) {
  const userResult = await query(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.country,
            u.fair_play_score, u.profile_visibility, u.show_stats, u.show_game_ids,
            u.favourite_game_ids, u.created_at
     FROM users u
     WHERE u.username = $1 AND u.status = 'ACTIVE' AND u.deleted_at IS NULL`,
    [username]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('Player profile not found', 404, 'USER_NOT_FOUND');
  }

  const user = userResult.rows[0];

  // If profile is private, return only minimal public card
  if (user.profile_visibility === 'PRIVATE') {
    return {
      username: user.username,
      display_name: user.display_name || user.username,
      avatar_url: user.avatar_url,
      profile_visibility: 'PRIVATE',
      is_private: true,
      created_at: user.created_at,
    };
  }

  // Fetch favourite games
  let favouriteGames = [];
  if (user.favourite_game_ids && user.favourite_game_ids.length > 0) {
    const gamesResult = await query(
      `SELECT id, slug, name, icon_url FROM games WHERE id = ANY($1)`,
      [user.favourite_game_ids]
    );
    favouriteGames = gamesResult.rows;
  }

  // Fetch linked in-game names (only if user permitted public display)
  let linkedGameIdentities = [];
  if (user.show_game_ids) {
    const identitiesResult = await query(
      `SELECT g.slug as game_slug, g.name as game_name, ugi.in_game_name, ugi.verified
       FROM user_game_ids ugi
       JOIN games g ON ugi.game_id = g.id
       WHERE ugi.user_id = $1`,
      [user.id]
    );
    linkedGameIdentities = identitiesResult.rows;
  }

  // Fetch public badges/achievements
  const achievementsResult = await query(
    `SELECT a.slug, a.name, a.icon_url, ua.earned_at
     FROM user_achievements ua
     JOIN achievements a ON ua.achievement_id = a.id
     WHERE ua.user_id = $1`,
    [user.id]
  );

  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name || user.username,
    avatar_url: user.avatar_url,
    bio: user.bio,
    country: user.country,
    fair_play_score: user.fair_play_score,
    profile_visibility: user.profile_visibility,
    favourite_games: favouriteGames,
    linked_game_identities: linkedGameIdentities,
    achievements: achievementsResult.rows,
    created_at: user.created_at,
  };
}

/**
 * Get authenticated user's own complete profile.
 */
export async function getOwnProfile(userId) {
  const result = await query(
    `SELECT u.id, u.username, u.email, u.phone, u.display_name, u.avatar_url,
            u.bio, u.country, u.state_region, u.role, u.status, u.email_verified,
            u.phone_verified, u.profile_visibility, u.show_stats, u.show_game_ids,
            u.favourite_game_ids, u.fair_play_score, u.created_at, u.updated_at
     FROM users u
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const user = result.rows[0];

  // Fetch all linked in-game IDs
  const gameIdsResult = await query(
    `SELECT ugi.id, ugi.game_id, g.slug as game_slug, g.name as game_name,
            ugi.in_game_uid, ugi.in_game_name, ugi.verified, ugi.verified_at,
            ugi.proof_upload_id, ugi.created_at
     FROM user_game_ids ugi
     JOIN games g ON ugi.game_id = g.id
     WHERE ugi.user_id = $1`,
    [userId]
  );

  return {
    ...user,
    linked_game_ids: gameIdsResult.rows,
  };
}

/**
 * Update authenticated user's profile and privacy preferences.
 */
export async function updateOwnProfile(userId, updates, actor = {}) {
  const currentResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (currentResult.rows.length === 0) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  const current = currentResult.rows[0];

  const fields = [];
  const values = [];

  if (updates.display_name !== undefined) {
    values.push(updates.display_name);
    fields.push(`display_name = $${values.length}`);
  }
  if (updates.bio !== undefined) {
    values.push(updates.bio);
    fields.push(`bio = $${values.length}`);
  }
  if (updates.avatar_url !== undefined) {
    values.push(updates.avatar_url);
    fields.push(`avatar_url = $${values.length}`);
  }
  if (updates.country !== undefined) {
    values.push(updates.country);
    fields.push(`country = $${values.length}`);
  }
  if (updates.state_region !== undefined) {
    values.push(updates.state_region);
    fields.push(`state_region = $${values.length}`);
  }
  if (updates.profile_visibility !== undefined) {
    values.push(updates.profile_visibility);
    fields.push(`profile_visibility = $${values.length}`);
  }
  if (updates.show_stats !== undefined) {
    values.push(updates.show_stats);
    fields.push(`show_stats = $${values.length}`);
  }
  if (updates.show_game_ids !== undefined) {
    values.push(updates.show_game_ids);
    fields.push(`show_game_ids = $${values.length}`);
  }
  if (updates.favourite_game_ids !== undefined) {
    values.push(updates.favourite_game_ids);
    fields.push(`favourite_game_ids = $${values.length}`);
  }

  if (fields.length === 0) return current;

  values.push(userId);
  fields.push('updated_at = NOW()');

  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );

  const updatedUser = result.rows[0];

  await appendAuditLog({
    actorId: userId,
    actorRole: current.role,
    action: 'users:edit_own',
    entityType: 'USER_PROFILE',
    entityId: userId,
    payload: { updatedFields: Object.keys(updates) },
    beforeState: {
      display_name: current.display_name,
      profile_visibility: current.profile_visibility,
      favourite_game_ids: current.favourite_game_ids,
    },
    afterState: {
      display_name: updatedUser.display_name,
      profile_visibility: updatedUser.profile_visibility,
      favourite_game_ids: updatedUser.favourite_game_ids,
    },
    reason: 'Player updated profile information',
    requestId: actor.requestId || null,
  });

  return updatedUser;
}

// ─── In-Game ID / UID Linking (Uniqueness Invariant) ────────────────────────

/**
 * Link an in-game ID / UID to a user profile.
 *
 * Invariant: Duplicate UID rule enforced across all users.
 * If another user already linked this UID for the same game -> THROW 409 UID_ALREADY_LINKED.
 */
export async function linkInGameId({
  userId,
  gameId,
  inGameUid,
  inGameName,
  proofUploadId = null,
  actor = {},
}) {
  // 1. Verify game exists and is active
  const gameResult = await query('SELECT id, slug, name, status FROM games WHERE id = $1', [gameId]);
  if (gameResult.rows.length === 0) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }
  const game = gameResult.rows[0];
  if (game.status === 'DEPRECATED') {
    throw new AppError('Cannot link UID to deprecated game', 400, 'GAME_DEPRECATED');
  }

  const normalizedUid = String(inGameUid).trim();
  const normalizedName = String(inGameName || '').trim();

  // 2. Anti-smurfing & Anti-impersonation: Check if UID is already registered by another account
  const conflictResult = await query(
    `SELECT ugi.id, ugi.user_id, u.username
     FROM user_game_ids ugi
     JOIN users u ON ugi.user_id = u.id
     WHERE ugi.game_id = $1 AND ugi.in_game_uid = $2`,
    [gameId, normalizedUid]
  );

  if (conflictResult.rows.length > 0) {
    const existing = conflictResult.rows[0];
    if (existing.user_id !== userId) {
      throw new AppError(
        `This in-game UID is already registered by another competitive account on Vexora. (Game: ${game.name})`,
        409,
        'UID_ALREADY_LINKED'
      );
    }
  }

  // 3. Upsert into user_game_ids (one UID per game per user)
  const result = await query(
    `INSERT INTO user_game_ids (user_id, game_id, in_game_uid, in_game_name, proof_upload_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, game_id) DO UPDATE SET
       in_game_uid = EXCLUDED.in_game_uid,
       in_game_name = EXCLUDED.in_game_name,
       proof_upload_id = COALESCE(EXCLUDED.proof_upload_id, user_game_ids.proof_upload_id),
       verified = FALSE, -- reset verification on UID change
       updated_at = NOW()
     RETURNING *`,
    [userId, gameId, normalizedUid, normalizedName, proofUploadId]
  );

  const linkedRecord = result.rows[0];

  // 4. Audit log UID registration
  await appendAuditLog({
    actorId: userId,
    actorRole: actor.role || 'PLAYER',
    action: 'users:link_game_uid',
    entityType: 'USER_GAME_ID',
    entityId: linkedRecord.id,
    payload: {
      gameId,
      gameSlug: game.slug,
      inGameUid: normalizedUid,
      inGameName: normalizedName,
      proofUploadId,
    },
    afterState: linkedRecord,
    reason: 'Player linked in-game competitive UID',
    requestId: actor.requestId || null,
  });

  return {
    ...linkedRecord,
    game_slug: game.slug,
    game_name: game.name,
  };
}

/**
 * Unlink in-game ID from user profile.
 */
export async function unlinkInGameId(userId, gameId, actor = {}) {
  const currentResult = await query(
    `SELECT ugi.*, g.name as game_name, g.slug as game_slug
     FROM user_game_ids ugi
     JOIN games g ON ugi.game_id = g.id
     WHERE ugi.user_id = $1 AND ugi.game_id = $2`,
    [userId, gameId]
  );

  if (currentResult.rows.length === 0) {
    throw new AppError('Linked game UID not found', 404, 'GAME_ID_NOT_FOUND');
  }

  const current = currentResult.rows[0];

  await query('DELETE FROM user_game_ids WHERE id = $1', [current.id]);

  await appendAuditLog({
    actorId: userId,
    actorRole: actor.role || 'PLAYER',
    action: 'users:unlink_game_uid',
    entityType: 'USER_GAME_ID',
    entityId: current.id,
    payload: {
      gameId,
      gameSlug: current.game_slug,
      inGameUid: current.in_game_uid,
    },
    beforeState: current,
    reason: 'Player unlinked in-game UID',
    requestId: actor.requestId || null,
  });

  return { success: true, unlinked_game_id: gameId };
}

// ─── Media Upload Recording ─────────────────────────────────────────────────

/**
 * Record a validated and sanitized media upload into the database.
 */
export async function recordMediaUpload({
  userId,
  purpose,
  storageKey,
  originalFilename,
  mimeType,
  fileSizeBytes,
  sha256Hash,
  isSanitized = true,
  metadata = {},
}) {
  const result = await query(
    `INSERT INTO media_uploads (
       user_id, purpose, storage_key, original_filename, mime_type,
       file_size_bytes, sha256_hash, status, is_sanitized, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'VALIDATED', $8, $9)
     RETURNING *`,
    [
      userId,
      purpose,
      storageKey,
      originalFilename,
      mimeType,
      fileSizeBytes,
      sha256Hash,
      isSanitized,
      JSON.stringify(metadata),
    ]
  );

  return result.rows[0];
}
