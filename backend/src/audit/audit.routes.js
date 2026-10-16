import { Router } from 'express';
import { query } from '../common/database.js';
import { parsePagination, paginatedResponse } from '../common/pagination.js';
import { verifyAuditChain } from './audit.service.js';

const auditRouter = Router();

// GET /api/v1/audit/logs — Paginated audit log records
auditRouter.get('/logs', async (req, res, next) => {
  try {
    const { cursor, limit } = parsePagination(req.query);
    const action = req.query.action;
    const entityType = req.query.entity_type;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (action) {
      params.push(action);
      whereClause += ` AND action = $${params.length}`;
    }
    if (entityType) {
      params.push(entityType);
      whereClause += ` AND entity_type = $${params.length}`;
    }
    if (cursor) {
      params.push(cursor.ts, cursor.id);
      whereClause += ` AND (created_at, id) < ($${params.length - 1}, $${params.length})`;
    }

    params.push(limit + 1);

    const result = await query(
      `SELECT id, actor_id, actor_role, action, entity_type, entity_id,
              payload, before_state, after_state, reason, request_id,
              prev_hash, curr_hash, created_at
       FROM audit_logs
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({
      success: true,
      ...paginatedResponse(result.rows, limit),
      appendOnlyTriggerActive: true,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/audit/verify — Cryptographic chain verification
auditRouter.get('/verify', async (req, res, next) => {
  try {
    const fromId = parseInt(req.query.from_id, 10) || 1;
    const verification = await verifyAuditChain(null, fromId);

    const statusCode = verification.valid ? 200 : 500;
    res.status(statusCode).json({
      success: verification.valid,
      data: {
        status: verification.valid ? 'VERIFIED' : 'TAMPERED_SEV1',
        chainIntegrity: verification.valid ? 'VALID' : 'BROKEN',
        verifiedCount: verification.verifiedCount,
        brokenAtId: verification.brokenAtId,
        sev1Alert: verification.sev1Alert,
        verifiedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

export { auditRouter };
