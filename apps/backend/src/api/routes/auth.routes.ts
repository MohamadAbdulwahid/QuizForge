import { Router, Request, Response, NextFunction } from 'express';
import { SignUpRequestSchema, SignInRequestSchema } from '../dtos/auth.dto';
import { signUp, signIn } from '../services/auth.service';
import { validateBody } from '../middleware/validation';
import { createChildLogger } from '../../config/logger';
import { StatusCodes } from 'http-status-codes';

const authRouteLogger = createChildLogger('auth-routes');
const router = Router();

/**
 * POST /api/auth/signup
 * Creates a new user account via Supabase Auth.
 * Body validated by validateBody middleware.
 */
router.post(
  '/signup',
  validateBody(SignUpRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await signUp(req.body);

      authRouteLogger.info({ userId: result.user.id }, 'User signed up via endpoint');
      res.status(StatusCodes.CREATED).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticates a user with email and password.
 * Body validated by validateBody middleware.
 */
router.post(
  '/login',
  validateBody(SignInRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await signIn(req.body);

      authRouteLogger.info({ userId: result.user.id }, 'User signed in via endpoint');
      res.status(StatusCodes.OK).json(result);
    } catch (err) {
      next(err);
    }
  }
);

export const authRoutes = router;
