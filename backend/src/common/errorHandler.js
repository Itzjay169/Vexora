import { logger } from './logger.js';

/**
 * Custom application error with HTTP status code.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

/**
 * 404 catch-all handler.
 */
export function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
}

/**
 * Global error handler middleware.
 */
export function errorHandler(err, req, res, _next) {
  // Log the error
  if (err.isOperational) {
    logger.warn(`Operational error: ${err.message}`, {
      code: err.code,
      statusCode: err.statusCode,
      path: req.originalUrl,
      method: req.method,
      requestId: req.requestId,
    });
  } else {
    logger.error('Unhandled error:', err);
  }

  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.isOperational ? err.message : 'An unexpected error occurred',
      correlationId: req?.correlationId || req?.requestId || undefined,
    },
  };

  if (!response.error.correlationId) {
    delete response.error.correlationId;
  }

  if (err.details) {
    response.error.details = err.details;
  }

  // Never leak stack traces in production
  if (process.env.NODE_ENV === 'development' && !err.isOperational) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
