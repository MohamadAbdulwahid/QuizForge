import type { Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from './auth';
import { createChildLogger } from '../../config/logger';

const adminLogger = createChildLogger('admin-middleware');

/**
 * Comma-separated list of Supabase user IDs with admin access.
 * Set via ADMIN_USER_IDS environment variable.
 */
const ADMIN_USER_IDS = (process.env['ADMIN_USER_IDS'] ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

/**
 * Middleware that restricts access to admin users only.
 * Must be used after authMiddleware — requires req.user to be set.
 * Returns 403 if the authenticated user is not in the admin list.
 */
export function adminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const userId = req.user?.id;

  if (!userId) {
    adminLogger.warn('Admin middleware called without authenticated user');
    res.status(StatusCodes.UNAUTHORIZED).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
      statusCode: StatusCodes.UNAUTHORIZED,
    });
    return;
  }

  if (!ADMIN_USER_IDS.includes(userId)) {
    adminLogger.warn({ userId }, 'Non-admin user attempted to access admin endpoint');
    res.status(StatusCodes.FORBIDDEN).json({
      error: 'Admin access required',
      code: 'ADMIN_FORBIDDEN',
      statusCode: StatusCodes.FORBIDDEN,
    });
    return;
  }

  next();
}
