import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
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
import { PlayerBubbleComponent } from '../../shared/ui/player-bubble.component';

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
  imports: [CommonModule, BubblePopComponent, PlayerBubbleComponent],
  templateUrl: './br-host-page.component.html',
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-height: 100vh;
        min-height: 100dvh;
      }

      /* ── Life bubble hearts ── */
      .life-heart {
        display: inline-block;
        font-size: 1.5rem;
        line-height: 1;
        transition:
          transform 300ms ease,
          opacity 300ms ease;
      }
      .life-heart.empty {
        opacity: 0.3;
        filter: grayscale(0.6);
      }
      .life-heart.popping {
        animation: life-bubble-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }

      @keyframes life-bubble-pop {
        0% {
          transform: scale(1);
          opacity: 1;
        }
        40% {
          transform: scale(1.4);
          opacity: 0.8;
        }
        100% {
          transform: scale(0);
          opacity: 0;
        }
      }

      /* ── Pairing split reveal ── */
      .pairing-player {
        animation: pairing-slide-in 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      .pairing-player.left {
        animation-name: pairing-slide-left;
      }
      .pairing-player.right {
        animation-name: pairing-slide-right;
      }

      @keyframes pairing-slide-left {
        0% {
          transform: translateX(-120%);
          opacity: 0;
        }
        100% {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes pairing-slide-right {
        0% {
          transform: translateX(120%);
          opacity: 0;
        }
        100% {
          transform: translateX(0);
          opacity: 1;
        }
      }

      /* ── Correct answer glow ── */
      .correct-glow {
        animation: green-pulse 800ms ease-out 3;
      }
      @keyframes green-pulse {
        0%,
        100% {
          box-shadow: 0 0 0 0 var(--bubbly-success, #22c55e);
        }
        50% {
          box-shadow: 0 0 24px 8px var(--bubbly-success, #22c55e);
        }
      }

      /* ── Wrong answer shake ── */
      .wrong-shake {
        animation: red-shake 400ms ease;
      }
      @keyframes red-shake {
        0%,
        100% {
          transform: translateX(0);
        }
        20%,
        60% {
          transform: translateX(-6px);
        }
        40%,
        80% {
          transform: translateX(6px);
        }
      }

      /* ── Winner announcements ── */
      .winner-bounce {
        animation: winner-slide-down 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      @keyframes winner-slide-down {
        0% {
          transform: translateY(-100%);
          opacity: 0;
        }
        60% {
          transform: translateY(12px);
          opacity: 1;
        }
        80% {
          transform: translateY(-6px);
        }
        100% {
          transform: translateY(0);
          opacity: 1;
        }
      }

      /* ── Full-screen overlay ── */
      .overlay-fade {
        animation: overlay-fade-in 400ms ease-out both;
      }
      @keyframes overlay-fade-in {
        0% {
          opacity: 0;
          backdrop-filter: blur(0px);
        }
        100% {
          opacity: 1;
          backdrop-filter: blur(12px);
        }
      }

      /* ── VS divider pulse ── */
      .vs-divider {
        animation: vs-pulse 1.5s ease-in-out infinite;
      }
      @keyframes vs-pulse {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.15);
        }
      }

      /* ── Crown bounce ── */
      .crown-bounce {
        display: inline-block;
        animation: crown-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      @keyframes crown-pop {
        0% {
          transform: scale(0) rotate(-30deg);
          opacity: 0;
        }
        60% {
          transform: scale(1.3) rotate(5deg);
          opacity: 1;
        }
        100% {
          transform: scale(1) rotate(0deg);
          opacity: 1;
        }
      }

      /* ── Option letter badge ── */
      .option-letter {
        width: 2.5rem;
        height: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--bubbly-radius-lg);
        flex-shrink: 0;
      }

      /* ── Reduced motion ── */
      @media (prefers-reduced-motion: reduce) {
        .life-heart.popping,
        .pairing-player,
        .correct-glow,
        .wrong-shake,
        .winner-bounce,
        .overlay-fade,
        .crown-bounce {
          animation: none !important;
        }
        .vs-divider {
          animation: none !important;
        }
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
    this.gameState.players().filter((p) => this.gameState.eliminatedPlayers().includes(p.userId))
  );

  protected readonly isLobbyPhase = computed(
    () => this.gameState.roundType() === null && !this.gameState.royaleWinner()
  );

  protected readonly isBubblePopPhase = computed(() => this.gameState.roundType() === 'bubble-pop');

  protected readonly isDuelPhase = computed(() => this.gameState.roundType() === 'duel');

  protected readonly isGameOver = computed(() => this.gameState.royaleWinner() !== null);

  // ── Option label ──
  protected getOptionLabel(index: number): string {
    return String.fromCharCode(65 + index); // 0→A, 1→B, …
  }

  /** Returns an array of numbers [0..count-1] for @for life-bubble iteration. */
  protected range(count: number): number[] {
    return Array.from({ length: Math.max(0, count) }, (_, i) => i);
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
    // Lobby state — sync players with GameStateService
    this.websocketService.lobbyState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameState.setLobbyState(event);
      });

    // Session closed
    this.websocketService.sessionClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.hasJoined = false;
      this.websocketService.disconnect();
      void this.router.navigateByUrl('/dashboard');
    });

    // Socket errors
    this.websocketService.socketError$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.errorMessage.set(event.error);
      });

    // ── Bubbly Royale events ──

    // Duel pairing — spotlight announcement
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

    // Duel question — show for audience
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

    // Duel result — reveal correct answer and winner
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

    // Life lost — trigger heart pop animation on the player
    this.websocketService.lifeLost$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((_event: BrLifeLostEvent) => {
        // GameStateService handles the signal update;
        // host just gets the animation trigger via lifeLostRecently signal
      });

    // Player eliminated — full-screen overlay
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

    // Life Steal announcement — full-screen overlay
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

    // Royale winner — full-screen celebration
    this.websocketService.royaleWinner$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
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
