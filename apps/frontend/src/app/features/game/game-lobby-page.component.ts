import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SessionApiService, SessionStatus } from '../../core/services/session-api.service';
import { SocketErrorPayload, WebsocketService } from '../../core/services/websocket.service';

interface LobbyPlayer {
  userId: string;
  name: string;
  emoji: string;
  isSelf: boolean;
  isHost: boolean;
}

@Component({
  selector: 'app-game-lobby-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './game-lobby-page.component.html',
  styleUrl: './game-lobby-page.component.css',
})
export class GameLobbyPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly sessionApiService = inject(SessionApiService);
  private readonly websocketService = inject(WebsocketService);

  protected readonly pin = signal('');
  protected readonly statusMessage = signal('Connecting to lobby...');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly players = signal<LobbyPlayer[]>([]);
  protected readonly playerCount = computed(() => this.players().length);
  protected readonly hostUserId = signal<string | null>(null);
  protected readonly sessionStatus = signal<SessionStatus>('waiting');
  protected readonly minPlayersToStart = signal(2);
  protected readonly startRequested = signal(false);
  protected readonly connected = this.websocketService.connected;
  protected readonly isHost = computed(() => this.authService.user()?.id === this.hostUserId());
  protected readonly canStartGame = computed(
    () =>
      this.isHost() &&
      this.connected() &&
      this.sessionStatus() === 'waiting' &&
      this.playerCount() >= this.minPlayersToStart() &&
      !this.startRequested()
  );

  private readonly emojiPool = ['🦊', '🚀', '🦄', '🍕', '👻', '👾', '🐯', '⚡', '🎮', '🌵', '🐙', '🤖'];
  private hasJoined = false;

  ngOnInit(): void {
    const pin = this.route.snapshot.paramMap.get('pin') ?? '';
    this.pin.set(pin);

    if (!/^\d{6}$/.test(pin)) {
      this.errorMessage.set('Invalid PIN format. Expected a 6-digit code.');
      return;
    }

    const token = this.authService.accessToken();
    const currentUser = this.authService.user();

    if (!token || !currentUser) {
      void this.router.navigateByUrl('/auth');
      return;
    }

    this.bindSocketEvents();

    this.sessionApiService
      .getSessionByPin(pin)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          this.hostUserId.set(session.host_id);
          this.sessionStatus.set(this.normalizeStatus(session.status));
          this.statusMessage.set(this.buildStatusMessage(this.normalizeStatus(session.status)));

          this.websocketService.connect(token);
          this.upsertPlayer(
            currentUser.id,
            this.buildDisplayName(currentUser.username, currentUser.email),
            true,
            currentUser.id === session.host_id
          );
          this.websocketService.joinGame(pin, this.buildDisplayName(currentUser.username, currentUser.email));
          this.hasJoined = true;
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveApiError(error));
        },
      });
  }

  ngOnDestroy(): void {
    this.leaveLobbyInternal('component-destroy');
  }

  protected leaveLobby(): void {
    this.leaveLobbyInternal('user-left');
    void this.router.navigateByUrl('/dashboard');
  }

  private bindSocketEvents(): void {
    this.websocketService.playerJoined$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (!event.userId) {
          return;
        }

        const ownUserId = this.authService.user()?.id;
        const isSelf = event.userId === ownUserId;

        this.upsertPlayer(
          event.userId,
          event.username ?? this.formatRemoteName(event.userId),
          isSelf,
          event.isHost ?? event.userId === this.hostUserId()
        );
      });

    this.websocketService.playerLeft$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (!event.userId) {
          return;
        }

        this.players.update((existingPlayers) =>
          existingPlayers.filter((player) => player.userId !== event.userId)
        );
      });

    this.websocketService.socketError$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.startRequested.set(false);
        this.errorMessage.set(this.resolveSocketError(event));
      });

    this.websocketService.lobbyState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.hostUserId.set(event.hostUserId);
        this.minPlayersToStart.set(event.minPlayersToStart || 2);

        const normalizedStatus = this.normalizeStatus(event.status);
        this.sessionStatus.set(normalizedStatus);
        this.statusMessage.set(this.buildStatusMessage(normalizedStatus));

        const ownUserId = this.authService.user()?.id;

        this.players.set(
          event.players.map((player) => ({
            userId: player.userId,
            name: player.username ?? this.formatRemoteName(player.userId),
            isSelf: player.userId === ownUserId,
            isHost: player.isHost ?? player.userId === event.hostUserId,
            emoji: this.selectEmoji(player.userId),
          }))
        );
      });

    this.websocketService.gameStarted$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.startRequested.set(false);
        this.sessionStatus.set('playing');
        this.statusMessage.set('Game started. Waiting for the first question...');
      });
  }

  protected startGame(): void {
    this.errorMessage.set(null);

    if (!this.isHost()) {
      this.errorMessage.set('Only the host can start the game.');
      return;
    }

    if (this.playerCount() < this.minPlayersToStart()) {
      this.errorMessage.set(
        `Need at least ${this.minPlayersToStart()} players to start. Current: ${this.playerCount()}.`
      );
      return;
    }

    this.startRequested.set(true);
    this.websocketService.startGame(this.pin());
  }

  private upsertPlayer(userId: string, name: string, isSelf: boolean, isHost: boolean): void {
    this.players.update((existingPlayers) => {
      const existing = existingPlayers.find((player) => player.userId === userId);
      if (existing) {
        return existingPlayers.map((player) =>
          player.userId === userId
            ? {
                ...player,
                name,
                isSelf: player.isSelf || isSelf,
                isHost: player.isHost || isHost,
              }
            : player
        );
      }

      return [
        ...existingPlayers,
        {
          userId,
          name,
          isSelf,
          isHost,
          emoji: this.selectEmoji(userId),
        },
      ];
    });
  }

  private selectEmoji(userId: string): string {
    const hash = Array.from(userId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return this.emojiPool[hash % this.emojiPool.length];
  }

  private buildDisplayName(username: string, email: string): string {
    if (username.trim().length > 0) {
      return username;
    }

    return email.split('@')[0] ?? 'Player';
  }

  private formatRemoteName(userId: string): string {
    const compactId = userId.replace(/-/g, '').slice(0, 6).toUpperCase();
    return `Player-${compactId}`;
  }

  private resolveApiError(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const transportError = error as {
        error?: {
          error?: string;
        };
      };

      if (transportError.error?.error) {
        return transportError.error.error;
      }
    }

    return 'Could not load this session. Confirm backend server and session PIN.';
  }

  private resolveSocketError(error: SocketErrorPayload): string {
    if (error.code === 'NOT_ENOUGH_PLAYERS') {
      const details =
        typeof error.details === 'object' && error.details !== null
          ? (error.details as { currentPlayers?: number; minPlayersToStart?: number })
          : undefined;

      if (details?.currentPlayers !== undefined && details?.minPlayersToStart !== undefined) {
        return `Need at least ${details.minPlayersToStart} players to start. Current: ${details.currentPlayers}.`;
      }
    }

    return error.error;
  }

  private normalizeStatus(status: string): SessionStatus {
    if (
      status === 'pending' ||
      status === 'waiting' ||
      status === 'playing' ||
      status === 'paused' ||
      status === 'ended' ||
      status === 'in-progress'
    ) {
      return status;
    }

    return 'waiting';
  }

  private buildStatusMessage(status: SessionStatus): string {
    if (status === 'playing' || status === 'in-progress') {
      return 'Game started. Waiting for the first question...';
    }

    if (status === 'paused') {
      return 'Game paused by host.';
    }

    if (status === 'ended') {
      return 'Game ended.';
    }

    return this.isHost()
      ? 'You are host. Start the game when enough players join.'
      : 'Waiting for host...';
  }

  private leaveLobbyInternal(reason: string): void {
    if (!this.hasJoined) {
      return;
    }

    this.startRequested.set(false);
    this.websocketService.leaveGame(this.pin(), reason);
    this.websocketService.disconnect();
    this.hasJoined = false;
  }
}
