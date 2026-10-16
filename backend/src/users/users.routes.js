import { Router } from 'express';
import multer from 'multer';
import { query } from '../common/database.js';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { AppError } from '../common/errorHandler.js';
import {
  ProfileUpdateSchema,
  InGameIdLinkSchema,
  SignedUploadRequestSchema,
} from '../../../packages/validation/src/index.ts';
import * as usersService from './users.service.js';
import { getPlayerDashboard } from './playerDashboard.service.js';
import {
  generateSignedUploadToken,
  processSecureUpload,
} from '../common/uploadPipeline.js';

export const usersRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB buffer limit
});

// ─── GET / — List users (Admin only) ────────────────────────────────────────
usersRouter.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT id, username, display_name, avatar_url, role, status, profile_visibility, created_at
       FROM users WHERE deleted_at IS NULL
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL');

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count, 10),
        totalPages: Math.ceil(countResult.rows[0].count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /me — Authenticated user's full profile ────────────────────────────
usersRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const profile = await usersService.getOwnProfile(req.user.id);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

// ─── GET /me/dashboard — Authenticated user's own performance dashboard ─────
usersRouter.get('/me/dashboard', authenticate, async (req, res, next) => {
  try {
    const gameId = req.query.game_id || null;
    const dashboard = await getPlayerDashboard(req.user.id, req.user, gameId);
    res.json({ success: true, data: dashboard });
  } catch (err) {
    next(err);
  }
});

// ─── GET /profile/:username/dashboard — Public player performance dashboard ──
usersRouter.get('/profile/:username/dashboard', async (req, res, next) => {
  try {
    const viewer = req.user || null;
    const gameId = req.query.game_id || null;
    const dashboard = await getPlayerDashboard(req.params.username, viewer, gameId);
    res.json({ success: true, data: dashboard });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /me — Update own profile & privacy preferences ───────────────────
usersRouter.patch('/me', authenticate, async (req, res, next) => {
  try {
    const validated = ProfileUpdateSchema.parse(req.body);
    const actor = {
      requestId: req.correlationId || req.id,
    };
    const updated = await usersService.updateOwnProfile(req.user.id, validated, actor);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

// ─── GET /profile/:username — Public profile (Zero-leak data minimisation) ──
usersRouter.get('/profile/:username', async (req, res, next) => {
  try {
    const profile = await usersService.getPublicProfile(req.params.username);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

// ─── In-Game ID / UID Management Endpoints ──────────────────────────────────

/**
 * POST /me/game-ids — Link in-game UID
 * Invariant: Duplicate UID rule strictly enforced across all platform users.
 */
usersRouter.post('/me/game-ids', authenticate, async (req, res, next) => {
  try {
    const data = InGameIdLinkSchema.parse(req.body);
    const actor = {
      role: req.user?.role,
      requestId: req.correlationId || req.id,
    };
    const linked = await usersService.linkInGameId({
      userId: req.user.id,
      gameId: data.game_id,
      inGameUid: data.in_game_uid,
      inGameName: data.in_game_name,
      proofUploadId: data.proof_upload_id,
      actor,
    });
    res.status(201).json({ success: true, data: linked });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

/**
 * DELETE /me/game-ids/:gameId — Unlink in-game UID
 */
usersRouter.delete('/me/game-ids/:gameId', authenticate, async (req, res, next) => {
  try {
    const actor = {
      role: req.user?.role,
      requestId: req.correlationId || req.id,
    };
    const result = await usersService.unlinkInGameId(req.user.id, req.params.gameId, actor);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Secure Upload Pipeline Endpoints ───────────────────────────────────────

/**
 * POST /uploads/sign — Request pre-signed upload token & random object key
 */
usersRouter.post('/uploads/sign', authenticate, async (req, res, next) => {
  try {
    const data = SignedUploadRequestSchema.parse(req.body);
    const tokenData = generateSignedUploadToken({
      userId: req.user.id,
      purpose: data.purpose,
      filename: data.filename,
    });
    res.json({ success: true, data: tokenData });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors) : err);
  }
});

/**
 * POST /uploads/process — Ingest & process file through the hostile-file security pipeline
 * Accepts multipart/form-data or base64 JSON payload.
 */
usersRouter.post('/uploads/process', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    let fileBuffer;
    let filename;
    let purpose;

    if (req.file) {
      fileBuffer = req.file.buffer;
      filename = req.file.originalname;
      purpose = req.body.purpose;
    } else if (req.body.file_base64 && req.body.filename) {
      fileBuffer = Buffer.from(req.body.file_base64, 'base64');
      filename = req.body.filename;
      purpose = req.body.purpose;
    } else {
      throw new AppError('No file provided for upload', 400, 'MISSING_FILE_PAYLOAD');
    }

    if (!purpose) {
      throw new AppError('Upload purpose is required', 400, 'MISSING_PURPOSE');
    }

    // Process through the deep security pipeline:
    // 1. Magic bytes binary header inspection
    // 2. Hostile content & polyglot script scan
    // 3. SVG / XSS rejection
    // 4. EXIF stripping & image re-encoding
    // 5. SHA-256 ingress hashing
    const processed = await processSecureUpload({
      buffer: fileBuffer,
      filename,
      purpose,
      userId: req.user.id,
    });

    // Record in media_uploads database table
    const record = await usersService.recordMediaUpload({
      userId: req.user.id,
      purpose: processed.purpose,
      storageKey: processed.storageKey,
      originalFilename: processed.originalFilename,
      mimeType: processed.mimeType,
      fileSizeBytes: processed.processedSizeBytes,
      sha256Hash: processed.finalSha256,
      isSanitized: processed.isSanitized,
      metadata: {
        rawSizeBytes: processed.rawSizeBytes,
        rawSha256: processed.rawSha256,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: record.id,
        storageKey: processed.storageKey,
        mimeType: processed.mimeType,
        sha256Hash: processed.finalSha256,
        isSanitized: processed.isSanitized,
        sizeBytes: processed.processedSizeBytes,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /me/uploads — List authenticated user's uploaded assets
 */
usersRouter.get('/me/uploads', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, purpose, storage_key, original_filename, mime_type, file_size_bytes,
              sha256_hash, status, is_sanitized, created_at
       FROM media_uploads
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});
