import type { Socket } from 'socket.io';
import { createChildLogger } from '../../config/logger';
import { supabaseClient } from '../../config/supabase';

const websocketLogger = createChildLogger('websocket');

export type VerifySocketToken = (
  token: string
) => Promise<{ userId: string | null; errorMessage?: string }>;

const verifySocketTokenWithSupabase: VerifySocketToken = async (token) => {
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser(token);

  return {
    userId: user?.id ?? null,
    errorMessage: error?.message,
  };
};

/**
 * Creates a socket auth middleware with injectable token verification.
 * @param verifyToken - Token verification implementation.
 * @returns Socket.IO middleware.
 */
export function createSocketAuthMiddleware(
  verifyToken: VerifySocketToken = verifySocketTokenWithSupabase
): (socket: Socket, next: (err?: Error) => void) => Promise<void> {
  return async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
    const token = socket.handshake.auth?.['token'];

    if (!token || typeof token !== 'string') {
      websocketLogger.warn({ socketId: socket.id }, 'Rejected websocket connection: missing token');
      next(new Error('UNAUTHORIZED: Missing token'));
      return;
    }

    try {
      const { userId, errorMessage } = await verifyToken(token);

      if (!userId) {
        websocketLogger.warn(
          {
            socketId: socket.id,
            error: errorMessage,
          },
          'Rejected websocket connection: invalid token'
        );
        next(new Error('UNAUTHORIZED: Invalid token'));
        return;
      }

      socket.data.userId = userId;
      next();
    } catch (err) {
      websocketLogger.error(
        { err, socketId: socket.id },
        'Socket authentication failed unexpectedly'
      );
      next(new Error('AUTH_ERROR'));
    }
  };
}

/**
 * Authenticates a socket using a Supabase JWT from handshake auth.
 * On success sets socket.data.userId for downstream handlers.
 * @param socket - Socket to authenticate.
 * @param next - Socket middleware continuation callback.
 */
export const socketAuthMiddleware = createSocketAuthMiddleware();
