import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createChildLogger } from '../../config/logger';
import { StatusCodes } from 'http-status-codes';

const errorLogger = createChildLogger('error-handler');

/**
 * Standardized error response shape
 */
interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
}

/**
 * Global error handling middleware
 * Maps known error types to appropriate HTTP status codes
 * Must be registered LAST in the Express middleware chain
 *
 * @param err - The error thrown
 * @param _req - Express request object
 * @param res - Express response object
 * @param _next - Express next function
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): void {
  // Zod validation errors → 400
  if (err instanceof ZodError) {
    errorLogger.warn({ err }, 'Validation error');
    res.status(StatusCodes.BAD_REQUEST).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      statusCode: StatusCodes.BAD_REQUEST,
    });
    return;
  }

  // Supabase Auth errors (message-based detection)
  if (err.message?.includes('Invalid login credentials')) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS',
      statusCode: StatusCodes.UNAUTHORIZED,
    });
    return;
  }

  if (err.message?.includes('User already registered')) {
    res.status(StatusCodes.CONFLICT).json({
      error: 'Email already exists',
      code: 'DUPLICATE_EMAIL',
      statusCode: StatusCodes.CONFLICT,
    });
    return;
  }

  // Unknown / unexpected errors → 500
  errorLogger.error({ err }, 'Unhandled error');
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
  });
}
