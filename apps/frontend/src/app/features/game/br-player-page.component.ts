import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WebsocketService } from '../../core/services/websocket.service';
import { buildDisplayName } from '../../shared/utils/display-name';
import { BubblyAlertComponent } from '../../shared/ui/bubbly-alert.component';
import { BubblyModalComponent } from '../../shared/ui/bubbly-modal.component';
import { BubblePopComponent } from './bubble-pop/bubble-pop.component';
import { GameStateService } from './services/game-state.service';

/** Power-up icon mapping for display. */
const POWER_UP_ICONS: Record<string, string> = {
  Shield: '🛡️',
  QuickBubble: '⚡',
  DoublePop: '💥',
  Freeze: '❄️',
  BubbleHeal: '💖',
};

/** Curse icon mapping for display. */
const CURSE_ICONS: Record<string, string> = {
  SlowMotion: '🐌',
  Jumble: '🔀',
  LifeSteal: '💀',
};

@Component({
  selector: 'app-br-player-page',
  standalone: true,
  imports: [BubblePopComponent, BubblyAlertComponent, BubblyModalComponent],
  templateUrl: './br-player-page.component.html',
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        background: var(--bubbly-background);
        color: var(--bubbly-text);
        font-family: var(--bubbly-font-body);
        overflow-x: hidden;
      }

      .spectator-overlay {
        filter: grayscale(100%);
      }

      .life-heart {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        transition:
          transform 300ms ease,
          opacity 300ms ease;
      }

      .life-heart.lost {
        opacity: 0.3;
        filter: grayscale(100%);
      }

      .life-heart.popping {
        animation: life-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }

      .duel-answer-btn {
        width: 100%;
        padding: 1rem 1.25rem;
        border-radius: var(--bubbly-radius-xl);
        border: 3px solid transparent;
        background: var(--bubbly-surface-soft);
        color: var(--bubbly-text);
        font-family: var(--bubbly-font-body);
        font-weight: 700;
        font-size: 1.125rem;
        text-align: left;
        cursor: pointer;
        transition:
          border-color 200ms ease,
          background-color 200ms ease,
          transform 150ms ease;
      }

      .duel-answer-btn:hover:not(:disabled) {
        background: var(--bubbly-surface);
        transform: scale(1.01);
      }

      .duel-answer-btn:focus-visible {
        outline: 3px solid var(--bubbly-focus);
        outline-offset: 2px;
      }

      .duel-answer-btn:active:not(:disabled) {
        transform: scale(0.98);
      }

      .duel-answer-btn.selected {
        border-color: var(--bubbly-primary);
        background: color-mix(in srgb, var(--bubbly-primary) 13%, white);
        animation: option-pulse 800ms ease-in-out infinite;
      }

      .duel-answer-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .result-banner {
        animation: slide-down 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      @keyframes life-pop {
        0% {
          transform: scale(1);
          opacity: 1;
        }
        40% {
          transform: scale(1.4);
          opacity: 0.7;
        }
        100% {
          transform: scale(0);
          opacity: 0;
        }
      }

      @keyframes option-pulse {
        0%,
        100% {
          box-shadow: 0 0 0 0 var(--bubbly-primary);
        }
        50% {
          box-shadow: 0 0 0 4px var(--bubbly-primary);
        }
      }

      @keyframes slide-down {
        from {
          transform: translateY(-30px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @keyframes flash-red {
        0%,
        100% {
          background-color: transparent;
        }
        50% {
          background-color: rgba(239, 68, 68, 0.2);
        }
      }

      .life-flash {
        animation: flash-red 600ms ease-in-out;
      }

      @media (prefers-reduced-motion: reduce) {
        .life-heart.popping,
        .duel-answer-btn.selected,
        .result-banner,
        .life-flash {
          animation: none;
        }
        .life-heart.popping {
          opacity: 0;
          transform: scale(0);
        }
        .duel-answer-btn {
          transition: none;
        }
      }
    `,
  ],
})
export class BrPlayerPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly websocketService = inject(WebsocketService);
  readonly gameState = inject(GameStateService);

  // ── Connection state ──
  readonly connected = this.websocketService.connected;
  readonly reconnecting = this.websocketService.reconnecting;

  // ── Game flow state ──
  readonly gameStarted = signal(false);
  readonly sessionClosedReason = signal('');
  readonly showSessionClosedModal = signal(false);

  // ── Duel state ──
  readonly selectedAnswer = signal<string | null>(null);
  readonly answerSubmitted = signal(false);
  readonly duelTimerMs = signal(0);

  // ── Bubble Pop state ──
  readonly bubbleBubblesReached = signal(0);
  readonly bubbleTimeMs = signal<number | null>(null);
  readonly bubbleSubmitted = signal(false);

  // ── Spectator / Curse state ──
  readonly showCursePicker = signal(false);
  readonly selectedCurseTarget = signal<string | null>(null);
  readonly selectedCurseType = signal<string | null>(null);

  // ── Toast notifications ──
  readonly powerUpToast = signal<string | null>(null);
  readonly curseToast = signal<string | null>(null);
  readonly showLifeLostFlash = signal(false);

  // ── Modal ──
  readonly errorMessage = signal<string | null>(null);

  // ── Computed ──
  readonly isInDuel = computed(() => this.gameState.duelState() !== null);

  readonly isWatchingDuel = computed(() => {
    return (
      this.gameState.roundType() === 'duel' && !this.isInDuel() && !this.gameState.isSpectator()
    );
  });

  readonly canCastCurse = computed(() => {
    const isDuringDuel = this.gameState.roundType() === 'duel';
    const hasAvailableToken = this.gameState.curseTokens().some((c) => !c.cast);
    const hasTargets = this.gameState.curseOpportunityTargets().length > 0;
    // Life Steal disabled during duels
    const hasNonLifeSteal = this.gameState
      .curseTokens()
      .some((c) => !c.cast && c.type !== 'LifeSteal');
    const canLifeSteal = !isDuringDuel;

    if (!this.gameState.isSpectator() || !hasAvailableToken || !hasTargets) {
      return false;
    }
    return canLifeSteal || hasNonLifeSteal;
  });

  readonly duelTimerSeconds = computed(() => Math.ceil(this.duelTimerMs() / 1000));

  readonly duelTimeProgress = computed(() => {
    const state = this.gameState.duelState();
    if (!state || state.timerMs <= 0) return 0;
    return Math.max(0, Math.min(100, (this.duelTimerMs() / state.timerMs) * 100));
  });

  /** Power-ups that have a manual use button (Bubble Heal only). */
  readonly manualPowerUps = computed(() =>
    this.gameState.powerUps().filter((p) => p.type === 'BubbleHeal' && !p.consumed)
  );

  /** Curses available for use (uncast, considering Life Steal timing). */
  readonly availableCurses = computed(() => {
    const isDuringDuel = this.gameState.roundType() === 'duel';
    return this.gameState.curseTokens().filter((c) => {
      if (c.cast) return false;
      if (c.type === 'LifeSteal' && isDuringDuel) return false;
      return true;
    });
  });

  /** Count of curses cast on the current duel (curseOpportunityTargets may have metadata). */
  readonly cursesOnCurrentDuel = computed(() => {
    // Spectators can see how many curses have been cast this round
    return this.gameState.curseTokens().filter((c) => c.cast).length;
  });

  // ── Internal ──
  private pin = '';
  private didConnect = false;
  private duelTimerInterval: ReturnType<typeof setInterval> | null = null;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;
  private lifeFlashTimeout: ReturnType<typeof setTimeout> | null = null;
  private wasInDuel = false;

  // ── Lifecycle ──

  async ngOnInit(): Promise<void> {
    this.pin = this.route.snapshot.paramMap.get('pin') ?? '';
    await this.authService.whenReady();

    const token = this.authService.accessToken();
    const currentUser = this.authService.currentUser();
    if (!token || !currentUser) {
      this.router.navigate(['/']);
      return;
    }

    this.bindSocketEvents();
    this.bindBrPowerUpEvents();
    this.websocketService.connect(token);
    this.websocketService.joinGame(this.pin, buildDisplayName(currentUser, 'Player'));
    this.didConnect = true;
  }

  ngOnDestroy(): void {
    this.clearDuelTimer();
    this.clearToast();
    this.clearLifeFlash();
    if (this.didConnect) {
      this.websocketService.leaveGame(this.pin, 'br-player-page-destroy');
      this.websocketService.disconnect();
    }
  }

  // ── Duel answer ──

  selectAnswer(optionId: string): void {
    if (this.answerSubmitted()) return;
    const duel = this.gameState.duelState();
    if (!duel) return;

    this.selectedAnswer.set(optionId);
    this.answerSubmitted.set(true);
    this.websocketService.submitDuelAnswer(this.pin, duel.duelId, optionId);
  }

  // ── Power-up usage ──

  useBubbleHeal(): void {
    this.websocketService.usePowerUp(this.pin, 'BubbleHeal');
  }

  // ── Curse casting ──

  openCursePicker(): void {
    this.showCursePicker.set(true);
    this.selectedCurseTarget.set(null);
    this.selectedCurseType.set(null);
  }

  closeCursePicker(): void {
    this.showCursePicker.set(false);
    this.selectedCurseTarget.set(null);
    this.selectedCurseType.set(null);
  }

  selectCurseTarget(targetId: string): void {
    this.selectedCurseTarget.set(targetId);
  }

  selectCurseType(curseType: string): void {
    this.selectedCurseType.set(curseType);
  }

  castCurse(): void {
    const target = this.selectedCurseTarget();
    const curseType = this.selectedCurseType();
    if (!target || !curseType) return;
    this.websocketService.castCurse(this.pin, curseType, target);
    this.closeCursePicker();
  }

  // ── Bubble Pop callbacks ──

  onBubbleClick(bubbleNumber: number): void {
    this.bubbleBubblesReached.set(bubbleNumber);
  }

  onBubblePopComplete(elapsedMs: number): void {
    if (this.bubbleSubmitted()) return;
    this.bubbleSubmitted.set(true);
    this.bubbleTimeMs.set(elapsedMs);
    this.websocketService.submitBubblePop(this.pin, 6, elapsedMs);
  }

  // ── Session close ──

  dismissSessionClosed(): void {
    this.showSessionClosedModal.set(false);
    this.router.navigateByUrl('/dashboard');
  }

  // ── Toast helpers ──

  private showPowerUpNotification(name: string): void {
    this.powerUpToast.set(name);
    this.clearToast();
    this.toastTimeout = setTimeout(() => this.powerUpToast.set(null), 3000);
  }

  private showCurseNotification(name: string): void {
    this.curseToast.set(name);
    this.clearToast();
    this.toastTimeout = setTimeout(() => this.curseToast.set(null), 3000);
  }

  private showLifeLost(): void {
    this.showLifeLostFlash.set(true);
    this.clearLifeFlash();
    this.lifeFlashTimeout = setTimeout(() => this.showLifeLostFlash.set(false), 800);
  }

  private clearToast(): void {
    if (this.toastTimeout !== null) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
  }

  private clearLifeFlash(): void {
    if (this.lifeFlashTimeout !== null) {
      clearTimeout(this.lifeFlashTimeout);
      this.lifeFlashTimeout = null;
    }
  }

  // ── Duel timer ──

  private startDuelTimer(totalMs: number): void {
    this.clearDuelTimer();
    this.duelTimerMs.set(totalMs);
    const start = Date.now();
    this.duelTimerInterval = setInterval(() => {
      const remaining = totalMs - (Date.now() - start);
      this.duelTimerMs.set(Math.max(0, remaining));
      if (remaining <= 0) {
        this.clearDuelTimer();
      }
    }, 100);
  }

  private clearDuelTimer(): void {
    if (this.duelTimerInterval !== null) {
      clearInterval(this.duelTimerInterval);
      this.duelTimerInterval = null;
    }
  }

  // ── Power-up icon helper (used in template) ──

  getPowerUpIcon(type: string): string {
    return POWER_UP_ICONS[type] ?? '✨';
  }

  getCurseIcon(type: string): string {
    return CURSE_ICONS[type] ?? '🔮';
  }

  // ── Socket event bindings ──

  private bindSocketEvents(): void {
    this.websocketService.lobbyState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameState.setLobbyState(event);
        if (event.gameMode) {
          this.gameState.setGameMode(event.gameMode);
        }
      });

    this.websocketService.gameStarted$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameStarted.set(true);
        // Set userId from auth
        const currentUser = this.authService.currentUser();
        if (currentUser) {
          this.gameState.setCurrentUserId(currentUser.id);
        }
        if (event.gameMode) {
          this.gameState.setGameMode(event.gameMode);
        }
      });

    this.websocketService.sessionClosed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.websocketService.disconnect();
        this.sessionClosedReason.set(event.reason);
        this.showSessionClosedModal.set(true);
      });

    // Watch duel state changes to start/stop timer and reset selections
    this.websocketService.duelQuestion$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const duel = this.gameState.duelState();
        if (!duel || duel.duelId !== event.duelId) return;
        // Reset answer state when new question arrives for our duel
        this.selectedAnswer.set(null);
        this.answerSubmitted.set(false);
        this.startDuelTimer(event.question.timerMs);
      });

    this.websocketService.duelResult$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const duel = this.gameState.duelState();
        if (!duel || duel.duelId !== event.duelId) return;
        // Stop the timer on duel result
        this.clearDuelTimer();
      });

    // Track when we enter/leave a duel to reset state
    this.websocketService.duelPaired$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.selectedAnswer.set(null);
      this.answerSubmitted.set(false);
      this.clearDuelTimer();
    });

    // Reset bubble pop state on round transition
    this.websocketService.roundTransition$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.bubbleBubblesReached.set(0);
        this.bubbleTimeMs.set(null);
        this.bubbleSubmitted.set(false);
        // Reset duel state if transitioning out of a duel round
        if (this.wasInDuel) {
          this.selectedAnswer.set(null);
          this.answerSubmitted.set(false);
          this.clearDuelTimer();
        }
      });
  }

  /** Binds BR-specific power-up / curse events for toast notifications. */
  private bindBrPowerUpEvents(): void {
    this.websocketService.powerUpAwarded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const currentUserId = this.gameState.currentUserId();
        if (event.playerId === currentUserId) {
          this.showPowerUpNotification(event.powerUp.name);
        }
      });

    this.websocketService.curseAwarded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const currentUserId = this.gameState.currentUserId();
        if (event.playerId === currentUserId) {
          this.showCurseNotification(event.curse.name);
        }
      });

    this.websocketService.lifeLost$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      const currentUserId = this.gameState.currentUserId();
      if (event.playerId === currentUserId) {
        this.showLifeLost();
      }
    });

    this.websocketService.playerEliminated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.clearDuelTimer();
        this.selectedAnswer.set(null);
        this.answerSubmitted.set(false);
      });
  }
}
