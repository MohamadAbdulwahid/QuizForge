import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WebsocketService } from '../../core/services/websocket.service';
import { buildDisplayName } from '../../shared/utils/display-name';
import { BubblyAlertComponent } from '../../shared/ui/bubbly-alert.component';
import { BubblyModalComponent } from '../../shared/ui/bubbly-modal.component';
import { BrLivesBarComponent } from '../../shared/ui/br-lives-bar.component';
import { BrPowerUpCardComponent } from '../../shared/ui/br-power-up-card.component';
import { BrCurseTokenCardComponent } from '../../shared/ui/br-curse-token-card.component';
import { BubblePopComponent } from './bubble-pop/bubble-pop.component';
import { GameStateService } from './services/game-state.service';

/** Curated icon set for power-ups. Falls back to ✨. */
const POWER_UP_ICONS: Readonly<Record<string, string>> = {
  Shield: '🛡️',
  QuickBubble: '⚡',
  DoublePop: '💥',
  Freeze: '❄️',
  BubbleHeal: '💖',
};

/** Curated icon set for curses. */
const CURSE_ICONS: Readonly<Record<string, string>> = {
  SlowMotion: '🐌',
  Jumble: '🔀',
  LifeSteal: '💀',
};

/** Cycle through vibrant Blooket-style colors for answer option cards. */
const OPTION_COLORS = [
  'bg-rose-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-fuchsia-500',
] as const;

const OPTION_BORDER_COLORS = [
  '#fb7185', // rose-400
  '#38bdf8', // sky-400
  '#34d399', // emerald-400
  '#a78bfa', // violet-400
  '#fbbf24', // amber-400
  '#e879f9', // fuchsia-400
] as const;

@Component({
  selector: 'app-br-player-page',
  standalone: true,
  imports: [
    BubblePopComponent,
    BubblyAlertComponent,
    BubblyModalComponent,
    BrLivesBarComponent,
    BrPowerUpCardComponent,
    BrCurseTokenCardComponent,
  ],
  templateUrl: './br-player-page.component.html',
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        overflow-x: hidden;
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
      this.gameState.roundType() === 'duel' &&
      !this.isInDuel() &&
      !this.gameState.isSpectator()
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
  readonly cursesOnCurrentDuel = computed(() =>
    this.gameState.curseTokens().filter((c) => c.cast).length
  );

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

  // ── Icon helpers (used in template for toasts and list items) ──

  getPowerUpIcon(type: string): string {
    return POWER_UP_ICONS[type] ?? '✨';
  }

  getCurseIcon(type: string): string {
    return CURSE_ICONS[type] ?? '🔮';
  }

  // ── Layout helpers (used in template) ──

  getOptionColor(i: number): string {
    return OPTION_COLORS[i % OPTION_COLORS.length];
  }

  getOptionBorderColor(i: number): string {
    return OPTION_BORDER_COLORS[i % OPTION_BORDER_COLORS.length];
  }

  getOptionLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  /** Returns an array [0..count-1] for @for iteration. */
  range(count: number): number[] {
    return Array.from({ length: Math.max(0, count) }, (_, i) => i);
  }

  /**
   * Index of the life that was just lost (so the lives bar can play
   * its pop animation). Derived from `lifeLostRecently` + current lives
   * — when the player who just lost a life matches our user, pop the
   * one that just disappeared (i.e. `remaining`).
   */
  readonly lifeJustLostIndex = computed<number | null>(() => {
    const recentLoser = this.gameState.lifeLostRecently();
    const me = this.gameState.currentUserId();
    if (!recentLoser || recentLoser !== me) return null;
    // The life at the index `remaining` was just lost
    // (e.g. lives was 3, now 2 → index 2 just disappeared).
    return this.gameState.lives();
  });

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

    this.websocketService.duelQuestion$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const duel = this.gameState.duelState();
        if (!duel || duel.duelId !== event.duelId) return;
        this.selectedAnswer.set(null);
        this.answerSubmitted.set(false);
        this.startDuelTimer(event.question.timerMs);
      });

    this.websocketService.duelResult$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const duel = this.gameState.duelState();
        if (!duel || duel.duelId !== event.duelId) return;
        this.clearDuelTimer();
      });

    this.websocketService.duelPaired$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.selectedAnswer.set(null);
        this.answerSubmitted.set(false);
        this.clearDuelTimer();
      });

    this.websocketService.roundTransition$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.bubbleBubblesReached.set(0);
        this.bubbleTimeMs.set(null);
        this.bubbleSubmitted.set(false);
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

    this.websocketService.lifeLost$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
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
