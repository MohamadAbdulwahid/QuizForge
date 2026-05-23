import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
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
}

export interface GameStartedEvent {
  pin: string;
  sessionId: number;
  startedByUserId?: string;
  playerCount?: number;
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
  type: string;
  options: Array<{ id: string; text: string }>;
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
  error: (payload: SocketErrorPayload) => void;
};

type ClientToServerEvents = {
  'join-game': (payload: { pin: string; username?: string }) => void;
  'leave-game': (payload: { pin: string; reason?: string }) => void;
  'start-game': (payload: { pin: string }) => void;
  'submit-answer': (payload: {
    pin: string;
    sessionId: number;
    questionId: number;
    selectedAnswer: string;
  }) => void;
  'next-question': (payload: { pin: string }) => void;
};

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  private readonly playerJoinedSubject = new Subject<PlayerJoinedEvent>();
  private readonly playerLeftSubject = new Subject<PlayerLeftEvent>();
  private readonly lobbyStateSubject = new Subject<LobbyStateEvent>();
  private readonly gameStartedSubject = new Subject<GameStartedEvent>();
  private readonly roundStartedSubject = new Subject<RoundStartedEvent>();
  private readonly questionSubject = new Subject<GameQuestionEvent>();
  private readonly answerAckSubject = new Subject<AnswerAckEvent>();
  private readonly answerRejectedSubject = new Subject<SocketErrorPayload>();
  private readonly scoreUpdateSubject = new Subject<ScoreUpdateEvent>();
  private readonly leaderboardUpdateSubject = new Subject<LeaderboardUpdateEvent>();
  private readonly roundClosedSubject = new Subject<RoundClosedEvent>();
  private readonly gameEndedSubject = new Subject<GameEndedEvent>();
  private readonly socketErrorSubject = new Subject<SocketErrorPayload>();

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
  readonly socketError$: Observable<SocketErrorPayload> = this.socketErrorSubject.asObservable();

  readonly connected = signal(false);

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.disposeSocket();

    this.socket = io(`${environment.websocketUrl}/game`, {
      auth: {
        token,
      },
      transports: ['websocket'],
    }) as Socket<ServerToClientEvents, ClientToServerEvents>;

    this.socket.on('connect', () => {
      this.connected.set(true);
    });

    this.socket.on('disconnect', () => {
      this.connected.set(false);
    });

    this.socket.on('player-joined', (payload) => {
      this.playerJoinedSubject.next(payload);
    });

    this.socket.on('player-left', (payload) => {
      this.playerLeftSubject.next(payload);
    });

    this.socket.on('lobby-state', (payload) => {
      this.lobbyStateSubject.next(payload);
    });

    this.socket.on('game-started', (payload) => {
      this.gameStartedSubject.next(payload);
    });

    this.socket.on('round-started', (payload) => {
      this.roundStartedSubject.next(payload);
    });

    this.socket.on('question', (payload) => {
      this.questionSubject.next(payload);
    });

    this.socket.on('answer-ack', (payload) => {
      this.answerAckSubject.next(payload);
    });

    this.socket.on('answer-rejected', (payload) => {
      this.answerRejectedSubject.next(payload);
    });

    this.socket.on('score-update', (payload) => {
      this.scoreUpdateSubject.next(payload);
    });

    this.socket.on('leaderboard-update', (payload) => {
      this.leaderboardUpdateSubject.next(payload);
    });

    this.socket.on('round-closed', (payload) => {
      this.roundClosedSubject.next(payload);
    });

    this.socket.on('game-ended', (payload) => {
      this.gameEndedSubject.next(payload);
    });

    this.socket.on('error', (payload) => {
      this.socketErrorSubject.next(payload);
    });
  }

  joinGame(pin: string, username?: string): void {
    this.socket?.emit('join-game', { pin, username });
  }

  leaveGame(pin: string, reason?: string): void {
    this.socket?.emit('leave-game', { pin, reason });
  }

  startGame(pin: string): void {
    this.socket?.emit('start-game', { pin });
  }

  submitAnswer(pin: string, sessionId: number, questionId: number, selectedAnswer: string): void {
    this.socket?.emit('submit-answer', { pin, sessionId, questionId, selectedAnswer });
  }

  nextQuestion(pin: string): void {
    this.socket?.emit('next-question', { pin });
  }

  disconnect(): void {
    this.disposeSocket();
    this.connected.set(false);
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
