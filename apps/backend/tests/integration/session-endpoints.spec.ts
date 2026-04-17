import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import express from 'express';

mock.module('../../src/config/supabase', () => ({
  supabaseClient: {
    auth: {
      getUser: async (token: string) => {
        if (token === 'host-token') {
          return {
            data: { user: { id: 'host-1' } },
            error: null,
          };
        }

        if (token === 'player-token') {
          return {
            data: { user: { id: 'player-1' } },
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
    getMySessions: (_req: express.Request, res: express.Response) => res.status(200).json([]),
    getSessionByPin: (req: express.Request, res: express.Response) => {
      if (req.params.pin === '111111') {
        res.status(404).json({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
          statusCode: 404,
        });
        return;
      }

      res.status(200).json({
        id: 1,
        pin: req.params.pin,
        status: 'waiting',
      });
    },
    updateSessionStatus: (req: express.Request, res: express.Response) => {
      const userId = (req as express.Request & { user?: { id?: string } }).user?.id;

      if (userId !== 'host-1') {
        res.status(403).json({
          error: 'Only the host can change session status',
          code: 'SESSION_HOST_FORBIDDEN',
          statusCode: 403,
        });
        return;
      }

      const action = (req.body as { action: string }).action;
      const nextStatus = action === 'start' ? 'playing' : 'paused';

      res.status(200).json({
        session: {
          id: 1,
          pin: req.params.pin,
          status: nextStatus,
        },
        previousStatus: 'waiting',
        nextStatus,
      });
    },
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
  const authHeaders = {
    'API-Version': '1.0',
    Authorization: 'Bearer host-token',
    'Content-Type': 'application/json',
  };

  it('POST /api/sessions accepts valid payload and returns 201', async () => {
    const response = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ quiz_id: 1 }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.pin).toBe('123456');
  });

  it('GET /api/sessions/:pin returns 200 for active session', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/123456`, {
      headers: {
        'API-Version': '1.0',
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pin).toBe('123456');
  });

  it('GET /api/sessions/:pin returns 400 for invalid pin format', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/12`, {
      headers: {
        'API-Version': '1.0',
      },
    });

    expect(response.status).toBe(400);
  });

  it('GET /api/sessions/:pin returns 404 for missing active session', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/111111`, {
      headers: {
        'API-Version': '1.0',
      },
    });

    expect(response.status).toBe(404);
  });

  it('PATCH /api/sessions/:pin/status returns 401 without JWT', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/123456/status`, {
      method: 'PATCH',
      headers: {
        'API-Version': '1.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'start' }),
    });

    expect(response.status).toBe(401);
  });

  it('PATCH /api/sessions/:pin/status returns 403 for non-host user', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/123456/status`, {
      method: 'PATCH',
      headers: {
        'API-Version': '1.0',
        Authorization: 'Bearer player-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'start' }),
    });

    expect(response.status).toBe(403);
  });

  it('PATCH /api/sessions/:pin/status returns 200 for valid transition by host', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/123456/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ action: 'start' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.nextStatus).toBe('playing');
  });
});
