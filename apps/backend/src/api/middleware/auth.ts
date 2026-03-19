import { Request, Response, NextFunction } from 'express';
import { supabaseClient } from '../../config/supabase';
import { createChildLogger } from '../../config/logger';
import type { User } from '@supabase/supabase-js';
import { StatusCodes } from 'http-status-codes';

const authLogger = createChildLogger('auth');

/**
 * Extended request with authenticated user data
 */
export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Validates JWT token from Authorization header using Supabase Auth
 * Attaches user to req.user on success, returns 401 on failure
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    authLogger.warn({ ip: req.ip }, 'Missing or invalid authorization header');
    res.status(StatusCodes.UNAUTHORIZED).json({
      error: 'Missing or invalid authorization header',
      code: 'UNAUTHORIZED',
      statusCode: StatusCodes.UNAUTHORIZED,
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      authLogger.warn({ error: error?.message, ip: req.ip }, 'Invalid token');
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
      return;
    }

    req.user = user;
    authLogger.debug({ userId: user.id }, 'User authenticated');
    next();
  } catch (err) {
    authLogger.error({ err, ip: req.ip }, 'Auth middleware error');
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    });
  }
}
