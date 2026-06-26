import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import type {
  BrDuelPairedEvent,
  BrDuelQuestionEvent,
  BrDuelResultEvent,
  BrLifeLostEvent,
  BrPlayerEliminatedEvent,
  BrLifeStealAnnouncementEvent,
} from '../../core/services/websocket.service';
import { WebsocketService } from '../../core/services/websocket.service';
import { GameStateService } from '../../features/game/services/game-state.service';
import { buildDisplayName } from '../../shared/utils/display-name';
import { BubblePopComponent } from '../../features/game/bubble-pop/bubble-pop.component';
import { BrRoyalPlayerCardComponent } from '../../shared/ui/br-royal-player-card.component';

/** Color cycle for the four answer options on the host projector. */
const OPTION_PALETTE = [
  { border: 'border-sky-400', badge: 'bg-sky-500' },
  { border: 'border-rose-400', badge: 'bg-rose-500' },
  { border: 'border-emerald-400', badge: 'bg-emerald-500' },
  { border: 'border-violet-400', badge: 'bg-violet-500' },
] as const;

/** Duel question + correct answer held for host-only display after result. */
interface HostDuelDisplay {
  text: string;
  options: Array<{ id: string; text: string }>;
  correctAnswer: string | null;
  player1TimeMs: number | null;
  player2TimeMs: number | null;
  player1Correct: boolean;
  player2Correct: boolean;
}

@Component({
  selector: 'app-br-host-page',
  standalone: true,
  imports: [
    CommonModule,
    BubblePopComponent,
    BrRoyalPlayerCardComponent,
  ],
  templateUrl: './br-host-page.component.html',
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-height: 100vh;
        min-height: 100dvh;
      }
    `,
  ],
})
export class BrHostPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly websocketService = inject(WebsocketService);
  readonly gameState = inject(GameStateService);

  // ── Connection / UI state ──
  protected readonly pin = signal('');
  protected readonly connected = this.websocketService.connected;
  protected readonly reconnecting = this.websocketService.reconnecting;
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly initialLoading = signal(true);

  // ── Host-specific duel display ──
  protected readonly hostDuelDisplay = signal<HostDuelDisplay | null>(null);
  protected readonly showDuelResult = signal(false);
  protected readonly duelAnswerStatus = signal<{
    player1Answered: boolean;
    player2Answered: boolean;
  }>({ player1Answered: false, player2Answered: false });
  private readonly player1Id = signal<string | null>(null);
  private readonly player2Id = signal<string | null>(null);

  // ── Overlay state ──
  protected readonly showLifeStealOverlay = signal(false);
  protected readonly lifeStealMessage = signal<{
    targetName: string;
    casterName: string;
  } | null>(null);
  protected readonly showEliminationOverlay = signal(false);
  protected readonly eliminatedPlayerName = signal<string | null>(null);
  protected readonly showWinnerOverlay = signal(false);

  // ── Confetti for winner overlay ──
  protected readonly confettiPieces = computed(() =>
    this.showWinnerOverlay()
      ? Array.from({ length: 50 }, (_, i) => ({
          id: i,
          leftPct: Math.random() * 100,
          delayMs: Math.random() * 2000,
          colorIndex: i % 6,
        }))
      : []
  );

  protected readonly confettiPalette = [
    '#00a5e0',
    '#cd2750',
    '#f59e0b',
    '#10b981',
    '#8b5cf6',
    '#ec4899',
  ] as const;

  private hasJoined = false;
  private animationTimeouts: ReturnType<typeof setTimeout>[] = [];
  private overlayTimeouts: ReturnType<typeof setTimeout>[] = [];

  // ── Computed views ──
  protected readonly activePlayers = computed(() =>
    this.gameState
      .players()
      .filter(
        (p) =>
          !this.gameState.eliminatedPlayers().includes(p.userId) &&
          p.userId !== this.gameState.hostUserId()
      )
  );

  protected readonly eliminatedPlayerNames = computed(() =>
    this.gameState.players().filter((p) =>
      this.gameState.eliminatedPlayers().includes(p.userId)
    )
  );

  protected readonly isLobbyPhase = computed(
    () => this.gameState.roundType() === null && !this.gameState.royaleWinner()
  );

  protected readonly isBubblePopPhase = computed(
    () => this.gameState.roundType() === 'bubble-pop'
  );

  protected readonly isDuelPhase = computed(
    () => this.gameState.roundType() === 'duel'
  );

  protected readonly isGameOver = computed(
    () => this.gameState.royaleWinner() !== null
  );

  // ── Layout helpers ──

  protected getOptionLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  protected getOptionColor(index: number): { border: string; badge: string } {
    return OPTION_PALETTE[index % OPTION_PALETTE.length];
  }

  /** Returns an array of numbers [0..count-1] for @for iteration. */
  protected range(count: number): number[] {
    return Array.from({ length: Math.max(0, count) }, (_, i) => i);
  }

  protected confettiColor(i: number): string {
    return this.confettiPalette[i % this.confettiPalette.length];
  }

  // ── Lifecycle ──

  async ngOnInit(): Promise<void> {
    const pin = this.route.snapshot.paramMap.get('pin') ?? '';
    this.pin.set(pin);

    if (!/^\d{6}$/.test(pin)) {
      this.errorMessage.set('Invalid PIN format.');
      this.initialLoading.set(false);
      return;
    }

    await this.authService.whenReady();
    const token = this.authService.accessToken();
    const currentUser = this.authService.currentUser();

    if (!token || !currentUser) {
      await this.router.navigateByUrl('/login');
      return;
    }

    try {
      this.gameState.setCurrentUserId(currentUser.id);
      this.gameState.setGameMode('bubbly-royale');
      this.bindSocketEvents();
      this.websocketService.connect(token);
      this.websocketService.joinGame(pin, buildDisplayName(currentUser, 'Host'));
      this.hasJoined = true;
      this.initialLoading.set(false);
    } catch {
      this.errorMessage.set('Failed to connect. Is the session running?');
      this.initialLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.clearAllTimeouts();
    this.leaveInternal();
  }

  // ── Host controls ──

  startGame(): void {
    this.websocketService.startGame(this.pin());
  }

  protected requestEndSession(): void {
    this.websocketService.endSession(this.pin());
    this.websocketService.disconnect();
    void this.router.navigateByUrl('/dashboard');
  }

  protected dismissOverlay(): void {
    this.showLifeStealOverlay.set(false);
    this.showEliminationOverlay.set(false);
    this.showWinnerOverlay.set(false);
  }

  protected backToDashboard(): void {
    this.websocketService.disconnect();
    void this.router.navigateByUrl('/dashboard');
  }

  // ── WebSocket event bindings ──

  private bindSocketEvents(): void {
    this.websocketService.lobbyState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameState.setLobbyState(event);
      });

    this.websocketService.sessionClosed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.hasJoined = false;
        this.websocketService.disconnect();
        void this.router.navigateByUrl('/dashboard');
      });

    this.websocketService.socketError$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.errorMessage.set(event.error);
      });

    // ── Bubbly Royale events ──

    this.websocketService.duelPaired$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: BrDuelPairedEvent) => {
        this.player1Id.set(event.player1Id);
        this.player2Id.set(event.player2Id);
        this.showDuelResult.set(false);
        this.hostDuelDisplay.set(null);
        this.duelAnswerStatus.set({
          player1Answered: false,
          player2Answered: false,
        });
      });

    this.websocketService.duelQuestion$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: BrDuelQuestionEvent) => {
        this.hostDuelDisplay.set({
          text: event.question.text,
          options: event.question.options,
          correctAnswer: null,
          player1TimeMs: null,
          player2TimeMs: null,
          player1Correct: false,
          player2Correct: false,
        });
      });

    this.websocketService.duelResult$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: BrDuelResultEvent) => {
        this.hostDuelDisplay.update((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            correctAnswer: event.correctAnswer,
            player1TimeMs: event.player1TimeMs,
            player2TimeMs: event.player2TimeMs,
            player1Correct: event.player1Correct,
            player2Correct: event.player2Correct,
          };
        });
        this.duelAnswerStatus.set({
          player1Answered: true,
          player2Answered: true,
        });
        this.showDuelResult.set(true);
      });

    this.websocketService.lifeLost$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((_event: BrLifeLostEvent) => {
        // GameStateService handles the signal update;
        // host just gets the animation trigger via lifeLostRecently signal
      });

    this.websocketService.playerEliminated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: BrPlayerEliminatedEvent) => {
        this.eliminatedPlayerName.set(event.playerName);
        this.showEliminationOverlay.set(true);

        const timer = setTimeout(() => {
          this.showEliminationOverlay.set(false);
          this.eliminatedPlayerName.set(null);
        }, 2500);
        this.overlayTimeouts.push(timer);
      });

    this.websocketService.lifeStealAnnouncement$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: BrLifeStealAnnouncementEvent) => {
        this.lifeStealMessage.set({
          targetName: event.targetName,
          casterName: event.casterName,
        });
        this.showLifeStealOverlay.set(true);

        const timer = setTimeout(() => {
          this.showLifeStealOverlay.set(false);
          this.lifeStealMessage.set(null);
        }, 3500);
        this.overlayTimeouts.push(timer);
      });

    this.websocketService.royaleWinner$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.showWinnerOverlay.set(true);
      });
  }

  // ── Cleanup ──

  private clearAllTimeouts(): void {
    for (const t of this.animationTimeouts) clearTimeout(t);
    for (const t of this.overlayTimeouts) clearTimeout(t);
    this.animationTimeouts = [];
    this.overlayTimeouts = [];
  }

  private leaveInternal(): void {
    if (!this.hasJoined) return;
    this.hasJoined = false;
    this.websocketService.leaveGame(this.pin(), 'host-page-destroy');
    this.websocketService.disconnect();
  }
}
