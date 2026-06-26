import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import type {
  BrBubblePopStartEvent,
  BrBubblePopRankingEvent,
  BrDuelPairedEvent,
  BrDuelQuestionEvent,
  BrDuelResultEvent,
  BrLifeLostEvent,
  BrPlayerEliminatedEvent,
  BrLifeStealAnnouncementEvent,
  BrPowerUpAwardedEvent,
  BrCurseAwardedEvent,
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
  imports: [CommonModule, BubblePopComponent, BrRoyalPlayerCardComponent],
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

  // ── Big per-player result announcement (correct/incorrect after duel) ──
  protected readonly showDuelResultOverlay = signal(false);
  protected readonly duelResultAnnouncement = signal<{
    player1Name: string;
    player2Name: string;
    player1Correct: boolean;
    player2Correct: boolean;
    player1TimeMs: number | null;
    player2TimeMs: number | null;
    correctAnswer: string;
    winnerName: string | null;
    loserName: string | null;
    isTie: boolean;
  } | null>(null);

  // ── Smaller power-up / curse / life-lost feed (rolling, top-right) ──
  protected readonly eventFeed = signal<
    Array<{
      id: number;
      kind: 'powerup' | 'curse' | 'life' | 'spectator';
      playerName: string;
      text: string;
      icon: string;
      color: 'green' | 'purple' | 'red' | 'amber';
      timestamp: number;
    }>
  >([]);
  private eventFeedIdCounter = 0;
  private eventFeedTimeouts = new Map<number, ReturnType<typeof setTimeout>>();

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

  // ── Per-player lives tracker (for the persistent leaderboard sidebar) ──
  // Keyed by playerId. Updated from duel pairings, life-lost events, and
  // reset to startingLives when a new game starts.
  protected readonly playerLivesMap = signal<
    Map<string, { lives: number; eliminated: boolean; username: string }>
  >(new Map());

  // ── Active round timer (counts down) ──
  // Set when a round starts (bubble pop or duel); ticks every 250ms.
  protected readonly timerTotalMs = signal(0);
  protected readonly timerRemainingMs = signal(0);
  private readonly timerStartedAt = signal<number | null>(null);
  private readonly timerNowMs = signal(Date.now());
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  protected readonly timerSeconds = computed(() => Math.ceil(this.timerRemainingMs() / 1000));

  protected readonly timerProgress = computed(() => {
    const total = this.timerTotalMs();
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (this.timerRemainingMs() / total) * 100));
  });

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

  /** Sorted leaderboard for the sidebar — alive players first (most lives), then eliminated. */
  protected readonly leaderboard = computed(() => {
    const map = this.playerLivesMap();
    const players = this.gameState.players();
    const hostId = this.gameState.hostUserId();
    return players
      .filter((p) => p.userId !== hostId)
      .map((p) => {
        const entry = map.get(p.userId);
        return {
          userId: p.userId,
          username: entry?.username ?? p.username,
          lives: entry?.lives ?? this.gameState.startingLives(),
          eliminated: entry?.eliminated ?? false,
        };
      })
      .sort((a, b) => {
        // Alive players first (by lives desc), then eliminated
        if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
        return b.lives - a.lives;
      });
  });

  protected readonly isLobbyPhase = computed(
    () => this.gameState.roundType() === null && !this.gameState.royaleWinner()
  );

  protected readonly isBubblePopPhase = computed(() => this.gameState.roundType() === 'bubble-pop');

  protected readonly isDuelPhase = computed(() => this.gameState.roundType() === 'duel');

  protected readonly isGameOver = computed(() => this.gameState.royaleWinner() !== null);

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

  /** Push a new event to the rolling host feed (auto-dismisses after 3.5s). */
  private pushFeedEvent(
    kind: 'powerup' | 'curse' | 'life' | 'spectator',
    playerName: string,
    text: string,
    icon: string,
    color: 'green' | 'purple' | 'red' | 'amber'
  ): void {
    const id = ++this.eventFeedIdCounter;
    const event = { id, kind, playerName, text, icon, color, timestamp: Date.now() };
    this.eventFeed.update((prev) => [event, ...prev].slice(0, 5));
    const timeout = setTimeout(() => {
      this.eventFeed.update((prev) => prev.filter((e) => e.id !== id));
      this.eventFeedTimeouts.delete(id);
    }, 3500);
    this.eventFeedTimeouts.set(id, timeout);
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
    this.stopTimer();
    for (const t of this.eventFeedTimeouts.values()) clearTimeout(t);
    this.eventFeedTimeouts.clear();
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

    this.websocketService.sessionClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
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

        // Update the persistent leaderboard with the paired players' lives
        this.playerLivesMap.update((map) => {
          const next = new Map(map);
          next.set(event.player1Id, {
            lives: event.player1Lives,
            eliminated: event.player1Lives <= 0,
            username: event.player1Name,
          });
          next.set(event.player2Id, {
            lives: event.player2Lives,
            eliminated: event.player2Lives <= 0,
            username: event.player2Name,
          });
          return next;
        });
      });

    // Bubble Pop start — start the round timer
    this.websocketService.bubblePopStart$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: BrBubblePopStartEvent) => {
        this.startTimer(event.timerMs);
        // Pre-populate the leaderboard with player names from this round
        // (all alive players start with full lives)
        this.playerLivesMap.update((map) => {
          const next = new Map(map);
          for (const p of this.gameState.players()) {
            if (p.userId === this.gameState.hostUserId()) continue;
            if (!next.has(p.userId)) {
              next.set(p.userId, {
                lives: this.gameState.startingLives(),
                eliminated: false,
                username: p.username,
              });
            }
          }
          return next;
        });
      });

    // Bubble Pop ranking — stop the timer (round complete)
    this.websocketService.bubblePopRanking$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((_event: BrBubblePopRankingEvent) => {
        this.stopTimer();
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
        // Start the active round timer for this duel
        this.startTimer(event.question.timerMs);
      });

    this.websocketService.duelResult$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: BrDuelResultEvent) => {
        // Duel resolved — stop the timer
        this.stopTimer();
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

        // Build the big per-player announcement
        const pairing = this.gameState.currentPairing();
        const correctText = event.correctAnswer ?? '';
        const p1Name = pairing?.player1Name ?? 'Player 1';
        const p2Name = pairing?.player2Name ?? 'Player 2';
        const winnerName = event.winnerId
          ? event.winnerId === pairing?.player1Id
            ? p1Name
            : p2Name
          : null;
        const loserName = event.loserId
          ? event.loserId === pairing?.player1Id
            ? p1Name
            : p2Name
          : null;
        this.duelResultAnnouncement.set({
          player1Name: p1Name,
          player2Name: p2Name,
          player1Correct: event.player1Correct,
          player2Correct: event.player2Correct,
          player1TimeMs: event.player1TimeMs,
          player2TimeMs: event.player2TimeMs,
          correctAnswer: correctText,
          winnerName,
          loserName,
          isTie: event.tie,
        });
        this.showDuelResultOverlay.set(true);

        // Auto-dismiss the big overlay after 3 seconds
        const timer = setTimeout(() => {
          this.showDuelResultOverlay.set(false);
          this.duelResultAnnouncement.set(null);
        }, 3000);
        this.overlayTimeouts.push(timer);
      });

    this.websocketService.lifeLost$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: BrLifeLostEvent) => {
        // Update the persistent leaderboard with the new lives count
        this.playerLivesMap.update((map) => {
          const next = new Map(map);
          const existing = next.get(event.playerId);
          if (existing) {
            next.set(event.playerId, {
              ...existing,
              lives: event.lives,
              eliminated: event.lives <= 0,
            });
          }
          return next;
        });
      });

    this.websocketService.playerEliminated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: BrPlayerEliminatedEvent) => {
        this.eliminatedPlayerName.set(event.playerName);
        this.showEliminationOverlay.set(true);

        // Mark the player as eliminated in the leaderboard
        this.playerLivesMap.update((map) => {
          const next = new Map(map);
          const existing = next.get(event.playerId);
          if (existing) {
            next.set(event.playerId, { ...existing, eliminated: true, lives: 0 });
          } else {
            next.set(event.playerId, {
              lives: 0,
              eliminated: true,
              username: event.playerName,
            });
          }
          return next;
        });

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

    this.websocketService.royaleWinner$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.showWinnerOverlay.set(true);
    });

    // Power-up awarded — show in the rolling event feed
    this.websocketService.powerUpAwarded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: BrPowerUpAwardedEvent) => {
        this.pushFeedEvent(
          'powerup',
          this.getPlayerName(event.playerId),
          `got ${event.powerUp.name}!`,
          '⚡',
          'green'
        );
      });

    // Curse awarded — show in the rolling event feed
    this.websocketService.curseAwarded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: BrCurseAwardedEvent) => {
        this.pushFeedEvent(
          'curse',
          this.getPlayerName(event.playerId),
          `got ${event.curse.name} curse!`,
          '💀',
          'purple'
        );
      });

    // Life lost (from duel) — show in the rolling event feed
    this.websocketService.lifeLost$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: BrLifeLostEvent) => {
        if (event.reason === 'curse') {
          // Steal — already covered by lifeStealAnnouncement
          return;
        }
        const playerName = this.getPlayerName(event.playerId);
        this.pushFeedEvent('life', playerName, 'lost a life!', '💔', 'red');
      });
  }

  /** Look up player username by id from the game-state players signal. */
  private getPlayerName(playerId: string): string {
    const player = this.gameState.players().find((p) => p.userId === playerId);
    return player?.username ?? 'A player';
  }

  // ── Cleanup ──

  private clearAllTimeouts(): void {
    for (const t of this.animationTimeouts) clearTimeout(t);
    for (const t of this.overlayTimeouts) clearTimeout(t);
    this.animationTimeouts = [];
    this.overlayTimeouts = [];
  }

  // ── Active round timer ──

  private startTimer(totalMs: number): void {
    this.stopTimer();
    this.timerTotalMs.set(totalMs);
    this.timerStartedAt.set(Date.now());
    this.timerNowMs.set(Date.now());
    this.timerRemainingMs.set(totalMs);
    this.timerInterval = setInterval(() => {
      this.timerNowMs.set(Date.now());
      const started = this.timerStartedAt();
      if (started === null) return;
      const elapsed = Date.now() - started;
      this.timerRemainingMs.set(Math.max(0, totalMs - elapsed));
      if (this.timerRemainingMs() <= 0) {
        this.stopTimer();
      }
    }, 100);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerStartedAt.set(null);
    this.timerRemainingMs.set(0);
    this.timerTotalMs.set(0);
  }

  private leaveInternal(): void {
    if (!this.hasJoined) return;
    this.hasJoined = false;
    this.websocketService.leaveGame(this.pin(), 'host-page-destroy');
    this.websocketService.disconnect();
  }
}
