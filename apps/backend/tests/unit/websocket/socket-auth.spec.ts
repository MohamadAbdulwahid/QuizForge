import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { createSocketAuthMiddleware } from '../../../src/websocket/middleware/socket-auth';

describe('socket auth middleware', () => {
  const verifyToken = mock(async () => ({ userId: null, errorMessage: 'Invalid token' }));

  beforeEach(() => {
    verifyToken.mockReset();
  });

  afterAll(() => {
    mock.restore();
  });

  it('drops connection when token is missing', async () => {
    const next = mock();
    const middleware = createSocketAuthMiddleware(verifyToken);

    await middleware(
      {
        id: 'socket-1',
        handshake: { auth: {} },
        data: {},
      } as never,
      next as never
    );

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]?.[0] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('Missing token');
  });

  it('drops connection when verifier rejects token', async () => {
    const next = mock();
    const middleware = createSocketAuthMiddleware(verifyToken);

    verifyToken.mockImplementationOnce(async () => ({
      userId: null,
      errorMessage: 'Invalid token',
    }));

    await middleware(
      {
        id: 'socket-2',
        handshake: { auth: { token: 'bad-token' } },
        data: {},
      } as never,
      next as never
    );

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]?.[0] as Error;
    expect(err.message).toContain('Invalid token');
  });

  it('sets socket.data.userId and calls next on valid token', async () => {
    const next = mock();
    const middleware = createSocketAuthMiddleware(verifyToken);
    const socket = {
      id: 'socket-3',
      handshake: { auth: { token: 'good-token' } },
      data: {},
    };

    verifyToken.mockImplementationOnce(async () => ({
      userId: 'user-1',
    }));

    await middleware(socket as never, next as never);

    expect(socket.data.userId).toBe('user-1');
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
  });
});
