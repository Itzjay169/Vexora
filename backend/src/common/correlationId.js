import { logger } from './logger.js';

/**
 * Correlation ID middleware.
 * Attaches a unique correlation ID to every request for distributed tracing.
 * Accepts X-Request-ID or X-Correlation-ID headers, or generates a new UUIDv4.
 * The ID propagates into logs and response headers.
 */
export function correlationId(req, res, next) {
  const id = req.headers['x-correlation-id']
    || req.headers['x-request-id']
    || crypto.randomUUID();

  req.correlationId = id;
  req.requestId = id; // backward compat

  // Expose in response headers for client-side tracing
  res.setHeader('X-Correlation-ID', id);
  res.setHeader('X-Request-ID', id);

  // Attach to logger child for this request scope
  req.log = logger.child({ correlationId: id });

  next();
}

/**
 * Request logging middleware.
 * Logs method, URL, status code, and response time for every completed request.
 * Replaces morgan for structured JSON output.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
      : res.statusCode >= 400 ? 'warn'
        : 'info';

    logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      correlationId: req.correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip ? req.ip.replace(/^.*:/, '') : undefined, // strip IPv6 prefix, don't log full IP
    });
  });

  next();
}
