import { Router, Request, Response, NextFunction } from 'express';
import { signUpSchema, signInSchema } from '../dtos/auth.dto';
import { signUp, signIn, AuthServiceError } from '../services/auth.service';
import { createChildLogger } from '../../config/logger';
import { StatusCodes } from 'http-status-codes';

const authRouteLogger = createChildLogger('auth-routes');
const router = Router();

/**
 * POST /api/auth/signup
 * Creates a new user account via Supabase Auth
 *
 * @param req - Express request with { email, password, username } body
 * @param res - Express response
 * @param next - Express next function for error forwarding
 */
router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = signUpSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: StatusCodes.BAD_REQUEST,
        details: parsed.error.issues,
      });
      return;
    }

    const result = await signUp(parsed.data);

    authRouteLogger.info({ userId: result.user.id }, 'User signed up via endpoint');
    res.status(StatusCodes.CREATED).json(result);
  } catch (err) {
    if (err instanceof AuthServiceError) {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
        statusCode: err.statusCode,
      });
      return;
    }
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Authenticates a user with email and password
 *
 * @param req - Express request with { email, password } body
 * @param res - Express response
 * @param next - Express next function for error forwarding
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = signInSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: StatusCodes.BAD_REQUEST,
        details: parsed.error.issues,
      });
      return;
    }

    const result = await signIn(parsed.data);

    authRouteLogger.info({ userId: result.user.id }, 'User signed in via endpoint');
    res.status(StatusCodes.OK).json(result);
  } catch (err) {
    if (err instanceof AuthServiceError) {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
        statusCode: err.statusCode,
      });
      return;
    }
    next(err);
  }
});

export const authRoutes = router;
