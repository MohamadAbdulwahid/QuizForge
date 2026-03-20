import type { Request, Response } from 'express';
import { Tspec } from 'tspec';
import type { CreateQuizRequest, UpdateQuizRequest } from './dtos/quiz.dto';
import type { CreateSessionRequest } from './dtos/session.dto';
import type { SignInDto, SignUpDto } from './dtos/auth.dto';

type HealthResponse = { status: string; timestamp: number };
type ErrorResponse = { error: string; code: string; statusCode: number };

type HealthHandler = (_req: Request, res: Response<HealthResponse>) => void;
type SignUpHandler = (_req: Request<unknown, unknown, SignUpDto>, res: Response<unknown>) => void;
type LoginHandler = (_req: Request<unknown, unknown, SignInDto>, res: Response<unknown>) => void;
type CreateQuizHandler = (
  _req: Request<unknown, unknown, CreateQuizRequest>,
  res: Response<unknown>
) => void;
type GetMyQuizzesHandler = (_req: Request, res: Response<unknown>) => void;
type GetQuizByIdHandler = (_req: Request<{ id: string }>, res: Response<unknown>) => void;
type PatchQuizHandler = (
  _req: Request<{ id: string }, unknown, UpdateQuizRequest>,
  res: Response<unknown>
) => void;
type DeleteQuizHandler = (_req: Request<{ id: string }>, res: Response<unknown>) => void;
type PublicQuizByCodeHandler = (
  _req: Request<{ shareCode: string }>,
  res: Response<unknown>
) => void;
type CreateSessionHandler = (
  _req: Request<unknown, unknown, CreateSessionRequest>,
  res: Response<unknown>
) => void;

export type QuizForgeApiSpec = Tspec.DefineApiSpec<{
  tags: ['Auth', 'Quiz', 'Session'];
  paths: {
    '/health': {
      get: {
        tags: ['Auth'];
        summary: 'Health check';
        handler: HealthHandler;
        responses: {
          200: HealthResponse;
        };
      };
    };
    '/api/auth/signup': {
      post: {
        tags: ['Auth'];
        summary: 'Create account';
        handler: SignUpHandler;
        responses: {
          201: unknown;
          400: ErrorResponse;
          409: ErrorResponse;
        };
      };
    };
    '/api/auth/login': {
      post: {
        tags: ['Auth'];
        summary: 'Login user';
        handler: LoginHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
        };
      };
    };
    '/api/quizzes': {
      post: {
        tags: ['Quiz'];
        summary: 'Create quiz';
        handler: CreateQuizHandler;
        responses: {
          201: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
        };
      };
      get: {
        tags: ['Quiz'];
        summary: 'Get my quizzes';
        handler: GetMyQuizzesHandler;
        responses: {
          200: unknown;
          401: ErrorResponse;
        };
      };
    };
    '/api/quizzes/{id}': {
      get: {
        tags: ['Quiz'];
        summary: 'Get quiz by id';
        handler: GetQuizByIdHandler;
        responses: {
          200: unknown;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
        };
      };
      patch: {
        tags: ['Quiz'];
        summary: 'Update quiz';
        handler: PatchQuizHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
        };
      };
      delete: {
        tags: ['Quiz'];
        summary: 'Delete quiz';
        handler: DeleteQuizHandler;
        responses: {
          204: unknown;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
        };
      };
    };
    '/api/quizzes/share/{shareCode}': {
      get: {
        tags: ['Quiz'];
        summary: 'Get quiz by share code';
        handler: PublicQuizByCodeHandler;
        responses: {
          200: unknown;
          404: ErrorResponse;
        };
      };
    };
    '/api/sessions': {
      post: {
        tags: ['Session'];
        summary: 'Create session';
        handler: CreateSessionHandler;
        responses: {
          201: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
          409: ErrorResponse;
        };
      };
    };
  };
}>;
