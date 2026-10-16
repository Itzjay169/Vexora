import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * PII field patterns to redact from structured log output.
 * Prevents accidental exposure of phone numbers, emails, tokens, and passwords.
 */
const PII_PATTERNS = [
  { key: /phone/i, replacement: '[REDACTED_PHONE]' },
  { key: /email/i, replacement: '[REDACTED_EMAIL]' },
  { key: /password/i, replacement: '[REDACTED]' },
  { key: /token/i, replacement: '[REDACTED_TOKEN]' },
  { key: /secret/i, replacement: '[REDACTED]' },
  { key: /authorization/i, replacement: '[REDACTED]' },
  { key: /cookie/i, replacement: '[REDACTED]' },
  { key: /firebase_uid/i, replacement: '[REDACTED_UID]' },
];

/**
 * Deep-redact PII from structured metadata before logging.
 */
function redactPII(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const redacted = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(redacted)) {
    for (const pattern of PII_PATTERNS) {
      if (pattern.key.test(key)) {
        redacted[key] = pattern.replacement;
        break;
      }
    }
    if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactPII(redacted[key]);
    }
  }
  return redacted;
}

/**
 * Winston format that redacts PII from all log metadata.
 */
const piiRedactionFormat = winston.format((info) => {
  // Redact top-level meta fields
  for (const pattern of PII_PATTERNS) {
    for (const key of Object.keys(info)) {
      if (pattern.key.test(key) && key !== 'level' && key !== 'message') {
        info[key] = pattern.replacement;
      }
    }
  }
  return info;
});

/**
 * Structured JSON format for production environments.
 * Includes: timestamp, level, message, service, correlationId, and redacted metadata.
 */
const structuredJsonFormat = printf(({ level, message, timestamp, correlationId, requestId, stack, ...meta }) => {
  const entry = {
    timestamp,
    level,
    message: stack || message,
    service: 'vexora-api',
    correlationId: correlationId || requestId || undefined,
    ...redactPII(meta),
  };
  // Remove undefined keys for cleaner output
  Object.keys(entry).forEach(k => entry[k] === undefined && delete entry[k]);
  return JSON.stringify(entry);
});

/**
 * Human-readable format for development/local use.
 */
const devFormat = printf(({ level, message, timestamp, correlationId, stack, ...meta }) => {
  const cid = correlationId ? ` [${correlationId}]` : '';
  const metaStr = Object.keys(meta).length > 1 ? ` ${JSON.stringify(redactPII(meta))}` : '';
  return `${timestamp} [${level}]${cid}: ${stack || message}${metaStr}`;
});

const isProduction = process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    piiRedactionFormat(),
    isProduction ? structuredJsonFormat : combine(colorize(), devFormat),
  ),
  defaultMeta: { service: 'vexora-api' },
  transports: [
    new winston.transports.Console(),
  ],
});

// In production, also log to rotating files
if (isProduction) {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
  }));
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 10 * 1024 * 1024,
    maxFiles: 10,
  }));
}

export { redactPII };
