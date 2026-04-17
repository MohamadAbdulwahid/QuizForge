import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './auth.routes';
import { quizPublicRouter, quizRouter } from './quiz.routes';
import { sessionRouter } from './session.routes';

/**
 * Registers API routes under /api.
 * Public routes are mounted first, then protected routes.
 * @returns Configured API router.
 */
export function registerRoutes(): Router {
  const router = Router();

  router.use('/auth', authRoutes);

  // Public quiz preview route.
  router.use('/quizzes', quizPublicRouter);

  // Protected quiz/session routes.
  router.use('/quizzes', authMiddleware, quizRouter);
  router.use('/sessions', sessionRouter);

  return router;
}
