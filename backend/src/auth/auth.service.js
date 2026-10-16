import crypto from 'node:crypto';
import { query } from '../common/database.js';
import { firebaseService } from '../common/firebase.js';
import { AppError } from '../common/errorHandler.js';
import { logger } from '../common/logger.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../common/auth.middleware.js';

// ─── Constants ─────────────────────────────────────────────────────────────────
const SESSION_EXPIRY_DAYS = 7;
const OTP_THROTTLE_WINDOW_MS = 15 * 60 * 1000;  // 15 minutes
const OTP_MAX_PER_PHONE = 5;
const OTP_MAX_PER_IP = 10;
const OTP_MAX_PER_DEVICE = 5;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Hash a value (IP, token, etc.) for privacy-safe storage.
 */
export function hashValue(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a cryptographically random session family ID.
 * A session family tracks all tokens derived from a single login.
 * Reuse of a rotated-out refresh token revokes the entire family.
 */
function generateSessionFamily() {
  return crypto.randomUUID();
}

// ─── Firebase Token Verification & User Linking ────────────────────────────────

/**
 * Verify a Firebase ID token and create or link the Vexora user.
 * Returns { user, isNewUser, accessToken, refreshToken }.
 */
export async function authenticateWithFirebase({
  firebaseIdToken,
  deviceInfo = null,
  ipAddress = null,
}) {
  // 1. Verify the Firebase ID token
  const firebaseUser = await firebaseService.verifyIdToken(firebaseIdToken);
  if (!firebaseUser || !firebaseUser.uid) {
    throw new AppError('Invalid Firebase ID token', 401, 'FIREBASE_AUTH_FAILED');
  }

  // 2. Find existing Vexora user by firebase_uid
  let user = null;
  let isNewUser = false;

  const existingResult = await query(
    `SELECT id, username, email, phone, display_name, role, status, firebase_uid
     FROM users WHERE firebase_uid = $1 AND status != 'DELETED' LIMIT 1`,
    [firebaseUser.uid]
  );

  if (existingResult.rows.length > 0) {
    user = existingResult.rows[0];

    // Update email/phone verification status from Firebase
    if (firebaseUser.email_verified) {
      await query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [user.id]);
    }
  } else {
    // 3. Check if user exists by email or phone (link account)
    const linkResult = await query(
      `SELECT id, username, email, phone, display_name, role, status, firebase_uid
       FROM users
       WHERE (email = $1 AND email IS NOT NULL)
          OR (phone = $2 AND phone IS NOT NULL)
       LIMIT 1`,
      [firebaseUser.email || null, firebaseUser.phone_number || null]
    );

    if (linkResult.rows.length > 0) {
      user = linkResult.rows[0];
      // Link Firebase UID to existing user
      await query(
        `UPDATE users SET firebase_uid = $1, email_verified = COALESCE($2, email_verified) WHERE id = $3`,
        [firebaseUser.uid, firebaseUser.email_verified || false, user.id]
      );
      user.firebase_uid = firebaseUser.uid;
    }
    // If no existing user found, they need to register first
  }

  if (!user) {
    // Return partial result — frontend must complete registration
    return {
      user: null,
      isNewUser: true,
      firebaseUid: firebaseUser.uid,
      firebaseEmail: firebaseUser.email,
      firebasePhone: firebaseUser.phone_number,
      accessToken: null,
      refreshToken: null,
    };
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError(`Account is ${user.status.toLowerCase()}`, 403, 'ACCOUNT_INACTIVE');
  }

  // 4. Create session with family tracking
  const { accessToken, refreshToken } = await createSession({
    user,
    deviceInfo,
    ipAddress,
  });

  return {
    user,
    isNewUser: false,
    accessToken,
    refreshToken,
  };
}

// ─── Session Management with Family Tracking ───────────────────────────────────

/**
 * Create a new session with a fresh family ID.
 * Each login starts a new family. Token rotation stays within the family.
 */
export async function createSession({ user, deviceInfo = null, ipAddress = null, mfaVerified = false }) {
  const accessToken = generateAccessToken(user, { mfa_verified: mfaVerified });
  const refreshToken = generateRefreshToken(user);
  const refreshHash = hashValue(refreshToken);
  const sessionFamily = generateSessionFamily();
  const ipHash = hashValue(ipAddress);

  // Register or update device
  let deviceId = null;
  if (deviceInfo) {
    deviceId = await registerDevice({
      userId: user.id,
      deviceInfo,
      ipAddress,
    });
  }

  await query(
    `INSERT INTO user_sessions
       (user_id, refresh_token_hash, session_family, device_info, device_id, ip_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '${SESSION_EXPIRY_DAYS} days')`,
    [user.id, refreshHash, sessionFamily, deviceInfo ? JSON.stringify(deviceInfo) : null, deviceId, ipHash]
  );

  return { accessToken, refreshToken, sessionFamily };
}

/**
 * Rotate a refresh token — implements reuse detection.
 * If the incoming refresh token has already been rotated out (reuse),
 * the ENTIRE session family is revoked as a security measure.
 */
export async function rotateRefreshToken({ refreshToken, ipAddress = null }) {
  const decoded = verifyRefreshToken(refreshToken);
  const tokenHash = hashValue(refreshToken);

  // 1. Find the active session matching this refresh token
  const sessionResult = await query(
    `SELECT id, user_id, session_family, device_id, status
     FROM user_sessions
     WHERE refresh_token_hash = $1 AND user_id = $2
     LIMIT 1`,
    [tokenHash, decoded.sub]
  );

  if (sessionResult.rows.length === 0) {
    throw new AppError('Session not found', 401, 'SESSION_NOT_FOUND');
  }

  const session = sessionResult.rows[0];

  // 2. REUSE DETECTION — if the session is already rotated/expired/revoked,
  //    someone is replaying an old token → revoke the entire family
  if (session.status !== 'ACTIVE') {
    logger.error('🚨 REFRESH TOKEN REUSE DETECTED — revoking entire session family', {
      userId: session.user_id,
      sessionFamily: session.session_family,
      attemptedSessionId: session.id,
      status: session.status,
    });

    // Revoke ALL sessions in this family
    await query(
      `UPDATE user_sessions SET status = 'REVOKED', revoked_at = NOW()
       WHERE session_family = $1 AND status = 'ACTIVE'`,
      [session.session_family]
    );

    throw new AppError(
      'Refresh token reuse detected. All sessions revoked for security.',
      401,
      'REFRESH_TOKEN_REUSE'
    );
  }

  // 3. Rotate: mark old session as EXPIRED
  await query(
    `UPDATE user_sessions SET status = 'EXPIRED', revoked_at = NOW() WHERE id = $1`,
    [session.id]
  );

  // 4. Fetch user for new tokens
  const userResult = await query(
    `SELECT id, username, role, status FROM users WHERE id = $1`,
    [decoded.sub]
  );

  if (userResult.rows.length === 0 || userResult.rows[0].status !== 'ACTIVE') {
    throw new AppError('Account not found or inactive', 401, 'ACCOUNT_INACTIVE');
  }

  const user = userResult.rows[0];

  // 5. Issue new tokens in the SAME family
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  const newHash = hashValue(newRefreshToken);
  const ipHash = hashValue(ipAddress);

  await query(
    `INSERT INTO user_sessions
       (user_id, refresh_token_hash, session_family, device_id, ip_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${SESSION_EXPIRY_DAYS} days')`,
    [user.id, newHash, session.session_family, session.device_id, ipHash]
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user,
  };
}

// ─── Session Listing & Revocation ──────────────────────────────────────────────

/**
 * List all active sessions for a user.
 */
export async function listSessions(userId) {
  const result = await query(
    `SELECT s.id, s.device_info, s.ip_hash, s.status, s.session_family,
            s.created_at, s.expires_at, s.last_activity_at,
            d.platform, d.device_model, d.trust_level
     FROM user_sessions s
     LEFT JOIN user_devices d ON s.device_id = d.id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT 50`,
    [userId]
  );
  return result.rows;
}

/**
 * Revoke a specific session.
 */
export async function revokeSession(userId, sessionId) {
  const result = await query(
    `UPDATE user_sessions SET status = 'REVOKED', revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'
     RETURNING id`,
    [sessionId, userId]
  );
  if (result.rows.length === 0) {
    throw new AppError('Session not found or already revoked', 404, 'SESSION_NOT_FOUND');
  }
  return result.rows[0];
}

/**
 * Force-logout: revoke ALL active sessions for a user.
 */
export async function revokeAllSessions(userId, excludeSessionId = null) {
  if (excludeSessionId) {
    await query(
      `UPDATE user_sessions SET status = 'REVOKED', revoked_at = NOW()
       WHERE user_id = $1 AND status = 'ACTIVE' AND id != $2`,
      [userId, excludeSessionId]
    );
  } else {
    await query(
      `UPDATE user_sessions SET status = 'REVOKED', revoked_at = NOW()
       WHERE user_id = $1 AND status = 'ACTIVE'`,
      [userId]
    );
  }
}

// ─── Device Registry ───────────────────────────────────────────────────────────

/**
 * Register a device or update last-seen. Returns device ID.
 * Triggers a new-device alert if this is the first time seeing this fingerprint.
 */
export async function registerDevice({ userId, deviceInfo, ipAddress = null }) {
  const fingerprint = hashValue(
    JSON.stringify({
      platform: deviceInfo.platform,
      model: deviceInfo.model,
      userAgent: deviceInfo.userAgent,
    })
  );

  // Check if device already registered
  const existingDevice = await query(
    `SELECT id, trust_level FROM user_devices
     WHERE user_id = $1 AND device_fingerprint_hash = $2 LIMIT 1`,
    [userId, fingerprint]
  );

  if (existingDevice.rows.length > 0) {
    // Update last-seen
    await query(
      `UPDATE user_devices SET last_seen = NOW(), app_version = $1 WHERE id = $2`,
      [deviceInfo.appVersion || null, existingDevice.rows[0].id]
    );
    return existingDevice.rows[0].id;
  }

  // New device — insert and trigger alert
  const insertResult = await query(
    `INSERT INTO user_devices
       (user_id, device_fingerprint_hash, platform, device_model, os_version, app_version, push_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      userId,
      fingerprint,
      deviceInfo.platform || 'UNKNOWN',
      deviceInfo.model || null,
      deviceInfo.osVersion || null,
      deviceInfo.appVersion || null,
      deviceInfo.pushToken || null,
    ]
  );

  const deviceId = insertResult.rows[0].id;

  // Log new device alert
  logger.warn('🔔 New device detected for user', {
    userId,
    deviceId,
    platform: deviceInfo.platform,
    model: deviceInfo.model,
  });

  return deviceId;
}

/**
 * List all devices for a user.
 */
export async function listDevices(userId) {
  const result = await query(
    `SELECT id, platform, device_model, os_version, app_version,
            trust_level, first_seen, last_seen
     FROM user_devices
     WHERE user_id = $1
     ORDER BY last_seen DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Block a device (mark as BLOCKED).
 */
export async function blockDevice(userId, deviceId) {
  const result = await query(
    `UPDATE user_devices SET trust_level = 'BLOCKED'
     WHERE id = $1 AND user_id = $2 RETURNING id`,
    [deviceId, userId]
  );
  if (result.rows.length === 0) {
    throw new AppError('Device not found', 404, 'DEVICE_NOT_FOUND');
  }

  // Also revoke all sessions linked to this device
  await query(
    `UPDATE user_sessions SET status = 'REVOKED', revoked_at = NOW()
     WHERE device_id = $1 AND status = 'ACTIVE'`,
    [deviceId]
  );

  return result.rows[0];
}

// ─── OTP Throttling ────────────────────────────────────────────────────────────

// In-memory throttle store (would be Redis in production)
const otpThrottle = {
  phone: new Map(),
  ip: new Map(),
  device: new Map(),
};

/**
 * Check if OTP send is allowed based on throttle limits.
 * Enforces per-phone, per-IP, and per-device rate limits within the window.
 */
export function checkOtpThrottle({ phone, ipAddress, deviceFingerprint }) {
  const now = Date.now();

  const checkLimit = (store, key, maxAttempts) => {
    if (!key) return true;
    const attempts = store.get(key) || [];
    // Clean up expired entries
    const recent = attempts.filter(ts => now - ts < OTP_THROTTLE_WINDOW_MS);
    store.set(key, recent);
    return recent.length < maxAttempts;
  };

  const phoneAllowed = checkLimit(otpThrottle.phone, phone, OTP_MAX_PER_PHONE);
  const ipAllowed = checkLimit(otpThrottle.ip, ipAddress, OTP_MAX_PER_IP);
  const deviceAllowed = checkLimit(otpThrottle.device, deviceFingerprint, OTP_MAX_PER_DEVICE);

  if (!phoneAllowed) {
    throw new AppError('Too many OTP requests for this phone number', 429, 'OTP_PHONE_THROTTLED');
  }
  if (!ipAllowed) {
    throw new AppError('Too many OTP requests from this IP', 429, 'OTP_IP_THROTTLED');
  }
  if (!deviceAllowed) {
    throw new AppError('Too many OTP requests from this device', 429, 'OTP_DEVICE_THROTTLED');
  }

  return true;
}

/**
 * Record an OTP send attempt for throttling.
 */
export function recordOtpAttempt({ phone, ipAddress, deviceFingerprint }) {
  const now = Date.now();

  const record = (store, key) => {
    if (!key) return;
    const attempts = store.get(key) || [];
    attempts.push(now);
    store.set(key, attempts);
  };

  record(otpThrottle.phone, phone);
  record(otpThrottle.ip, ipAddress);
  record(otpThrottle.device, deviceFingerprint);
}

/**
 * Reset OTP throttle (for testing).
 */
export function resetOtpThrottle() {
  otpThrottle.phone.clear();
  otpThrottle.ip.clear();
  otpThrottle.device.clear();
}

// ─── Account Lifecycle ─────────────────────────────────────────────────────────

/**
 * Request account deletion/anonymisation.
 * Sets status to DELETED and anonymises PII after a cooling-off period.
 */
export async function requestAccountDeletion(userId) {
  // Mark account for deletion
  await query(
    `UPDATE users SET status = 'DELETED', deleted_at = NOW(),
     email = 'deleted_' || id::text || '@vexora.deleted',
     phone = NULL,
     display_name = 'Deleted User',
     avatar_url = NULL,
     bio = NULL,
     firebase_uid = NULL
     WHERE id = $1 AND status = 'ACTIVE'`,
    [userId]
  );

  // Revoke all sessions
  await revokeAllSessions(userId);

  logger.info('Account deletion requested', { userId });
}

/**
 * Update user email with re-verification requirement.
 */
export async function changeEmail(userId, newEmail) {
  // Check uniqueness
  const existing = await query(
    `SELECT id FROM users WHERE email = $1 AND id != $2 LIMIT 1`,
    [newEmail, userId]
  );
  if (existing.rows.length > 0) {
    throw new AppError('Email already in use', 409, 'EMAIL_TAKEN');
  }

  await query(
    `UPDATE users SET email = $1, email_verified = FALSE, updated_at = NOW() WHERE id = $2`,
    [newEmail, userId]
  );
}

/**
 * Update user phone with re-verification requirement.
 */
export async function changePhone(userId, newPhone) {
  const existing = await query(
    `SELECT id FROM users WHERE phone = $1 AND id != $2 LIMIT 1`,
    [newPhone, userId]
  );
  if (existing.rows.length > 0) {
    throw new AppError('Phone number already in use', 409, 'PHONE_TAKEN');
  }

  await query(
    `UPDATE users SET phone = $1, phone_verified = FALSE, updated_at = NOW() WHERE id = $2`,
    [newPhone, userId]
  );
}
