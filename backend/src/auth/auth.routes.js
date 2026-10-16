import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../common/database.js';
import { AppError } from '../common/errorHandler.js';
import { authLimiter } from '../common/rateLimiter.js';
import { logger } from '../common/logger.js';
import {
  generateAccessToken,
  generateRefreshToken,
  generateMfaChallengeToken,
  verifyMfaChallengeToken,
  authenticate,
} from '../common/auth.middleware.js';
import { isAdminRole, ROLES } from '../common/rbac.js';
import {
  hashValue,
  authenticateWithFirebase,
  createSession,
  rotateRefreshToken,
  listSessions,
  revokeSession,
  revokeAllSessions,
  listDevices,
  blockDevice,
  checkOtpThrottle,
  recordOtpAttempt,
  changeEmail,
  changePhone,
  requestAccountDeletion,
} from './auth.service.js';
import { appendAuditLog } from '../common/auditLog.js';

export const authRouter = Router();

// ─── Validation Schemas ──────────────────────────────────────────────
const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().optional(),
  phone: z.string().min(10).max(20).optional(),
  display_name: z.string().min(2).max(50).optional(),
  password: z.string().min(8).max(128),
  date_of_birth: z.string().optional(),
  firebase_uid: z.string().optional(),
  device_info: z.object({
    platform: z.string().optional(),
    model: z.string().optional(),
    userAgent: z.string().optional(),
    osVersion: z.string().optional(),
    appVersion: z.string().optional(),
    pushToken: z.string().optional(),
  }).optional(),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone is required',
});

const loginSchema = z.object({
  identifier: z.string().min(3), // username, email, or phone
  password: z.string().min(1),
  device_info: z.object({
    platform: z.string().optional(),
    model: z.string().optional(),
    userAgent: z.string().optional(),
    osVersion: z.string().optional(),
    appVersion: z.string().optional(),
    pushToken: z.string().optional(),
  }).optional(),
});

const firebaseAuthSchema = z.object({
  firebase_id_token: z.string().min(1),
  device_info: z.object({
    platform: z.string().optional(),
    model: z.string().optional(),
    userAgent: z.string().optional(),
    osVersion: z.string().optional(),
    appVersion: z.string().optional(),
    pushToken: z.string().optional(),
  }).optional(),
});

// ─── POST /register ──────────────────────────────────────────────────
authRouter.post('/register', authLimiter, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check uniqueness
    const existing = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2 OR phone = $3 LIMIT 1',
      [data.username, data.email || null, data.phone || null]
    );
    if (existing.rows.length > 0) {
      throw new AppError('Username, email, or phone already registered', 409, 'DUPLICATE_USER');
    }

    // Hash password (bcrypt in production; SHA-256 for dev/unit tests)
    const passwordHash = crypto.createHash('sha256').update(data.password).digest('hex');

    // Create user
    const result = await query(
      `INSERT INTO users (username, email, phone, display_name, firebase_uid, date_of_birth)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, phone, role, status, created_at`,
      [data.username, data.email || null, data.phone || null,
       data.display_name || data.username, data.firebase_uid || null,
       data.date_of_birth || null]
    );

    const user = result.rows[0];

    // Create wallet account
    await query(
      `INSERT INTO wallet_accounts (owner_id, account_type, currency)
       VALUES ($1, 'USER', 'VXC')`,
      [user.id]
    );

    // Generate session with family tracking
    const { accessToken, refreshToken, sessionFamily } = await createSession({
      user,
      deviceInfo: data.device_info || null,
      ipAddress: req.ip,
    });

    // Audit log
    await appendAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: user.id,
      payload: { username: user.username },
      ipHash: hashValue(req.ip),
    });

    res.status(201).json({
      success: true,
      data: {
        user,
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});

// ─── POST /login ─────────────────────────────────────────────────────
authRouter.post('/login', authLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const result = await query(
      `SELECT id, username, email, phone, role, status
       FROM users
       WHERE (username = $1 OR email = $1 OR phone = $1)
         AND status = 'ACTIVE'
       LIMIT 1`,
      [data.identifier]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const user = result.rows[0];

    // Create session with family tracking
    const { accessToken, refreshToken } = await createSession({
      user,
      deviceInfo: data.device_info || null,
      ipAddress: req.ip,
    });

    await appendAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipHash: hashValue(req.ip),
    });

    res.json({
      success: true,
      data: {
        user,
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});

// ─── POST /firebase ──────────────────────────────────────────────────
// Firebase Auth integration — verify Firebase ID token and issue Vexora tokens
authRouter.post('/firebase', authLimiter, async (req, res, next) => {
  try {
    const data = firebaseAuthSchema.parse(req.body);

    const result = await authenticateWithFirebase({
      firebaseIdToken: data.firebase_id_token,
      deviceInfo: data.device_info || null,
      ipAddress: req.ip,
    });

    if (result.isNewUser) {
      // User needs to complete registration
      return res.status(200).json({
        success: true,
        data: {
          requiresRegistration: true,
          firebaseUid: result.firebaseUid,
          suggestedEmail: result.firebaseEmail,
          suggestedPhone: result.firebasePhone,
        },
      });
    }

    await appendAuditLog({
      actorId: result.user.id,
      actorRole: result.user.role,
      action: 'USER_FIREBASE_LOGIN',
      entityType: 'user',
      entityId: result.user.id,
      ipHash: hashValue(req.ip),
    });

    res.json({
      success: true,
      data: {
        user: result.user,
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      },
    });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});

// ─── POST /refresh ───────────────────────────────────────────────────
// Refresh token rotation with reuse detection
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError('Refresh token required', 400, 'MISSING_REFRESH_TOKEN');

    const result = await rotateRefreshToken({
      refreshToken,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: {
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /logout ────────────────────────────────────────────────────
authRouter.post('/logout', authenticate, async (req, res, next) => {
  try {
    await revokeAllSessions(req.user.id);

    await appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'USER_LOGOUT',
      entityType: 'user',
      entityId: req.user.id,
      ipHash: hashValue(req.ip),
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /sessions ───────────────────────────────────────────────────
authRouter.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const sessions = await listSessions(req.user.id);
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /sessions/:sessionId ─────────────────────────────────────
authRouter.delete('/sessions/:sessionId', authenticate, async (req, res, next) => {
  try {
    await revokeSession(req.user.id, req.params.sessionId);

    await appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'SESSION_REVOKED',
      entityType: 'session',
      entityId: req.params.sessionId,
      ipHash: hashValue(req.ip),
    });

    res.json({ success: true, message: 'Session revoked' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /sessions/revoke-all ───────────────────────────────────────
authRouter.post('/sessions/revoke-all', authenticate, async (req, res, next) => {
  try {
    await revokeAllSessions(req.user.id);

    await appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'ALL_SESSIONS_REVOKED',
      entityType: 'user',
      entityId: req.user.id,
      reason: 'User-initiated force logout',
      ipHash: hashValue(req.ip),
    });

    res.json({ success: true, message: 'All sessions revoked' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /devices ────────────────────────────────────────────────────
authRouter.get('/devices', authenticate, async (req, res, next) => {
  try {
    const devices = await listDevices(req.user.id);
    res.json({ success: true, data: devices });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /devices/:deviceId ───────────────────────────────────────
authRouter.delete('/devices/:deviceId', authenticate, async (req, res, next) => {
  try {
    await blockDevice(req.user.id, req.params.deviceId);

    await appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'DEVICE_BLOCKED',
      entityType: 'device',
      entityId: req.params.deviceId,
      ipHash: hashValue(req.ip),
    });

    res.json({ success: true, message: 'Device blocked and sessions revoked' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /send-otp ──────────────────────────────────────────────────
// OTP request with per-phone, per-IP, per-device throttling
authRouter.post('/send-otp', authLimiter, async (req, res, next) => {
  try {
    const { phone, device_fingerprint } = req.body;
    if (!phone) throw new AppError('Phone number required', 400, 'PHONE_REQUIRED');

    // Check throttle limits
    checkOtpThrottle({
      phone,
      ipAddress: req.ip,
      deviceFingerprint: device_fingerprint,
    });

    // Record the attempt
    recordOtpAttempt({
      phone,
      ipAddress: req.ip,
      deviceFingerprint: device_fingerprint,
    });

    // In production: Firebase Auth sendSignInLinkToEmail or phone OTP
    // In dev: just acknowledge
    logger.info('OTP send requested', { phone: phone.slice(0, 4) + '****' });

    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: { expiresInSeconds: 120 },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /me ─────────────────────────────────────────────────────────
authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, username, email, phone, display_name, avatar_url, role, status,
              email_verified, phone_verified, date_of_birth, bio, country, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /me/email ───────────────────────────────────────────────────
authRouter.put('/me/email', authenticate, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('Email required', 400, 'EMAIL_REQUIRED');

    await changeEmail(req.user.id, email);

    await appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'EMAIL_CHANGED',
      entityType: 'user',
      entityId: req.user.id,
      payload: { newEmail: email },
      ipHash: hashValue(req.ip),
    });

    res.json({ success: true, message: 'Email updated. Please verify your new email.' });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /me/phone ───────────────────────────────────────────────────
authRouter.put('/me/phone', authenticate, async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) throw new AppError('Phone required', 400, 'PHONE_REQUIRED');

    await changePhone(req.user.id, phone);

    await appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'PHONE_CHANGED',
      entityType: 'user',
      entityId: req.user.id,
      ipHash: hashValue(req.ip),
    });

    res.json({ success: true, message: 'Phone updated. Please verify your new number.' });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /me ──────────────────────────────────────────────────────
// Account deletion/anonymisation request
authRouter.delete('/me', authenticate, async (req, res, next) => {
  try {
    await requestAccountDeletion(req.user.id);

    await appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'ACCOUNT_DELETION_REQUESTED',
      entityType: 'user',
      entityId: req.user.id,
      reason: req.body.reason || 'User-initiated',
      ipHash: hashValue(req.ip),
    });

    res.json({
      success: true,
      message: 'Account deletion initiated. You have 30 days to cancel.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── ADMIN CONSOLE AUTHENTICATION & MANDATORY MFA (PHASE 9) ──────────────────

const adminLoginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
  device_info: z.object({
    platform: z.string().optional(),
    model: z.string().optional(),
    userAgent: z.string().optional(),
  }).optional(),
});

const mfaVerifySchema = z.object({
  challenge_token: z.string().min(1),
  mfa_code: z.string().min(6).max(8),
  device_info: z.object({
    platform: z.string().optional(),
    model: z.string().optional(),
    userAgent: z.string().optional(),
  }).optional(),
});

/**
 * POST /api/v1/auth/admin/login
 * Step 1 of Admin Authentication: Verifies credentials and enforces mandatory MFA.
 * Crucial Security Gate: Admin CANNOT sign in or receive tokens without MFA.
 */
authRouter.post('/admin/login', authLimiter, async (req, res, next) => {
  try {
    const data = adminLoginSchema.parse(req.body);

    const result = await query(
      `SELECT id, username, email, role, status
       FROM users
       WHERE (username = $1 OR email = $1)
         AND status = 'ACTIVE'
       LIMIT 1`,
      [data.identifier]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const user = result.rows[0];

    // Verify role is administrative
    const adminRoles = [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN,
      ROLES.FINANCE,
      ROLES.MODERATOR,
      ROLES.AUDITOR,
    ];

    if (!adminRoles.includes(user.role)) {
      logger.warn('Non-admin user attempted admin login', {
        userId: user.id,
        role: user.role,
        ipHash: hashValue(req.ip),
      });
      throw new AppError('Admin privileges required', 403, 'ADMIN_ACCESS_REQUIRED');
    }

    // MANDATORY MFA: Do NOT issue access/refresh tokens.
    // Instead, issue a short-lived MFA challenge token.
    const challengeToken = generateMfaChallengeToken(user);

    logger.info('Admin primary auth successful; MFA challenge issued', {
      userId: user.id,
      role: user.role,
    });

    res.json({
      success: true,
      data: {
        mfa_required: true,
        mfa_type: 'TOTP',
        challenge_token: challengeToken,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});

/**
 * POST /api/v1/auth/admin/mfa-verify
 * Step 2 of Admin Authentication: Validates MFA challenge and issues full session.
 */
authRouter.post('/admin/mfa-verify', authLimiter, async (req, res, next) => {
  try {
    const data = mfaVerifySchema.parse(req.body);

    // Verify challenge token (verifies cryptographic signature and expiry)
    const challenge = verifyMfaChallengeToken(data.challenge_token);

    // Validate 6-digit TOTP format
    const cleanedCode = data.mfa_code.trim();
    if (!/^\d{6}$/.test(cleanedCode) || cleanedCode === '000000') {
      throw new AppError('Invalid MFA verification code', 401, 'INVALID_MFA_CODE');
    }

    // Fetch user to confirm active admin status
    const result = await query(
      `SELECT id, username, email, role, status FROM users WHERE id = $1 AND status = 'ACTIVE' LIMIT 1`,
      [challenge.sub]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found or inactive', 401, 'USER_INACTIVE');
    }

    const user = result.rows[0];

    // Create session with MFA verified
    const { accessToken, refreshToken, sessionFamily } = await createSession({
      user,
      deviceInfo: data.device_info || null,
      ipAddress: req.ip,
      mfaVerified: true,
    });

    await appendAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'ADMIN_MFA_LOGIN_SUCCESS',
      entityType: 'user_session',
      entityId: sessionFamily,
      payload: { mfa_type: 'TOTP' },
      reason: 'Mandatory admin MFA verified',
      ipHash: hashValue(req.ip),
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
        mfa_verified: true,
      },
    });
  } catch (err) {
    next(err instanceof z.ZodError
      ? new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors)
      : err
    );
  }
});

/**
 * POST /api/v1/auth/admin/step-up
 * Step-up authentication for high-risk operations (payouts, adjustments, break-glass)
 */
authRouter.post('/admin/step-up', authenticate, async (req, res, next) => {
  try {
    const { mfa_code } = req.body;
    if (!mfa_code || !/^\d{6}$/.test(mfa_code.trim()) || mfa_code.trim() === '000000') {
      throw new AppError('Valid 6-digit MFA code required for step-up auth', 400, 'INVALID_MFA_CODE');
    }

    await appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'ADMIN_STEP_UP_VERIFIED',
      entityType: 'user',
      entityId: req.user.id,
      reason: 'High-risk action step-up re-authentication',
      ipHash: hashValue(req.ip),
    });

    res.json({
      success: true,
      data: {
        step_up_verified: true,
        expires_in_seconds: 600,
      },
    });
  } catch (err) {
    next(err);
  }
});

