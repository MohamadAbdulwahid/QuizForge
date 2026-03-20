import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import express from 'express';

mock.module('../../src/config/supabase', () => ({
  supabaseClient: {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
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
    createQuiz: (_req: express.Request, res: express.Response) => res.status(201).json({}),
    getMyQuizzes: (_req: express.Request, res: express.Response) => res.status(200).json([]),
    getQuizById: (_req: express.Request, res: express.Response) => res.status(200).json({}),
    updateQuiz: (_req: express.Request, res: express.Response) => res.status(200).json({}),
    deleteQuiz: (_req: express.Request, res: express.Response) => res.status(204).send(),
    getQuizByShareCode: (_req: express.Request, res: express.Response) => res.status(200).json({}),
  },
}));

mock.module('../../src/api/controllers/session.controller', () => ({
  sessionController: {
    createSession: (_req: express.Request, res: express.Response) =>
      res.status(201).json({ session: { id: 1 }, pin: '123456' }),
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

describe('session endpoints integration', () => {
  const headers = {
    'API-Version': '1.0',
    Authorization: 'Bearer valid-token',
    'Content-Type': 'application/json',
  };

  it('POST /api/sessions returns 201 for valid payload', async () => {
    const response = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ quiz_id: 1 }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.pin).toBe('123456');
  });

  it('POST /api/sessions returns 400 for invalid payload', async () => {
    const response = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ quiz_id: 'not-a-number' }),
    });

    expect(response.status).toBe(400);
  });
});
