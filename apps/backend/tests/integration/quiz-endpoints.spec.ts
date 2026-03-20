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
    createQuiz: (_req: express.Request, res: express.Response) =>
      res.status(201).json({ quiz: { id: 1 }, shareCode: 'ABCDEFGH' }),
    getMyQuizzes: (_req: express.Request, res: express.Response) =>
      res.status(200).json([{ id: 1, questionCount: 2 }]),
    getQuizById: (_req: express.Request, res: express.Response) =>
      res.status(200).json({ id: 1, questions: [{ id: 10 }] }),
    updateQuiz: (_req: express.Request, res: express.Response) =>
      res.status(200).json({ id: 1, title: 'Updated' }),
    deleteQuiz: (_req: express.Request, res: express.Response) => res.status(204).send(),
    getQuizByShareCode: (_req: express.Request, res: express.Response) =>
      res.status(200).json({ id: 1, questions: [{ id: 10 }] }),
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

describe('quiz endpoints integration', () => {
  const headers = {
    'API-Version': '1.0',
    Authorization: 'Bearer valid-token',
    'Content-Type': 'application/json',
  };

  it('POST /api/quizzes returns 201 with valid payload', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Demo',
        questions: [
          {
            text: '2 + 2?',
            type: 'multiple-choice',
            options: [
              { id: 'A', text: '3' },
              { id: 'B', text: '4' },
            ],
            correct_answer: 'B',
          },
        ],
      }),
    });

    expect(response.status).toBe(201);
  });

  it('POST /api/quizzes returns 400 on invalid body', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: '',
        questions: [],
      }),
    });

    expect(response.status).toBe(400);
  });

  it('GET /api/quizzes returns 200', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes`, {
      headers,
    });
    expect(response.status).toBe(200);
  });

  it('GET /api/quizzes/:id returns 200', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/1`, {
      headers,
    });
    expect(response.status).toBe(200);
  });

  it('PATCH /api/quizzes/:id returns 200', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/1`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title: 'Updated' }),
    });

    expect(response.status).toBe(200);
  });

  it('DELETE /api/quizzes/:id returns 204', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/1`, {
      method: 'DELETE',
      headers,
    });

    expect(response.status).toBe(204);
  });

  it('GET /api/quizzes/share/:code returns 200', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/share/ABCDEFGH`, {
      headers: {
        'API-Version': '1.0',
      },
    });

    expect(response.status).toBe(200);
  });
});
