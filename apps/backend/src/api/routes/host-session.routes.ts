import { Router, type Response, type NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth';
import { validateParams } from '../middleware/validation';
import { PinParamSchema } from '../dtos/session.dto';
import * as sessionRepository from '../../database/repositories/session.repository';
import * as quizRepository from '../../database/repositories/quiz.repository';

export const hostSessionRouter = Router();

/**
 * GET /:pin/host
 * Returns session, quiz questions, and players for the host view.
 * Protected — only the authenticated host can access their session data.
 * Can be called before the game starts (lobby phase) since the lookup
 * does not filter by active status.
 */
hostSessionRouter.get(
  '/:pin/host',
  authMiddleware,
  validateParams(PinParamSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { pin } = req.params;
      const userId = req.user!.id;

      // Look up session by pin (any status — works in lobby and game phases)
      const session = await sessionRepository.getSessionByPin(pin);

      if (!session) {
        res.status(StatusCodes.NOT_FOUND).json({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
          statusCode: StatusCodes.NOT_FOUND,
        });
        return;
      }

      // Verify the requesting user is the session host
      if (session.host_id !== userId) {
        res.status(StatusCodes.FORBIDDEN).json({
          error: 'Only the session host can access this data',
          code: 'SESSION_HOST_FORBIDDEN',
          statusCode: StatusCodes.FORBIDDEN,
        });
        return;
      }

      // Retrieve players (ordered by score descending)
      const players = await sessionRepository.listPlayersBySession(session.id);

      // Retrieve quiz questions
      const questions = await quizRepository.getQuestionsByQuizId(session.quiz_id);

      res.status(StatusCodes.OK).json({
        session,
        players,
        questions,
      });
    } catch (err) {
      next(err);
    }
  }
);
