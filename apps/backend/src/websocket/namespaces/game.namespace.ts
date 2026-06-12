import type { Namespace, Socket } from 'socket.io';
import { createChildLogger } from '../../config/logger';
import { calculateForgeClassicScore } from '../../game/engine/scoring';
import { validateAnswerSubmission } from '../../game/engine/answer-validation';
import { gradeAnswer } from '../../game/engine/answer-grading';
import {
  handleCorrectAnswer,
  handleIncorrectAnswer,
  processChestPick,
  processStealTarget,
  processSwapTarget,
  applyGoldOutcome,
  shouldAdvanceTreasureForgeRound,
  createTreasureForgeRoundState,
  createPlayerQuestionState,
  getNextPlayerQuestion,
  advanceToNextQuestion,
  isPlayerInPenalty,
  WRONG_ANSWER_DELAY_MS,
  WRONG_ANSWER_PENALTY_MS,
  type TreasureForgeRoundState,
  type PlayerQuestionState,
} from '../../game/engine/treasure-forge.engine';
import { generateChests } from '../../game/engine/chest-generation';
import type { ChestOutcome } from '../../game/engine/chest-generation';
import { stealGold, swapGold } from '../../game/engine/gold-calculation';
import * as quizRepository from '../../database/repositories/quiz.repository';
import * as sessionRepository from '../../database/repositories/session.repository';
import type { QUESTION } from '../../database/schema/quiz';
import type {
  Session,
  SessionPlayer,
  GameMode,
  ChestOutcomeType,
} from '../../database/schema/session';
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
  SelectChestMessageSchema,
  SelectStealTargetMessageSchema,
} from '../validation/schemas';
import type {
  SubmitAnswerMessage,
  SelectChestMessage,
  SelectStealTargetMessage,
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
  /**
   * Right-side options for 'matching' questions. Server-shuffled
   * deterministically so reconnects see the same order. Undefined
   * for every other question type.
   */
  rightOptions?: QuestionOption[];
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
  /** Treasure Forge round state (null for Forge Classic). */
  treasureForge: TreasureForgeRoundState | null;
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
  /** Game mode for this session. */
  gameMode: GameMode;
  /** Continuous TF: per-player question tracking. */
  playerQuestionStates?: Map<string, PlayerQuestionState>;
  /** Continuous TF: timestamp when game started. */
  gameStartTime?: number;
  /** Continuous TF: end condition mode (timer / gold_goal). */
  tfEndMode?: string | null;
  /** Continuous TF: timer duration in minutes (timer mode). */
  tfTimerMinutes?: number | null;
  /** Continuous TF: gold goal target (gold_goal mode). */
  tfGoldGoal?: number | null;
  /** Continuous TF: reference to game end timer. */
  gameEndTimer?: ReturnType<typeof setTimeout> | null;
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
  // Treasure Forge events
  'chests-revealed': (payload: ChestsRevealedEvent) => void;
  'chest-effect': (payload: ChestEffectEvent) => void;
  'gold-update': (payload: GoldUpdateEvent) => void;
  'target-needed': (payload: TargetNeededEvent) => void;
  'forge-activity': (payload: ForgeActivityEvent) => void;
}

interface ClientToServerEvents {
  'join-game': (payload: unknown) => void;
  'leave-game': (payload: unknown) => void;
  'end-session': (payload: unknown) => void;
  'start-game': (payload: unknown) => void;
  'submit-answer': (payload: unknown) => void;
  'next-question': (payload: unknown) => void;
  'request-question': (payload: unknown) => void;
  'skip-question': (payload: { pin: string }) => void;
  // Treasure Forge events
  'select-chest': (payload: unknown) => void;
  'select-steal-target': (payload: unknown) => void;
}

interface SocketData {
  userId?: string;
  joinedPin?: string;
  username?: string;
  /**
   * Set by the socket auth middleware when the handshake opted into the
   * guest path (`auth.guest === true`). Guests have a non-UUID `userId`
   * of the form `guest:<uuid>`, so downstream handlers must skip any DB
   * write that targets a UUID-typed column (e.g. `session_player.user_id`).
   */
  isGuest?: boolean;
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
  gameMode: GameMode;
}

interface GameStartedEvent {
  pin: string;
  sessionId: number;
  startedByUserId?: string;
  playerCount?: number;
  gameMode: GameMode;
  /** Continuous TF: end condition mode. */
  tfEndMode?: 'timer' | 'gold_goal' | string | null;
  /** Continuous TF: timer duration in minutes. */
  tfTimerMinutes?: number | null;
  /** Continuous TF: gold goal target. */
  tfGoldGoal?: number | null;
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

// Treasure Forge event payloads
interface ChestsRevealedEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  chests: readonly { type: string; label: string }[];
}

interface ChestEffectEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  outcomeType: ChestOutcomeType;
  outcomeValue: number | null;
  label: string;
  goldDelta: number;
  newTotal: number;
  targetUsername?: string;
}

interface GoldUpdateEvent {
  pin: string;
  sessionId: number;
  playerId: string;
  username: string;
  goldDelta: number;
  newTotal: number;
  leaderboard: LeaderboardPlayer[];
}

interface TargetNeededEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  outcomeType: 'steal' | 'swap';
  stealPercent?: number;
}

/** Broadcast to the room so the host can display an activity feed. */
interface ForgeActivityEvent {
  pin: string;
  sessionId: number;
  timestamp: number;
  type: 'chest-picked' | 'steal' | 'swap' | 'round-correct' | 'round-incorrect';
  playerId: string;
  playerUsername: string;
  /** Short human-readable message for the feed. */
  message: string;
  goldDelta?: number;
  newTotal?: number;
  /** Username of the target player (for steal/swap). */
  targetUsername?: string;
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
  updateSessionStartTime: typeof sessionRepository.updateSessionStartTime;
  findQuizByIdWithQuestions: typeof quizRepository.findByIdWithQuestions;
  upsertSessionPlayer: typeof sessionRepository.upsertSessionPlayer;
  findActivePlayerByUsername: typeof sessionRepository.findActivePlayerByUsername;
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
    updateSessionStartTime: sessionRepository.updateSessionStartTime,
    findQuizByIdWithQuestions: quizRepository.findByIdWithQuestions,
    upsertSessionPlayer: sessionRepository.upsertSessionPlayer,
    findActivePlayerByUsername: sessionRepository.findActivePlayerByUsername,
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
      // Guests flow through this handler too: their `socket.data.userId`
      // is a non-UUID `guest:<uuid>` string and `socket.data.isGuest` is
      // true. The handler skips any DB write that would target a UUID
      // column (e.g. `session_player.user_id`) for those sockets, but
      // still admits them into the room and the in-memory game state so
      // they can play, see questions, appear on the leaderboard, and
      // submit answers like any other player.
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

      // Post-game restriction: reject joins on ended sessions
      if (session.status === 'ended') {
        emitError(socket, 'SESSION_ENDED', 'This session has already ended');
        return;
      }

      const userId = socket.data.userId;
      // Priority: explicit payload username > middleware-stored guest
      // username > synthesised fallback from the userId.
      const username =
        parsed.data.username ?? socket.data.username ?? formatUsername(userId);

      // Check for duplicate username in the session (skip if same user reconnecting)
      if (userId) {
        const existingPlayer = await resolvedDependencies.findActivePlayerByUsername(
          session.id,
          username
        );
        if (existingPlayer && existingPlayer.user_id !== userId) {
          emitError(socket, 'DUPLICATE_USERNAME', 'That username is already taken in this session');
          return;
        }
      }

      // Prevent duplicate socket connections for the same user
      // (e.g. multiple tabs, different browsers, host trying to join as player)
      if (userId) {
        const socketsInRoom = await typedNamespace.in(pin).fetchSockets();
        const existingSocket = socketsInRoom.find(
          (roomSocket) => roomSocket.data.userId === userId && roomSocket.id !== socket.id
        );
        if (existingSocket) {
          emitError(
            socket,
            'ALREADY_IN_GAME',
            'You are already connected to this game in another window'
          );
          return;
        }
      }

      // Authenticated users get a `session_player` row; guests do NOT
      // (their userId is not a valid UUID and would crash the insert).
      if (userId && !socket.data.isGuest) {
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

      // Only broadcast player-joined for non-host players — the host never
      // needs to appear as a "joined player" on their own or others' screens.
      if (userId !== session.host_id) {
        typedNamespace.to(pin).emit('player-joined', {
          userId,
          username,
          isHost: false,
        });
      }

      // Track host connections for orphaned-session cleanup. Guests can
      // never be hosts (they are not the session creator), so gate the
      // branch defensively.
      if (userId === session.host_id && !socket.data.isGuest) {
        const hostSessions = connectedHosts.get(userId) ?? new Set<string>();
        hostSessions.add(pin);
        connectedHosts.set(userId, hostSessions);
      }

      socket.emit('lobby-state', await buildLobbyState(typedNamespace, pin, session));
      await sendGameResync(socket, activeGames.get(pin));

      // If re-joining an active TF game, ensure player has PlayerQuestionState
      const activeGame = activeGames.get(pin);
      if (
        activeGame &&
        activeGame.gameMode === 'treasure-forge' &&
        activeGame.status === 'playing' &&
        userId
      ) {
        if (!activeGame.playerQuestionStates?.has(userId)) {
          const questionIds = activeGame.questions.map((q) => q.id);
          if (!activeGame.playerQuestionStates) {
            activeGame.playerQuestionStates = new Map();
          }
          activeGame.playerQuestionStates.set(userId, createPlayerQuestionState(questionIds));
          gameNamespaceLogger.info(
            { userId, pin, questionCount: questionIds.length },
            'TF join-game: added player to playerQuestionStates'
          );
        } else {
          gameNamespaceLogger.debug(
            { userId, pin },
            'TF join-game: player already in playerQuestionStates'
          );
        }

        // Also ensure player is in playersByUserId and scoresByUserId.
        // For authenticated users, hydrate from the DB row. For guests,
        // there is no DB row — seed an in-memory placeholder so that
        // submit-answer / leaderboard / chest-pick handlers can find the
        // player record and emit a username instead of an empty string.
        if (!activeGame.playersByUserId.has(userId)) {
          gameNamespaceLogger.info(
            { userId, pin, isGuest: socket.data.isGuest === true },
            'TF join-game: added player to playersByUserId'
          );
          if (!socket.data.isGuest) {
            const player = await sessionRepository.findPlayerBySessionAndUser(session.id, userId);
            if (player) {
              activeGame.playersByUserId.set(userId, player);
              if (!activeGame.scoresByUserId.has(userId)) {
                activeGame.scoresByUserId.set(userId, player.score);
              }
            }
          } else {
            // Guest placeholder — SessionPlayer-shaped object with the
            // minimum fields consumed downstream (user_id, username,
            // score, status). Other fields are left undefined.
            activeGame.playersByUserId.set(userId, {
              id: 0,
              session_id: session.id,
              user_id: userId,
              username,
              score: 0,
              status: 'active',
            });
            if (!activeGame.scoresByUserId.has(userId)) {
              activeGame.scoresByUserId.set(userId, 0);
            }
          }
        }
      }
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

      // Branch for Treasure Forge continuous mode
      if (gameState.gameMode === 'treasure-forge') {
        await handleTreasureForgeStartGame(
          typedNamespace,
          socket,
          resolvedDependencies,
          gameState,
          activeGames,
          session
        );
        return;
      }

      typedNamespace.to(pin).emit('game-started', {
        pin,
        sessionId: session.id,
        startedByUserId: socket.data.userId,
        playerCount: activePlayerCount,
        gameMode: gameState.gameMode,
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

      // Post-game restriction: reject answers on ended games
      if (gameState.status === 'ended') {
        emitRejection(socket, 'GAME_ENDED', 'This game has ended');
        return;
      }

      // Host cannot submit answers — only players can
      if (gameState.hostUserId === userId) {
        emitRejection(socket, 'HOST_CANNOT_ANSWER', 'The host cannot submit answers');
        return;
      }

      // Branch: Continuous Treasure Forge (no rounds)
      if (gameState.gameMode === 'treasure-forge' && gameState.playerQuestionStates) {
        await handleTreasureForgeSubmitAnswer(
          socket,
          typedNamespace,
          resolvedDependencies,
          gameState,
          { pin, sessionId, questionId, selectedAnswer },
          activeGames
        );
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
        socket.data.username,
        socket.data.isGuest
      );
      const isCorrect = round ? gradeAnswer(round.question, selectedAnswer).correct : false;

      // Branch: Forge Classic vs Treasure Forge
      if (gameState.gameMode === 'treasure-forge' && round?.treasureForge) {
        // --- TREASURE FORGE ---
        if (isCorrect) {
          // Calculate rank for comeback mechanics
          const leaderboard = buildLeaderboard(gameState);
          const rank =
            leaderboard.find((entry) => entry.userId === userId)?.rank ?? leaderboard.length;
          const currentGold = gameState.scoresByUserId.get(userId) ?? 0;

          // Generate chests (server-side only — never sent until picked)
          const chests = handleCorrectAnswer(
            round.treasureForge,
            userId,
            currentGold,
            rank,
            gameState.playersByUserId.size
          );

          // Send chests to the answering player ONLY
          socket.emit('chests-revealed', {
            pin,
            sessionId,
            questionId,
            chests: chests.map((c) => ({ type: c.type, label: c.label })),
          });

          // Send answer-ack (correct, but no gold yet — gold applied after chest pick)
          socket.emit('answer-ack', {
            pin,
            sessionId,
            questionId,
            selectedAnswer,
            correct: true,
            scoreDelta: 0,
            totalScore: currentGold,
          });

          await logGameEvent(resolvedDependencies, sessionId, player.id, 'answer-submitted', {
            questionId,
            selectedAnswer,
            correct: true,
            elapsedMs: validation.elapsedMs,
            gameMode: 'treasure-forge',
          });

          // Broadcast activity to host
          typedNamespace.to(pin).emit('forge-activity', {
            pin,
            sessionId,
            timestamp: Date.now(),
            type: 'round-correct',
            playerId: userId,
            playerUsername: player.username ?? 'Player',
            message: `${player.username ?? 'Player'} answered correctly! Opening chests...`,
          });
        } else {
          // Wrong answer — mark as incorrect in Treasure Forge state
          handleIncorrectAnswer(round.treasureForge, userId);

          socket.emit('answer-ack', {
            pin,
            sessionId,
            questionId,
            selectedAnswer,
            correct: false,
            scoreDelta: 0,
            totalScore: gameState.scoresByUserId.get(userId) ?? 0,
          });

          await logGameEvent(resolvedDependencies, sessionId, player.id, 'answer-submitted', {
            questionId,
            selectedAnswer,
            correct: false,
            elapsedMs: validation.elapsedMs,
            gameMode: 'treasure-forge',
          });

          // Broadcast activity to host
          typedNamespace.to(pin).emit('forge-activity', {
            pin,
            sessionId,
            timestamp: Date.now(),
            type: 'round-incorrect',
            playerId: userId,
            playerUsername: player.username ?? 'Player',
            message: `${player.username ?? 'Player'} answered incorrectly.`,
          });

          // Anti-spam delay for wrong answers before auto-advance check
          setTimeout(() => {
            tryAutoAdvance(gameState, typedNamespace, resolvedDependencies, activeGames);
          }, WRONG_ANSWER_DELAY_MS);
        }
      } else {
        // --- FORGE CLASSIC ---
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
        const rank =
          leaderboard.find((entry) => entry.userId === userId)?.rank ?? leaderboard.length;
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
      }
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

    // --- TREASURE FORGE: Request Next Question (Continuous Mode) ---
    socket.on('request-question', async (payload) => {
      const parsed = NextQuestionMessageSchema.safeParse(payload);

      if (!parsed.success) {
        gameNamespaceLogger.warn({ socketId: socket.id }, 'TF request-question: validation failed');
        emitSocketValidationError(socket, parsed.error);
        return;
      }

      const { pin } = parsed.data;
      const userId = socket.data.userId;

      if (!userId) {
        gameNamespaceLogger.warn(
          { socketId: socket.id, pin },
          'TF request-question: no userId on socket'
        );
        emitError(socket, 'AUTH_REQUIRED', 'Authentication required');
        return;
      }

      const gameState = activeGames.get(pin);

      if (!gameState || gameState.status !== 'playing') {
        gameNamespaceLogger.warn(
          { socketId: socket.id, userId, pin },
          'TF request-question: game not active'
        );
        emitError(socket, 'GAME_NOT_ACTIVE', 'Game is not active');
        return;
      }

      if (gameState.gameMode !== 'treasure-forge') {
        emitError(socket, 'NOT_TREASURE_FORGE', 'Only available in Treasure Forge mode');
        return;
      }

      gameNamespaceLogger.info(
        { userId, pin, hasPqs: gameState.playerQuestionStates?.has(userId) },
        'TF request-question: processing'
      );

      handleTreasureForgeNextQuestion(socket, gameState);
    });

    // --- TREASURE FORGE: Chest Selection ---
    socket.on('select-chest', async (payload) => {
      const parsed = SelectChestMessageSchema.safeParse(payload);

      if (!parsed.success) {
        emitSocketValidationError(socket, parsed.error);
        return;
      }

      const { pin, sessionId, questionId, chestIndex } = parsed.data;
      const userId = socket.data.userId;
      const gameState = activeGames.get(pin);

      if (
        !userId ||
        socket.data.joinedPin !== pin ||
        !gameState ||
        gameState.sessionId !== sessionId
      ) {
        emitError(socket, 'NOT_IN_ACTIVE_GAME', 'Join the active game before picking a chest');
        return;
      }

      if (gameState.status === 'ended') {
        emitError(socket, 'GAME_ENDED', 'This game has ended');
        return;
      }

      if (gameState.gameMode !== 'treasure-forge') {
        emitError(
          socket,
          'INVALID_GAME_MODE',
          'Chest selection is only available in Treasure Forge'
        );
        return;
      }

      // Branch: Continuous Treasure Forge (no rounds)
      if (gameState.playerQuestionStates) {
        await handleTreasureForgeChestPick(
          socket,
          typedNamespace,
          resolvedDependencies,
          gameState,
          { pin, sessionId, questionId, chestIndex },
          activeGames
        );
        return;
      }

      const round = gameState.round;
      if (!round || !round.treasureForge) {
        emitError(socket, 'ROUND_NOT_ACTIVE', 'No active round for chest selection');
        return;
      }

      const result = processChestPick(
        round.treasureForge,
        userId,
        chestIndex,
        !round.closed,
        gameState.status === 'playing'
      );

      if (!result.ok) {
        emitError(socket, result.code, result.error);
        return;
      }

      const player = await ensureGamePlayer(
        resolvedDependencies,
        gameState,
        userId,
        socket.data.username,
        socket.data.isGuest
      );
      const currentGold = gameState.scoresByUserId.get(userId) ?? 0;

      // Apply gold outcome for non-interactive types
      let goldDelta = 0;
      let newTotal = currentGold;

      if (
        result.outcomeType === 'gold' ||
        result.outcomeType === 'multiplier' ||
        result.outcomeType === 'loss' ||
        result.outcomeType === 'nothing'
      ) {
        const goldResult = applyGoldOutcome(currentGold, result.outcomeType, result.outcomeValue);
        goldDelta = goldResult.delta;
        newTotal = goldResult.newTotal;

        gameState.scoresByUserId.set(userId, newTotal);
        await resolvedDependencies.updatePlayerScore(player.id, newTotal);

        // Persist chest pick to DB
        await resolvedDependencies.createChestPick({
          session_id: sessionId,
          session_player_id: player.id,
          round_number: gameState.currentQuestionIndex + 1,
          outcome_type: result.outcomeType,
          outcome_value: result.outcomeValue,
          gold_delta: goldDelta,
          target_player_id: null,
        });

        await logGameEvent(resolvedDependencies, sessionId, player.id, 'chest-picked', {
          questionId,
          chestIndex,
          outcomeType: result.outcomeType,
          outcomeValue: result.outcomeValue,
          goldDelta,
          newTotal,
        });

        // Send effect to the player
        socket.emit('chest-effect', {
          pin,
          sessionId,
          questionId,
          outcomeType: result.outcomeType,
          outcomeValue: result.outcomeValue,
          label: result.label,
          goldDelta,
          newTotal,
        });

        // Broadcast gold update to the room
        const leaderboard = buildLeaderboard(gameState);
        throttledEmit(resolvedDependencies, typedNamespace, pin, 'gold-update', {
          pin,
          sessionId,
          playerId: userId,
          username: player.username,
          goldDelta,
          newTotal,
          leaderboard,
        });
        throttledEmit(resolvedDependencies, typedNamespace, pin, 'leaderboard-update', {
          pin,
          sessionId,
          leaderboard,
        });

        // Broadcast activity to host
        typedNamespace.to(pin).emit('forge-activity', {
          pin,
          sessionId,
          timestamp: Date.now(),
          type: 'chest-picked',
          playerId: userId,
          playerUsername: player.username ?? 'Player',
          message: `${player.username ?? 'Player'} opened a chest: ${result.label}`,
          goldDelta,
          newTotal,
        });
      } else if (result.outcomeType === 'steal') {
        // Steal requires target selection
        socket.emit('target-needed', {
          pin,
          sessionId,
          questionId,
          outcomeType: 'steal',
          stealPercent: result.outcomeValue ?? 10,
        });
      } else if (result.outcomeType === 'swap') {
        // Swap requires target selection
        socket.emit('target-needed', {
          pin,
          sessionId,
          questionId,
          outcomeType: 'swap',
        });
      }

      // Try auto-advance (for non-interactive outcomes)
      if (!result.requiresTargetSelection) {
        tryAutoAdvance(gameState, typedNamespace, resolvedDependencies, activeGames);
      }
    });

    // --- TREASURE FORGE: Steal/Swap Target Selection ---
    socket.on('select-steal-target', async (payload) => {
      const parsed = SelectStealTargetMessageSchema.safeParse(payload);

      if (!parsed.success) {
        emitSocketValidationError(socket, parsed.error);
        return;
      }

      const { pin, sessionId, questionId, targetUserId } = parsed.data;
      const userId = socket.data.userId;
      const gameState = activeGames.get(pin);

      if (
        !userId ||
        socket.data.joinedPin !== pin ||
        !gameState ||
        gameState.sessionId !== sessionId
      ) {
        emitError(socket, 'NOT_IN_ACTIVE_GAME', 'Join the active game before selecting a target');
        return;
      }

      if (gameState.status === 'ended') {
        emitError(socket, 'GAME_ENDED', 'This game has ended');
        return;
      }

      if (gameState.gameMode !== 'treasure-forge') {
        emitError(
          socket,
          'INVALID_GAME_MODE',
          'Target selection is only available in Treasure Forge'
        );
        return;
      }

      // Branch: Continuous Treasure Forge (no rounds)
      if (gameState.playerQuestionStates) {
        await handleTreasureForgeStealSwap(
          socket,
          typedNamespace,
          resolvedDependencies,
          gameState,
          { pin, sessionId, questionId, targetUserId },
          activeGames
        );
        return;
      }

      const round = gameState.round;
      if (!round || !round.treasureForge) {
        emitError(socket, 'ROUND_NOT_ACTIVE', 'No active round for target selection');
        return;
      }

      const playerState = round.treasureForge.playerStates.get(userId);
      if (!playerState) {
        emitError(socket, 'NO_CHEST_PICKED', 'Pick a chest before selecting a target');
        return;
      }

      const player = await ensureGamePlayer(
        resolvedDependencies,
        gameState,
        userId,
        socket.data.username,
        socket.data.isGuest
      );
      const targetPlayer = gameState.playersByUserId.get(targetUserId);
      if (!targetPlayer) {
        emitError(socket, 'TARGET_NOT_FOUND', 'Target player not found');
        return;
      }

      const stealerGold = gameState.scoresByUserId.get(userId) ?? 0;
      const targetGold = gameState.scoresByUserId.get(targetUserId) ?? 0;

      if (playerState.outcomeType === 'steal') {
        const stealPercent = playerState.outcomeValue ?? 10;
        const result = processStealTarget(
          round.treasureForge,
          userId,
          targetUserId,
          stealerGold,
          targetGold,
          stealPercent
        );

        if (!result.ok) {
          emitError(socket, result.code, result.error);
          return;
        }

        // Update gold for both players
        gameState.scoresByUserId.set(userId, result.stealerNewTotal);
        gameState.scoresByUserId.set(targetUserId, result.targetNewTotal);
        await resolvedDependencies.updatePlayerScore(player.id, result.stealerNewTotal);
        await resolvedDependencies.updatePlayerScore(targetPlayer.id, result.targetNewTotal);

        // Persist chest pick
        await resolvedDependencies.createChestPick({
          session_id: sessionId,
          session_player_id: player.id,
          round_number: gameState.currentQuestionIndex + 1,
          outcome_type: 'steal',
          outcome_value: stealPercent,
          gold_delta: result.stolenAmount,
          target_player_id: targetPlayer.id,
        });

        await logGameEvent(resolvedDependencies, sessionId, player.id, 'steal-executed', {
          questionId,
          targetUserId,
          stolenAmount: result.stolenAmount,
          stealerNewTotal: result.stealerNewTotal,
          targetNewTotal: result.targetNewTotal,
        });

        // Send effect to the stealer
        socket.emit('chest-effect', {
          pin,
          sessionId,
          questionId,
          outcomeType: 'steal',
          outcomeValue: stealPercent,
          label: `Stole ${result.stolenAmount} Gold from ${targetPlayer.username}!`,
          goldDelta: result.stolenAmount,
          newTotal: result.stealerNewTotal,
          targetUsername: targetPlayer.username,
        });

        // Broadcast gold update
        const leaderboard = buildLeaderboard(gameState);
        throttledEmit(resolvedDependencies, typedNamespace, pin, 'gold-update', {
          pin,
          sessionId,
          playerId: userId,
          username: player.username,
          goldDelta: result.stolenAmount,
          newTotal: result.stealerNewTotal,
          leaderboard,
        });
        throttledEmit(resolvedDependencies, typedNamespace, pin, 'leaderboard-update', {
          pin,
          sessionId,
          leaderboard,
        });

        // Broadcast activity to host
        typedNamespace.to(pin).emit('forge-activity', {
          pin,
          sessionId,
          timestamp: Date.now(),
          type: 'steal',
          playerId: userId,
          playerUsername: player.username ?? 'Player',
          message: `${player.username ?? 'Player'} stole ${result.stolenAmount} Gold from ${targetPlayer.username}!`,
          goldDelta: result.stolenAmount,
          newTotal: result.stealerNewTotal,
          targetUsername: targetPlayer.username,
        });
      } else if (playerState.outcomeType === 'swap') {
        const result = processSwapTarget(
          round.treasureForge,
          userId,
          targetUserId,
          stealerGold,
          targetGold
        );

        if (!result.ok) {
          emitError(socket, result.code, result.error);
          return;
        }

        // Update gold for both players
        gameState.scoresByUserId.set(userId, result.playerNewTotal);
        gameState.scoresByUserId.set(targetUserId, result.targetNewTotal);
        await resolvedDependencies.updatePlayerScore(player.id, result.playerNewTotal);
        await resolvedDependencies.updatePlayerScore(targetPlayer.id, result.targetNewTotal);

        // Persist chest pick
        await resolvedDependencies.createChestPick({
          session_id: sessionId,
          session_player_id: player.id,
          round_number: gameState.currentQuestionIndex + 1,
          outcome_type: 'swap',
          outcome_value: null,
          gold_delta: result.playerNewTotal - stealerGold,
          target_player_id: targetPlayer.id,
        });

        await logGameEvent(resolvedDependencies, sessionId, player.id, 'swap-executed', {
          questionId,
          targetUserId,
          playerNewTotal: result.playerNewTotal,
          targetNewTotal: result.targetNewTotal,
        });

        // Send effect to the player
        socket.emit('chest-effect', {
          pin,
          sessionId,
          questionId,
          outcomeType: 'swap',
          outcomeValue: null,
          label: `Swapped Gold with ${targetPlayer.username}!`,
          goldDelta: result.playerNewTotal - stealerGold,
          newTotal: result.playerNewTotal,
          targetUsername: targetPlayer.username,
        });

        // Broadcast gold update
        const leaderboard = buildLeaderboard(gameState);
        throttledEmit(resolvedDependencies, typedNamespace, pin, 'gold-update', {
          pin,
          sessionId,
          playerId: userId,
          username: player.username,
          goldDelta: result.playerNewTotal - stealerGold,
          newTotal: result.playerNewTotal,
          leaderboard,
        });
        throttledEmit(resolvedDependencies, typedNamespace, pin, 'leaderboard-update', {
          pin,
          sessionId,
          leaderboard,
        });

        // Broadcast activity to host
        typedNamespace.to(pin).emit('forge-activity', {
          pin,
          sessionId,
          timestamp: Date.now(),
          type: 'swap',
          playerId: userId,
          playerUsername: player.username ?? 'Player',
          message: `${player.username ?? 'Player'} swapped Gold with ${targetPlayer.username}!`,
          goldDelta: result.playerNewTotal - stealerGold,
          newTotal: result.playerNewTotal,
          targetUsername: targetPlayer.username,
        });
      } else {
        emitError(socket, 'INVALID_STATE', 'No pending steal or swap for this player');
        return;
      }

      // Try auto-advance after target selection
      tryAutoAdvance(gameState, typedNamespace, resolvedDependencies, activeGames);
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
        // Guests have no `session_player` row — `markPlayerDisconnected`
        // would crash Postgres on the `user_id = $1` UUID comparison.
        if (!socket.data.isGuest) {
          void resolvedDependencies.markPlayerDisconnected(activeGame.sessionId, userId);
        }

        // Remove from in-memory player pool so auto-advance doesn't wait for them
        activeGame.playersByUserId.delete(userId);

        // If no players remain, end the game immediately
        if (activeGame.playersByUserId.size === 0) {
          activeGame.status = 'ended';
          if (activeGame.round?.timer) {
            clearTimeout(activeGame.round.timer);
            activeGame.round.timer = null;
          }
          activeGames.delete(pin);

          typedNamespace.to(pin).emit('game-ended', {
            pin,
            sessionId: activeGame.sessionId,
            leaderboard: buildLeaderboard(activeGame),
          });

          void resolvedDependencies.updateStatus(activeGame.sessionId, 'ended');
          void logGameEvent(resolvedDependencies, activeGame.sessionId, null, 'game-ended', {
            pin,
            reason: 'All players left',
          });

          gameNamespaceLogger.info({ pin }, 'Game ended — all players disconnected');
          return;
        }

        // Players remain — try auto-advance in case the disconnected player
        // was the last one we were waiting on
        tryAutoAdvance(activeGame, typedNamespace, resolvedDependencies, activeGames);
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
    .filter((roomSocket) => roomSocket.data.userId !== session.host_id)
    .map((roomSocket) => ({
      userId: roomSocket.data.userId ?? '',
      username: roomSocket.data.username,
      isHost: false,
    }));

  return {
    pin,
    hostUserId: session.host_id,
    status: session.status,
    minPlayersToStart: MIN_PLAYERS_TO_START,
    players,
    gameMode: (session.game_mode as GameMode) ?? 'forge-classic',
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
    gameMode: (session.game_mode as GameMode) ?? 'forge-classic',
  };
}

// ---------------------------------------------------------------------------
// Treasure Forge Continuous Mode Handlers
// ---------------------------------------------------------------------------

/**
 * Builds a public question payload for TF continuous mode.
 * Per-question timer fields are set to 0 (no timer in TF).
 */
function buildTfPublicQuestion(
  gameState: ActiveGameState,
  question: QUESTION,
  order: number
): PublicQuestionPayload {
  // Continuous TF has no per-round server start time, so seed off the
  // question id + the session's monotonic clock equivalent (order index).
  const seed = hashStringToInt(`${question.id}:tf:${order}`);
  const built = buildPublicOptions(question, seed);

  return {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    questionId: question.id,
    order,
    totalQuestions: 0,
    text: question.text,
    type: question.type,
    options: built.options,
    ...(built.rightOptions ? { rightOptions: built.rightOptions } : {}),
    points: question.points ?? DEFAULT_POINTS,
    timeLimitMs: 0,
    serverStartTimeMs: 0,
  };
}

/**
 * Builds a TF leaderboard sorted by gold descending.
 */
function buildTfLeaderboard(gameState: ActiveGameState): LeaderboardPlayer[] {
  const entries: LeaderboardPlayer[] = [];
  const sorted = [...gameState.scoresByUserId.entries()].sort(([, a], [, b]) => b - a);

  for (let i = 0; i < sorted.length; i++) {
    const [userId, score] = sorted[i]!;
    const player = gameState.playersByUserId.get(userId);
    entries.push({
      userId,
      username: player?.username ?? 'Unknown',
      score,
      rank: i + 1,
    });
  }

  return entries;
}

/**
 * Emits game-ended to the room and finalises the session.
 */
async function endTreasureForgeGame(
  typedNamespace: GameNamespace,
  resolvedDependencies: GameNamespaceDependencies,
  gameState: ActiveGameState,
  activeGames: Map<string, ActiveGameState>
): Promise<void> {
  if (gameState.status === 'ended') return;
  gameState.status = 'ended';

  // Clear the global timer
  if (gameState.gameEndTimer) {
    clearTimeout(gameState.gameEndTimer);
    gameState.gameEndTimer = null;
  }

  const leaderboard = buildTfLeaderboard(gameState);

  // Update session status in DB
  await resolvedDependencies.updateStatus(gameState.sessionId, 'ended');

  await logGameEvent(resolvedDependencies, gameState.sessionId, null, 'session-ended', {
    pin: gameState.pin,
  });

  typedNamespace.to(gameState.pin).emit('game-ended', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    leaderboard,
  });

  // Clean up after a delay
  setTimeout(() => {
    activeGames.delete(gameState.pin);
  }, 60_000);
}

/**
 * Starts a continuous Treasure Forge game.
 * Called from the start-game handler when gameMode is 'treasure-forge'.
 * Initialises per-player question states, starts the global timer
 * (timer mode), or sets the gold goal.
 */
async function handleTreasureForgeStartGame(
  typedNamespace: GameNamespace,
  socket: GameSocket,
  resolvedDependencies: GameNamespaceDependencies,
  gameState: ActiveGameState,
  activeGames: Map<string, ActiveGameState>,
  session: Session
): Promise<void> {
  const questionIds = gameState.questions.map((q) => q.id);
  const playerQuestionStates = new Map<string, PlayerQuestionState>();

  for (const [userId] of gameState.playersByUserId) {
    playerQuestionStates.set(userId, createPlayerQuestionState(questionIds));
  }

  gameState.playerQuestionStates = playerQuestionStates;
  gameState.gameStartTime = Date.now();
  gameState.gameEndTimer = null;
  gameState.tfEndMode = session.tf_end_mode;

  // Update DB started_at so the host page can calculate the global timer
  await resolvedDependencies.updateSessionStartTime(gameState.sessionId);

  await logGameEvent(resolvedDependencies, gameState.sessionId, null, 'session-started', {
    pin: gameState.pin,
    questionCount: gameState.questions.length,
    tfEndMode: session.tf_end_mode,
    tfTimerMinutes: session.tf_timer_minutes,
    tfGoldGoal: session.tf_gold_goal,
  });

  // Start global timer (timer mode) or record gold goal
  if (session.tf_end_mode === 'timer' && session.tf_timer_minutes && session.tf_timer_minutes > 0) {
    gameState.tfTimerMinutes = session.tf_timer_minutes;
    const durationMs = session.tf_timer_minutes * 60 * 1000;
    gameState.gameEndTimer = setTimeout(() => {
      endTreasureForgeGame(typedNamespace, resolvedDependencies, gameState, activeGames);
    }, durationMs);
  } else if (
    session.tf_end_mode === 'gold_goal' &&
    session.tf_gold_goal &&
    session.tf_gold_goal > 0
  ) {
    gameState.tfGoldGoal = session.tf_gold_goal;
  }

  // Emit game-started with TF config
  typedNamespace.to(gameState.pin).emit('game-started', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    startedByUserId: socket.data.userId,
    playerCount: gameState.playersByUserId.size,
    gameMode: 'treasure-forge',
    tfEndMode: session.tf_end_mode,
    tfTimerMinutes: session.tf_timer_minutes,
    tfGoldGoal: session.tf_gold_goal,
  });
}

/**
 * Handles a player's request for their next question in continuous TF mode.
 * Validates that the player is not in penalty and has no pending chest pick.
 */
function handleTreasureForgeNextQuestion(socket: GameSocket, gameState: ActiveGameState): void {
  const userId = socket.data.userId;
  if (!userId) {
    emitError(socket, 'AUTH_REQUIRED', 'Authentication required');
    return;
  }

  const pqs = gameState.playerQuestionStates?.get(userId);
  if (!pqs) {
    gameNamespaceLogger.warn(
      { userId, pin: gameState.pin, pqsSize: gameState.playerQuestionStates?.size },
      'TF nextQuestion: player not in playerQuestionStates'
    );
    emitError(socket, 'NOT_IN_GAME', 'You are not in this game');
    return;
  }

  if (pqs.hasPendingChest) {
    gameNamespaceLogger.warn({ userId, pin: gameState.pin }, 'TF nextQuestion: pending chest');
    emitError(socket, 'PENDING_CHEST', 'Pick a chest first');
    return;
  }

  const now = Date.now();
  if (isPlayerInPenalty(pqs, now)) {
    const remaining = Math.ceil((pqs.penaltyUntil! - now) / 1000);
    gameNamespaceLogger.warn(
      { userId, pin: gameState.pin, penaltyRemaining: remaining },
      'TF nextQuestion: player in penalty'
    );
    emitError(socket, 'PENALTY_ACTIVE', `Wait ${remaining}s`);
    return;
  }

  const qId = getNextPlayerQuestion(pqs);
  if (qId === null) {
    gameNamespaceLogger.warn(
      {
        userId,
        pin: gameState.pin,
        questionIndex: pqs.currentQuestionIndex,
        shuffledCount: pqs.shuffledQuestionIds.length,
      },
      'TF nextQuestion: no more questions'
    );
    emitError(socket, 'NO_QUESTIONS', 'No questions available');
    return;
  }

  const question = gameState.questions.find((q) => q.id === qId);
  if (!question) {
    gameNamespaceLogger.warn(
      { userId, pin: gameState.pin, qId },
      'TF nextQuestion: question not found in gameState'
    );
    emitError(socket, 'QUESTION_NOT_FOUND', 'Question not found');
    return;
  }

  gameNamespaceLogger.info(
    { userId, pin: gameState.pin, questionId: qId, order: question.order_index },
    'TF nextQuestion: emitting question'
  );

  socket.emit('question', buildTfPublicQuestion(gameState, question, pqs.currentQuestionIndex + 1));
}

/**
 * Handles a submitted answer in continuous TF mode.
 * Correct → generates chests. Incorrect → sets penalty.
 */
async function handleTreasureForgeSubmitAnswer(
  socket: GameSocket,
  typedNamespace: GameNamespace,
  resolvedDependencies: GameNamespaceDependencies,
  gameState: ActiveGameState,
  payload: SubmitAnswerMessage,
  _gameNamespaces: Map<string, ActiveGameState>
): Promise<void> {
  const userId = socket.data.userId;
  if (!userId) {
    emitError(socket, 'AUTH_REQUIRED', 'Authentication required');
    return;
  }

  if (gameState.status === 'ended') {
    emitError(socket, 'GAME_ENDED', 'The game has ended');
    return;
  }

  const pqs = gameState.playerQuestionStates?.get(userId);
  if (!pqs) {
    emitError(socket, 'NOT_IN_GAME', 'You are not in this game');
    return;
  }

  const now = Date.now();
  if (isPlayerInPenalty(pqs, now)) {
    emitError(socket, 'PENALTY_ACTIVE', 'Still in penalty cooldown');
    return;
  }

  const question = gameState.questions.find((q) => q.id === payload.questionId);
  if (!question) {
    emitError(socket, 'QUESTION_NOT_FOUND', 'Question not found');
    return;
  }

  const isCorrect = gradeAnswer(question, payload.selectedAnswer).correct;
  const player = gameState.playersByUserId.get(userId);
  const currentGold = player ? (gameState.scoresByUserId.get(userId) ?? 0) : 0;
  const username = player?.username ?? '';

  // Compute rank for chest generation
  const sorted = [...gameState.scoresByUserId.entries()].sort(([, a], [, b]) => b - a);
  const rank = sorted.findIndex(([id]) => id === userId) + 1;

  if (isCorrect) {
    // Generate chests (synchronous)
    const result = generateChests({
      currentGold,
      playerRank: rank,
      totalPlayers: gameState.playersByUserId.size,
    });
    const chests = result.chests;

    pqs.hasPendingChest = true;
    pqs.pendingChestOutcomes = chests;

    // Send chests to this player only
    socket.emit('chests-revealed', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      questionId: question.id,
      chests: chests.map((c: ChestOutcome) => ({ type: c.type, label: c.label })),
    });

    socket.emit('answer-ack', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      questionId: question.id,
      selectedAnswer: payload.selectedAnswer,
      correct: true,
      scoreDelta: 0,
      totalScore: currentGold,
    });

    typedNamespace.to(gameState.pin).emit('forge-activity', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      timestamp: Date.now(),
      type: 'round-correct',
      playerId: userId,
      playerUsername: username,
      message: `${username} answered correctly!`,
    });
  } else {
    // Wrong answer — set penalty
    pqs.penaltyUntil = Date.now() + WRONG_ANSWER_PENALTY_MS;
    advanceToNextQuestion(pqs);

    socket.emit('answer-ack', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      questionId: question.id,
      selectedAnswer: payload.selectedAnswer,
      correct: false,
      scoreDelta: 0,
      totalScore: currentGold,
    });

    typedNamespace.to(gameState.pin).emit('forge-activity', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      timestamp: Date.now(),
      type: 'round-incorrect',
      playerId: userId,
      playerUsername: username,
      message: `${username} answered incorrectly! (3s penalty)`,
    });
  }
}

/**
 * Processes a chest pick in continuous TF mode.
 */
async function handleTreasureForgeChestPick(
  socket: GameSocket,
  typedNamespace: GameNamespace,
  resolvedDependencies: GameNamespaceDependencies,
  gameState: ActiveGameState,
  payload: SelectChestMessage,
  activeGames: Map<string, ActiveGameState>
): Promise<void> {
  const userId = socket.data.userId;
  if (!userId) {
    emitError(socket, 'AUTH_REQUIRED', 'Authentication required');
    return;
  }

  if (gameState.status === 'ended') {
    emitError(socket, 'GAME_ENDED', 'The game has ended');
    return;
  }

  const pqs = gameState.playerQuestionStates?.get(userId);
  if (!pqs || !pqs.hasPendingChest || !pqs.pendingChestOutcomes) {
    emitError(socket, 'NO_PENDING_CHEST', 'No chest to pick');
    return;
  }

  if (payload.chestIndex < 0 || payload.chestIndex >= pqs.pendingChestOutcomes.length) {
    emitError(socket, 'INVALID_CHEST', 'Invalid chest index');
    return;
  }

  const selectedChest = pqs.pendingChestOutcomes[payload.chestIndex]!;
  const player = gameState.playersByUserId.get(userId);
  if (!player) {
    emitError(socket, 'PLAYER_NOT_FOUND', 'Player data not found');
    return;
  }
  const currentGold = gameState.scoresByUserId.get(userId) ?? 0;
  const username = player.username ?? '';

  // Clear pending chest
  pqs.hasPendingChest = false;
  pqs.pendingChestOutcomes = null;

  // Steal/Swap — needs target selection first
  if (selectedChest.type === 'steal' || selectedChest.type === 'swap') {
    pqs.pendingTfOutcome = {
      type: selectedChest.type,
      value: selectedChest.value,
      label: selectedChest.label,
    };

    socket.emit('target-needed', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      questionId: payload.questionId,
      outcomeType: selectedChest.type,
      stealPercent: selectedChest.type === 'steal' ? (selectedChest.value ?? 10) : undefined,
    });
    return;
  }

  // Immediate outcome — gold, multiplier, loss, nothing
  const outcome = applyGoldOutcome(currentGold, selectedChest.type, selectedChest.value);
  const newTotal = outcome.newTotal;
  const goldDelta = outcome.delta;

  gameState.scoresByUserId.set(userId, newTotal);
  await resolvedDependencies.updatePlayerScore(player!.id, newTotal);

  socket.emit('chest-effect', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    questionId: payload.questionId,
    outcomeType: selectedChest.type,
    outcomeValue: selectedChest.value,
    label: selectedChest.label,
    goldDelta,
    newTotal,
  });

  const leaderboard = buildTfLeaderboard(gameState);
  typedNamespace.to(gameState.pin).emit('gold-update', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    playerId: userId,
    username,
    goldDelta,
    newTotal,
    leaderboard,
  });

  typedNamespace.to(gameState.pin).emit('forge-activity', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    timestamp: Date.now(),
    type: 'chest-picked',
    playerId: userId,
    playerUsername: username,
    message: `${username} picked ${selectedChest.label}!`,
    goldDelta,
    newTotal,
  });

  // Advance to the next question after chest outcome is applied
  advanceToNextQuestion(pqs);

  // Check gold goal
  if (gameState.tfGoldGoal && newTotal >= gameState.tfGoldGoal) {
    await endTreasureForgeGame(typedNamespace, resolvedDependencies, gameState, activeGames);
  }
}

/**
 * Handles steal/swap target selection in continuous TF mode.
 */
async function handleTreasureForgeStealSwap(
  socket: GameSocket,
  typedNamespace: GameNamespace,
  resolvedDependencies: GameNamespaceDependencies,
  gameState: ActiveGameState,
  payload: SelectStealTargetMessage,
  activeGames: Map<string, ActiveGameState>
): Promise<void> {
  const userId = socket.data.userId;
  if (!userId) {
    emitError(socket, 'AUTH_REQUIRED', 'Authentication required');
    return;
  }

  if (gameState.status === 'ended') {
    emitError(socket, 'GAME_ENDED', 'The game has ended');
    return;
  }

  const pqs = gameState.playerQuestionStates?.get(userId);
  if (!pqs || !pqs.pendingTfOutcome) {
    emitError(socket, 'NO_PENDING_TARGET', 'No pending target selection');
    return;
  }

  const player = gameState.playersByUserId.get(userId);
  const targetPlayer = gameState.playersByUserId.get(payload.targetUserId);
  if (!player || !targetPlayer) {
    emitError(socket, 'PLAYER_NOT_FOUND', 'Player not found');
    return;
  }

  const playerGold = gameState.scoresByUserId.get(userId) ?? 0;
  const targetGold = gameState.scoresByUserId.get(payload.targetUserId) ?? 0;
  const username = player.username;
  const targetUsername = targetPlayer.username;

  const outcome = pqs.pendingTfOutcome;
  pqs.pendingTfOutcome = null;

  if (outcome.type === 'steal') {
    const result = stealGold({
      stealerGold: playerGold,
      targetGold,
      percent: outcome.value ?? 10,
    });

    gameState.scoresByUserId.set(userId, result.stealerNewTotal);
    gameState.scoresByUserId.set(payload.targetUserId, result.targetNewTotal);

    await resolvedDependencies.updatePlayerScore(player.id, result.stealerNewTotal);
    await resolvedDependencies.updatePlayerScore(targetPlayer.id, result.targetNewTotal);

    const leaderboard = buildTfLeaderboard(gameState);

    socket.emit('chest-effect', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      questionId: payload.questionId,
      outcomeType: 'steal',
      outcomeValue: outcome.value,
      label: outcome.label,
      goldDelta: result.stolenAmount,
      newTotal: result.stealerNewTotal,
      targetUsername,
    });

    typedNamespace.to(gameState.pin).emit('gold-update', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      playerId: userId,
      username,
      goldDelta: result.stolenAmount,
      newTotal: result.stealerNewTotal,
      leaderboard,
    });

    // Emit gold-update for the target so their counter updates too
    typedNamespace.to(gameState.pin).emit('gold-update', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      playerId: payload.targetUserId,
      username: targetUsername,
      goldDelta: -result.stolenAmount,
      newTotal: result.targetNewTotal,
      leaderboard,
    });

    typedNamespace.to(gameState.pin).emit('forge-activity', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      timestamp: Date.now(),
      type: 'steal',
      playerId: userId,
      playerUsername: username,
      message: `${username} stole ${result.stolenAmount} gold from ${targetUsername}!`,
      goldDelta: result.stolenAmount,
      targetUsername,
    });

    // Advance to the next question after steal outcome is applied
    advanceToNextQuestion(pqs);

    // Check gold goal
    if (gameState.tfGoldGoal && result.stealerNewTotal >= gameState.tfGoldGoal) {
      await endTreasureForgeGame(typedNamespace, resolvedDependencies, gameState, activeGames);
    }
  } else if (outcome.type === 'swap') {
    const result = swapGold(playerGold, targetGold);

    gameState.scoresByUserId.set(userId, result.playerANewTotal);
    gameState.scoresByUserId.set(payload.targetUserId, result.playerBNewTotal);

    await resolvedDependencies.updatePlayerScore(player.id, result.playerANewTotal);
    await resolvedDependencies.updatePlayerScore(targetPlayer.id, result.playerBNewTotal);

    const leaderboard = buildTfLeaderboard(gameState);

    socket.emit('chest-effect', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      questionId: payload.questionId,
      outcomeType: 'swap',
      outcomeValue: null,
      label: outcome.label,
      goldDelta: result.playerANewTotal - playerGold,
      newTotal: result.playerANewTotal,
      targetUsername,
    });

    typedNamespace.to(gameState.pin).emit('gold-update', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      playerId: userId,
      username,
      goldDelta: result.playerANewTotal - playerGold,
      newTotal: result.playerANewTotal,
      leaderboard,
    });

    // Emit gold-update for the target so their counter updates too
    typedNamespace.to(gameState.pin).emit('gold-update', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      playerId: payload.targetUserId,
      username: targetUsername,
      goldDelta: result.playerBNewTotal - targetGold,
      newTotal: result.playerBNewTotal,
      leaderboard,
    });

    typedNamespace.to(gameState.pin).emit('forge-activity', {
      pin: gameState.pin,
      sessionId: gameState.sessionId,
      timestamp: Date.now(),
      type: 'swap',
      playerId: userId,
      playerUsername: username,
      message: `${username} swapped gold with ${targetUsername}!`,
      targetUsername,
    });

    // Advance to the next question after swap outcome is applied
    advanceToNextQuestion(pqs);
  }
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
    treasureForge: gameState.gameMode === 'treasure-forge' ? createTreasureForgeRoundState() : null,
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
    treasureForge: gameState.gameMode === 'treasure-forge' ? createTreasureForgeRoundState() : null,
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
    // For Treasure Forge: also wait for chest picks and target selections
    if (gameState.gameMode === 'treasure-forge' && gameState.round.treasureForge) {
      if (!shouldAdvanceTreasureForgeRound(gameState.round.treasureForge)) {
        return; // Still waiting for chest picks or target selections
      }
    }

    // All players answered (and picked chests for Treasure Forge) — clear timer and advance
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
    gameMode: gameState.gameMode,
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

  socket.emit('game-started', {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    gameMode: gameState.gameMode,
    tfEndMode: gameState.tfEndMode,
    tfTimerMinutes: gameState.tfTimerMinutes,
    tfGoldGoal: gameState.tfGoldGoal,
  });

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
  // Deterministic per-round seed so reconnects see the same Ordering/Matching order.
  const seed = hashStringToInt(`${question.id}:${serverStartTimeMs}`);
  const built = buildPublicOptions(question, seed);

  return {
    pin: gameState.pin,
    sessionId: gameState.sessionId,
    questionId: question.id,
    order: index + 1,
    totalQuestions: gameState.questions.length,
    text: question.text,
    type: question.type,
    options: built.options,
    ...(built.rightOptions ? { rightOptions: built.rightOptions } : {}),
    points: question.points ?? DEFAULT_POINTS,
    timeLimitMs,
    serverStartTimeMs,
  };
}

// ---------------------------------------------------------------------------
// Public option builders
// ---------------------------------------------------------------------------
interface BuiltPublicOptions {
  options: QuestionOption[];
  rightOptions?: QuestionOption[];
}

/**
 * Builds the player-facing options payload for a question of any supported
 * type. Strips answer keys (FIB), `matchId` pointers (matching) and applies
 * a deterministic server-side shuffle for Ordering and the right side of
 * Matching so reconnects see a consistent order.
 */
function buildPublicOptions(question: QUESTION, seed: number): BuiltPublicOptions {
  switch (question.type) {
    case 'multiple-choice':
    case 'true-false':
    case 'open': {
      return { options: parseTextOptions(question.options) };
    }
    case 'ordering': {
      const items = parseTextOptions(question.options);
      return { options: deterministicShuffle(items, seed) };
    }
    case 'matching': {
      const { left, right } = readMatchingOptions(question.options);
      return {
        options: left.map((item) => ({ id: item.id, text: item.text })),
        rightOptions: deterministicShuffle(
          right.map((item) => ({ id: item.id, text: item.text })),
          seed
        ),
      };
    }
    case 'fill-in-blank': {
      const accepted = readFIBOptions(question.options);
      return {
        options: accepted.map((item) => ({ id: item.id, text: '___' })),
      };
    }
    default: {
      // Unknown / future type — return an empty options list to be safe.
      return { options: [] };
    }
  }
}

function parseTextOptions(value: unknown): QuestionOption[] {
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

interface MatchingLeftEntry {
  id: string;
  text: string;
  matchId: string;
}

interface MatchingRightEntry {
  id: string;
  text: string;
}

function readMatchingOptions(value: unknown): {
  left: MatchingLeftEntry[];
  right: MatchingRightEntry[];
} {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { left: [], right: [] };
  }

  const candidate = value as { left?: unknown; right?: unknown };
  return {
    left: parseMatchingLeftArray(candidate.left),
    right: parseTextOptions(candidate.right),
  };
}

function parseMatchingLeftArray(value: unknown): MatchingLeftEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((option) => {
    if (typeof option !== 'object' || option === null) {
      return [];
    }
    const candidate = option as { id?: unknown; text?: unknown; matchId?: unknown };
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.text !== 'string' ||
      typeof candidate.matchId !== 'string'
    ) {
      return [];
    }
    return [{ id: candidate.id, text: candidate.text, matchId: candidate.matchId }];
  });
}

interface FibEntry {
  id: string;
  answer: string;
  caseSensitive?: boolean;
}

function readFIBOptions(value: unknown): FibEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((option) => {
    if (typeof option !== 'object' || option === null) {
      return [];
    }
    const candidate = option as { id?: unknown; answer?: unknown; caseSensitive?: unknown };
    if (typeof candidate.id !== 'string' || typeof candidate.answer !== 'string') {
      return [];
    }
    const entry: FibEntry = { id: candidate.id, answer: candidate.answer };
    if (typeof candidate.caseSensitive === 'boolean') {
      entry.caseSensitive = candidate.caseSensitive;
    }
    return [entry];
  });
}

// ---------------------------------------------------------------------------
// Deterministic shuffle (FNV-1a hash + mulberry32 PRNG + Fisher-Yates)
// ---------------------------------------------------------------------------
function hashStringToInt(value: string): number {
  let hash = 2166136261; // FNV-1a 32-bit offset basis
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  return hash | 0;
}

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const result = items.slice();
  if (result.length < 2) {
    return result;
  }
  // mulberry32 PRNG — fast, small state, good distribution for shuffling.
  let state = seed | 0 || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(rand * (index + 1));
    const a = result[index];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[index] = b;
      result[j] = a;
    }
  }
  return result;
}

async function ensureGamePlayer(
  dependencies: GameNamespaceDependencies,
  gameState: ActiveGameState,
  userId: string,
  username?: string,
  isGuest?: boolean
): Promise<SessionPlayer> {
  const existingPlayer = gameState.playersByUserId.get(userId);
  if (existingPlayer) {
    return existingPlayer;
  }

  // Guests have a non-UUID `userId` and no `session_player` row — the
  // upsert would crash Postgres. Synthesise an in-memory placeholder so
  // downstream emitters (answer-ack, leaderboard, etc.) can read a
  // username and the score stays in `scoresByUserId` only.
  if (isGuest) {
    const placeholder: SessionPlayer = {
      id: 0,
      session_id: gameState.sessionId,
      user_id: userId,
      username: username ?? formatUsername(userId),
      score: 0,
      status: 'active',
    };
    gameState.playersByUserId.set(userId, placeholder);
    if (!gameState.scoresByUserId.has(userId)) {
      gameState.scoresByUserId.set(userId, 0);
    }
    return placeholder;
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
