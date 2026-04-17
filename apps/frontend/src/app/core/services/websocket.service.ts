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
  startedByUserId?: string;
  playerCount?: number;
}

type ServerToClientEvents = {
  'player-joined': (payload: PlayerJoinedEvent) => void;
  'player-left': (payload: PlayerLeftEvent) => void;
  'lobby-state': (payload: LobbyStateEvent) => void;
  'game-started': (payload: GameStartedEvent) => void;
  error: (payload: SocketErrorPayload) => void;
};

type ClientToServerEvents = {
  'join-game': (payload: { pin: string; username?: string }) => void;
  'leave-game': (payload: { pin: string; reason?: string }) => void;
  'start-game': (payload: { pin: string }) => void;
};

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  private readonly playerJoinedSubject = new Subject<PlayerJoinedEvent>();
  private readonly playerLeftSubject = new Subject<PlayerLeftEvent>();
  private readonly lobbyStateSubject = new Subject<LobbyStateEvent>();
  private readonly gameStartedSubject = new Subject<GameStartedEvent>();
  private readonly socketErrorSubject = new Subject<SocketErrorPayload>();

  readonly playerJoined$: Observable<PlayerJoinedEvent> = this.playerJoinedSubject.asObservable();
  readonly playerLeft$: Observable<PlayerLeftEvent> = this.playerLeftSubject.asObservable();
  readonly lobbyState$: Observable<LobbyStateEvent> = this.lobbyStateSubject.asObservable();
  readonly gameStarted$: Observable<GameStartedEvent> = this.gameStartedSubject.asObservable();
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
