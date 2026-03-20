import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../middleware/auth';
import { createSession } from '../services/session.service';

/**
 * HTTP handlers for session endpoints.
 */
export class SessionController {
  /**
   * Creates a session for a quiz owned by the authenticated user.
   * @param req - Express request containing quiz_id payload.
   * @param res - Express response.
   */
  async createSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
      return;
    }

    const result = await createSession(userId, req.body as never);
    res.status(StatusCodes.CREATED).json(result);
  }
}

export const sessionController = new SessionController();
