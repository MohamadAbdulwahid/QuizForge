import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../middleware/auth';
import * as adminService from '../services/admin.service';

/**
 * HTTP handlers for admin endpoints.
 * All routes require authMiddleware + adminMiddleware.
 */
export class AdminController {
  /**
   * Returns aggregate platform statistics.
   */
  async getStats(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const stats = await adminService.getPlatformStats();
    res.status(StatusCodes.OK).json(stats);
  }

  /**
   * Returns recent sessions with player counts.
   */
  async getRecentSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const limit = Math.max(1, Math.min(Number(req.query['limit']) || 20, 100));
    const sessions = await adminService.getRecentSessions(limit);
    res.status(StatusCodes.OK).json(sessions);
  }

  /**
   * Returns detailed analytics for a specific session.
   */
  async getSessionAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    const sessionId = Number(req.params['sessionId']);
    const analytics = await adminService.getSessionAnalytics(sessionId);
    res.status(StatusCodes.OK).json(analytics);
  }

  /**
   * Returns stale/abandoned sessions.
   */
  async getStaleSessions(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const staleSessions = await adminService.getStaleSessions();
    res.status(StatusCodes.OK).json(staleSessions);
  }

  /**
   * Terminates a stale session.
   */
  async terminateSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    const sessionId = Number(req.params['sessionId']);
    const adminId = req.user!.id;
    const result = await adminService.terminateSession(sessionId, adminId);
    res.status(StatusCodes.OK).json(result);
  }
}
