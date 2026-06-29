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

mock.module('../../src/api/controllers/quiz.controller', () => {
  // getQuizByShareCode mock simulates the service's visibility gating: hidden
  // codes (private/draft) are not findable and return 404. The service tests
  // in quiz.service.spec.ts are the source of truth for the gating logic;
  // this mock just provides a representative response shape.
  const getQuizByShareCode = (req: express.Request, res: express.Response): void => {
    const code = req.params.shareCode;
    if (code === 'PRIVATECODE' || code === 'DRAFTCODE') {
      res.status(404).json({ error: 'Quiz not found', code: 'QUIZ_NOT_FOUND' });
      return;
    }
    res.status(200).json({ id: 1, questions: [{ id: 10 }] });
  };

  // discoverQuizzes mock echoes back the validated limit/offset so callers
  // can assert the request shape was preserved end-to-end.
  const discoverQuizzes = (req: express.Request, res: express.Response): void => {
    const limit = Number(req.query.limit) || 24;
    const offset = Number(req.query.offset) || 0;
    res.status(200).json({ items: [], total: 0, limit, offset });
  };

  // AI remix mock: returns a representative remix payload so callers can
  // assert the route reaches the controller and the response shape is right.
  const aiRemixQuiz = (_req: express.Request, res: express.Response): void => {
    res.status(200).json({
      quiz: { id: 100, title: '[Remix] Demo', parent_quiz_id: 1, transformation_type: 'remix' },
      shareCode: 'REMIXED1',
      transformationType: 'remix',
      reused: false,
    });
  };

  // AI translate mock: returns a representative translate payload.
  const aiTranslateQuiz = (_req: express.Request, res: express.Response): void => {
    res.status(200).json({
      quiz: { id: 101, title: '[Spanish] Demo', parent_quiz_id: 1, transformation_type: 'translate' },
      shareCode: 'TRANSLT1',
      transformationType: 'translate',
      targetLanguage: 'es',
      reused: false,
    });
  };

  // AI generate mock: returns a representative generated-questions payload.
  const aiGenerateQuiz = (_req: express.Request, res: express.Response): void => {
    res.status(200).json({
      data: { questions: [{ text: 'Q?', type: 'multiple-choice', options: [], correct_answer: 'a' }] },
      meta: { count: 1 },
    });
  };

  return {
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
      getQuizByShareCode,
      discoverQuizzes,
      aiGenerateQuiz,
      aiRemixQuiz,
      aiTranslateQuiz,
    },
  };
});

mock.module('../../src/api/controllers/session.controller', () => ({
  sessionController: {
    createSession: (_req: express.Request, res: express.Response) =>
      res.status(201).json({ session: { id: 1 }, pin: '123456' }),
    getSessionByPin: (_req: express.Request, res: express.Response) =>
      res.status(200).json({ id: 1, pin: '123456', status: 'waiting' }),
    updateSessionStatus: (_req: express.Request, res: express.Response) =>
      res.status(200).json({ id: 1, pin: '123456', status: 'playing' }),
    getLeaderboard: (_req: express.Request, res: express.Response) =>
      res.status(200).json({ quizTitle: 'Quiz', leaderboard: [] }),
    getMySessions: (_req: express.Request, res: express.Response) =>
      res.status(200).json([]),
    abortSession: (_req: express.Request, res: express.Response) =>
      res.status(204).send(),
    startQuestion: (_req: express.Request, res: express.Response) =>
      res.status(200).json({}),
    endQuestion: (_req: express.Request, res: express.Response) =>
      res.status(200).json({}),
    showLeaderboard: (_req: express.Request, res: express.Response) =>
      res.status(200).json({}),
    showFinalLeaderboard: (_req: express.Request, res: express.Response) =>
      res.status(200).json({}),
    recordAnswer: (_req: express.Request, res: express.Response) =>
      res.status(200).json({}),
  },
}));

mock.module('../../src/api/controllers/group.controller', () => ({
  groupController: {
    createGroup: (_req: express.Request, res: express.Response) => res.status(201).json({ id: 1 }),
    listMyGroups: (_req: express.Request, res: express.Response) => res.status(200).json([]),
    searchGroups: (_req: express.Request, res: express.Response) => res.status(200).json([]),
    getGroupDetails: (_req: express.Request, res: express.Response) =>
      res.status(200).json({ id: 1 }),
    updateGroup: (_req: express.Request, res: express.Response) => res.status(200).json({ id: 1 }),
    requestJoin: (_req: express.Request, res: express.Response) =>
      res.status(200).json({ joined: false }),
    listJoinRequests: (_req: express.Request, res: express.Response) => res.status(200).json([]),
    respondToJoinRequest: (_req: express.Request, res: express.Response) =>
      res.status(200).json({}),
    inviteMember: (_req: express.Request, res: express.Response) => res.status(201).json({}),
    listMyInvites: (_req: express.Request, res: express.Response) => res.status(200).json([]),
    respondToInvite: (_req: express.Request, res: express.Response) => res.status(200).json({}),
    updateMemberRole: (_req: express.Request, res: express.Response) => res.status(200).json({}),
    removeMember: (_req: express.Request, res: express.Response) => res.status(204).send(),
    listActiveSessions: (_req: express.Request, res: express.Response) => res.status(200).json([]),
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

describe('GET /api/quizzes/discover', () => {
  const headers = {
    'API-Version': '1.0',
  };

  it('returns 200 with default pagination', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/discover`, { headers });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: unknown[];
      total: number;
      limit: number;
      offset: number;
    };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.limit).toBe(24);
    expect(body.offset).toBe(0);
  });

  it('returns 200 with custom query/sort/limit/offset', async () => {
    const response = await fetch(
      `${baseUrl}/api/quizzes/discover?query=math&sort=popular&limit=10&offset=0`,
      { headers }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { limit: number; offset: number };
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
  });

  it('returns 400 on invalid sort', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/discover?sort=invalid`, { headers });
    expect(response.status).toBe(400);
  });

  it('returns 400 when limit out of range', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/discover?limit=999`, { headers });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/quizzes/share/:code visibility gating', () => {
  const headers = {
    'API-Version': '1.0',
  };

  it('returns 404 for private quiz', async () => {
    // The mock controller returns 404 for codes flagged as private to mirror
    // the real service's NotFoundError behavior. The service tests in
    // quiz.service.spec.ts are the source of truth for the gating logic.
    const response = await fetch(`${baseUrl}/api/quizzes/share/PRIVATECODE`, { headers });
    expect(response.status).toBe(404);
  });

  it('returns 404 for draft quiz', async () => {
    // Same approach: draft visibility is also 404 in the service.
    const response = await fetch(`${baseUrl}/api/quizzes/share/DRAFTCODE`, { headers });
    expect(response.status).toBe(404);
  });
});

describe('AI remix/translate endpoints', () => {
  const headers = {
    'API-Version': '1.0',
    Authorization: 'Bearer valid-token',
    'Content-Type': 'application/json',
  };

  it('POST /api/quizzes/:id/ai-remix returns 200 with remixed quiz', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/1/ai-remix`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ instructions: 'Make it easier' }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      quiz: { parent_quiz_id: number; transformation_type: string };
      shareCode: string;
      transformationType: string;
      reused: boolean;
    };
    expect(body.transformationType).toBe('remix');
    expect(body.quiz.transformation_type).toBe('remix');
    expect(body.reused).toBe(false);
    expect(body.shareCode).toBe('REMIXED1');
  });

  it('POST /api/quizzes/:id/ai-remix returns 400 on invalid body', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/1/ai-remix`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ instructions: 'a'.repeat(2000) }),
    });
    expect(response.status).toBe(400);
  });

  it('POST /api/quizzes/:id/ai-remix returns 400 on invalid id', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/abc/ai-remix`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });

  it('POST /api/quizzes/:id/ai-translate returns 200 with translated quiz', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/1/ai-translate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetLanguage: 'es' }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      quiz: { parent_quiz_id: number; transformation_type: string };
      shareCode: string;
      transformationType: string;
      targetLanguage: string;
      reused: boolean;
    };
    expect(body.transformationType).toBe('translate');
    expect(body.targetLanguage).toBe('es');
    expect(body.quiz.transformation_type).toBe('translate');
    expect(body.reused).toBe(false);
  });

  it('POST /api/quizzes/:id/ai-translate returns 400 on unsupported language', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/1/ai-translate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetLanguage: 'klingon' }),
    });
    expect(response.status).toBe(400);
  });

  it('POST /api/quizzes/:id/ai-translate returns 400 on missing body', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/1/ai-translate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });

  it('POST /api/quizzes/:id/ai-translate returns 400 on invalid id', async () => {
    const response = await fetch(`${baseUrl}/api/quizzes/abc/ai-translate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetLanguage: 'es' }),
    });
    expect(response.status).toBe(400);
  });
});
