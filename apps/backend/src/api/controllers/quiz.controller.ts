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
 * Protected routes rely on authMiddleware to guarantee req.user exists.
 */
export class QuizController {
  /**
   * Creates a quiz for the authenticated user.
   */
  async createQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;

    const result = await createQuizWithCollisionGuard(userId, req.body as never);
    res.status(StatusCodes.CREATED).json(result);
  }

  /**
   * Updates quiz metadata and optionally replaces questions.
   */
  async updateQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;

    const quizId = Number(req.params.id);
    const result = await updateQuiz(quizId, userId, req.body as never);
    res.status(StatusCodes.OK).json(result);
  }

  /**
   * Deletes a quiz owned by the authenticated user.
   */
  async deleteQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;

    const quizId = Number(req.params.id);
    await deleteQuiz(quizId, userId);
    res.status(StatusCodes.NO_CONTENT).send();
  }

  /**
   * Lists all quizzes for the authenticated user.
   */
  async getMyQuizzes(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;

    const quizzes = await getQuizzesByCreator(userId);
    res.status(StatusCodes.OK).json(quizzes);
  }

  /**
   * Returns a quiz with questions for its owner.
   */
  async getQuizById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;

    const quizId = Number(req.params.id);
    const quiz = await getQuizById(quizId, userId);
    res.status(StatusCodes.OK).json(quiz);
  }

  /**
   * Returns a public quiz preview by share code (no auth required).
   */
  async getQuizByShareCode(req: Request, res: Response): Promise<void> {
    const shareCodeParam = req.params.shareCode;
    const shareCode = Array.isArray(shareCodeParam) ? shareCodeParam[0] : shareCodeParam;
    const quiz = await getQuizByShareCode(shareCode);
    res.status(StatusCodes.OK).json(quiz);
  }
}

export const quizController = new QuizController();
