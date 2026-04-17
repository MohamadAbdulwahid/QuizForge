import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import express from 'express';

mock.module('../../src/config/supabase', () => ({
  supabaseClient: {
    auth: {
      getUser: async (token: string) => {
        if (token === 'valid-token') {
          return {
            data: { user: { id: 'user-1' } },
            error: null,
          };
        }

        return {
          data: { user: null },
          error: { message: 'Invalid token' },
        };
      },
    },
  },
  authAdminClient: {
    auth: {
      admin: {
        createUser: async () => ({}),
      },
    },
  },
}));

mock.module('../../src/api/controllers/quiz.controller', () => ({
  quizController: {
    createQuiz: (_req: express.Request, res: express.Response) =>
      res.status(201).json({ ok: true, shareCode: 'ABCDEFGH' }),
    getMyQuizzes: (_req: express.Request, res: express.Response) => res.status(200).json([]),
    getQuizById: (_req: express.Request, res: express.Response) => res.status(200).json({ id: 1 }),
    updateQuiz: (_req: express.Request, res: express.Response) => res.status(200).json({ id: 1 }),
    deleteQuiz: (_req: express.Request, res: express.Response) => res.status(204).send(),
    getQuizByShareCode: (_req: express.Request, res: express.Response) =>
      res.status(200).json({ id: 1 }),
  },
}));

mock.module('../../src/api/controllers/session.controller', () => ({
  sessionController: {
    createSession: (_req: express.Request, res: express.Response) =>
      res.status(201).json({ session: { id: 1 }, pin: '123456' }),
    getSessionByPin: (_req: express.Request, res: express.Response) =>
      res.status(200).json({ id: 1, pin: '123456', status: 'waiting' }),
    updateSessionStatus: (_req: express.Request, res: express.Response) =>
      res.status(200).json({ id: 1, pin: '123456', status: 'playing' }),
  },
}));

const { registerRoutes } = await import('../../src/api/routes');
const { apiVersionMiddleware } = await import('../../src/api/middleware/api-version');

let baseUrl = '';
let server: ReturnType<express.Application['listen']>;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', apiVersionMiddleware, registerRoutes());
  server = app.listen(0);
  await new Promise<void>((resolve) => server.on('listening', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not start test server');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server.close();
  mock.restore();
});

describe('quiz route auth integration', () => {
  it('returns 401 without token for protected route', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers: {
        'API-Version': '1.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Demo', questions: [] }),
    });

    expect(response.status).toBe(401);
  });

  it('allows public share route without token', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/share/ABCDEFGH`, {
      headers: {
        'API-Version': '1.0',
      },
    });

    expect(response.status).toBe(200);
  });

  it('returns 401 for invalid token', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'GET',
      headers: {
        'API-Version': '1.0',
        Authorization: 'Bearer invalid-token',
      },
    });

    expect(response.status).toBe(401);
  });

  it('allows protected route with valid token', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'GET',
      headers: {
        'API-Version': '1.0',
        Authorization: 'Bearer valid-token',
      },
    });

    expect(response.status).toBe(200);
  });
});
