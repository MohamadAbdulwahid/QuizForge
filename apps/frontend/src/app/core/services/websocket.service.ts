import { Injectable, signal } from '@angular/core';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

export interface PlayerJoinedEvent {
  userId?: string;
  username?: string;
  isHost?: boolean;
}

export interface PlayerLeftEvent {
  userId?: string;
  reason?: string;
}

export interface SocketErrorPayload {
  code: string;
  error: string;
  details?: unknown;
}

export interface LobbyStateEvent {
  pin: string;
  hostUserId: string;
  status: string;
  minPlayersToStart: number;
  players: Array<{
    userId: string;
    username?: string;
    isHost?: boolean;
  }>;
  gameMode?: string;
}

export interface GameStartedEvent {
  pin: string;
  sessionId: number;
  startedByUserId?: string;
  playerCount?: number;
  gameMode?: string;
}

export interface RoundStartedEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  order: number;
  totalQuestions: number;
  serverStartTimeMs: number;
  timeLimitMs: number;
}

export interface GameQuestionEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  order: number;
  totalQuestions: number;
  text: string;
  /** Permissive `string` so server-side question type additions don't break the client. */
  type: string;
  /** Left-column items for matching; sole options column for every other type. */
  options: Array<{ id: string; text: string }>;
  /** Right-column items for matching (shuffled server-side). Undefined for non-matching. */
  rightOptions?: Array<{ id: string; text: string }>;
  points: number;
  timeLimitMs: number;
  serverStartTimeMs: number;
}

export interface AnswerAckEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  selectedAnswer: string;
  correct: boolean;
  scoreDelta: number;
  totalScore: number;
}

export interface LeaderboardPlayerEvent {
  userId: string;
  username: string;
  score: number;
  rank: number;
}

export interface ScoreUpdateEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  playerId: string;
  username: string;
  scoreDelta: number;
  totalScore: number;
  correct: boolean;
  rank: number;
  leaderboard: LeaderboardPlayerEvent[];
}

export interface LeaderboardUpdateEvent {
  pin: string;
  sessionId: number;
  leaderboard: LeaderboardPlayerEvent[];
}

export interface RoundClosedEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  order: number;
}

export interface GameEndedEvent {
  pin: string;
  sessionId: number;
  leaderboard: LeaderboardPlayerEvent[];
}

export interface SessionClosedEvent {
  pin: string;
  sessionId: number;
  reason: string;
}

export interface ChestsRevealedEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  chests: Array<{ type: string; label: string }>;
}

export interface ChestEffectEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  outcomeType: string;
  outcomeValue: number | null;
  label: string;
  goldDelta: number;
  newTotal: number;
  targetUsername?: string;
}

export interface GoldUpdateEvent {
  pin: string;
  sessionId: number;
  playerId: string;
  username: string;
  goldDelta: number;
  newTotal: number;
  leaderboard: LeaderboardPlayerEvent[];
}

export interface TargetNeededEvent {
  pin: string;
  sessionId: number;
  questionId: number;
  outcomeType: 'steal' | 'swap';
  stealPercent?: number;
}

export interface ForgeActivityEvent {
  pin: string;
  sessionId: number;
  timestamp: number;
  type: 'chest-picked' | 'steal' | 'swap' | 'round-correct' | 'round-incorrect';
  playerId: string;
  playerUsername: string;
  message: string;
  goldDelta?: number;
  newTotal?: number;
  targetUsername?: string;
}

type ServerToClientEvents = {
  'player-joined': (payload: PlayerJoinedEvent) => void;
  'player-left': (payload: PlayerLeftEvent) => void;
  'lobby-state': (payload: LobbyStateEvent) => void;
  'game-started': (payload: GameStartedEvent) => void;
  'round-started': (payload: RoundStartedEvent) => void;
  question: (payload: GameQuestionEvent) => void;
  'answer-ack': (payload: AnswerAckEvent) => void;
  'answer-rejected': (payload: SocketErrorPayload) => void;
  'score-update': (payload: ScoreUpdateEvent) => void;
  'leaderboard-update': (payload: LeaderboardUpdateEvent) => void;
  'round-closed': (payload: RoundClosedEvent) => void;
  'game-ended': (payload: GameEndedEvent) => void;
  'session-closed': (payload: SessionClosedEvent) => void;
  error: (payload: SocketErrorPayload) => void;
  'chests-revealed': (payload: ChestsRevealedEvent) => void;
  'chest-effect': (payload: ChestEffectEvent) => void;
  'gold-update': (payload: GoldUpdateEvent) => void;
  'target-needed': (payload: TargetNeededEvent) => void;
  'forge-activity': (payload: ForgeActivityEvent) => void;
};

type ClientToServerEvents = {
  'join-game': (payload: { pin: string; username?: string }) => void;
  'leave-game': (payload: { pin: string; reason?: string }) => void;
  'end-session': (payload: { pin: string }) => void;
  'start-game': (payload: { pin: string }) => void;
  'submit-answer': (payload: {
    pin: string;
    sessionId: number;
    questionId: number;
    selectedAnswer: string;
  }) => void;
  'next-question': (payload: { pin: string }) => void;
  'request-question': (payload: { pin: string }) => void;
  'skip-question': (payload: { pin: string }) => void;
  'select-chest': (payload: {
    pin: string;
    sessionId: number;
    questionId: number;
    chestIndex: number;
  }) => void;
  'select-steal-target': (payload: {
    pin: string;
    sessionId: number;
    questionId: number;
    targetUserId: string;
  }) => void;
};

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const RECONNECT_MAX_ATTEMPTS = 20;

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private token: string | null = null;
  private lastJoinPin = '';
  private lastJoinUsername = '';
  private intentionalDisconnect = false;

  private readonly playerJoinedSubject = new Subject<PlayerJoinedEvent>();
  private readonly playerLeftSubject = new Subject<PlayerLeftEvent>();
  private readonly lobbyStateSubject = new Subject<LobbyStateEvent>();
  private readonly gameStartedSubject = new ReplaySubject<GameStartedEvent>(1);
  private readonly roundStartedSubject = new ReplaySubject<RoundStartedEvent>(1);
  private readonly questionSubject = new ReplaySubject<GameQuestionEvent>(1);
  private readonly answerAckSubject = new Subject<AnswerAckEvent>();
  private readonly answerRejectedSubject = new Subject<SocketErrorPayload>();
  private readonly scoreUpdateSubject = new Subject<ScoreUpdateEvent>();
  private readonly leaderboardUpdateSubject = new Subject<LeaderboardUpdateEvent>();
  private readonly roundClosedSubject = new Subject<RoundClosedEvent>();
  private readonly gameEndedSubject = new Subject<GameEndedEvent>();
  private readonly sessionClosedSubject = new Subject<SessionClosedEvent>();
  private readonly socketErrorSubject = new Subject<SocketErrorPayload>();
  private readonly chestsRevealedSubject = new Subject<ChestsRevealedEvent>();
  private readonly chestEffectSubject = new Subject<ChestEffectEvent>();
  private readonly goldUpdateSubject = new Subject<GoldUpdateEvent>();
  private readonly targetNeededSubject = new Subject<TargetNeededEvent>();
  private readonly forgeActivitySubject = new Subject<ForgeActivityEvent>();

  readonly playerJoined$: Observable<PlayerJoinedEvent> = this.playerJoinedSubject.asObservable();
  readonly playerLeft$: Observable<PlayerLeftEvent> = this.playerLeftSubject.asObservable();
  readonly lobbyState$: Observable<LobbyStateEvent> = this.lobbyStateSubject.asObservable();
  readonly gameStarted$: Observable<GameStartedEvent> = this.gameStartedSubject.asObservable();
  readonly roundStarted$: Observable<RoundStartedEvent> = this.roundStartedSubject.asObservable();
  readonly question$: Observable<GameQuestionEvent> = this.questionSubject.asObservable();
  readonly answerAck$: Observable<AnswerAckEvent> = this.answerAckSubject.asObservable();
  readonly answerRejected$: Observable<SocketErrorPayload> =
    this.answerRejectedSubject.asObservable();
  readonly scoreUpdate$: Observable<ScoreUpdateEvent> = this.scoreUpdateSubject.asObservable();
  readonly leaderboardUpdate$: Observable<LeaderboardUpdateEvent> =
    this.leaderboardUpdateSubject.asObservable();
  readonly roundClosed$: Observable<RoundClosedEvent> = this.roundClosedSubject.asObservable();
  readonly gameEnded$: Observable<GameEndedEvent> = this.gameEndedSubject.asObservable();
  readonly sessionClosed$: Observable<SessionClosedEvent> =
    this.sessionClosedSubject.asObservable();
  readonly socketError$: Observable<SocketErrorPayload> = this.socketErrorSubject.asObservable();
  readonly chestsRevealed$: Observable<ChestsRevealedEvent> =
    this.chestsRevealedSubject.asObservable();
  readonly chestEffect$: Observable<ChestEffectEvent> = this.chestEffectSubject.asObservable();
  readonly goldUpdate$: Observable<GoldUpdateEvent> = this.goldUpdateSubject.asObservable();
  readonly targetNeeded$: Observable<TargetNeededEvent> = this.targetNeededSubject.asObservable();
  readonly forgeActivity$: Observable<ForgeActivityEvent> =
    this.forgeActivitySubject.asObservable();

  readonly connected = signal(false);
  readonly reconnecting = signal(false);

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.token = token;
    this.intentionalDisconnect = false;
    this.disposeSocket();

    this.socket = io(`${environment.websocketUrl}/game`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: RECONNECT_BASE_DELAY,
      reconnectionDelayMax: RECONNECT_MAX_DELAY,
      reconnectionAttempts: RECONNECT_MAX_ATTEMPTS,
    }) as Socket<ServerToClientEvents, ClientToServerEvents>;

    this.setupSocketListeners(this.socket);
  }

  /**
   * Connects as an unauthenticated guest with a display name. The handshake
   * carries `auth.guest = true` and `auth.username` instead of a JWT. The
   * server mints an ephemeral `guest:<uuid>` userId; no DB row is written.
   * @param username - Display name shown in the lobby and leaderboard.
   */
  connectAsGuest(username: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.token = null;
    this.intentionalDisconnect = false;
    this.disposeSocket();

    this.socket = io(`${environment.websocketUrl}/game`, {
      auth: { guest: true, username },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: RECONNECT_BASE_DELAY,
      reconnectionDelayMax: RECONNECT_MAX_DELAY,
      reconnectionAttempts: RECONNECT_MAX_ATTEMPTS,
    }) as Socket<ServerToClientEvents, ClientToServerEvents>;

    this.setupSocketListeners(this.socket);
  }

  /**
   * Wires all server-event listeners onto the given socket. Shared by
   * `connect` (authenticated) and `connectAsGuest` (guest) — the event
   * surface is identical for both, the only difference is the handshake
   * `auth` payload.
   * @param socket - The freshly created socket to bind listeners to.
   */
  private setupSocketListeners(socket: Socket<ServerToClientEvents, ClientToServerEvents>): void {
    socket.on('connect', () => {
      this.connected.set(true);
      this.reconnecting.set(false);

      if (this.lastJoinPin) {
        this.socket?.emit('join-game', {
          pin: this.lastJoinPin,
          username: this.lastJoinUsername || undefined,
        });
      }
    });

    socket.on('disconnect', (reason) => {
      this.connected.set(false);
      if (!this.intentionalDisconnect && reason !== 'io client disconnect') {
        this.reconnecting.set(true);
      }
    });

    socket.io.on('reconnect_failed', () => {
      this.reconnecting.set(false);
    });

    socket.on('player-joined', (payload) => {
      this.playerJoinedSubject.next(payload);
    });

    socket.on('player-left', (payload) => {
      this.playerLeftSubject.next(payload);
    });

    socket.on('lobby-state', (payload) => {
      this.lobbyStateSubject.next(payload);
    });

    socket.on('game-started', (payload) => {
      this.gameStartedSubject.next(payload);
    });

    socket.on('round-started', (payload) => {
      this.roundStartedSubject.next(payload);
    });

    socket.on('question', (payload) => {
      this.questionSubject.next(payload);
    });

    socket.on('answer-ack', (payload) => {
      this.answerAckSubject.next(payload);
    });

    socket.on('answer-rejected', (payload) => {
      this.answerRejectedSubject.next(payload);
    });

    socket.on('score-update', (payload) => {
      this.scoreUpdateSubject.next(payload);
    });

    socket.on('leaderboard-update', (payload) => {
      this.leaderboardUpdateSubject.next(payload);
    });

    socket.on('round-closed', (payload) => {
      this.roundClosedSubject.next(payload);
    });

    socket.on('game-ended', (payload) => {
      this.gameEndedSubject.next(payload);
    });

    socket.on('session-closed', (payload) => {
      this.sessionClosedSubject.next(payload);
    });

    socket.on('error', (payload) => {
      this.socketErrorSubject.next(payload);
    });

    socket.on('chests-revealed', (payload) => {
      this.chestsRevealedSubject.next(payload);
    });

    socket.on('chest-effect', (payload) => {
      this.chestEffectSubject.next(payload);
    });

    socket.on('gold-update', (payload) => {
      this.goldUpdateSubject.next(payload);
    });

    socket.on('target-needed', (payload) => {
      this.targetNeededSubject.next(payload);
    });

    socket.on('forge-activity', (payload) => {
      this.forgeActivitySubject.next(payload);
    });
  }

  joinGame(pin: string, username?: string): void {
    this.lastJoinPin = pin;
    this.lastJoinUsername = username ?? '';
    this.socket?.emit('join-game', { pin, username });
  }

  leaveGame(pin: string, reason?: string): void {
    this.lastJoinPin = '';
    this.lastJoinUsername = '';
    this.socket?.emit('leave-game', { pin, reason });
  }

  startGame(pin: string): void {
    this.socket?.emit('start-game', { pin });
  }

  endSession(pin: string): void {
    this.socket?.emit('end-session', { pin });
  }

  submitAnswer(pin: string, sessionId: number, questionId: number, selectedAnswer: string): void {
    this.socket?.emit('submit-answer', { pin, sessionId, questionId, selectedAnswer });
  }

  skipQuestion(pin: string): void {
    this.socket?.emit('skip-question', { pin });
  }

  nextQuestion(pin: string): void {
    this.socket?.emit('next-question', { pin });
  }

  /** Requests the next question in continuous Treasure Forge mode. */
  requestNextQuestion(pin: string): void {
    this.socket?.emit('request-question', { pin });
  }

  selectChest(pin: string, sessionId: number, questionId: number, chestIndex: number): void {
    this.socket?.emit('select-chest', { pin, sessionId, questionId, chestIndex });
  }

  selectStealTarget(
    pin: string,
    sessionId: number,
    questionId: number,
    targetUserId: string
  ): void {
    this.socket?.emit('select-steal-target', { pin, sessionId, questionId, targetUserId });
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.lastJoinPin = '';
    this.lastJoinUsername = '';
    this.disposeSocket();
    this.connected.set(false);
    this.reconnecting.set(false);
  }

  private disposeSocket(): void {
    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }
}
