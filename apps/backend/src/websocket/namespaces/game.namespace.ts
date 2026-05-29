import type { Namespace, Socket } from 'socket.io';
import { createChildLogger } from '../../config/logger';
import { calculateForgeClassicScore } from '../../game/engine/scoring';
import { validateAnswerSubmission } from '../../game/engine/answer-validation';
import * as quizRepository from '../../database/repositories/quiz.repository';
import * as sessionRepository from '../../database/repositories/session.repository';
import type { QUESTION } from '../../database/schema/quiz';
import type { Session, SessionPlayer } from '../../database/schema/session';
import { RoomEventRateLimiter } from '../rate-limit';
import {
  emitSocketValidationError,
  EndSessionMessageSchema,
  JoinGameMessageSchema,
  LeaveGameMessageSchema,
  NextQuestionMessageSchema,
  SkipQuestionMessageSchema,
  StartGameMessageSchema,
  SubmitAnswerMessageSchema,
} from '../validation/schemas';
import { emitSessionEvent } from '../../api/services/session-event.service';

const gameNamespaceLogger = createChildLogger('websocket-game-namespace');
const MIN_PLAYERS_TO_START = 2;
const DEFAULT_TIME_LIMIT_SECONDS = 30;
const DEFAULT_POINTS = 100;

/**
 * Tracks which host user IDs currently have active WebSocket connections.
 * Maps hostUserId → Set of session pins they are hosting.
 * Used by the session cleanup scheduler to detect orphaned sessions
 * when a host disconnects without explicitly ending their session.
 */
const connectedHosts = new Map<string, Set<string>>();

interface QuestionOption {
  id: string;
  text: string;
}

interface PublicQuestionPayload {
  pin: string;
  sessionId: number;
  questionId: number;
  order: number;
  totalQuestions: number;
  text: string;
  type: string;
  options: QuestionOption[];
  points: number;
  timeLimitMs: number;
  serverStartTimeMs: number;
}

interface LeaderboardPlayer {
  userId: string;
  username: string;
  score: number;
  rank: number;
}

interface ActiveRoundState {
  question: QUESTION;
  publicQuestion: PublicQuestionPayload;
  startTimeMs: number;
  timeLimitMs: number;
  submittedUserIds: Set<string>;
  closed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

interface ActiveGameState {
  pin: string;
  sessionId: number;
  quizId: number;
  hostUserId: string;
  questions: QUESTION[];
  currentQuestionIndex: number;
  playersByUserId: Map<string, SessionPlayer>;
  scoresByUserId: Map<string, number>;
  round: ActiveRoundState | null;
  status: 'playing' | 'ended';
}

interface ServerToClientEvents {
  'player-joined': (payload: PlayerJoinedEvent) => void;
  'player-left': (payload: PlayerLeftEvent) => void;
  'lobby-state': (payload: LobbyStateEvent) => void;
  'game-started': (payload: GameStartedEvent) => void;
  'round-started': (payload: RoundStartedEvent) => void;
  question: (payload: PublicQuestionPayload) => void;
  'answer-ack': (payload: AnswerAckEvent) => void;
  'answer-rejected': (payload: SocketErrorPayload) => void;
  'score-update': (payload: ScoreUpdateEvent) => void;
  'leaderboard-update': (payload: LeaderboardUpdateEvent) => void;
  'round-closed': (payload: RoundClosedEvent) => void;
  'game-ended': (payload: GameEndedEvent) => void;
  'session-closed': (payload: SessionClosedEvent) => void;
  error: (payload: SocketErrorPayload) => void;
}

interface ClientToServerEvents {
  'join-game': (payload: unknown) => void;
  'leave-game': (payload: unknown) => void;
  'end-session': (payload: unknown) => void;
  'start-game': (payload: unknown) => void;
  'submit-answer': (payload: unknown) => void;
  'next-question': (payload: unknown) => void;
  'skip-question': (payload: { pin: string }) => void;
}

interface SocketData {
  userId?: string;
  joinedPin?: string;
  username?: string;
}

interface PlayerJoinedEvent {
  userId?: string;
  username?: string;
  isHost?: boolean;
}

interface PlayerLeftEvent {
  userId?: string;
  reason?: string;
}

interface LobbyStateEvent {
  pin: string;
  hostUserId: string;
  status: string;
  minPlayersToStart: number;
  players: Array<{ userId: string; username?: string; isHost?: boolean }>;
}

interface GameStartedEvent {
  pin: string;
  sessionId: number;
  startedByUserId?: string;
  playerCount?: number;
}

interface RoundStartedEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  order: number;
  totalQuestions: number;
  serverStartTimeMs: number;
  timeLimitMs: number;
}

interface AnswerAckEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  selectedAnswer: string;
  correct: boolean;
  scoreDelta: number;
  totalScore: number;
}

interface ScoreUpdateEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  playerId: string;
  username: string;
  scoreDelta: number;
  totalScore: number;
  correct: boolean;
  rank: number;
  leaderboard: LeaderboardPlayer[];
}

interface LeaderboardUpdateEvent {
  pin: string;
  sessionId: number;
  leaderboard: LeaderboardPlayer[];
}

interface RoundClosedEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  order: number;
}

interface GameEndedEvent {
  pin: string;
  sessionId: number;
  leaderboard: LeaderboardPlayerEvent[];
}

interface SessionClosedEvent {
  pin: string;
  sessionId: number;
  reason: string;
}

interface SocketErrorPayload {
  code: string;
  error: string;
  details?: unknown;
}

type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type GameNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export interface GameNamespaceDependencies {
  findActiveByPin: typeof sessionRepository.findActiveByPin;
  updateStatus: typeof sessionRepository.updateStatus;
  findQuizByIdWithQuestions: typeof quizRepository.findByIdWithQuestions;
  upsertSessionPlayer: typeof sessionRepository.upsertSessionPlayer;
  listPlayersBySession: typeof sessionRepository.listPlayersBySession;
  updatePlayerScore: typeof sessionRepository.updatePlayerScore;
  markPlayerDisconnected: typeof sessionRepository.markPlayerDisconnected;
  createGameEvent: typeof sessionRepository.createGameEvent;
  deleteSession: typeof sessionRepository.deleteSession;
  deletePlayersBySession: typeof sessionRepository.deletePlayersBySession;
  rateLimiter: RoomEventRateLimiter;
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
  const typedNamespace = gameNamespace as GameNamespace;
  const activeGames = new Map<string, ActiveGameState>();
  const resolvedDependencies: GameNamespaceDependencies = {
    findActiveByPin: sessionRepository.findActiveByPin,
    updateStatus: sessionRepository.updateStatus,
    findQuizByIdWithQuestions: quizRepository.findByIdWithQuestions,
    upsertSessionPlayer: sessionRepository.upsertSessionPlayer,
    listPlayersBySession: sessionRepository.listPlayersBySession,
    updatePlayerScore: sessionRepository.updatePlayerScore,
    markPlayerDisconnected: sessionRepository.markPlayerDisconnected,
    createGameEvent: sessionRepository.createGameEvent,
    deleteSession: sessionRepository.deleteSession,
    deletePlayersBySession: sessionRepository.deletePlayersBySession,
    rateLimiter: new RoomEventRateLimiter(100),
    ...dependencies,
  };

  typedNamespace.on('connection', (socket) => {
    gameNamespaceLogger.debug(
      { socketId: socket.id, userId: socket.data.userId },
      'Game socket connected'
    );

    socket.on('join-game', async (payload) => {
      const parsed = JoinGameMessageSchema.safeParse(payload);

      if (!parsed.success) {
        emitSocketValidationError(socket, parsed.error);
        return;
      }

      const { pin } = parsed.data;
      const session = await resolvedDependencies.findActiveByPin(pin);

      if (!session) {
        emitError(socket, 'SESSION_NOT_FOUND', 'Session not found');
        return;
      }

      const userId = socket.data.userId;
      const username = parsed.data.username ?? formatUsername(userId);

      if (userId) {
        await resolvedDependencies.upsertSessionPlayer({ sessionId: session.id, userId, username });
      }

      const previousPin = socket.data.joinedPin;
      if (previousPin && previousPin !== pin) {
        await socket.leave(previousPin);
        typedNamespace.to(previousPin).emit('player-left', { userId });
      }

      socket.data.joinedPin = pin;
      socket.data.username = username;

      await socket.join(pin);
      typedNamespace.to(pin).emit('player-joined', {
        userId,
        username,
        isHost: userId === session.host_id,
      });

      // Track host connections for orphaned-session cleanup.
      if (userId === session.host_id) {
        const hostSessions = connectedHosts.get(userId) ?? new Set<string>();
        hostSessions.add(pin);
        connectedHosts.set(userId, hostSessions);
      }

      socket.emit('lobby-state', await buildLobbyState(typedNamespace, pin, session));
      await sendGameResync(socket, activeGames.get(pin));
    });

    socket.on('leave-game', async (payload) => {
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

      typedNamespace.to(pin).emit('player-left', { userId: socket.data.userId, reason });
    });

    socket.on('end-session', async (payload) => {
      const parsed = EndSessionMessageSchema.safeParse(payload);

      if (!parsed.success) {
        emitSocketValidationError(socket, parsed.error);
        return;
      }

      const { pin } = parsed.data;
      const userId = socket.data.userId;

      if (!pin || !userId) {
        socket.emit('error', {
          code: 'NOT_HOST',
          error: 'Only the host can end the session.',
        } as const);
        return;
      }

      // Case 1: Game already started — close via activeGames
      const activeGame = activeGames.get(pin);
      if (activeGame && userId === activeGame.hostUserId) {
        // Notify all players (NOT the host — they initiated the end)
        typedNamespace.to(pin).emit('session-closed', {
          pin,
          sessionId: activeGame.sessionId,
          reason: 'Game ended by host',
        });

        // Immediately end the session in memory
        activeGame.status = 'ended';
        if (activeGame.round?.timer) {
          clearTimeout(activeGame.round.timer);
          activeGame.round.timer = null;
        }
        activeGames.delete(pin);

        // Update DB asynchronously
        void resolvedDependencies.updateStatus(activeGame.sessionId, 'ended');
        void logGameEvent(resolvedDependencies, activeGame.sessionId, null, 'session-closed', {
          pin,
          reason: 'Host ended session',
        });

        // Notify SSE subscribers so dashboards update in real-time
        sessionRepository
          .listBroadcastGroupIds(activeGame.sessionId)
          .then((groupIds) => {
            if (groupIds.length > 0) {
              emitSessionEvent('ended', activeGame.sessionId, groupIds);
            }
          })
          .catch(() => {
            /* non-critical — SSE is best-effort */
          });

        // Clean up host tracking
        const hostSessions = connectedHosts.get(userId);
        if (hostSessions) {
          hostSessions.delete(pin);
          if (hostSessions.size === 0) {
            connectedHosts.delete(userId);
          }
        }

        gameNamespaceLogger.info({ pin, hostUserId: userId }, 'Session ended by host (active)');
        return;
      }

      // Case 2: Host is in lobby (pre-start) — delete session immediately
      const hostSessions = connectedHosts.get(userId);
      if (hostSessions?.has(pin)) {
        const session = await resolvedDependencies.findActiveByPin(pin);
        if (session) {
          // Notify all players in the lobby
          typedNamespace.to(pin).emit('session-closed', {
            pin,
            sessionId: session.id,
            reason: 'Host ended the session',
          });

          // Fetch group IDs BEFORE hard-deleting (cascade will remove them)
          const groupIds = await sessionRepository
            .listBroadcastGroupIds(session.id)
            .catch(() => []);

          // Hard-delete session and players from DB
          await resolvedDependencies.deletePlayersBySession(session.id);
          await resolvedDependencies.deleteSession(session.id);

          // Notify SSE subscribers so dashboards update in real-time
          if (groupIds.length > 0) {
            emitSessionEvent('ended', session.id, groupIds);
          }

          // Clean up host tracking
          hostSessions.delete(pin);
          if (hostSessions.size === 0) {
            connectedHosts.delete(userId);
          }

          // Disconnect all sockets from the room
          typedNamespace.in(pin).disconnectSockets(true);

          gameNamespaceLogger.info({ pin, hostUserId: userId }, 'Session ended by host (lobby)');
        }
        return;
      }

      // Not the host — reject
      socket.emit('error', {
        code: 'NOT_HOST',
        error: 'Only the host can end the session.',
      } as const);
    });

    socket.on('start-game', async (payload) => {
      const parsed = StartGameMessageSchema.safeParse(payload);

      if (!parsed.success) {
        emitSocketValidationError(socket, parsed.error);
        return;
      }

      const { pin } = parsed.data;
      const session = await validateHostAction(socket, pin, resolvedDependencies);
      if (!session) {
        return;
      }

      const activeGame = activeGames.get(pin);
      if (activeGame?.round) {
        emitCurrentRound(typedNamespace, activeGame);
        return;
      }

      if (
        session.status !== 'waiting' &&
        session.status !== 'playing' &&
        session.status !== 'in-progress'
      ) {
        emitError(socket, 'INVALID_SESSION_STATUS', `Cannot start from status: ${session.status}`);
        return;
      }

      const socketsInRoom = await typedNamespace.in(pin).fetchSockets();
      const activePlayerCount = socketsInRoom.filter(
        (roomSocket) =>
          Boolean(roomSocket.data.userId) && roomSocket.data.userId !== session.host_id
      ).length;

      if (activePlayerCount < MIN_PLAYERS_TO_START) {
        emitError(socket, 'NOT_ENOUGH_PLAYERS', 'Not enough players to start', {
          currentPlayers: activePlayerCount,
          minPlayersToStart: MIN_PLAYERS_TO_START,
        });
        return;
      }

      const quiz = await resolvedDependencies.findQuizByIdWithQuestions(session.quiz_id);
      if (!quiz || quiz.questions.length === 0) {
        emitError(socket, 'QUIZ_EMPTY', 'This quiz has no playable questions');
        return;
      }

      await resolvedDependencies.updateStatus(session.id, 'playing');

      const players = await resolvedDependencies.listPlayersBySession(session.id);
      const gameState = createGameState(pin, session, quiz.questions, players);
      activeGames.set(pin, gameState);

      typedNamespace.to(pin).emit('game-started', {
        pin,
        sessionId: session.id,
        startedByUserId: socket.data.userId,
        playerCount: activePlayerCount,
      });

      await logGameEvent(resolvedDependencies, session.id, null, 'session-started', {
        pin,
        questionCount: quiz.questions.length,
      });
      await startRound(typedNamespace, resolvedDependencies, gameState, activeGames, 0);
    });

    socket.on('submit-answer', async (payload) => {
      const parsed = SubmitAnswerMessageSchema.safeParse(payload);

      if (!parsed.success) {
        emitSocketValidationError(socket, parsed.error);
        return;
      }

      const { pin, sessionId, questionId, selectedAnswer } = parsed.data;
      const userId = socket.data.userId;
      const gameState = activeGames.get(pin);

      if (
        !userId ||
        socket.data.joinedPin !== pin ||
        !gameState ||
        gameState.sessionId !== sessionId
      ) {
        emitRejection(socket, 'NOT_IN_ACTIVE_GAME', 'Join the active game before answering');
        return;
      }

      const round = gameState.round;
      const validation = validateAnswerSubmission({
        sessionId,
        questionId,
        userId,
        selectedAnswer,
        nowMs: Date.now(),
        activeQuestion:
          round && !round.closed
            ? {
                sessionId: gameState.sessionId,
                questionId: round.question.id,
                startTimeMs: round.startTimeMs,
                timeLimitMs: round.timeLimitMs,
                optionIds: round.publicQuestion.options.map((option) => option.id),
                submittedUserIds: round.submittedUserIds,
              }
            : null,
      });

      if (!validation.ok) {
        emitRejection(socket, validation.code, validation.error);
        return;
      }

      round?.submittedUserIds.add(userId);
      const player = await ensureGamePlayer(
        resolvedDependencies,
        gameState,
        userId,
        socket.data.username
      );
      const isCorrect = selectedAnswer === String(round?.question.correct_answer ?? '');
      const scoreResult = calculateForgeClassicScore({
        isCorrect,
        basePoints: round?.question.points ?? DEFAULT_POINTS,
        timeLimitMs: round?.timeLimitMs ?? DEFAULT_TIME_LIMIT_SECONDS * 1000,
        elapsedMs: validation.elapsedMs,
      });
      const nextTotalScore = (gameState.scoresByUserId.get(userId) ?? 0) + scoreResult.points;

      gameState.scoresByUserId.set(userId, nextTotalScore);
      await resolvedDependencies.updatePlayerScore(player.id, nextTotalScore);
      await logGameEvent(resolvedDependencies, sessionId, player.id, 'answer-submitted', {
        questionId,
        selectedAnswer,
        correct: isCorrect,
        elapsedMs: validation.elapsedMs,
      });
      await logGameEvent(resolvedDependencies, sessionId, player.id, 'score-calculated', {
        questionId,
        scoreDelta: scoreResult.points,
        totalScore: nextTotalScore,
        multiplier: scoreResult.multiplier,
      });

      const leaderboard = buildLeaderboard(gameState);
      const rank = leaderboard.find((entry) => entry.userId === userId)?.rank ?? leaderboard.length;
      const username = player.username;

      socket.emit('answer-ack', {
        pin,
        sessionId,
        questionId,
        selectedAnswer,
        correct: isCorrect,
        scoreDelta: scoreResult.points,
        totalScore: nextTotalScore,
      });

      throttledEmit(resolvedDependencies, typedNamespace, pin, 'score-update', {
        pin,
        sessionId,
        questionId,
        playerId: userId,
        username,
        scoreDelta: scoreResult.points,
        totalScore: nextTotalScore,
        correct: isCorrect,
        rank,
        leaderboard,
      });
      throttledEmit(resolvedDependencies, typedNamespace, pin, 'leaderboard-update', {
        pin,
        sessionId,
        leaderboard,
      });

      // Auto-advance: close round and advance if all players have answered
      tryAutoAdvance(gameState, typedNamespace, resolvedDependencies, activeGames);
    });

    socket.on('next-question', async (payload) => {
      const parsed = NextQuestionMessageSchema.safeParse(payload);

      if (!parsed.success) {
        emitSocketValidationError(socket, parsed.error);
        return;
      }

      const { pin } = parsed.data;
      const session = await validateHostAction(socket, pin, resolvedDependencies);
      if (!session) {
        return;
      }

      const gameState = activeGames.get(pin);
      if (!gameState || gameState.status !== 'playing' || !gameState.round) {
        emitError(socket, 'ROUND_NOT_ACTIVE', 'No active round to skip');
        return;
      }

      await handleSkipQuestion(
        socket,
        pin,
        gameState,
        typedNamespace,
        resolvedDependencies,
        activeGames
      );
    });

    socket.on('skip-question', async (payload) => {
      const parsed = SkipQuestionMessageSchema.safeParse(payload);

      if (!parsed.success) {
        emitSocketValidationError(socket, parsed.error);
        return;
      }

      const { pin } = parsed.data;
      const session = await validateHostAction(socket, pin, resolvedDependencies);
      if (!session) {
        return;
      }

      const gameState = activeGames.get(pin);
      if (!gameState || gameState.status !== 'playing' || !gameState.round) {
        emitError(socket, 'ROUND_NOT_ACTIVE', 'No active round to skip');
        return;
      }

      await handleSkipQuestion(
        socket,
        pin,
        gameState,
        typedNamespace,
        resolvedDependencies,
        activeGames
      );
    });

    socket.on('disconnect', async () => {
      const pin = socket.data.joinedPin;
      const userId = socket.data.userId;
      const activeGame = pin ? activeGames.get(pin) : undefined;

      // Case 1: Host disconnected from active game
      if (pin && userId && activeGame && userId === activeGame.hostUserId) {
        // Notify all players in the room that the session was closed
        typedNamespace.to(pin).emit('session-closed', {
          pin,
          sessionId: activeGame.sessionId,
          reason: 'Host left the session',
        });

        // Immediately end the session in memory
        activeGame.status = 'ended';
        // Clear the round timer if running
        if (activeGame.round?.timer) {
          clearTimeout(activeGame.round.timer);
          activeGame.round.timer = null;
        }
        activeGames.delete(pin);

        // Update DB asynchronously — fire-and-forget is fine
        void resolvedDependencies.updateStatus(activeGame.sessionId, 'ended');
        void logGameEvent(resolvedDependencies, activeGame.sessionId, null, 'session-closed', {
          pin,
          reason: 'Host disconnected',
        });

        // Clean up host tracking
        const hostSessions = connectedHosts.get(userId);
        if (hostSessions) {
          hostSessions.delete(pin);
          if (hostSessions.size === 0) {
            connectedHosts.delete(userId);
          }
        }

        gameNamespaceLogger.info(
          { pin, hostUserId: userId },
          'Session closed because host disconnected'
        );
        return;
      }

      // Case 2: Host disconnected from lobby (pre-start) — delete session immediately
      if (pin && userId) {
        const hostSessions = connectedHosts.get(userId);
        if (hostSessions?.has(pin)) {
          const session = await resolvedDependencies.findActiveByPin(pin);
          if (session) {
            typedNamespace.to(pin).emit('session-closed', {
              pin,
              sessionId: session.id,
              reason: 'Host left the session',
            });

            // Hard-delete session and players from DB
            await resolvedDependencies.deletePlayersBySession(session.id);
            await resolvedDependencies.deleteSession(session.id);

            // Clean up host tracking
            hostSessions.delete(pin);
            if (hostSessions.size === 0) {
              connectedHosts.delete(userId);
            }

            // Disconnect all sockets from the room
            typedNamespace.in(pin).disconnectSockets(true);

            gameNamespaceLogger.info(
              { pin, hostUserId: userId },
              'Session closed because host disconnected (lobby)'
            );
          }
          return;
        }
      }

      // Case 3: Regular player disconnect
      if (pin) {
        typedNamespace.to(pin).emit('player-left', { userId });
      }

      if (activeGame && userId) {
        void resolvedDependencies.markPlayerDisconnected(activeGame.sessionId, userId);
      }

      gameNamespaceLogger.debug({ socketId: socket.id, userId, pin }, 'Game socket disconnected');
    });
  });
}

async function buildLobbyState(
  gameNamespace: GameNamespace,
  pin: string,
  session: Session
): Promise<LobbyStateEvent> {
  const socketsInRoom = await gameNamespace.in(pin).fetchSockets();
  const players = socketsInRoom
    .filter((roomSocket) => Boolean(roomSocket.data.userId))
    .map((roomSocket) => ({
      userId: roomSocket.data.userId ?? '',
      username: roomSocket.data.username,
      isHost: roomSocket.data.userId === session.host_id,
    }));

  return {
    pin,
    hostUserId: session.host_id,
    status: session.status,
    minPlayersToStart: MIN_PLAYERS_TO_START,
    players,
  };
}

async function validateHostAction(
  socket: GameSocket,
  pin: string,
  dependencies: GameNamespaceDependencies
): Promise<Session | null> {
  if (socket.data.joinedPin !== pin) {
    emitError(socket, 'NOT_IN_LOBBY', 'Join the lobby before using host controls');
    return null;
  }

  const session = await dependencies.findActiveByPin(pin);
  if (!session) {
    emitError(socket, 'SESSION_NOT_FOUND', 'Session not found');
    return null;
  }

  if (socket.data.userId !== session.host_id) {
    emitError(socket, 'SESSION_HOST_FORBIDDEN', 'Only the host can control the game');
    return null;
  }

  return session;
}

function createGameState(
  pin: string,
  session: Session,
  questions: QUESTION[],
  players: SessionPlayer[]
): ActiveGameState {
  // Filter out the host — they are NOT a player and should not appear
  // in the leaderboard or count toward auto-advance.
  const nonHostPlayers = players.filter((player) => player.user_id !== session.host_id);

  return {
    pin,
    sessionId: session.id,
    quizId: session.quiz_id,
    hostUserId: session.host_id,
    questions,
    currentQuestionIndex: 0,
    playersByUserId: new Map(nonHostPlayers.map((player) => [player.user_id, player])),
    scoresByUserId: new Map(nonHostPlayers.map((player) => [player.user_id, player.score])),
    round: null,
    status: 'playing',
  };
}

async function startRound(
  gameNamespace: GameNamespace,
  dependencies: GameNamespaceDependencies,
  gameState: ActiveGameState,
  activeGames: Map<string, ActiveGameState>,
  index: number
): Promise<void> {
  if (gameState.round?.timer) {
    clearTimeout(gameState.round.timer);
  }

  const question = gameState.questions[index];
  const startTimeMs = Date.now();
  const timeLimitMs = Math.max(5, question.time_limit ?? DEFAULT_TIME_LIMIT_SECONDS) * 1000;
  const publicQuestion = buildPublicQuestion(gameState, question, index, startTimeMs, timeLimitMs);
  const round: ActiveRoundState = {
    question,
    publicQuestion,
    startTimeMs,
    timeLimitMs,
    submittedUserIds: new Set<string>(),
    closed: false,
    timer: null,
  };

  round.timer = setTimeout(() => {
    closeRoundAndAdvance(gameNamespace, dependencies, gameState, activeGames);
  }, timeLimitMs);

  gameState.currentQuestionIndex = index;
  gameState.round = round;

  await logGameEvent(dependencies, gameState.sessionId, null, 'round-started', {
    questionId: question.id,
    order: index + 1,
    serverStartTimeMs: startTimeMs,
    timeLimitMs,
  });

  gameNamespace.to(gameState.pin).emit('round-started', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    questionId: question.id,
    order: index + 1,
    totalQuestions: gameState.questions.length,
    serverStartTimeMs: startTimeMs,
    timeLimitMs,
  });
  gameNamespace.to(gameState.pin).emit('question', publicQuestion);
}

function closeRound(gameNamespace: GameNamespace, gameState: ActiveGameState): void {
  const round = gameState.round;
  if (!round || round.closed) {
    return;
  }

  round.closed = true;
  if (round.timer) {
    clearTimeout(round.timer);
    round.timer = null;
  }

  gameNamespace.to(gameState.pin).emit('round-closed', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    questionId: round.question.id,
    order: gameState.currentQuestionIndex + 1,
  });
}

/**
 * Closes the current round and automatically advances to the next question
 * or ends the game if no more questions remain.
 */
function closeRoundAndAdvance(
  gameNamespace: GameNamespace,
  dependencies: GameNamespaceDependencies,
  gameState: ActiveGameState,
  activeGames: Map<string, ActiveGameState>
): void {
  const round = gameState.round;
  if (!round || round.closed) {
    return; // Guard: prevent double-close
  }

  closeRound(gameNamespace, gameState);

  const nextIndex = gameState.currentQuestionIndex + 1;
  if (nextIndex < gameState.questions.length) {
    // More questions — advance after brief delay
    gameState.currentQuestionIndex = nextIndex;
    setTimeout(() => {
      emitNextQuestion(gameNamespace, dependencies, gameState, activeGames);
    }, 3000);
  } else {
    // No more questions — emit game-ended after delay
    setTimeout(() => {
      emitGameEnded(gameNamespace, dependencies, gameState, activeGames);
    }, 3000);
  }
}

/**
 * Emits the next question to the room and starts its round timer.
 * Sets up round tracking state and schedules auto-advance on timer expiry.
 */
function emitNextQuestion(
  gameNamespace: GameNamespace,
  dependencies: GameNamespaceDependencies,
  gameState: ActiveGameState,
  activeGames: Map<string, ActiveGameState>
): void {
  const index = gameState.currentQuestionIndex;
  const question = gameState.questions[index];
  if (!question) {
    return;
  }

  const startTimeMs = Date.now();
  const timeLimitMs = Math.max(5, question.time_limit ?? DEFAULT_TIME_LIMIT_SECONDS) * 1000;
  const publicQuestion = buildPublicQuestion(gameState, question, index, startTimeMs, timeLimitMs);

  const round: ActiveRoundState = {
    question,
    publicQuestion,
    startTimeMs,
    timeLimitMs,
    submittedUserIds: new Set<string>(),
    closed: false,
    timer: null,
  };

  round.timer = setTimeout(() => {
    closeRoundAndAdvance(gameNamespace, dependencies, gameState, activeGames);
  }, timeLimitMs);

  gameState.round = round;

  void logGameEvent(dependencies, gameState.sessionId, null, 'round-started', {
    questionId: question.id,
    order: index + 1,
    serverStartTimeMs: startTimeMs,
    timeLimitMs,
  });

  gameNamespace.to(gameState.pin).emit('round-started', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    questionId: question.id,
    order: index + 1,
    totalQuestions: gameState.questions.length,
    serverStartTimeMs: startTimeMs,
    timeLimitMs,
  });
  gameNamespace.to(gameState.pin).emit('question', publicQuestion);
}

/**
 * Emits the game-ended event to the room and cleans up the in-memory game state.
 */
function emitGameEnded(
  gameNamespace: GameNamespace,
  dependencies: GameNamespaceDependencies,
  gameState: ActiveGameState,
  activeGames: Map<string, ActiveGameState>
): void {
  gameState.status = 'ended';
  activeGames.delete(gameState.pin);

  void dependencies.updateStatus(gameState.sessionId, 'ended');
  void logGameEvent(dependencies, gameState.sessionId, null, 'session-ended', {
    pin: gameState.pin,
    leaderboard: buildLeaderboard(gameState),
  });

  gameNamespace.to(gameState.pin).emit('game-ended', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    leaderboard: buildLeaderboard(gameState),
  });
}

/**
 * Checks whether all players have answered the current round.
 * If so, clears the timer and closes the round with auto-advance.
 */
function tryAutoAdvance(
  gameState: ActiveGameState,
  gameNamespace: GameNamespace,
  dependencies: GameNamespaceDependencies,
  activeGames: Map<string, ActiveGameState>
): void {
  if (!gameState.round || gameState.round.closed || gameState.status !== 'playing') {
    return;
  }

  const totalAnswered = gameState.round.submittedUserIds.size;
  const totalPlayers = gameState.playersByUserId.size;

  if (totalPlayers > 0 && totalAnswered >= totalPlayers) {
    // All players answered — clear timer and advance
    if (gameState.round.timer) {
      clearTimeout(gameState.round.timer);
      gameState.round.timer = null;
    }
    closeRoundAndAdvance(gameNamespace, dependencies, gameState, activeGames);
  }
}

/**
 * Handles a skip-question request from the host:
 * 1. Cancels the round timer
 * 2. Sends answer-ack with 0 points to unanswered players
 * 3. Closes the round and advances
 */
async function handleSkipQuestion(
  socket: GameSocket,
  pin: string,
  gameState: ActiveGameState,
  gameNamespace: GameNamespace,
  dependencies: GameNamespaceDependencies,
  activeGames: Map<string, ActiveGameState>
): Promise<void> {
  // Cancel the round timer
  if (gameState.round?.timer) {
    clearTimeout(gameState.round.timer);
    gameState.round.timer = null;
  }

  // Mark unanswered players as "no answer" (0 points)
  if (gameState.round) {
    const socketsInRoom = await gameNamespace.in(pin).fetchSockets();
    for (const s of socketsInRoom) {
      const uid = s.data.userId;
      if (uid && !gameState.round.submittedUserIds.has(uid)) {
        s.emit('answer-ack', {
          pin,
          sessionId: gameState.sessionId,
          questionId: gameState.round.question.id,
          selectedAnswer: '',
          correct: false,
          scoreDelta: 0,
          totalScore: gameState.scoresByUserId.get(uid) ?? 0,
        });
      }
    }
  }

  // Close round and advance
  closeRoundAndAdvance(gameNamespace, dependencies, gameState, activeGames);
}

function emitCurrentRound(gameNamespace: GameNamespace, gameState: ActiveGameState): void {
  if (!gameState.round) {
    return;
  }

  gameNamespace.to(gameState.pin).emit('game-started', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
  });
  gameNamespace.to(gameState.pin).emit('round-started', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    questionId: gameState.round.question.id,
    order: gameState.currentQuestionIndex + 1,
    totalQuestions: gameState.questions.length,
    serverStartTimeMs: gameState.round.startTimeMs,
    timeLimitMs: gameState.round.timeLimitMs,
  });
  gameNamespace.to(gameState.pin).emit('question', gameState.round.publicQuestion);
}

async function sendGameResync(
  socket: GameSocket,
  gameState: ActiveGameState | undefined
): Promise<void> {
  if (!gameState || gameState.status !== 'playing') {
    return;
  }

  socket.emit('game-started', { pin: gameState.pin, sessionId: gameState.sessionId });

  if (gameState.round) {
    socket.emit('round-started', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      questionId: gameState.round.question.id,
      order: gameState.currentQuestionIndex + 1,
      totalQuestions: gameState.questions.length,
      serverStartTimeMs: gameState.round.startTimeMs,
      timeLimitMs: gameState.round.timeLimitMs,
    });
    socket.emit('question', gameState.round.publicQuestion);
  }

  socket.emit('leaderboard-update', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    leaderboard: buildLeaderboard(gameState),
  });
}

function buildPublicQuestion(
  gameState: ActiveGameState,
  question: QUESTION,
  index: number,
  serverStartTimeMs: number,
  timeLimitMs: number
): PublicQuestionPayload {
  return {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    questionId: question.id,
    order: index + 1,
    totalQuestions: gameState.questions.length,
    text: question.text,
    type: question.type,
    options: parseQuestionOptions(question.options),
    points: question.points ?? DEFAULT_POINTS,
    timeLimitMs,
    serverStartTimeMs,
  };
}

function parseQuestionOptions(value: unknown): QuestionOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((option) => {
    if (typeof option !== 'object' || option === null) {
      return [];
    }

    const candidate = option as { id?: unknown; text?: unknown };
    if (typeof candidate.id !== 'string' || typeof candidate.text !== 'string') {
      return [];
    }

    return [{ id: candidate.id, text: candidate.text }];
  });
}

async function ensureGamePlayer(
  dependencies: GameNamespaceDependencies,
  gameState: ActiveGameState,
  userId: string,
  username?: string
): Promise<SessionPlayer> {
  const existingPlayer = gameState.playersByUserId.get(userId);
  if (existingPlayer) {
    return existingPlayer;
  }

  const player = await dependencies.upsertSessionPlayer({
    sessionId: gameState.sessionId,
    userId,
    username: username ?? formatUsername(userId),
  });
  gameState.playersByUserId.set(userId, player);
  gameState.scoresByUserId.set(userId, player.score);
  return player;
}

function buildLeaderboard(gameState: ActiveGameState): LeaderboardPlayer[] {
  return [...gameState.playersByUserId.values()]
    .map((player) => ({
      userId: player.user_id,
      username: player.username,
      score: gameState.scoresByUserId.get(player.user_id) ?? player.score,
    }))
    .sort((left, right) => right.score - left.score || left.username.localeCompare(right.username))
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

function throttledEmit<TEvent extends keyof ServerToClientEvents>(
  dependencies: GameNamespaceDependencies,
  gameNamespace: GameNamespace,
  pin: string,
  event: TEvent,
  payload: Parameters<ServerToClientEvents[TEvent]>[0]
): void {
  dependencies.rateLimiter.emit({ room: pin, event, payload }, (nextEvent) => {
    gameNamespace.to(nextEvent.room).emit(event, nextEvent.payload as never);
  });
}

async function logGameEvent(
  dependencies: GameNamespaceDependencies,
  sessionId: number,
  sessionPlayerId: number | null,
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await dependencies.createGameEvent({
      session_id: sessionId,
      session_player_id: sessionPlayerId,
      event_type: eventType,
      data,
    });
  } catch (err) {
    gameNamespaceLogger.error({ err, sessionId, eventType }, 'Failed to write game event');
  }
}

function emitError(socket: GameSocket, code: string, error: string, details?: unknown): void {
  socket.emit('error', { code, error, details });
}

function emitRejection(socket: GameSocket, code: string, error: string, details?: unknown): void {
  socket.emit('answer-rejected', { code, error, details });
}

function formatUsername(userId: string | undefined): string {
  if (!userId) {
    return 'Player';
  }

  return `Player-${userId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

/**
 * Returns all host user IDs that currently have active WebSocket connections.
 * Used by the session cleanup scheduler to identify orphaned sessions.
 */
export function getConnectedHostIds(): Set<string> {
  return new Set(connectedHosts.keys());
}

/**
 * Starts a periodic cleanup interval that removes ended and orphaned sessions.
 * Runs every 5 minutes by default. Cleans up:
 * - Sessions with terminal status ('ended', 'finished')
 * - Active sessions whose host has disconnected (no active WebSocket)
 * @param intervalMs - Cleanup interval in milliseconds (default: 300000 = 5 min).
 * @returns Cleanup function to stop the interval.
 */
export function startCleanupScheduler(intervalMs = 300_000): () => void {
  const cleanupLogger = createChildLogger('session-cleanup');

  const intervalId = setInterval(async () => {
    try {
      const endedCount = await sessionRepository.cleanupEndedSessions();
      const connectedHostIds = getConnectedHostIds();
      const orphanedCount = await sessionRepository.cleanupOrphanedSessions(connectedHostIds);

      if (endedCount > 0 || orphanedCount > 0) {
        cleanupLogger.info(
          { endedCount, orphanedCount, connectedHosts: connectedHostIds.size },
          'Session cleanup completed'
        );
      }
    } catch (err) {
      cleanupLogger.error({ err }, 'Session cleanup failed');
    }
  }, intervalMs);

  return () => {
    clearInterval(intervalId);
    cleanupLogger.info('Session cleanup scheduler stopped');
  };
}
