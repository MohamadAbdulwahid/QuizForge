import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createSocketAuthMiddleware } from '../../src/websocket/middleware/socket-auth';
import { registerGameNamespace } from '../../src/websocket/namespaces/game.namespace';

const activePins = new Set(['123456', '654321']);
const sessionStatuses = new Map<string, 'waiting' | 'playing'>([
  ['123456', 'waiting'],
  ['654321', 'waiting'],
]);
const sessionPlayers = new Map<
  string,
  Array<{ id: number; user_id: string; username: string; score: number }>
>();

let httpServer: ReturnType<typeof createServer>;
let ioServer: Server;
let baseUrl = '';
const sockets: ClientSocket[] = [];

beforeAll(async () => {
  httpServer = createServer();
  ioServer = new Server(httpServer, {
    cors: { origin: '*' },
  });

  const gameNamespace = ioServer.of('/game');
  gameNamespace.use(
    createSocketAuthMiddleware(async (token) => {
      if (!token.startsWith('token-')) {
        return { userId: null, errorMessage: 'Invalid token' };
      }

      return { userId: token.replace('token-', '') };
    })
  );

  registerGameNamespace(gameNamespace, {
    findActiveByPin: async (pin: string) => {
      if (!activePins.has(pin)) {
        return null;
      }

      const status = sessionStatuses.get(pin) ?? 'waiting';

      return {
        id: 1,
        quiz_id: 1,
        pin,
        status,
        host_id: 'host-1',
        broadcast_mode: 'private',
        started_at: new Date(),
      };
    },
    updateStatus: async (_sessionId: number, status: 'waiting' | 'playing') => {
      sessionStatuses.set('123456', status);
      return {
        id: 1,
        quiz_id: 1,
        pin: '123456',
        status,
        host_id: 'host-1',
        broadcast_mode: 'private',
        started_at: new Date(),
      };
    },
    findQuizByIdWithQuestions: async () => ({
      id: 1,
      title: 'Socket Quiz',
      description: null,
      creator_id: 'host-1',
      share_code: 'SOCKET01',
      created_at: new Date(),
      questions: [
        {
          id: 1,
          quiz_id: 1,
          text: 'What is 2 + 2?',
          type: 'multiple-choice',
          options: [
            { id: 'a', text: '3' },
            { id: 'b', text: '4' },
          ],
          correct_answer: 'b',
          time_limit: 30,
          points: 100,
          order_index: 0,
        },
      ],
    }),
    upsertSessionPlayer: async ({ sessionId, userId, username }) => {
      const key = String(sessionId);
      const currentPlayers = sessionPlayers.get(key) ?? [];
      const existingPlayer = currentPlayers.find((player) => player.user_id === userId);

      if (existingPlayer) {
        existingPlayer.username = username;
        return { ...existingPlayer, session_id: sessionId, lives: null, status: 'active' };
      }

      const player = {
        id: currentPlayers.length + 1,
        user_id: userId,
        username,
        score: 0,
      };
      sessionPlayers.set(key, [...currentPlayers, player]);
      return { ...player, session_id: sessionId, lives: null, status: 'active' };
    },
    listPlayersBySession: async (sessionId: number) => {
      return (sessionPlayers.get(String(sessionId)) ?? []).map((player) => ({
        ...player,
        session_id: sessionId,
        lives: null,
        status: 'active',
      }));
    },
    updatePlayerScore: async (playerId: number, score: number) => {
      for (const players of sessionPlayers.values()) {
        const player = players.find((candidate) => candidate.id === playerId);
        if (player) {
          player.score = score;
          return { ...player, session_id: 1, lives: null, status: 'active' };
        }
      }

      throw new Error('Missing test player');
    },
    markPlayerDisconnected: async () => undefined,
    createGameEvent: async (data) => ({
      id: 1,
      session_id: data.session_id,
      session_player_id: data.session_player_id ?? null,
      event_type: data.event_type,
      data: data.data ?? null,
      created_at: new Date(),
    }),
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not start websocket test server');
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(() => {
  sessionPlayers.clear();
  sessionStatuses.set('123456', 'waiting');
  sessionStatuses.set('654321', 'waiting');
  while (sockets.length > 0) {
    const socket = sockets.pop();
    socket?.disconnect();
  }
});

afterAll(() => {
  ioServer.close();
  httpServer.close();
});

/**
 * Connects a websocket test client to the game namespace.
 * @param token - Handshake auth token.
 * @returns Connected client socket.
 */
function connectClient(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`${baseUrl}/game`, {
      auth: { token },
      transports: ['websocket'],
      timeout: 3000,
      reconnection: false,
    });

    socket.once('connect', () => {
      sockets.push(socket);
      resolve(socket);
    });

    socket.once('connect_error', reject);
  });
}

/**
 * Waits for a single socket event triggered by an action.
 * @param socket - Client socket that should receive the event.
 * @param eventName - Event name to listen for.
 * @param trigger - Callback that triggers the expected event.
 * @param timeoutMs - Timeout in milliseconds.
 * @returns Event payload.
 */
function waitForEvent<T>(
  socket: ClientSocket,
  eventName: string,
  trigger: () => void,
  timeoutMs = 2000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for event: ${eventName}`));
    }, timeoutMs);

    socket.once(eventName, (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    });

    trigger();
  });
}

/**
 * Waits for a specified delay.
 * @param ms - Delay in milliseconds.
 */
async function wait(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
}

describe('websocket room management', () => {
  it('join-game emits lobby-state including already-connected players', async () => {
    const hostSocket = await connectClient('token-host-1');
    await waitForEvent<{ userId: string }>(hostSocket, 'player-joined', () =>
      hostSocket.emit('join-game', { pin: '123456', username: 'Host' })
    );

    const playerSocket = await connectClient('token-player-1');
    const lobbyState = await waitForEvent<{
      players: Array<{ userId: string; username?: string; isHost?: boolean }>;
      hostUserId: string;
    }>(playerSocket, 'lobby-state', () =>
      playerSocket.emit('join-game', { pin: '123456', username: 'Player1' })
    );

    expect(lobbyState.hostUserId).toBe('host-1');
    expect(lobbyState.players.some((player) => player.userId === 'host-1')).toBe(true);
  });

  it('join-game with missing pin emits validation error', async () => {
    const socket = await connectClient('token-alice');

    const payload = await waitForEvent<{ code: string }>(socket, 'error', () =>
      socket.emit('join-game', {})
    );

    expect(payload.code).toBe('VALIDATION_ERROR');
  });

  it('join-game attaches socket to room pin', async () => {
    const socket = await connectClient('token-alice');

    await waitForEvent<{ userId: string }>(socket, 'player-joined', () =>
      socket.emit('join-game', { pin: '123456' })
    );

    const gameNamespace = ioServer.of('/game');
    const serverSocket = gameNamespace.sockets.get(socket.id);

    expect(serverSocket?.rooms.has('123456')).toBe(true);
  });

  it('joining a room broadcasts player-joined to room members only', async () => {
    const socketA = await connectClient('token-alice');
    const socketB = await connectClient('token-bob');

    await waitForEvent<{ userId: string }>(socketB, 'player-joined', () =>
      socketB.emit('join-game', { pin: '123456' })
    );

    const payload = await waitForEvent<{ userId: string }>(socketB, 'player-joined', () =>
      socketA.emit('join-game', { pin: '123456' })
    );

    expect(payload.userId).toBe('alice');
  });

  it('disconnect emits player-left for remaining room members', async () => {
    const socketA = await connectClient('token-alice');
    const socketB = await connectClient('token-bob');

    await waitForEvent<{ userId: string }>(socketA, 'player-joined', () =>
      socketA.emit('join-game', { pin: '123456' })
    );

    await waitForEvent<{ userId: string }>(socketB, 'player-joined', () =>
      socketB.emit('join-game', { pin: '123456' })
    );

    const payload = await waitForEvent<{ userId: string }>(socketB, 'player-left', () =>
      socketA.disconnect()
    );

    expect(payload.userId).toBe('alice');
  });

  it('room isolation prevents Room B from receiving Room A events', async () => {
    const roomASocket = await connectClient('token-alice');
    const roomBSocket = await connectClient('token-charlie');

    await waitForEvent<{ userId: string }>(roomASocket, 'player-joined', () =>
      roomASocket.emit('join-game', { pin: '123456' })
    );

    await waitForEvent<{ userId: string }>(roomBSocket, 'player-joined', () =>
      roomBSocket.emit('join-game', { pin: '654321' })
    );

    let roomBReceived = false;
    roomBSocket.once('player-left', () => {
      roomBReceived = true;
    });

    roomASocket.emit('leave-game', { pin: '123456' });
    await wait(300);

    expect(roomBReceived).toBe(false);
  });

  it('host can start game once minimum players are connected', async () => {
    const hostSocket = await connectClient('token-host-1');
    await waitForEvent<{ userId: string }>(hostSocket, 'player-joined', () =>
      hostSocket.emit('join-game', { pin: '123456', username: 'Host' })
    );

    const playerSocket = await connectClient('token-player-1');
    await waitForEvent<{ userId: string }>(playerSocket, 'player-joined', () =>
      playerSocket.emit('join-game', { pin: '123456', username: 'Player1' })
    );

    const startedPayload = await waitForEvent<{ pin: string; startedByUserId: string }>(
      playerSocket,
      'game-started',
      () => hostSocket.emit('start-game', { pin: '123456' })
    );

    expect(startedPayload.pin).toBe('123456');
    expect(startedPayload.startedByUserId).toBe('host-1');
  });

  it('host start broadcasts the first question payload', async () => {
    const hostSocket = await connectClient('token-host-1');
    await waitForEvent<{ userId: string }>(hostSocket, 'player-joined', () =>
      hostSocket.emit('join-game', { pin: '123456', username: 'Host' })
    );

    const playerSocket = await connectClient('token-player-1');
    await waitForEvent<{ userId: string }>(playerSocket, 'player-joined', () =>
      playerSocket.emit('join-game', { pin: '123456', username: 'Player1' })
    );

    const questionPayload = await waitForEvent<{
      questionId: number;
      text: string;
      options: Array<{ id: string; text: string }>;
      timeLimitMs: number;
    }>(playerSocket, 'question', () => hostSocket.emit('start-game', { pin: '123456' }));

    expect(questionPayload.questionId).toBe(1);
    expect(questionPayload.text).toBe('What is 2 + 2?');
    expect(questionPayload.options).toHaveLength(2);
    expect(questionPayload.timeLimitMs).toBe(30000);
  });
});
