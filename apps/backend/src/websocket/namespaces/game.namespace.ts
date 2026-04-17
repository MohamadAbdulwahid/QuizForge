import type { Namespace, Socket } from 'socket.io';
import { createChildLogger } from '../../config/logger';
import * as sessionRepository from '../../database/repositories/session.repository';
import {
  emitSocketValidationError,
  JoinGameMessageSchema,
  LeaveGameMessageSchema,
  StartGameMessageSchema,
} from '../validation/schemas';

const gameNamespaceLogger = createChildLogger('websocket-game-namespace');
const MIN_PLAYERS_TO_START = 2;

type GameSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  {
    userId?: string;
    joinedPin?: string;
    username?: string;
  }
>;

export interface GameNamespaceDependencies {
  findActiveByPin: typeof sessionRepository.findActiveByPin;
  updateStatus: typeof sessionRepository.updateStatus;
}

/**
 * Registers gameplay socket events under a namespace.
 * @param gameNamespace - Socket.IO game namespace.
 * @param dependencies - Optional data access overrides for testing.
 */
export function registerGameNamespace(
  gameNamespace: Namespace,
  dependencies: Partial<GameNamespaceDependencies> = {}
): void {
  const resolvedDependencies: GameNamespaceDependencies = {
    findActiveByPin: sessionRepository.findActiveByPin,
    updateStatus: sessionRepository.updateStatus,
    ...dependencies,
  };

  gameNamespace.on('connection', (rawSocket) => {
    const socket = rawSocket as GameSocket;

    gameNamespaceLogger.debug(
      {
        socketId: socket.id,
        userId: socket.data.userId,
      },
      'Game socket connected'
    );

    socket.on('join-game', async (payload: unknown) => {
      const parsed = JoinGameMessageSchema.safeParse(payload);

      if (!parsed.success) {
        emitSocketValidationError(socket, parsed.error);
        return;
      }

      const { pin, username } = parsed.data;
      const session = await resolvedDependencies.findActiveByPin(pin);

      if (!session) {
        socket.emit('error', {
          code: 'SESSION_NOT_FOUND',
          error: 'Session not found',
        });
        return;
      }

      const previousPin = socket.data.joinedPin;
      if (previousPin && previousPin !== pin) {
        await socket.leave(previousPin);
        gameNamespace.to(previousPin).emit('player-left', {
          userId: socket.data.userId,
        });
      }

      socket.data.joinedPin = pin;
      socket.data.username = username;

      await socket.join(pin);
      gameNamespace.to(pin).emit('player-joined', {
        userId: socket.data.userId,
        username,
        isHost: socket.data.userId === session.host_id,
      });

      const socketsInRoom = await gameNamespace.in(pin).fetchSockets();
      const players = socketsInRoom
        .filter((roomSocket) => Boolean(roomSocket.data.userId))
        .map((roomSocket) => ({
          userId: roomSocket.data.userId,
          username: roomSocket.data.username,
          isHost: roomSocket.data.userId === session.host_id,
        }));

      socket.emit('lobby-state', {
        pin,
        hostUserId: session.host_id,
        status: session.status,
        minPlayersToStart: MIN_PLAYERS_TO_START,
        players,
      });
    });

    socket.on('leave-game', async (payload: unknown) => {
      const parsed = LeaveGameMessageSchema.safeParse(payload);

      if (!parsed.success) {
        emitSocketValidationError(socket, parsed.error);
        return;
      }

      const { pin, reason } = parsed.data;
      if (socket.data.joinedPin !== pin) {
        return;
      }

      await socket.leave(pin);
      socket.data.joinedPin = undefined;

      gameNamespace.to(pin).emit('player-left', {
        userId: socket.data.userId,
        reason,
      });
    });

    socket.on('start-game', async (payload: unknown) => {
      const parsed = StartGameMessageSchema.safeParse(payload);

      if (!parsed.success) {
        emitSocketValidationError(socket, parsed.error);
        return;
      }

      const { pin } = parsed.data;
      if (socket.data.joinedPin !== pin) {
        socket.emit('error', {
          code: 'NOT_IN_LOBBY',
          error: 'Join the lobby before starting the game',
        });
        return;
      }

      const session = await resolvedDependencies.findActiveByPin(pin);
      if (!session) {
        socket.emit('error', {
          code: 'SESSION_NOT_FOUND',
          error: 'Session not found',
        });
        return;
      }

      if (socket.data.userId !== session.host_id) {
        socket.emit('error', {
          code: 'SESSION_HOST_FORBIDDEN',
          error: 'Only the host can start the game',
        });
        return;
      }

      if (session.status === 'playing' || session.status === 'in-progress') {
        gameNamespace.to(pin).emit('game-started', {
          pin,
          startedByUserId: socket.data.userId,
        });
        return;
      }

      if (session.status !== 'waiting') {
        socket.emit('error', {
          code: 'INVALID_SESSION_STATUS',
          error: `Cannot start from status: ${session.status}`,
        });
        return;
      }

      const socketsInRoom = await gameNamespace.in(pin).fetchSockets();
      const activePlayerCount = socketsInRoom.filter((roomSocket) =>
        Boolean(roomSocket.data.userId)
      ).length;

      if (activePlayerCount < MIN_PLAYERS_TO_START) {
        socket.emit('error', {
          code: 'NOT_ENOUGH_PLAYERS',
          error: 'Not enough players to start',
          details: {
            currentPlayers: activePlayerCount,
            minPlayersToStart: MIN_PLAYERS_TO_START,
          },
        });
        return;
      }

      await resolvedDependencies.updateStatus(session.id, 'playing');
      gameNamespace.to(pin).emit('game-started', {
        pin,
        startedByUserId: socket.data.userId,
        playerCount: activePlayerCount,
      });
    });

    socket.on('disconnect', () => {
      const pin = socket.data.joinedPin;
      if (pin) {
        gameNamespace.to(pin).emit('player-left', {
          userId: socket.data.userId,
        });
      }

      gameNamespaceLogger.debug(
        {
          socketId: socket.id,
          userId: socket.data.userId,
          pin,
        },
        'Game socket disconnected'
      );
    });
  });
}
