process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  authenticate,
  authorize,
} from '../../backend/src/common/auth.middleware.js';
import {
  hashValue,
  checkOtpThrottle,
  recordOtpAttempt,
  resetOtpThrottle,
} from '../../backend/src/auth/auth.service.js';
import { FirebaseService } from '../../backend/src/common/firebase.js';

// ─── Migration 003 Validation ────────────────────────────────────────────────

test('Phase 7 Database: Migration 003 defines session family, OTP throttle, login attempts tables', () => {
  const migration003Path = path.resolve('infra/migrations/003_auth_sessions_enhancement.sql');
  assert.ok(fs.existsSync(migration003Path), 'Migration 003 file must exist');

  const sql = fs.readFileSync(migration003Path, 'utf8');

  // Session family column
  assert.ok(
    sql.includes('session_family'),
    'Migration must add session_family column to user_sessions'
  );

  // OTP throttle table
  assert.ok(
    /CREATE TABLE (?:IF NOT EXISTS )?otp_throttle_log/i.test(sql),
    'Migration must create otp_throttle_log table'
  );

  // Account deletion requests table
  assert.ok(
    /CREATE TABLE (?:IF NOT EXISTS )?account_deletion_requests/i.test(sql),
    'Migration must create account_deletion_requests table'
  );

  // Login attempts table for brute force protection
  assert.ok(
    /CREATE TABLE (?:IF NOT EXISTS )?login_attempts/i.test(sql),
    'Migration must create login_attempts table for brute force tracking'
  );

  // Indexes for performance
  assert.ok(sql.includes('idx_sessions_family'), 'Must index session_family for revocation lookups');
  assert.ok(sql.includes('idx_sessions_refresh_hash'), 'Must index refresh_token_hash for rotation');
  assert.ok(sql.includes('idx_otp_throttle_phone'), 'Must index OTP throttle by phone');
});

// ─── JWT Token Generation & Verification ─────────────────────────────────────

test('Phase 7 Tokens: Access token is short-lived and contains role', () => {
  const mockUser = { id: 'usr_001', username: 'test_player', role: 'PLAYER' };
  const token = generateAccessToken(mockUser);

  assert.equal(typeof token, 'string');
  assert.ok(token.split('.').length === 3, 'JWT must have 3 parts');

  const decoded = verifyAccessToken(token);
  assert.equal(decoded.sub, 'usr_001');
  assert.equal(decoded.username, 'test_player');
  assert.equal(decoded.role, 'PLAYER');
  assert.equal(decoded.type, 'access');
});

test('Phase 7 Tokens: Refresh token contains only user ID (no role/username)', () => {
  const mockUser = { id: 'usr_002', username: 'test_org', role: 'ORGANISER' };
  const token = generateRefreshToken(mockUser);

  const decoded = verifyRefreshToken(token);
  assert.equal(decoded.sub, 'usr_002');
  assert.equal(decoded.type, 'refresh');

  // Refresh token must NOT contain role or username (minimise data exposure)
  assert.equal(decoded.username, undefined, 'Refresh token must not contain username');
  assert.equal(decoded.role, undefined, 'Refresh token must not contain role');
});

test('Phase 7 Security Gate: Expired access token is rejected', () => {
  const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-min-32-chars-long-12345';
  const expiredToken = jwt.sign(
    { sub: 'usr_003', username: 'expired_user', role: 'PLAYER', type: 'access' },
    ACCESS_SECRET,
    { expiresIn: '0s' }
  );

  // Allow a tiny delay for the token to expire
  assert.throws(
    () => verifyAccessToken(expiredToken),
    (err) => err.code === 'INVALID_TOKEN',
    'Expired token must be rejected with INVALID_TOKEN code'
  );
});

test('Phase 7 Security Gate: Token with wrong type is rejected', () => {
  const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-min-32-chars-long-12345';
  const refreshAsAccess = jwt.sign(
    { sub: 'usr_004', type: 'refresh' },
    ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  assert.throws(
    () => verifyAccessToken(refreshAsAccess),
    (err) => err.code === 'INVALID_TOKEN',
    'Refresh token must not pass as access token'
  );
});

// ─── Authentication Middleware ────────────────────────────────────────────────

test('Phase 7 Middleware: authenticate rejects request without Authorization header', () => {
  const req = { headers: {} };
  const res = {};

  let capturedError = null;
  const next = (err) => { capturedError = err; };

  authenticate(req, res, next);

  assert.ok(capturedError !== null, 'Should call next with error');
  assert.equal(capturedError.code, 'AUTH_REQUIRED');
  assert.equal(capturedError.statusCode, 401);
});

test('Phase 7 Middleware: authenticate rejects malformed Bearer token', () => {
  const req = { headers: { authorization: 'Bearer invalid.token.here' } };
  const res = {};

  let capturedError = null;
  const next = (err) => { capturedError = err; };

  try {
    authenticate(req, res, next);
    // If authenticate passes the error via next
    if (capturedError) {
      assert.equal(capturedError.code, 'INVALID_TOKEN');
      return;
    }
  } catch (err) {
    // If authenticate throws the error directly
    assert.equal(err.code, 'INVALID_TOKEN');
    return;
  }

  assert.fail('authenticate should reject malformed token');
});

test('Phase 7 Middleware: authenticate attaches user to request on valid token', () => {
  const mockUser = { id: 'usr_005', username: 'auth_test', role: 'PLAYER' };
  const token = generateAccessToken(mockUser);

  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = {};

  let calledNext = false;
  const next = (err) => {
    if (err) throw err;
    calledNext = true;
  };

  authenticate(req, res, next);

  assert.ok(calledNext, 'next() should be called without error');
  assert.equal(req.user.id, 'usr_005');
  assert.equal(req.user.username, 'auth_test');
  assert.equal(req.user.role, 'PLAYER');
});

// ─── Role-Based Authorization ────────────────────────────────────────────────

test('Phase 7 RBAC: authorize allows permitted roles', () => {
  const adminGuard = authorize('ADMIN', 'SUPER_ADMIN');

  const req = { user: { id: 'usr_006', role: 'ADMIN' } };
  let calledNext = false;
  adminGuard(req, {}, (err) => {
    if (err) throw err;
    calledNext = true;
  });

  assert.ok(calledNext, 'ADMIN should pass ADMIN guard');
});

test('Phase 7 RBAC: authorize blocks non-permitted roles', () => {
  const adminGuard = authorize('ADMIN', 'SUPER_ADMIN');

  const req = { user: { id: 'usr_007', role: 'PLAYER' } };
  let capturedError = null;
  adminGuard(req, {}, (err) => { capturedError = err; });

  assert.ok(capturedError !== null);
  assert.equal(capturedError.code, 'FORBIDDEN');
  assert.equal(capturedError.statusCode, 403);
});

// ─── Firebase ID Token Verification ──────────────────────────────────────────

test('Phase 7 Firebase: Dev mock token verification returns expected user data', async () => {
  const firebase = new FirebaseService();
  const mockToken = 'mock_token_testuser123';

  const result = await firebase.verifyIdToken(mockToken);

  assert.ok(result.uid, 'Must return a uid');
  assert.ok(result.email, 'Must return an email');
  assert.equal(result.email_verified, true);
});

test('Phase 7 Firebase: Missing token throws error', async () => {
  const firebase = new FirebaseService();

  await assert.rejects(
    () => firebase.verifyIdToken(null),
    { message: 'Missing authentication token' }
  );

  await assert.rejects(
    () => firebase.verifyIdToken(''),
    { message: 'Missing authentication token' }
  );
});

// ─── OTP Throttling ──────────────────────────────────────────────────────────

test('Phase 7 Security Gate: OTP throttle blocks after exceeding per-phone limit', () => {
  resetOtpThrottle();

  const phone = '+919876543210';
  const ip = '192.168.1.1';

  // First 5 attempts should pass
  for (let i = 0; i < 5; i++) {
    assert.doesNotThrow(() => {
      checkOtpThrottle({ phone, ipAddress: ip, deviceFingerprint: 'dev_001' });
      recordOtpAttempt({ phone, ipAddress: ip, deviceFingerprint: 'dev_001' });
    });
  }

  // 6th attempt should be throttled
  assert.throws(
    () => checkOtpThrottle({ phone, ipAddress: ip, deviceFingerprint: 'dev_001' }),
    (err) => err.code === 'OTP_PHONE_THROTTLED',
    'Must throttle after 5 OTP requests per phone'
  );
});

test('Phase 7 Security Gate: OTP throttle blocks after exceeding per-IP limit', () => {
  resetOtpThrottle();

  const ip = '10.0.0.1';

  // Send OTPs from different phones but same IP
  for (let i = 0; i < 10; i++) {
    const phone = `+91987654${String(i).padStart(4, '0')}`;
    assert.doesNotThrow(() => {
      checkOtpThrottle({ phone, ipAddress: ip, deviceFingerprint: `dev_${i}` });
      recordOtpAttempt({ phone, ipAddress: ip, deviceFingerprint: `dev_${i}` });
    });
  }

  // 11th attempt from same IP should be throttled
  assert.throws(
    () => checkOtpThrottle({ phone: '+919999999999', ipAddress: ip, deviceFingerprint: 'dev_99' }),
    (err) => err.code === 'OTP_IP_THROTTLED',
    'Must throttle after 10 OTP requests per IP'
  );
});

// ─── Security: No Tokens in Logs ─────────────────────────────────────────────

test('Phase 7 Security Gate: PII redaction masks tokens and secrets', () => {
  // The logger module already redacts fields like 'token', 'password', 'secret'
  // Verify that the auth module never puts raw tokens in log calls
  const authServiceSource = fs.readFileSync(
    path.resolve('backend/src/auth/auth.service.js'), 'utf8'
  );
  const authRoutesSource = fs.readFileSync(
    path.resolve('backend/src/auth/auth.routes.js'), 'utf8'
  );

  // The service/routes should never log raw token values
  const tokenLogPattern = /logger\.(info|warn|error|debug)\([^)]*(?:accessToken|refreshToken|token:)/;

  assert.ok(
    !tokenLogPattern.test(authServiceSource),
    'Auth service must never log raw token values'
  );
  assert.ok(
    !tokenLogPattern.test(authRoutesSource),
    'Auth routes must never log raw token values'
  );
});

// ─── Hash Utilities ──────────────────────────────────────────────────────────

test('Phase 7 Crypto: hashValue produces consistent SHA-256 output', () => {
  const hash1 = hashValue('test_value');
  const hash2 = hashValue('test_value');
  const hash3 = hashValue('different_value');

  assert.equal(hash1, hash2, 'Same input must produce same hash');
  assert.notEqual(hash1, hash3, 'Different inputs must produce different hashes');
  assert.equal(hash1.length, 64, 'SHA-256 produces 64-char hex string');

  assert.equal(hashValue(null), null, 'Null input returns null');
  assert.equal(hashValue(undefined), null, 'Undefined input returns null');
});

// ─── Session Family Architecture ─────────────────────────────────────────────

test('Phase 7 Architecture: Auth service exports all required session management functions', async () => {
  const authService = await import('../../backend/src/auth/auth.service.js');

  const requiredExports = [
    'hashValue',
    'authenticateWithFirebase',
    'createSession',
    'rotateRefreshToken',
    'listSessions',
    'revokeSession',
    'revokeAllSessions',
    'listDevices',
    'blockDevice',
    'checkOtpThrottle',
    'recordOtpAttempt',
    'resetOtpThrottle',
    'registerDevice',
    'requestAccountDeletion',
    'changeEmail',
    'changePhone',
  ];

  for (const fn of requiredExports) {
    assert.equal(typeof authService[fn], 'function', `Auth service must export ${fn}`);
  }
});

test('Phase 7 Architecture: Auth routes file defines all Phase 7 endpoints', () => {
  const routesSource = fs.readFileSync(
    path.resolve('backend/src/auth/auth.routes.js'), 'utf8'
  );

  const requiredEndpoints = [
    '/register',
    '/login',
    '/firebase',
    '/refresh',
    '/logout',
    '/sessions',
    '/devices',
    '/send-otp',
    '/me',
    '/me/email',
    '/me/phone',
  ];

  for (const ep of requiredEndpoints) {
    assert.ok(
      routesSource.includes(`'${ep}'`) || routesSource.includes(`"${ep}"`),
      `Auth routes must define endpoint: ${ep}`
    );
  }

  // Delete /me for account deletion
  assert.ok(
    routesSource.includes("authRouter.delete('/me'"),
    'Auth routes must support DELETE /me for account deletion'
  );
});

// ─── Refresh Token Rotation Architecture ─────────────────────────────────────

test('Phase 7 Architecture: Refresh rotation with reuse detection is implemented', () => {
  const serviceSource = fs.readFileSync(
    path.resolve('backend/src/auth/auth.service.js'), 'utf8'
  );

  // Must check session status before rotation
  assert.ok(
    serviceSource.includes('REFRESH_TOKEN_REUSE'),
    'Service must detect and report refresh token reuse'
  );

  // Must revoke entire session family on reuse
  assert.ok(
    serviceSource.includes('session_family'),
    'Service must use session_family for family-wide revocation'
  );

  // Must mark old session as EXPIRED during rotation
  assert.ok(
    serviceSource.includes("'EXPIRED'"),
    'Service must mark rotated sessions as EXPIRED'
  );
});

// ─── Device Registry ─────────────────────────────────────────────────────────

test('Phase 7 Architecture: Device registry with new-device alerts is implemented', () => {
  const serviceSource = fs.readFileSync(
    path.resolve('backend/src/auth/auth.service.js'), 'utf8'
  );

  assert.ok(
    serviceSource.includes('registerDevice'),
    'Service must implement device registration'
  );
  assert.ok(
    serviceSource.includes('New device detected'),
    'Service must log new-device alerts'
  );
  assert.ok(
    serviceSource.includes('device_fingerprint_hash'),
    'Service must use fingerprint hashing for device uniqueness'
  );
  assert.ok(
    serviceSource.includes('BLOCKED'),
    'Service must support blocking devices'
  );
});

// ─── Account Lifecycle ───────────────────────────────────────────────────────

test('Phase 7 Account Lifecycle: Delete/anonymise, change email/phone are implemented', () => {
  const serviceSource = fs.readFileSync(
    path.resolve('backend/src/auth/auth.service.js'), 'utf8'
  );

  assert.ok(
    serviceSource.includes('requestAccountDeletion'),
    'Service must implement account deletion'
  );
  assert.ok(
    serviceSource.includes('Deleted User'),
    'Deletion must anonymise display name'
  );
  assert.ok(
    serviceSource.includes('changeEmail'),
    'Service must implement email change'
  );
  assert.ok(
    serviceSource.includes('email_verified = FALSE'),
    'Email change must reset verification status'
  );
  assert.ok(
    serviceSource.includes('changePhone'),
    'Service must implement phone change'
  );
  assert.ok(
    serviceSource.includes('phone_verified = FALSE'),
    'Phone change must reset verification status'
  );
});
