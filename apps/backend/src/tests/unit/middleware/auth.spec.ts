import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../../api/middleware/auth';

// Mock supabase client before importing the middleware
const mockGetUser = mock(() => Promise.resolve({ data: { user: null }, error: null }));

mock.module('../../../config/supabase', () => ({
  supabaseClient: {
    auth: {
      getUser: mockGetUser,
    },
  },
  authAdminClient: {
    auth: {
      admin: {
        createUser: mock(),
      },
    },
  },
}));

mock.module('../../../config/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
    child: () => ({
      info: mock(),
      warn: mock(),
      error: mock(),
      debug: mock(),
    }),
  },
  createChildLogger: () => ({
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  }),
}));

const { authMiddleware } = await import('../../../api/middleware/auth');

/**
 * Unit tests for auth middleware
 */
describe('authMiddleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusMock: ReturnType<typeof mock>;
  let jsonMock: ReturnType<typeof mock>;

  beforeEach(() => {
    jsonMock = mock(() => mockRes);
    statusMock = mock(() => ({ json: jsonMock }));
    mockReq = {
      headers: {},
      ip: '127.0.0.1',
    };
    mockRes = {
      status: statusMock,
      json: jsonMock,
    } as Partial<Response>;
    mockNext = mock(() => undefined);
    mockGetUser.mockReset();
  });

  it('should return 401 when Authorization header is missing', async () => {
    await authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header does not start with Bearer', async () => {
    mockReq.headers = { authorization: 'Basic abc123' };

    await authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when token is invalid', async () => {
    mockReq.headers = { authorization: 'Bearer invalid-token' };
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid token' } as unknown as null,
    });

    await authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }));
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next and attach user on valid JWT', async () => {
    const fakeUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { username: 'testuser' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    mockReq.headers = { authorization: 'Bearer valid-token' };
    mockGetUser.mockResolvedValueOnce({
      data: { user: fakeUser } as unknown as { user: null },
      error: null,
    });

    await authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toEqual(fakeUser);
  });

  it('should populate req.user with user data on success', async () => {
    const fakeUser = {
      id: 'user-456',
      email: 'another@example.com',
      user_metadata: { username: 'another' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    mockReq.headers = { authorization: 'Bearer good-token' };
    mockGetUser.mockResolvedValueOnce({
      data: { user: fakeUser } as unknown as { user: null },
      error: null,
    });

    await authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockReq.user).toBeDefined();
    expect((mockReq.user as { id: string }).id).toBe('user-456');
    expect((mockReq.user as { email: string }).email).toBe('another@example.com');
  });
});
