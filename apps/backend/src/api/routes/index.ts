import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authRoutes } from './auth.routes';
import { groupRouter } from './group.routes';
import { quizPublicRouter, quizRouter } from './quiz.routes';
import { hostSessionRouter } from './host-session.routes';
import { sessionRouter } from './session.routes';
import { sessionEventsRouter } from './session-events.routes';

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
  router.use('/groups', groupRouter);
  router.use('/quizzes', authMiddleware, quizRouter);

  // SSE must be registered before sessionRouter.
  // Otherwise sessionRouter's GET /:pin matches /events first and
  // rejects "events" as an invalid 6-digit PIN → HTTP 400.
  router.use('/sessions', sessionEventsRouter);

  router.use('/sessions', sessionRouter);
  router.use('/sessions', hostSessionRouter);

  return router;
}
