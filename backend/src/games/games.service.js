import { query, withTransaction } from '../common/database.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/errorHandler.js';
import { simulateTournamentScoring, calculateFormulaScore, sortStandings } from '../../../packages/scoring-engine/src/index.js';

/**
 * Vexora Games, Modes & Versioned Scoring Service — Phase 11
 *
 * Implements:
 *   - Configurable game engine (no hardcoded games)
 *   - Game modes CRUD with team-size constraints
 *   - Reusable tournament rule templates & evidence requirements
 *   - Versioned scoring formula management with strict immutability (No Silent Edits)
 *   - Interactive tournament scoring simulator
 *   - Full tamper-evident audit logging for all mutations
 *
 * Blueprint refs: Section 5 (Game & Rules Engine), Section 31 (ADR-002, ADR-015), Section 39
 */

// ─── Games Catalog CRUD ─────────────────────────────────────────────────────

export async function listGames({ status = null, platform = null } = {}) {
  let sql = `
    SELECT g.*,
           COALESCE(
             (SELECT json_agg(json_build_object(
               'id', gm.id, 'slug', gm.slug, 'name', gm.name, 'format', gm.format,
               'team_size', gm.team_size, 'min_team_size', gm.min_team_size,
               'max_team_size', gm.max_team_size, 'is_active', gm.is_active,
               'description', gm.description
             ) ORDER BY gm.name) FROM game_modes gm WHERE gm.game_id = g.id AND gm.is_active = TRUE),
             '[]'
           ) as modes,
           COALESCE(
             (SELECT json_agg(json_build_object(
               'id', ss.id, 'mode_slug', ss.mode_slug, 'mode_name', ss.mode_name,
               'version', ss.version, 'is_active', ss.is_active, 'formula', ss.formula,
               'tie_breakers', ss.tie_breakers, 'evidence_requirements', ss.evidence_requirements
             ) ORDER BY ss.version DESC) FROM scoring_schemas ss WHERE ss.game_id = g.id AND ss.is_active = TRUE),
             '[]'
           ) as active_scoring_schemas
    FROM games g
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    params.push(status);
    sql += ` AND g.status = $${params.length}`;
  }
  if (platform) {
    params.push(platform);
    sql += ` AND $${params.length} = ANY(g.platforms)`;
  }

  sql += ` ORDER BY g.name ASC`;

  const result = await query(sql, params);
  return result.rows;
}

export async function getGameBySlug(slug) {
  const result = await query(
    `SELECT g.*,
            COALESCE(
              (SELECT json_agg(json_build_object(
                'id', gm.id, 'slug', gm.slug, 'name', gm.name, 'format', gm.format,
                'team_size', gm.team_size, 'min_team_size', gm.min_team_size,
                'max_team_size', gm.max_team_size, 'is_active', gm.is_active,
                'description', gm.description, 'metadata', gm.metadata
              ) ORDER BY gm.name) FROM game_modes gm WHERE gm.game_id = g.id),
              '[]'
            ) as modes,
            COALESCE(
              (SELECT json_agg(json_build_object(
                'id', rt.id, 'name', rt.name, 'description', rt.description,
                'is_default', rt.is_default, 'evidence_requirements', rt.evidence_requirements,
                'tie_breaker_rules', rt.tie_breaker_rules
              ) ORDER BY rt.created_at) FROM rule_templates rt WHERE rt.game_id = g.id),
              '[]'
            ) as rule_templates,
            COALESCE(
              (SELECT json_agg(json_build_object(
                'id', ss.id, 'mode_slug', ss.mode_slug, 'mode_name', ss.mode_name,
                'version', ss.version, 'formula', ss.formula, 'tie_breakers', ss.tie_breakers,
                'evidence_requirements', ss.evidence_requirements, 'is_active', ss.is_active,
                'previous_version_id', ss.previous_version_id, 'created_at', ss.created_at
              ) ORDER BY ss.created_at DESC) FROM scoring_schemas ss WHERE ss.game_id = g.id),
              '[]'
            ) as scoring_schemas
     FROM games g
     WHERE g.slug = $1`,
    [slug]
  );

  if (result.rows.length === 0) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  return result.rows[0];
}

export async function getGameById(id) {
  const result = await query('SELECT * FROM games WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }
  return result.rows[0];
}

export async function createGame(data, actor = {}) {
  // Check slug uniqueness
  const existing = await query('SELECT id FROM games WHERE slug = $1', [data.slug]);
  if (existing.rows.length > 0) {
    throw new AppError(`Game with slug "${data.slug}" already exists`, 409, 'GAME_SLUG_CONFLICT');
  }

  const result = await query(
    `INSERT INTO games (slug, name, publisher, icon_url, banner_url, status, max_team_size, min_team_size, platforms, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.slug,
      data.name,
      data.publisher || null,
      data.icon_url || null,
      data.banner_url || null,
      data.status || 'ACTIVE',
      data.max_team_size ?? 4,
      data.min_team_size ?? 1,
      data.platforms || ['ANDROID', 'IOS'],
      JSON.stringify(data.metadata || {}),
    ]
  );

  const createdGame = result.rows[0];

  await appendAuditLog({
    actorId: actor.id || null,
    actorRole: actor.role || 'ADMIN',
    action: 'games:create',
    entityType: 'GAME',
    entityId: createdGame.id,
    payload: { slug: createdGame.slug, name: createdGame.name },
    afterState: createdGame,
    reason: 'Admin registered new competitive game title',
    requestId: actor.requestId || null,
  });

  return createdGame;
}

export async function updateGame(id, data, actor = {}) {
  const current = await getGameById(id);

  const fields = [];
  const values = [];

  if (data.name !== undefined) {
    values.push(data.name);
    fields.push(`name = $${values.length}`);
  }
  if (data.publisher !== undefined) {
    values.push(data.publisher);
    fields.push(`publisher = $${values.length}`);
  }
  if (data.icon_url !== undefined) {
    values.push(data.icon_url);
    fields.push(`icon_url = $${values.length}`);
  }
  if (data.banner_url !== undefined) {
    values.push(data.banner_url);
    fields.push(`banner_url = $${values.length}`);
  }
  if (data.status !== undefined) {
    values.push(data.status);
    fields.push(`status = $${values.length}`);
  }
  if (data.max_team_size !== undefined) {
    values.push(data.max_team_size);
    fields.push(`max_team_size = $${values.length}`);
  }
  if (data.min_team_size !== undefined) {
    values.push(data.min_team_size);
    fields.push(`min_team_size = $${values.length}`);
  }
  if (data.platforms !== undefined) {
    values.push(data.platforms);
    fields.push(`platforms = $${values.length}`);
  }
  if (data.metadata !== undefined) {
    values.push(JSON.stringify(data.metadata));
    fields.push(`metadata = $${values.length}`);
  }

  if (fields.length === 0) return current;

  values.push(id);
  fields.push('updated_at = NOW()');

  const result = await query(
    `UPDATE games SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );

  const updatedGame = result.rows[0];

  await appendAuditLog({
    actorId: actor.id || null,
    actorRole: actor.role || 'ADMIN',
    action: 'games:edit',
    entityType: 'GAME',
    entityId: id,
    payload: { changedFields: Object.keys(data) },
    beforeState: current,
    afterState: updatedGame,
    reason: actor.reason || 'Admin updated game details',
    requestId: actor.requestId || null,
  });

  return updatedGame;
}

export async function deleteGame(id, actor = {}) {
  const current = await getGameById(id);

  // Soft delete by updating status to DEPRECATED
  const result = await query(
    `UPDATE games SET status = 'DEPRECATED', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );

  await appendAuditLog({
    actorId: actor.id || null,
    actorRole: actor.role || 'SUPER_ADMIN',
    action: 'games:delete',
    entityType: 'GAME',
    entityId: id,
    payload: { previousStatus: current.status, newStatus: 'DEPRECATED' },
    beforeState: current,
    afterState: result.rows[0],
    reason: actor.reason || 'Admin deprecated game title',
    requestId: actor.requestId || null,
  });

  return result.rows[0];
}

// ─── Game Modes CRUD ────────────────────────────────────────────────────────

export async function listGameModes(gameId) {
  const result = await query(
    `SELECT * FROM game_modes WHERE game_id = $1 ORDER BY name ASC`,
    [gameId]
  );
  return result.rows;
}

export async function createGameMode(gameId, data, actor = {}) {
  await getGameById(gameId); // verify game exists

  const existing = await query(
    `SELECT id FROM game_modes WHERE game_id = $1 AND slug = $2`,
    [gameId, data.slug]
  );
  if (existing.rows.length > 0) {
    throw new AppError(`Game mode slug "${data.slug}" already exists for this game`, 409, 'MODE_SLUG_CONFLICT');
  }

  const result = await query(
    `INSERT INTO game_modes (game_id, slug, name, format, team_size, min_team_size, max_team_size, is_active, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      gameId,
      data.slug,
      data.name,
      data.format || 'BATTLE_ROYALE',
      data.team_size ?? 4,
      data.min_team_size ?? 1,
      data.max_team_size ?? 4,
      data.is_active ?? true,
      data.description || null,
      JSON.stringify(data.metadata || {}),
    ]
  );

  const createdMode = result.rows[0];

  await appendAuditLog({
    actorId: actor.id || null,
    actorRole: actor.role || 'ADMIN',
    action: 'games:mode_create',
    entityType: 'GAME_MODE',
    entityId: createdMode.id,
    payload: { gameId, slug: createdMode.slug, name: createdMode.name },
    afterState: createdMode,
    reason: 'Admin configured new game mode',
    requestId: actor.requestId || null,
  });

  return createdMode;
}

export async function updateGameMode(modeId, data, actor = {}) {
  const currentResult = await query('SELECT * FROM game_modes WHERE id = $1', [modeId]);
  if (currentResult.rows.length === 0) {
    throw new AppError('Game mode not found', 404, 'MODE_NOT_FOUND');
  }
  const current = currentResult.rows[0];

  const fields = [];
  const values = [];

  if (data.name !== undefined) {
    values.push(data.name);
    fields.push(`name = $${values.length}`);
  }
  if (data.format !== undefined) {
    values.push(data.format);
    fields.push(`format = $${values.length}`);
  }
  if (data.team_size !== undefined) {
    values.push(data.team_size);
    fields.push(`team_size = $${values.length}`);
  }
  if (data.min_team_size !== undefined) {
    values.push(data.min_team_size);
    fields.push(`min_team_size = $${values.length}`);
  }
  if (data.max_team_size !== undefined) {
    values.push(data.max_team_size);
    fields.push(`max_team_size = $${values.length}`);
  }
  if (data.is_active !== undefined) {
    values.push(data.is_active);
    fields.push(`is_active = $${values.length}`);
  }
  if (data.description !== undefined) {
    values.push(data.description);
    fields.push(`description = $${values.length}`);
  }
  if (data.metadata !== undefined) {
    values.push(JSON.stringify(data.metadata));
    fields.push(`metadata = $${values.length}`);
  }

  if (fields.length === 0) return current;

  values.push(modeId);
  fields.push('updated_at = NOW()');

  const result = await query(
    `UPDATE game_modes SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );

  const updatedMode = result.rows[0];

  await appendAuditLog({
    actorId: actor.id || null,
    actorRole: actor.role || 'ADMIN',
    action: 'games:mode_edit',
    entityType: 'GAME_MODE',
    entityId: modeId,
    payload: { changedFields: Object.keys(data) },
    beforeState: current,
    afterState: updatedMode,
    reason: actor.reason || 'Admin updated game mode configuration',
    requestId: actor.requestId || null,
  });

  return updatedMode;
}

// ─── Rule Templates CRUD ───────────────────────────────────────────────────

export async function listRuleTemplates(gameId) {
  const result = await query(
    `SELECT rt.*, gm.name as mode_name, gm.slug as mode_slug
     FROM rule_templates rt
     LEFT JOIN game_modes gm ON rt.mode_id = gm.id
     WHERE rt.game_id = $1
     ORDER BY rt.is_default DESC, rt.created_at ASC`,
    [gameId]
  );
  return result.rows;
}

export async function createRuleTemplate(data, actor = {}) {
  await getGameById(data.game_id);

  const result = await query(
    `INSERT INTO rule_templates (game_id, mode_id, name, description, rules_text, evidence_requirements, tie_breaker_rules, is_default, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.game_id,
      data.mode_id || null,
      data.name,
      data.description || null,
      data.rules_text,
      JSON.stringify(data.evidence_requirements || {}),
      JSON.stringify(data.tie_breaker_rules || []),
      data.is_default ?? false,
      actor.id || null,
    ]
  );

  const createdTemplate = result.rows[0];

  await appendAuditLog({
    actorId: actor.id || null,
    actorRole: actor.role || 'ADMIN',
    action: 'games:rule_template_create',
    entityType: 'RULE_TEMPLATE',
    entityId: createdTemplate.id,
    payload: { gameId: data.game_id, name: createdTemplate.name },
    afterState: createdTemplate,
    reason: 'Admin authored tournament rule template',
    requestId: actor.requestId || null,
  });

  return createdTemplate;
}

export async function updateRuleTemplate(id, data, actor = {}) {
  const currentResult = await query('SELECT * FROM rule_templates WHERE id = $1', [id]);
  if (currentResult.rows.length === 0) {
    throw new AppError('Rule template not found', 404, 'RULE_TEMPLATE_NOT_FOUND');
  }
  const current = currentResult.rows[0];

  const fields = [];
  const values = [];

  if (data.name !== undefined) {
    values.push(data.name);
    fields.push(`name = $${values.length}`);
  }
  if (data.description !== undefined) {
    values.push(data.description);
    fields.push(`description = $${values.length}`);
  }
  if (data.rules_text !== undefined) {
    values.push(data.rules_text);
    fields.push(`rules_text = $${values.length}`);
  }
  if (data.evidence_requirements !== undefined) {
    values.push(JSON.stringify(data.evidence_requirements));
    fields.push(`evidence_requirements = $${values.length}`);
  }
  if (data.tie_breaker_rules !== undefined) {
    values.push(JSON.stringify(data.tie_breaker_rules));
    fields.push(`tie_breaker_rules = $${values.length}`);
  }
  if (data.is_default !== undefined) {
    values.push(data.is_default);
    fields.push(`is_default = $${values.length}`);
  }

  if (fields.length === 0) return current;

  values.push(id);
  fields.push('updated_at = NOW()');

  const result = await query(
    `UPDATE rule_templates SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );

  const updatedTemplate = result.rows[0];

  await appendAuditLog({
    actorId: actor.id || null,
    actorRole: actor.role || 'ADMIN',
    action: 'games:rule_template_edit',
    entityType: 'RULE_TEMPLATE',
    entityId: id,
    payload: { changedFields: Object.keys(data) },
    beforeState: current,
    afterState: updatedTemplate,
    reason: actor.reason || 'Admin updated rule template',
    requestId: actor.requestId || null,
  });

  return updatedTemplate;
}

// ─── Versioned Scoring Schemas Management ───────────────────────────────────

export async function listScoringSchemas(gameId, modeSlug = null) {
  let sql = `SELECT * FROM scoring_schemas WHERE game_id = $1`;
  const params = [gameId];

  if (modeSlug) {
    params.push(modeSlug);
    sql += ` AND mode_slug = $2`;
  }

  sql += ` ORDER BY created_at DESC`;

  const result = await query(sql, params);
  return result.rows;
}

export async function getScoringSchemaById(id) {
  const result = await query('SELECT * FROM scoring_schemas WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    throw new AppError('Scoring schema not found', 404, 'SCORING_SCHEMA_NOT_FOUND');
  }
  return result.rows[0];
}

/**
 * Create initial scoring schema version for a game mode.
 */
export async function createScoringSchema(data, actor = {}) {
  await getGameById(data.game_id);

  // Check version uniqueness for game + mode
  const existing = await query(
    `SELECT id FROM scoring_schemas WHERE game_id = $1 AND mode_slug = $2 AND version = $3`,
    [data.game_id, data.mode_slug, data.version]
  );
  if (existing.rows.length > 0) {
    throw new AppError(
      `Scoring schema version "${data.version}" already exists for ${data.mode_slug}`,
      409,
      'SCORING_VERSION_CONFLICT'
    );
  }

  const result = await query(
    `INSERT INTO scoring_schemas (
       game_id, mode_id, mode_slug, mode_name, version, formula,
       tie_breakers, evidence_requirements, is_active, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.game_id,
      data.mode_id || null,
      data.mode_slug,
      data.mode_name,
      data.version,
      JSON.stringify(data.formula),
      JSON.stringify(data.tie_breakers || []),
      JSON.stringify(data.evidence_requirements || {}),
      data.is_active ?? true,
      actor.id || null,
    ]
  );

  const createdSchema = result.rows[0];

  await appendAuditLog({
    actorId: actor.id || null,
    actorRole: actor.role || 'ADMIN',
    action: 'games:scoring_schema_create',
    entityType: 'SCORING_SCHEMA',
    entityId: createdSchema.id,
    payload: {
      gameId: data.game_id,
      modeSlug: data.mode_slug,
      version: data.version,
      formula: data.formula,
    },
    afterState: createdSchema,
    reason: 'Admin published initial scoring schema version',
    requestId: actor.requestId || null,
  });

  return createdSchema;
}

/**
 * Formula Versioning Enforcement (ADR-002, ADR-015 Invariant: No Silent Edits):
 * Never silently alter a published formula. Creates a new version row, preserves the
 * immutable previous version, links previous_version_id, and records full audit trail.
 */
export async function createNewScoringVersion(schemaId, newVersionData, actor = {}) {
  const current = await getScoringSchemaById(schemaId);

  if (current.version === newVersionData.new_version) {
    throw new AppError(
      `New version (${newVersionData.new_version}) must differ from current version (${current.version})`,
      400,
      'VERSION_MUST_INCREMENT'
    );
  }

  // Check new version uniqueness
  const existing = await query(
    `SELECT id FROM scoring_schemas WHERE game_id = $1 AND mode_slug = $2 AND version = $3`,
    [current.game_id, current.mode_slug, newVersionData.new_version]
  );
  if (existing.rows.length > 0) {
    throw new AppError(
      `Version "${newVersionData.new_version}" already exists for mode "${current.mode_slug}"`,
      409,
      'VERSION_ALREADY_EXISTS'
    );
  }

  const result = await query(
    `INSERT INTO scoring_schemas (
       game_id, mode_id, mode_slug, mode_name, version, formula,
       tie_breakers, evidence_requirements, is_active, created_by, previous_version_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10)
     RETURNING *`,
    [
      current.game_id,
      current.mode_id,
      current.mode_slug,
      current.mode_name,
      newVersionData.new_version,
      JSON.stringify(newVersionData.formula),
      JSON.stringify(newVersionData.tie_breakers || current.tie_breakers || []),
      JSON.stringify(newVersionData.evidence_requirements || current.evidence_requirements || {}),
      actor.id || null,
      current.id,
    ]
  );

  const newVersionRow = result.rows[0];

  // Audit log with full delta and mandatory change reason
  await appendAuditLog({
    actorId: actor.id || null,
    actorRole: actor.role || 'ADMIN',
    action: 'games:scoring_schema_version_increment',
    entityType: 'SCORING_SCHEMA',
    entityId: newVersionRow.id,
    payload: {
      gameId: current.game_id,
      modeSlug: current.mode_slug,
      oldVersion: current.version,
      newVersion: newVersionRow.version,
      previousVersionId: current.id,
      formulaDiff: {
        oldFormula: current.formula,
        newFormula: newVersionData.formula,
      },
    },
    beforeState: current,
    afterState: newVersionRow,
    reason: newVersionData.change_reason,
    requestId: actor.requestId || null,
  });

  return newVersionRow;
}

// ─── Scoring Simulator ──────────────────────────────────────────────────────

export function simulateTournamentResults({ formula, game_slug, participants }) {
  if (!participants || participants.length === 0) {
    throw new AppError('Participants list is required for simulation', 400, 'PARTICIPANTS_REQUIRED');
  }

  return simulateTournamentScoring({ formula, gameSlug: game_slug }, participants);
}
