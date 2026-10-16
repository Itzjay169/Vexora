import { AppError } from './errorHandler.js';

/**
 * Express middleware to validate request body using a Zod schema.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate req.body against
 * @returns {Function} Express middleware function
 */
export function validateBody(schema) {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors));
      }
      next(err);
    }
  };
}
