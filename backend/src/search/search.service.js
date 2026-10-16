import { query } from '../common/database.js';

/**
 * Vexora Search & Filter Engine — Phase 14
 *
 * Implements:
 *   - Fast PostgreSQL full-text (FTS) and trigram (pg_trgm) search
 *   - Unified search across Games, Teams, Players, Tournaments, Seasons
 *   - Type filters and sorting (Relevance, Newest, Name)
 *
 * SECURITY MANDATE (Phase 14 Security Gate):
 *   - Search NEVER exposes private fields (email, phone, firebase_uid, password_hash,
 *     dob, ip_hash, session tokens, or sensitive KYC records).
 *   - Respects user privacy: Filters out profiles where profile_visibility = 'PRIVATE'.
 */

// ─── Whitelisted Projection Fields (Zero-Leak) ──────────────────────────────

export const PUBLIC_PLAYER_FIELDS = Object.freeze([
  'u.id',
  'u.username',
  'u.display_name',
  'u.avatar_url',
  'u.fair_play_score',
]);

export const PUBLIC_TEAM_FIELDS = Object.freeze([
  't.id',
  't.name',
  't.tag',
  't.game_id',
  'g.name as game_name',
  't.logo_url',
  't.region',
  't.max_roster_size',
  't.transfer_window_open',
  'COUNT(tm.id)::int as roster_count',
]);

export const PUBLIC_GAME_FIELDS = Object.freeze([
  'g.id',
  'g.slug',
  'g.name',
  'g.publisher',
  'g.icon_url',
  'g.banner_url',
  'g.status',
  'g.platforms',
]);

export const PUBLIC_TOURNAMENT_FIELDS = Object.freeze([
  'tr.id',
  'tr.name',
  'tr.game_id',
  'g.name as game_name',
  'tr.status',
  'tr.format',
  'tr.capacity',
  'tr.schedule',
  'tr.entry_fee_credits',
  'tr.prize_pool_credits',
]);

export const PUBLIC_SEASON_FIELDS = Object.freeze([
  's.id',
  's.game_id',
  'g.name as game_name',
  's.name',
  's.slug',
  's.season_number',
  's.start_at',
  's.end_at',
  's.status',
  's.is_active',
  's.banner_url',
]);

// ─── Individual Entity Searches ─────────────────────────────────────────────

/**
 * Search games using trigram and full-text match.
 */
export async function searchGames(q, { limit = 20, offset = 0 } = {}) {
  const searchTerm = `%${q}%`;
  const result = await query(
    `SELECT ${PUBLIC_GAME_FIELDS.join(', ')},
            GREATEST(similarity(g.name, $1), similarity(COALESCE(g.publisher, ''), $1)) as score
     FROM games g
     WHERE (g.name ILIKE $2 OR g.publisher ILIKE $2 OR g.slug ILIKE $2)
        OR to_tsvector('english', g.name || ' ' || COALESCE(g.publisher, '')) @@ plainto_tsquery('english', $1)
     ORDER BY score DESC, g.name ASC
     LIMIT $3 OFFSET $4`,
    [q, searchTerm, Math.min(limit, 100), offset]
  );
  return result.rows;
}

/**
 * Search teams by name or tag with optional game/region filters.
 */
export async function searchTeams(q, { gameId, region, limit = 20, offset = 0 } = {}) {
  const params = [q, `%${q}%`];
  const conditions = [
    `(t.name ILIKE $2 OR t.tag ILIKE $2 OR to_tsvector('english', t.name || ' ' || t.tag || ' ' || COALESCE(t.description, '')) @@ plainto_tsquery('english', $1))`,
    't.is_active = TRUE',
  ];

  if (gameId) {
    params.push(gameId);
    conditions.push(`t.game_id = $${params.length}`);
  }

  if (region) {
    params.push(region);
    conditions.push(`t.region = $${params.length}`);
  }

  params.push(Math.min(limit, 100));
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const result = await query(
    `SELECT ${PUBLIC_TEAM_FIELDS.join(', ')},
            GREATEST(similarity(t.name, $1), similarity(t.tag, $1)) as score
     FROM teams t
     JOIN games g ON t.game_id = g.id
     LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.left_at IS NULL
     WHERE ${conditions.join(' AND ')}
     GROUP BY t.id, g.name
     ORDER BY score DESC, t.name ASC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return result.rows;
}

/**
 * Search players by username or display_name.
 * SECURITY: Never returns private fields. Excludes PRIVATE profiles.
 */
export async function searchPlayers(q, { limit = 20, offset = 0 } = {}) {
  const searchTerm = `%${q}%`;
  const result = await query(
    `SELECT ${PUBLIC_PLAYER_FIELDS.join(', ')},
            GREATEST(similarity(u.username, $1), similarity(COALESCE(u.display_name, ''), $1)) as score
     FROM users u
     WHERE (u.username ILIKE $2 OR u.display_name ILIKE $2 OR to_tsvector('english', u.username || ' ' || COALESCE(u.display_name, '')) @@ plainto_tsquery('english', $1))
       AND u.status = 'ACTIVE'
       AND COALESCE(u.profile_visibility, 'PUBLIC') != 'PRIVATE'
     ORDER BY score DESC, u.username ASC
     LIMIT $3 OFFSET $4`,
    [q, searchTerm, Math.min(limit, 100), offset]
  );
  return result.rows;
}

/**
 * Search tournaments with optional game and status filters.
 */
export async function searchTournaments(q, { gameId, status, limit = 20, offset = 0 } = {}) {
  const params = [q, `%${q}%`];
  const conditions = [
    `(tr.name ILIKE $2 OR to_tsvector('english', tr.name || ' ' || COALESCE(tr.description, '')) @@ plainto_tsquery('english', $1))`,
  ];

  if (gameId) {
    params.push(gameId);
    conditions.push(`tr.game_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`tr.status = $${params.length}`);
  }

  params.push(Math.min(limit, 100));
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const result = await query(
    `SELECT ${PUBLIC_TOURNAMENT_FIELDS.join(', ')},
            similarity(tr.name, $1) as score
     FROM tournaments tr
     JOIN games g ON tr.game_id = g.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY score DESC, tr.name ASC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return result.rows;
}

/**
 * Search seasons by name.
 */
export async function searchSeasons(q, { gameId, status, limit = 20, offset = 0 } = {}) {
  const params = [q, `%${q}%`];
  const conditions = [
    `(s.name ILIKE $2 OR to_tsvector('english', s.name || ' ' || COALESCE(s.description, '')) @@ plainto_tsquery('english', $1))`,
  ];

  if (gameId) {
    params.push(gameId);
    conditions.push(`s.game_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`s.status = $${params.length}`);
  }

  params.push(Math.min(limit, 100));
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const result = await query(
    `SELECT ${PUBLIC_SEASON_FIELDS.join(', ')},
            similarity(s.name, $1) as score
     FROM seasons s
     JOIN games g ON s.game_id = g.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY score DESC, s.start_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return result.rows;
}

// ─── Unified Multi-Entity Search ───────────────────────────────────────────

/**
 * Unified multi-entity search endpoint.
 * Dispatches to individual searchers based on type, or executes parallel searches when type is 'ALL'.
 */
export async function searchAll({ q, type = 'ALL', gameId, limit = 20, offset = 0, sort = 'RELEVANCE' } = {}) {
  const cleanQ = (q || '').trim();
  if (!cleanQ) {
    return { games: [], teams: [], players: [], tournaments: [], seasons: [] };
  }

  const subLimit = Math.min(limit, 20);

  switch (type) {
    case 'GAMES':
      return { games: await searchGames(cleanQ, { limit, offset }) };
    case 'TEAMS':
      return { teams: await searchTeams(cleanQ, { gameId, limit, offset }) };
    case 'PLAYERS':
      return { players: await searchPlayers(cleanQ, { limit, offset }) };
    case 'TOURNAMENTS':
      return { tournaments: await searchTournaments(cleanQ, { gameId, limit, offset }) };
    case 'SEASONS':
      return { seasons: await searchSeasons(cleanQ, { gameId, limit, offset }) };
    case 'ALL':
    default: {
      const [games, teams, players, tournaments, seasons] = await Promise.all([
        searchGames(cleanQ, { limit: subLimit, offset }),
        searchTeams(cleanQ, { gameId, limit: subLimit, offset }),
        searchPlayers(cleanQ, { limit: subLimit, offset }),
        searchTournaments(cleanQ, { gameId, limit: subLimit, offset }),
        searchSeasons(cleanQ, { gameId, limit: subLimit, offset }),
      ]);
      return { games, teams, players, tournaments, seasons };
    }
  }
}
