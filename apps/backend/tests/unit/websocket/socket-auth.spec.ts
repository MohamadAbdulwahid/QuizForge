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

  it('accepts guest connection with valid username and mints a guest-prefixed userId', async () => {
    const next = mock();
    const middleware = createSocketAuthMiddleware(verifyToken);
    const socket = {
      id: 'socket-guest-1',
      handshake: { auth: { guest: true, username: 'Casey' } },
      data: {},
    };

    await middleware(socket as never, next as never);

    // Verifier must NOT be called on the guest path.
    expect(verifyToken).not.toHaveBeenCalled();

    expect(socket.data.isGuest).toBe(true);
    expect(socket.data.username).toBe('Casey');
    expect(typeof socket.data.userId).toBe('string');
    // Format: "guest:" + RFC 4122 UUID (8-4-4-4-12 hex chars, 36 total).
    expect(socket.data.userId).toMatch(/^guest:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
  });

  it('rejects guest connection with missing username', async () => {
    const next = mock();
    const middleware = createSocketAuthMiddleware(verifyToken);
    const socket = {
      id: 'socket-guest-2',
      handshake: { auth: { guest: true } },
      data: {},
    };

    await middleware(socket as never, next as never);

    expect(verifyToken).not.toHaveBeenCalled();
    expect(socket.data.isGuest).toBeUndefined();
    expect(socket.data.userId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]?.[0] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('Invalid guest username');
  });

  it('rejects guest connection with username longer than 30 chars', async () => {
    const next = mock();
    const middleware = createSocketAuthMiddleware(verifyToken);
    const longUsername = 'x'.repeat(31);
    const socket = {
      id: 'socket-guest-3',
      handshake: { auth: { guest: true, username: longUsername } },
      data: {},
    };

    await middleware(socket as never, next as never);

    expect(verifyToken).not.toHaveBeenCalled();
    expect(socket.data.isGuest).toBeUndefined();
    expect(socket.data.userId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]?.[0] as Error;
    expect(err.message).toContain('Invalid guest username');
  });
});
