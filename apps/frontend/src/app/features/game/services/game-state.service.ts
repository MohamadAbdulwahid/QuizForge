import { computed, Injectable, signal } from '@angular/core';
import type {
  AnswerAckEvent,
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

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly pinState = signal<string | null>(null);
  private readonly sessionIdState = signal<number | null>(null);
  private readonly hostUserIdState = signal<string | null>(null);
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
  private timerId: ReturnType<typeof setInterval> | null = null;

  readonly pin = this.pinState.asReadonly();
  readonly sessionId = this.sessionIdState.asReadonly();
  readonly hostUserId = this.hostUserIdState.asReadonly();
  readonly players = this.playersState.asReadonly();
  readonly currentQuestion = this.currentQuestionState.asReadonly();
  readonly leaderboard = this.leaderboardState.asReadonly();
  readonly selectedAnswer = this.selectedAnswerState.asReadonly();
  readonly submissionState = this.submissionStateSignal.asReadonly();
  readonly lastAnswer = this.lastAnswerState.asReadonly();
  readonly lastRoundResult = this.lastRoundResultState.asReadonly();
  readonly errorMessage = this.errorState.asReadonly();
  readonly ended = this.endedState.asReadonly();
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
    this.startClock();
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
    this.stopClock();
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
