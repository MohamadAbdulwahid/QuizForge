import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../middleware/auth';
import {
  createQuizWithCollisionGuard,
  deleteQuiz,
  getQuizById,
  getQuizzesByCreator,
  getQuizByShareCode,
  updateQuiz,
} from '../services/quiz.service';

/**
 * HTTP handlers for quiz endpoints.
 */
export class QuizController {
  /**
   * Creates a quiz for the authenticated user.
   * @param req - Express request containing validated quiz payload.
   * @param res - Express response.
   */
  async createQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
      return;
    }

    const result = await createQuizWithCollisionGuard(userId, req.body as never);
    res.status(StatusCodes.CREATED).json(result);
  }

  /**
   * Updates quiz metadata and optionally replaces questions.
   * @param req - Express request containing quiz id and update payload.
   * @param res - Express response.
   */
  async updateQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
      return;
    }

    const quizId = Number(req.params.id);
    const result = await updateQuiz(quizId, userId, req.body as never);
    res.status(StatusCodes.OK).json(result);
  }

  /**
   * Deletes a quiz owned by the authenticated user.
   * @param req - Express request containing quiz id.
   * @param res - Express response.
   */
  async deleteQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
      return;
    }

    const quizId = Number(req.params.id);
    await deleteQuiz(quizId, userId);
    res.status(StatusCodes.NO_CONTENT).send();
  }

  /**
   * Lists all quizzes for the authenticated user.
   * @param req - Express request.
   * @param res - Express response.
   */
  async getMyQuizzes(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
      return;
    }

    const quizzes = await getQuizzesByCreator(userId);
    res.status(StatusCodes.OK).json(quizzes);
  }

  /**
   * Returns a quiz with questions for its owner.
   * @param req - Express request containing quiz id.
   * @param res - Express response.
   */
  async getQuizById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
      return;
    }

    const quizId = Number(req.params.id);
    const quiz = await getQuizById(quizId, userId);
    res.status(StatusCodes.OK).json(quiz);
  }

  /**
   * Returns a public quiz preview by share code.
   * @param req - Express request containing shareCode route param.
   * @param res - Express response.
   */
  async getQuizByShareCode(req: Request, res: Response): Promise<void> {
    const shareCodeParam = req.params.shareCode;
    const shareCode = Array.isArray(shareCodeParam) ? shareCodeParam[0] : shareCodeParam;
    const quiz = await getQuizByShareCode(shareCode);
    res.status(StatusCodes.OK).json(quiz);
  }
}

export const quizController = new QuizController();
