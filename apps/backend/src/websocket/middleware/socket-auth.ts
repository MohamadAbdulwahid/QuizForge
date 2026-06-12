import type { Socket } from 'socket.io';
import { createChildLogger } from '../../config/logger';
import { supabaseClient } from '../../config/supabase';

const websocketLogger = createChildLogger('websocket');

/** Maximum allowed length (after trimming) for a guest username. */
const MAX_GUEST_USERNAME_LENGTH = 30;

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
 *
 * Supports two connection modes:
 *
 * 1. **Authenticated** — the handshake carries a Supabase JWT in
 *    `auth.token`. The verifier resolves a real `userId` (a UUID from the
 *    `USER` table) and stores it on `socket.data.userId`.
 * 2. **Guest (Kahoot-style)** — the handshake carries `auth.guest === true`
 *    and a non-empty `auth.username` (1–30 chars after trimming). No token
 *    verification is performed. The middleware mints an ephemeral,
 *    non-UUID identifier of the form `guest:<uuid>` and stores it on
 *    `socket.data.userId`, sets `socket.data.isGuest = true`, and stores
 *    the trimmed username on `socket.data.username`.
 *
 * Downstream handlers MUST gate any DB write that targets a UUID-typed
 * column (e.g. `session_player.user_id`, which has a foreign key to
 * `USER.id`) on `!socket.data.isGuest` — passing a `guest:<uuid>` string
 * to a UUID column would crash Postgres on insert.
 *
 * @param verifyToken - Token verification implementation.
 * @returns Socket.IO middleware.
 */
export function createSocketAuthMiddleware(
  verifyToken: VerifySocketToken = verifySocketTokenWithSupabase
): (socket: Socket, next: (err?: Error) => void) => Promise<void> {
  return async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
    const auth = socket.handshake.auth ?? {};
    const isGuest = auth['guest'] === true;

    if (isGuest) {
      const rawUsername = auth['username'];

      if (typeof rawUsername !== 'string') {
        websocketLogger.warn(
          { socketId: socket.id },
          'Rejected guest websocket connection: missing username'
        );
        next(new Error('UNAUTHORIZED: Invalid guest username'));
        return;
      }

      const trimmedUsername = rawUsername.trim();
      if (trimmedUsername.length < 1 || trimmedUsername.length > MAX_GUEST_USERNAME_LENGTH) {
        websocketLogger.warn(
          { socketId: socket.id, usernameLength: trimmedUsername.length },
          'Rejected guest websocket connection: username length out of range'
        );
        next(new Error('UNAUTHORIZED: Invalid guest username'));
        return;
      }

      // The "guest:" prefix is detected by downstream handlers to skip DB
      // writes against UUID-typed columns (see SocketData.isGuest).
      socket.data.userId = `guest:${crypto.randomUUID()}`;
      socket.data.isGuest = true;
      socket.data.username = trimmedUsername;
      next();
      return;
    }

    const token = auth['token'];

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
 * Authenticates a socket using a Supabase JWT from handshake auth, with
 * an opt-in guest path for Kahoot-style play. See `createSocketAuthMiddleware`
 * for full semantics. On success sets `socket.data.userId` (real UUID for
 * authenticated users, `guest:<uuid>` for guests), and for guests also
 * `socket.data.isGuest = true` and `socket.data.username`.
 * @param socket - Socket to authenticate.
 * @param next - Socket middleware continuation callback.
 */
export const socketAuthMiddleware = createSocketAuthMiddleware();
