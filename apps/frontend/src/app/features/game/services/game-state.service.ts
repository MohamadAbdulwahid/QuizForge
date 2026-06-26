import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  AnswerAckEvent,
  BrBubblePopRankingEvent,
  BrBubblePopStartEvent,
  BrCurseAwardedEvent,
  BrCurseCastEvent,
  BrCurseOpportunityEvent,
  BrDuelPairedEvent,
  BrDuelQuestionEvent,
  BrDuelResultEvent,
  BrLifeLostEvent,
  BrLifeStealAnnouncementEvent,
  BrPlayerEliminatedEvent,
  BrPowerUpAwardedEvent,
  BrRoundTransitionEvent,
  BrRoyaleWinnerEvent,
  BrSpectatorModeEvent,
  GameEndedEvent,
  GameQuestionEvent,
  LeaderboardPlayerEvent,
  LeaderboardUpdateEvent,
  LobbyStateEvent,
  RoundClosedEvent,
  RoundStartedEvent,
  ScoreUpdateEvent,
  SocketErrorPayload,
} from '../../../core/services/websocket.service';
import { WebsocketService } from '../../../core/services/websocket.service';

export type AnswerSubmissionState = 'idle' | 'pending' | 'accepted' | 'rejected' | 'closed';

export interface GamePlayerState {
  userId: string;
  username: string;
  isHost: boolean;
}

export interface RoundResult {
  correct: boolean;
  scoreDelta: number;
  totalScore: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
  rankDelta?: number;
  scoreDelta?: number;
}

// ---------------------------------------------------------------------------
// Bubbly Royale type definitions
// ---------------------------------------------------------------------------

export type BrPowerUpType = 'Shield' | 'QuickBubble' | 'DoublePop' | 'Freeze' | 'BubbleHeal';

export type BrCurseType = 'SlowMotion' | 'Jumble' | 'LifeSteal';

export interface BrPowerUp {
  id: string;
  type: BrPowerUpType;
  name: string;
  description: string;
  consumed: boolean;
}

export interface BrCurseToken {
  id: string;
  type: BrCurseType;
  name: string;
  description: string;
  cast: boolean;
}

export interface BrDuelPairing {
  duelId: string;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  player1Lives: number;
  player2Lives: number;
}

export interface BrBubblePopBubble {
  number: number; // 1-6
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export interface BrBubblePopState {
  bubbles: BrBubblePopBubble[];
  timerMs: number;
  status: 'waiting' | 'active' | 'finished';
  rankings?: Array<{ playerId: string; timeMs: number | null; bubblesReached: number }>;
}

export interface BrDuelState {
  duelId: string;
  opponentId: string;
  opponentName: string;
  question: { text: string; options: Array<{ id: string; text: string }> } | null;
  timerMs: number;
  myAnswer: string | null;
  opponentAnswered: boolean;
  result: 'pending' | 'won' | 'lost' | 'tie' | null;
}

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly pinState = signal<string | null>(null);
  private readonly sessionIdState = signal<number | null>(null);
  private readonly hostUserIdState = signal<string | null>(null);
  private readonly currentUserIdState = signal<string | null>(null);
  private readonly playersState = signal<GamePlayerState[]>([]);
  private readonly currentQuestionState = signal<GameQuestionEvent | null>(null);
  private readonly leaderboardState = signal<LeaderboardEntry[]>([]);
  private readonly previousRankMap = new Map<string, number>();
  private readonly previousScoreMap = new Map<string, number>();
  private readonly selectedAnswerState = signal<string | null>(null);
  private readonly submissionStateSignal = signal<AnswerSubmissionState>('idle');
  private readonly lastAnswerState = signal<AnswerAckEvent | null>(null);
  private readonly lastRoundResultState = signal<RoundResult | null>(null);
  private readonly errorState = signal<string | null>(null);
  private readonly endedState = signal(false);
  private readonly nowMs = signal(Date.now());
  private readonly gameModeState = signal<string>('forge-classic');
  private readonly currentGoldState = signal<number>(0);
  private readonly penaltyUntilState = signal<number | null>(null);
  // Draft answers for structured question types. Reset on each new question.
  // The player components bind to these via 2-way binding and serialize on submit.
  private readonly draftOrderingState = signal<string[]>([]);
  private readonly draftMatchingState = signal<Record<string, string>>({});
  private readonly draftTextState = signal<string>('');
  // Bubbly Royale state signals
  private readonly livesState = signal<number>(3);
  private readonly startingLivesState = signal<number>(3);
  private readonly duelStateState = signal<BrDuelState | null>(null);
  private readonly currentPairingState = signal<BrDuelPairing | null>(null);
  private readonly powerUpsState = signal<BrPowerUp[]>([]);
  private readonly curseTokensState = signal<BrCurseToken[]>([]);
  private readonly isSpectatorState = signal<boolean>(false);
  private readonly bubblePopStateState = signal<BrBubblePopState | null>(null);
  private readonly roundNumberState = signal<number>(0);
  private readonly roundTypeState = signal<'bubble-pop' | 'duel' | null>(null);
  private readonly royaleWinnerState = signal<{
    playerId: string;
    playerName: string;
    livesRemaining: number;
  } | null>(null);
  private readonly lifeLostRecentlyState = signal<string | null>(null);
  private readonly lifeStealAnnouncementState = signal<{
    targetName: string;
    casterName: string;
  } | null>(null);
  private readonly eliminatedPlayersState = signal<string[]>([]);
  private readonly curseOpportunityTargetsState = signal<
    Array<{ id: string; name: string; lives: number }>
  >([]);

  private readonly ws = inject(WebsocketService);
  private readonly destroyRef = inject(DestroyRef);

  private timerId: ReturnType<typeof setInterval> | null = null;

  readonly pin = this.pinState.asReadonly();
  readonly sessionId = this.sessionIdState.asReadonly();
  readonly hostUserId = this.hostUserIdState.asReadonly();
  readonly currentUserId = this.currentUserIdState.asReadonly();
  readonly players = this.playersState.asReadonly();
  readonly currentQuestion = this.currentQuestionState.asReadonly();
  readonly leaderboard = this.leaderboardState.asReadonly();
  readonly selectedAnswer = this.selectedAnswerState.asReadonly();
  readonly submissionState = this.submissionStateSignal.asReadonly();
  readonly lastAnswer = this.lastAnswerState.asReadonly();
  readonly lastRoundResult = this.lastRoundResultState.asReadonly();
  readonly errorMessage = this.errorState.asReadonly();
  readonly ended = this.endedState.asReadonly();
  readonly gameMode = this.gameModeState.asReadonly();
  /** Current gold total (Treasure Forge mode). */
  readonly currentGold = this.currentGoldState.asReadonly();
  /** Penalty end timestamp (Treasure Forge mode). */
  readonly penaltyUntil = this.penaltyUntilState.asReadonly();
  /** Draft ordering answer (array of option ids in current order). */
  readonly draftOrdering = this.draftOrderingState.asReadonly();
  /** Draft matching answer (leftId → rightId map). */
  readonly draftMatching = this.draftMatchingState.asReadonly();
  /** Draft fill-in-blank answer (raw text). */
  readonly draftText = this.draftTextState.asReadonly();
  /** Current lives remaining (Bubbly Royale mode). */
  readonly lives = this.livesState.asReadonly();
  /** Starting lives for this Bubbly Royale game. */
  readonly startingLives = this.startingLivesState.asReadonly();
  /** Current duel state for the active player in a Bubbly Royale duel. */
  readonly duelState = this.duelStateState.asReadonly();
  /** Current duel pairing being shown (host/spectator view). */
  readonly currentPairing = this.currentPairingState.asReadonly();
  /** Player's power-up inventory (Bubbly Royale mode). */
  readonly powerUps = this.powerUpsState.asReadonly();
  /** Player's curse token inventory (Bubbly Royale mode, spectators). */
  readonly curseTokens = this.curseTokensState.asReadonly();
  /** Whether the current player is in spectator mode (eliminated). */
  readonly isSpectator = this.isSpectatorState.asReadonly();
  /** Current Bubble Pop challenge state. */
  readonly bubblePopState = this.bubblePopStateState.asReadonly();
  /** Current round number in Bubbly Royale. */
  readonly roundNumber = this.roundNumberState.asReadonly();
  /** Current round type in Bubbly Royale. */
  readonly roundType = this.roundTypeState.asReadonly();
  /** The winner of the Bubbly Royale game, once crowned. */
  readonly royaleWinner = this.royaleWinnerState.asReadonly();
  /** playerId that just lost a life — triggers pop animation. */
  readonly lifeLostRecently = this.lifeLostRecentlyState.asReadonly();
  /** Life Steal announcement for full-screen display. */
  readonly lifeStealAnnouncement = this.lifeStealAnnouncementState.asReadonly();
  /** List of eliminated player IDs in current Bubbly Royale game. */
  readonly eliminatedPlayers = this.eliminatedPlayersState.asReadonly();
  /** Target players available for casting a curse. */
  readonly curseOpportunityTargets = this.curseOpportunityTargetsState.asReadonly();
  /** Whether the player is currently in penalty cooldown. */
  readonly isInPenalty = computed(() => {
    const until = this.penaltyUntilState();
    return until !== null && Date.now() < until;
  });
  readonly timeRemainingMs = computed(() => {
    const question = this.currentQuestionState();
    if (!question) {
      return 0;
    }

    const elapsedMs = this.nowMs() - question.serverStartTimeMs;
    return Math.max(0, question.timeLimitMs - elapsedMs);
  });
  readonly timeRemainingSeconds = computed(() => Math.ceil(this.timeRemainingMs() / 1000));
  readonly progressPercent = computed(() => {
    const question = this.currentQuestionState();
    if (!question) {
      return 0;
    }

    return Math.max(0, Math.min(100, (this.timeRemainingMs() / question.timeLimitMs) * 100));
  });
  readonly canSubmit = computed(
    () =>
      Boolean(this.currentQuestionState()) &&
      Boolean(this.selectedAnswerState()) &&
      this.submissionStateSignal() === 'idle' &&
      this.timeRemainingMs() > 0
  );

  constructor() {
    this.subscribeBrEvents();
  }

  /** Subscribes to all Bubbly Royale WebSocket events and updates the corresponding signals. */
  private subscribeBrEvents(): void {
    // Guard: skip if WebSocket service does not provide BR observables
    // (e.g., mocked service in non-BR tests)
    if (!this.ws.duelPaired$) return;

    const destroyRef = this.destroyRef;

    // Duel pairing — store pairing info for everyone; create duel state for involved players
    this.ws.duelPaired$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrDuelPairedEvent) => {
        const currentUserId = this.currentUserIdState();
        this.currentPairingState.set({
          duelId: event.duelId,
          player1Id: event.player1Id,
          player1Name: event.player1Name,
          player2Id: event.player2Id,
          player2Name: event.player2Name,
          player1Lives: event.player1Lives,
          player2Lives: event.player2Lives,
        });

        // Only create duel state for the two players involved
        if (currentUserId === event.player1Id) {
          this.duelStateState.set({
            duelId: event.duelId,
            opponentId: event.player2Id,
            opponentName: event.player2Name,
            question: null,
            timerMs: 0,
            myAnswer: null,
            opponentAnswered: false,
            result: null,
          });
        } else if (currentUserId === event.player2Id) {
          this.duelStateState.set({
            duelId: event.duelId,
            opponentId: event.player1Id,
            opponentName: event.player1Name,
            question: null,
            timerMs: 0,
            myAnswer: null,
            opponentAnswered: false,
            result: null,
          });
        }
      });

    // Duel question — update the duel state with the question and timer
    this.ws.duelQuestion$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrDuelQuestionEvent) => {
        this.duelStateState.update((state) => {
          if (!state || state.duelId !== event.duelId) return state;
          return {
            ...state,
            question: { text: event.question.text, options: event.question.options },
            timerMs: event.question.timerMs,
            myAnswer: null,
            opponentAnswered: false,
          };
        });
      });

    // Duel result — determine outcome and update duel state
    this.ws.duelResult$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrDuelResultEvent) => {
        const currentUserId = this.currentUserIdState();
        // Update duel state for involved players
        this.duelStateState.update((state) => {
          if (!state || state.duelId !== event.duelId) return state;
          let result: BrDuelState['result'] = null;
          if (event.tie) {
            result = 'tie';
          } else if (event.winnerId === currentUserId) {
            result = 'won';
          } else if (event.loserId === currentUserId) {
            result = 'lost';
          }
          return { ...state, opponentAnswered: true, result };
        });
      });

    // Life lost — update lives for current player, trigger pop animation
    this.ws.lifeLost$.pipe(takeUntilDestroyed(destroyRef)).subscribe((event: BrLifeLostEvent) => {
      const currentUserId = this.currentUserIdState();
      if (event.playerId === currentUserId) {
        this.livesState.set(event.lives);
      }
      // Trigger pop animation regardless of who lost
      this.lifeLostRecentlyState.set(event.playerId);
    });

    // Player eliminated — track eliminated players, set spectator mode for current player
    this.ws.playerEliminated$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrPlayerEliminatedEvent) => {
        const currentUserId = this.currentUserIdState();
        this.eliminatedPlayersState.update((ids) =>
          ids.includes(event.playerId) ? ids : [...ids, event.playerId]
        );
        if (event.playerId === currentUserId) {
          this.isSpectatorState.set(true);
          this.duelStateState.set(null);
        }
      });

    // Bubble Pop start — initialize the bubble pop challenge state
    this.ws.bubblePopStart$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrBubblePopStartEvent) => {
        this.bubblePopStateState.set({
          bubbles: event.bubbles.map((b) => ({ number: b.number, x: b.x, y: b.y })),
          timerMs: event.timerMs,
          status: 'active',
        });
      });

    // Bubble Pop ranking — update the challenge state with results
    this.ws.bubblePopRanking$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrBubblePopRankingEvent) => {
        this.bubblePopStateState.update((state) => {
          if (!state) return state;
          return {
            ...state,
            status: 'finished',
            rankings: event.rankings.map((r) => ({
              playerId: r.playerId,
              timeMs: r.timeMs,
              bubblesReached: r.bubblesReached,
            })),
          };
        });
      });

    // Power-up awarded — add to inventory if for current player (max 2)
    this.ws.powerUpAwarded$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrPowerUpAwardedEvent) => {
        const currentUserId = this.currentUserIdState();
        if (event.playerId !== currentUserId) return;
        const newPowerUp: BrPowerUp = {
          id: crypto.randomUUID(),
          type: event.powerUp.type as BrPowerUpType,
          name: event.powerUp.name,
          description: event.powerUp.description,
          consumed: false,
        };
        this.powerUpsState.update((powerUps) => {
          if (powerUps.length >= 2) return powerUps; // inventory full, forfeit
          return [...powerUps, newPowerUp];
        });
      });

    // Curse awarded — add to inventory if for current player (max 3)
    this.ws.curseAwarded$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrCurseAwardedEvent) => {
        const currentUserId = this.currentUserIdState();
        if (event.playerId !== currentUserId) return;
        const newCurse: BrCurseToken = {
          id: crypto.randomUUID(),
          type: event.curse.type as BrCurseType,
          name: event.curse.name,
          description: event.curse.description,
          cast: false,
        };
        this.curseTokensState.update((tokens) => {
          if (tokens.length >= 3) return tokens; // inventory full, forfeit
          return [...tokens, newCurse];
        });
      });

    // Curse cast — mark the curse as cast for the caster
    this.ws.curseCast$.pipe(takeUntilDestroyed(destroyRef)).subscribe((event: BrCurseCastEvent) => {
      const currentUserId = this.currentUserIdState();
      if (event.casterId !== currentUserId) return;
      this.curseTokensState.update((tokens) => {
        const idx = tokens.findIndex((t) => t.type === event.curseType && !t.cast);
        if (idx === -1) return tokens;
        const updated = [...tokens];
        updated[idx] = { ...updated[idx], cast: true };
        return updated;
      });
    });

    // Spectator mode — set isSpectator for the specified player
    this.ws.spectatorMode$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrSpectatorModeEvent) => {
        const currentUserId = this.currentUserIdState();
        if (event.playerId === currentUserId) {
          this.isSpectatorState.set(true);
        }
      });

    // Royale winner — set the winner signal
    this.ws.royaleWinner$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrRoyaleWinnerEvent) => {
        this.royaleWinnerState.set({
          playerId: event.playerId,
          playerName: event.playerName,
          livesRemaining: event.livesRemaining,
        });
      });

    // Round transition — update round number and type
    this.ws.roundTransition$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrRoundTransitionEvent) => {
        this.roundNumberState.set(event.round);
        this.roundTypeState.set(event.type);
      });

    // Curse opportunity — set the list of targetable players
    this.ws.curseOpportunity$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrCurseOpportunityEvent) => {
        this.curseOpportunityTargetsState.set(
          event.targetPlayers.map((p) => ({ id: p.id, name: p.name, lives: p.lives }))
        );
      });

    // Life steal announcement — set for full-screen display
    this.ws.lifeStealAnnouncement$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: BrLifeStealAnnouncementEvent) => {
        this.lifeStealAnnouncementState.set({
          targetName: event.targetName,
          casterName: event.casterName,
        });
      });
  }

  setLobbyState(event: LobbyStateEvent): void {
    this.pinState.set(event.pin);
    this.hostUserIdState.set(event.hostUserId);
    this.playersState.set(
      event.players.map((player) => ({
        userId: player.userId,
        username: player.username ?? player.userId,
        isHost: player.isHost ?? player.userId === event.hostUserId,
      }))
    );
  }

  setCurrentUserId(userId: string): void {
    this.currentUserIdState.set(userId);
  }

  setGameMode(mode: string): void {
    this.gameModeState.set(mode);
    if (mode !== 'forge-classic') {
      this.currentGoldState.set(0);
    }
  }

  /** Sets the current gold total (treasure forge mode). */
  setCurrentGold(gold: number): void {
    this.currentGoldState.set(gold);
  }

  /** Sets the penalty end timestamp (treasure forge mode). Null = no penalty. */
  setPenaltyUntil(ms: number | null): void {
    this.penaltyUntilState.set(ms);
  }

  setRound(event: RoundStartedEvent): void {
    this.pinState.set(event.pin);
    this.sessionIdState.set(event.sessionId);
    this.errorState.set(null);
    this.endedState.set(false);
  }

  setQuestion(event: GameQuestionEvent): void {
    this.pinState.set(event.pin);
    this.sessionIdState.set(event.sessionId);
    this.currentQuestionState.set(event);
    this.selectedAnswerState.set(null);
    this.submissionStateSignal.set('idle');
    this.lastAnswerState.set(null);
    this.lastRoundResultState.set(null);
    this.errorState.set(null);
    // Reset structured-answer drafts on every new question.
    this.draftOrderingState.set([]);
    this.draftMatchingState.set({});
    this.draftTextState.set('');
    // Only start timer for Forge Classic (TF has no per-question timer)
    if (this.gameModeState() === 'forge-classic') {
      this.startClock();
    }
  }

  /** Sets the draft ordering answer (array of option ids in current order). */
  setDraftOrdering(orderedIds: string[]): void {
    this.draftOrderingState.set(orderedIds);
  }

  /** Sets the draft matching answer (leftId → rightId map). */
  setDraftMatching(pairs: Record<string, string>): void {
    this.draftMatchingState.set(pairs);
  }

  /** Sets the draft fill-in-blank answer (raw text). */
  setDraftText(text: string): void {
    this.draftTextState.set(text);
  }

  selectAnswer(optionId: string): void {
    if (this.submissionStateSignal() !== 'idle') {
      return;
    }

    this.selectedAnswerState.set(optionId);
  }

  markPending(): void {
    this.submissionStateSignal.set('pending');
    this.errorState.set(null);
  }

  acceptAnswer(event: AnswerAckEvent): void {
    // Guard: don't transition from 'idle' to 'accepted' — this happens when the
    // host skips a question and the server sends a 0-point answer-ack to players
    // who didn't submit. The 'idle' → 'closed' transition in closeRound handles
    // this case so they see "Time's up!" instead of "Incorrect".
    if (this.submissionStateSignal() === 'idle') {
      this.lastAnswerState.set(event);
      this.errorState.set(null);
      return;
    }

    this.submissionStateSignal.set('accepted');
    this.lastAnswerState.set(event);
    this.lastRoundResultState.set({
      correct: event.correct,
      scoreDelta: event.scoreDelta,
      totalScore: event.totalScore,
    });
    this.errorState.set(null);
  }

  rejectAnswer(event: SocketErrorPayload): void {
    this.submissionStateSignal.set('rejected');
    this.errorState.set(event.error);
  }

  setScoreUpdate(event: ScoreUpdateEvent): void {
    this.leaderboardState.set(this.computeRankDeltas(event.leaderboard));
  }

  setLeaderboard(event: LeaderboardUpdateEvent): void {
    this.leaderboardState.set(this.computeRankDeltas(event.leaderboard));
  }

  closeRound(_event: RoundClosedEvent): void {
    if (this.submissionStateSignal() === 'idle') {
      this.submissionStateSignal.set('closed');
      this.lastRoundResultState.set(null);
    }
  }

  endGame(event: GameEndedEvent): void {
    this.leaderboardState.set(this.computeRankDeltas(event.leaderboard));
    this.endedState.set(true);
    this.currentQuestionState.set(null);
    this.stopClock();
    // Don't reset gold — keep it for final display
  }

  reset(): void {
    this.pinState.set(null);
    this.sessionIdState.set(null);
    this.hostUserIdState.set(null);
    this.playersState.set([]);
    this.currentQuestionState.set(null);
    this.leaderboardState.set([]);
    this.previousRankMap.clear();
    this.previousScoreMap.clear();
    this.selectedAnswerState.set(null);
    this.submissionStateSignal.set('idle');
    this.lastAnswerState.set(null);
    this.lastRoundResultState.set(null);
    this.errorState.set(null);
    this.endedState.set(false);
    this.draftOrderingState.set([]);
    this.draftMatchingState.set({});
    this.draftTextState.set('');
    this.resetBrState();
    this.stopClock();
  }

  /** Resets all Bubbly Royale state for a new game. */
  resetBrState(): void {
    this.livesState.set(3);
    this.startingLivesState.set(3);
    this.duelStateState.set(null);
    this.currentPairingState.set(null);
    this.powerUpsState.set([]);
    this.curseTokensState.set([]);
    this.isSpectatorState.set(false);
    this.bubblePopStateState.set(null);
    this.roundNumberState.set(0);
    this.roundTypeState.set(null);
    this.royaleWinnerState.set(null);
    this.lifeLostRecentlyState.set(null);
    this.lifeStealAnnouncementState.set(null);
    this.eliminatedPlayersState.set([]);
    this.curseOpportunityTargetsState.set([]);
  }

  /** Checks if the current player has a specific power-up type (unconsumed). */
  hasPowerUp(type: string): boolean {
    return this.powerUpsState().some((p) => p.type === type && !p.consumed);
  }

  /** Gets the opponent's user ID from the current duel state, or null if not in a duel. */
  getOpponentId(): string | null {
    const state = this.duelStateState();
    return state?.opponentId ?? null;
  }

  private computeRankDeltas(raw: LeaderboardPlayerEvent[]): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = raw.map((player) => {
      const prevRank = this.previousRankMap.get(player.userId);
      const rankDelta = prevRank !== undefined ? prevRank - player.rank : 0;
      return {
        userId: player.userId,
        username: player.username,
        score: player.score,
        rank: player.rank,
        rankDelta,
      };
    });

    // Compute score deltas by comparing with previous scores
    for (const entry of entries) {
      const prevScore = this.previousScoreMap.get(entry.userId);
      if (prevScore !== undefined) {
        entry.scoreDelta = entry.score - prevScore;
      }
    }

    // Store current state for next round comparison
    this.previousRankMap.clear();
    this.previousScoreMap.clear();
    for (const entry of entries) {
      this.previousRankMap.set(entry.userId, entry.rank);
      this.previousScoreMap.set(entry.userId, entry.score);
    }

    return entries;
  }

  private startClock(): void {
    if (this.timerId) {
      return;
    }

    this.nowMs.set(Date.now());
    this.timerId = setInterval(() => {
      this.nowMs.set(Date.now());
    }, 250);
  }

  private stopClock(): void {
    if (!this.timerId) {
      return;
    }

    clearInterval(this.timerId);
    this.timerId = null;
  }
}
