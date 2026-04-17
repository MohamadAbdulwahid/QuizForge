import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../middleware/auth';
import {
  createSession,
  getSessionByPin,
  getSessionsByHost,
  updateSessionStatus,
} from '../services/session.service';
import type { PinParam, UpdateSessionStatusRequest } from '../dtos/session.dto';

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

  /**
   * Lists sessions created by the authenticated host.
   * @param req - Express request.
   * @param res - Express response.
   */
  async getMySessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
      return;
    }

    const sessions = await getSessionsByHost(userId);
    res.status(StatusCodes.OK).json(sessions);
  }

  /**
   * Gets an active session by pin.
   * @param req - Express request containing pin param.
   * @param res - Express response.
   */
  async getSessionByPin(req: Request<PinParam>, res: Response): Promise<void> {
    const result = await getSessionByPin(req.params.pin);
    res.status(StatusCodes.OK).json(result);
  }

  /**
   * Updates session status with a state-machine transition.
   * @param req - Express request containing pin and action.
   * @param res - Express response.
   */
  async updateSessionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
      return;
    }

    const result = await updateSessionStatus(
      (req.params as PinParam).pin,
      userId,
      req.body as UpdateSessionStatusRequest
    );

    res.status(StatusCodes.OK).json(result);
  }
}

export const sessionController = new SessionController();
