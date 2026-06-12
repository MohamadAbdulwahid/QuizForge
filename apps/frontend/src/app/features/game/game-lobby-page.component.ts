import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SessionApiService, SessionStatus } from '../../core/services/session-api.service';
import { SessionEventBus } from '../../core/services/session-event-bus.service';
import {
  SessionClosedEvent,
  SocketErrorPayload,
  WebsocketService,
} from '../../core/services/websocket.service';
import { buildDisplayName } from '../../shared/utils/display-name';
import { BubblyModalComponent } from '../../shared/ui/bubbly-modal.component';
import { GameStateService } from './services/game-state.service';

interface LobbyPlayer {
  userId: string;
  name: string;
  emoji: string;
  isSelf: boolean;
}

@Component({
  selector: 'app-game-lobby-page',
  standalone: true,
  imports: [CommonModule, BubblyModalComponent],
  templateUrl: './game-lobby-page.component.html',
})
export class GameLobbyPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly sessionEventBus = inject(SessionEventBus);
  private readonly sessionApiService = inject(SessionApiService);
  private readonly websocketService = inject(WebsocketService);
  private readonly gameStateService = inject(GameStateService);

  protected readonly pin = signal('');
  protected readonly statusMessage = signal('Connecting to lobby...');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly players = signal<LobbyPlayer[]>([]);
  protected readonly playerCount = computed(() => this.players().length);
  protected readonly hostUserId = signal<string | null>(null);
  protected readonly sessionStatus = signal<SessionStatus>('waiting');
  protected readonly minPlayersToStart = signal(2);
  protected readonly gameMode = signal<string>('forge-classic');
  protected readonly startRequested = signal(false);
  protected readonly connected = this.websocketService.connected;
  protected readonly reconnecting = this.websocketService.reconnecting;
  protected readonly isHost = computed(
    () => this.authService.currentUser()?.id === this.hostUserId()
  );
  protected readonly canStartGame = computed(
    () =>
      this.isHost() &&
      this.connected() &&
      this.sessionStatus() === 'waiting' &&
      this.playerCount() >= this.minPlayersToStart() &&
      !this.startRequested()
  );

  private readonly emojiPool = [
    '🦊',
    '🐼',
    '🦁',
    '🐯',
    '🐸',
    '🐙',
    '🦄',
    '🐧',
    '🦉',
    '🐺',
    '🐱',
    '🐶',
    '🐰',
    '🐭',
    '🐹',
    '🐻',
    '🐲',
    '👽',
    '🤖',
    '👾',
    '🫅',
    '🐨',
  ];
  // Modal states
  protected readonly showEndConfirmModal = signal(false);
  protected readonly showSessionClosedModal = signal(false);
  protected readonly sessionClosedReason = signal('');

  private hasJoined = false;

  async ngOnInit(): Promise<void> {
    const pin = this.route.snapshot.paramMap.get('pin') ?? '';
    this.pin.set(pin);

    if (!/^\d{6}$/.test(pin)) {
      this.errorMessage.set('Invalid PIN format. Expected a 6-digit code.');
      return;
    }

    // Read username from router state (set by play page) before awaiting
    // auth — guests won't have a Supabase session and must still be able
    // to join with the display name they typed on /play.
    const state = history.state as { username?: string };
    const guestUsername = state?.username?.trim() ?? '';

    await this.authService.whenReady();
    const token = this.authService.accessToken();
    const currentUser = this.authService.currentUser();
    const isGuest = !token || !currentUser;

    // Resolve display name: explicit play-page input wins, then the
    // authenticated user's display name, then a generic fallback.
    const username =
      guestUsername || (currentUser ? buildDisplayName(currentUser, 'Player') : 'Player');

    if (!username) {
      this.errorMessage.set('Please enter a username to join the game.');
      return;
    }

    this.bindSocketEvents();

    this.sessionApiService
      .getSessionByPin(pin)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          this.sessionStatus.set(this.normalizeStatus(session.status));
          this.statusMessage.set(this.buildStatusMessage(this.normalizeStatus(session.status)));

          if (isGuest) {
            this.websocketService.connectAsGuest(username);
          } else {
            this.websocketService.connect(token ?? '');
            if (!session.isHost && currentUser) {
              this.upsertPlayer(currentUser.id, username, true);
            }
          }
          this.websocketService.joinGame(pin, username);
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

  /** Host: show the end-session confirmation modal */
  protected requestEndSession(): void {
    this.showEndConfirmModal.set(true);
  }

  /** Host: confirmed — emit end-session, navigate to dashboard */
  protected confirmEndSession(): void {
    this.showEndConfirmModal.set(false);
    this.websocketService.endSession(this.pin());
    this.sessionEventBus.emit();
    this.websocketService.disconnect();
    void this.router.navigateByUrl('/dashboard');
  }

  /** Cancel end-session confirmation */
  protected cancelEndSession(): void {
    this.showEndConfirmModal.set(false);
  }

  /** Dismiss the session-closed popup and go to dashboard */
  protected dismissSessionClosed(): void {
    this.showSessionClosedModal.set(false);
    void this.router.navigateByUrl('/dashboard');
  }

  private bindSocketEvents(): void {
    this.websocketService.playerJoined$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (!event.userId) {
          return;
        }

        // Skip host — they have a separate screen
        if (event.isHost || event.userId === this.hostUserId()) {
          return;
        }

        const ownUserId = this.authService.currentUser()?.id;
        const isSelf = event.userId === ownUserId;

        this.upsertPlayer(
          event.userId,
          event.username ?? this.formatRemoteName(event.userId),
          isSelf
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
        this.gameMode.set(event.gameMode ?? 'forge-classic');

        const normalizedStatus = this.normalizeStatus(event.status);
        this.sessionStatus.set(normalizedStatus);
        this.statusMessage.set(this.buildStatusMessage(normalizedStatus));

        const ownUserId = this.authService.currentUser()?.id;

        this.players.set(
          event.players
            .filter((player) => !(player.isHost ?? player.userId === event.hostUserId))
            .map((player) => ({
              userId: player.userId,
              name: player.username ?? this.formatRemoteName(player.userId),
              isSelf: player.userId === ownUserId,
              emoji: this.selectEmoji(player.userId),
            }))
        );
      });

    this.websocketService.gameStarted$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.startRequested.set(false);
        this.sessionStatus.set('playing');

        // Update gameMode from the game-started event (more reliable than lobby-state)
        if (event.gameMode) {
          this.gameMode.set(event.gameMode);
        }

        // Store game mode for the play page
        this.gameStateService.setGameMode(event.gameMode ?? 'forge-classic');

        // Store current user ID for treasure-forge gold updates
        const ownUserId = this.authService.currentUser()?.id;
        if (ownUserId) {
          this.gameStateService.setCurrentUserId(ownUserId);
        }

        const isHost = this.isHost();
        let target: string;

        if (isHost) {
          target = '/host';
        } else {
          target = '/game';
        }

        this.statusMessage.set(
          isHost
            ? 'Game started. Displaying questions...'
            : 'Game started. Waiting for the first question...'
        );
        void this.router.navigate([target, this.pin()]);
      });

    this.websocketService.sessionClosed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.handleSessionClosed(event);
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

  private upsertPlayer(userId: string, name: string, isSelf: boolean): void {
    this.players.update((existingPlayers) => {
      const existing = existingPlayers.find((player) => player.userId === userId);
      if (existing) {
        return existingPlayers.map((player) =>
          player.userId === userId ? { ...player, name, isSelf: player.isSelf || isSelf } : player
        );
      }

      return [
        ...existingPlayers,
        {
          userId,
          name,
          isSelf,
          emoji: this.selectEmoji(userId),
        },
      ];
    });
  }

  private selectEmoji(userId: string): string {
    const hash = Array.from(userId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return this.emojiPool[hash % this.emojiPool.length];
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

    if (error.code === 'DUPLICATE_USERNAME') {
      return 'That username is already taken. Please go back and choose a different name.';
    }

    if (error.code === 'SESSION_ENDED') {
      return 'This session has already ended.';
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

  private handleSessionClosed(event: SessionClosedEvent): void {
    if (!this.hasJoined) {
      return;
    }

    this.hasJoined = false;
    this.websocketService.disconnect();

    this.sessionClosedReason.set(event.reason);
    this.showSessionClosedModal.set(true);
  }
}
