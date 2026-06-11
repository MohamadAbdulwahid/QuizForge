import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import express from 'express';

/**
 * Integration tests for admin dashboard endpoints.
 * Tests auth + admin middleware, endpoint responses, and access control.
 */

// --- Mock Supabase auth ---
mock.module('../../src/config/supabase', () => ({
  supabaseClient: {
    auth: {
      getUser: async (token: string) => {
        if (token === 'admin-token') {
          return { data: { user: { id: 'admin-user-1' } }, error: null };
        }
        if (token === 'user-token') {
          return { data: { user: { id: 'regular-user-1' } }, error: null };
        }
        return { data: { user: null }, error: { message: 'Invalid token' } };
      },
    },
  },
  authAdminClient: { auth: { admin: { createUser: async () => ({}) } } },
}));

// Set admin user IDs for the middleware
process.env['ADMIN_USER_IDS'] = 'admin-user-1';

// --- Mock admin service ---
mock.module('../../src/api/services/admin.service', () => ({
  getPlatformStats: async () => ({
    totalSessions: 10,
    activeSessions: 3,
    endedSessions: 7,
    totalPlayers: 25,
    averagePlayersPerSession: 2.5,
    completionRate: 70,
  }),
  getRecentSessions: async (limit: number) =>
    Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
      id: i + 1,
      pin: `12345${i}`,
      status: 'ended',
      quizTitle: `Quiz ${i}`,
      hostEmail: 'host@test.com',
      playerCount: 5,
      startedAt: new Date(),
    })),
  getSessionAnalytics: async (sessionId: number) => {
    if (sessionId === 999) {
      throw Object.assign(new Error('Session not found'), {
        code: 'SESSION_NOT_FOUND',
        statusCode: 404,
      });
    }
    return {
      sessionId,
      pin: '123456',
      quizTitle: 'Test Quiz',
      status: 'ended',
      playerCount: 5,
      totalQuestions: 10,
      answeredQuestions: 8,
      averageAnswerTimeMs: 3500,
      startedAt: new Date(),
    };
  },
  getStaleSessions: async () => [
    {
      id: 1,
      pin: '111111',
      status: 'playing',
      quizTitle: 'Stale Quiz',
      hostEmail: 'host@test.com',
      playerCount: 3,
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      minutesSinceStart: 60,
    },
  ],
  terminateSession: async (sessionId: number) => ({
    terminated: sessionId !== 888,
  }),
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
  if (!address || typeof address === 'string') throw new Error('Could not start test server');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server.close();
  mock.restore();
});

describe('Admin Dashboard Endpoints', () => {
  const adminHeaders = {
    'API-Version': '1.0',
    Authorization: 'Bearer admin-token',
    'Content-Type': 'application/json',
  };

  const userHeaders = {
    'API-Version': '1.0',
    Authorization: 'Bearer user-token',
    'Content-Type': 'application/json',
  };

  describe('GET /api/admin/check', () => {
    it('returns 200 for admin user', async () => {
      const res = await fetch(`${baseUrl}/api/admin/check`, { headers: adminHeaders });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isAdmin).toBe(true);
    });

    it('returns 403 for non-admin user', async () => {
      const res = await fetch(`${baseUrl}/api/admin/check`, { headers: userHeaders });
      expect(res.status).toBe(403);
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await fetch(`${baseUrl}/api/admin/check`, {
        headers: { 'API-Version': '1.0' },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/admin/stats', () => {
    it('returns platform stats for admin', async () => {
      const res = await fetch(`${baseUrl}/api/admin/stats`, { headers: adminHeaders });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalSessions).toBe(10);
      expect(body.activeSessions).toBe(3);
      expect(body.completionRate).toBe(70);
    });

    it('returns 403 for non-admin', async () => {
      const res = await fetch(`${baseUrl}/api/admin/stats`, { headers: userHeaders });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/sessions', () => {
    it('returns recent sessions for admin', async () => {
      const res = await fetch(`${baseUrl}/api/admin/sessions`, { headers: adminHeaders });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(3);
    });

    it('respects limit parameter', async () => {
      const res = await fetch(`${baseUrl}/api/admin/sessions?limit=1`, { headers: adminHeaders });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
    });

    it('returns 403 for non-admin', async () => {
      const res = await fetch(`${baseUrl}/api/admin/sessions`, { headers: userHeaders });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/sessions/stale', () => {
    it('returns stale sessions for admin', async () => {
      const res = await fetch(`${baseUrl}/api/admin/sessions/stale`, { headers: adminHeaders });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0].minutesSinceStart).toBe(60);
    });

    it('returns 403 for non-admin', async () => {
      const res = await fetch(`${baseUrl}/api/admin/sessions/stale`, { headers: userHeaders });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/sessions/:sessionId/analytics', () => {
    it('returns session analytics for admin', async () => {
      const res = await fetch(`${baseUrl}/api/admin/sessions/1/analytics`, {
        headers: adminHeaders,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sessionId).toBe(1);
      expect(body.totalQuestions).toBe(10);
      expect(body.answeredQuestions).toBe(8);
    });

    it('returns 404 for non-existent session', async () => {
      const res = await fetch(`${baseUrl}/api/admin/sessions/999/analytics`, {
        headers: adminHeaders,
      });
      expect(res.status).toBe(404);
    });

    it('returns 403 for non-admin', async () => {
      const res = await fetch(`${baseUrl}/api/admin/sessions/1/analytics`, {
        headers: userHeaders,
      });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/admin/sessions/:sessionId/terminate', () => {
    it('terminates a session for admin', async () => {
      const res = await fetch(`${baseUrl}/api/admin/sessions/1/terminate`, {
        method: 'POST',
        headers: adminHeaders,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.terminated).toBe(true);
    });

    it('returns 403 for non-admin', async () => {
      const res = await fetch(`${baseUrl}/api/admin/sessions/1/terminate`, {
        method: 'POST',
        headers: userHeaders,
      });
      expect(res.status).toBe(403);
    });
  });
});
