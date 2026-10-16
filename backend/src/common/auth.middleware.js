import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import { query } from './database.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-min-32-chars-long-12345';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-min-32-chars-long-12345';

/**
 * Generate an access token (short-lived).
 */
export function generateAccessToken(user, options = {}) {
  const mfaVerified = options.mfa_verified !== undefined
    ? options.mfa_verified
    : (user.mfa_verified || false);

  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      type: 'access',
      mfa_verified: mfaVerified,
    },
    ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
}

/**
 * Generate an MFA challenge token (valid 5 minutes).
 */
export function generateMfaChallengeToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      type: 'mfa_challenge',
    },
    ACCESS_SECRET,
    { expiresIn: '5m' }
  );
}

/**
 * Verify an MFA challenge token.
 */
export function verifyMfaChallengeToken(token) {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    if (decoded.type !== 'mfa_challenge') throw new Error('Invalid token type');
    return decoded;
  } catch (err) {
    throw new AppError('Invalid or expired MFA challenge token', 401, 'INVALID_MFA_CHALLENGE');
  }
}

/**
 * Generate a refresh token (long-lived).
 */
export function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
    },
    REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
}

/**
 * Verify an access token.
 */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    if (decoded.type !== 'access') throw new Error('Invalid token type');
    return decoded;
  } catch (err) {
    throw new AppError('Invalid or expired access token', 401, 'INVALID_TOKEN');
  }
}

/**
 * Verify a refresh token.
 */
export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET);
    if (decoded.type !== 'refresh') throw new Error('Invalid token type');
    return decoded;
  } catch (err) {
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }
}

/**
 * Authentication middleware — extracts and verifies JWT from Authorization header.
 * Attaches req.user = { id, username, role, mfa_verified }.
 */
export function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authorization token required', 401, 'AUTH_REQUIRED'));
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyAccessToken(token);

  req.user = {
    id: decoded.sub,
    username: decoded.username,
    role: decoded.role,
    mfa_verified: decoded.mfa_verified || false,
  };

  next();
}

/**
 * Role-based authorization middleware factory.
 * @param  {...string} allowedRoles - Roles permitted to access the route
 */
export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }
    next();
  };
}

/**
 * Idempotency key enforcement middleware.
 * Requires `Idempotency-Key` header on mutation endpoints.
 */
export function requireIdempotencyKey(req, _res, next) {
  const key = req.headers['idempotency-key'];
  if (!key || key.trim().length < 8) {
    return next(new AppError(
      'Idempotency-Key header is required (min 8 characters)',
      400,
      'IDEMPOTENCY_KEY_REQUIRED'
    ));
  }
  req.idempotencyKey = key.trim();
  next();
}
