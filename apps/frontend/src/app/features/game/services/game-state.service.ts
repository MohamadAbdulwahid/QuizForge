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

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly pinState = signal<string | null>(null);
  private readonly sessionIdState = signal<number | null>(null);
  private readonly hostUserIdState = signal<string | null>(null);
  private readonly playersState = signal<GamePlayerState[]>([]);
  private readonly currentQuestionState = signal<GameQuestionEvent | null>(null);
  private readonly leaderboardState = signal<LeaderboardPlayerEvent[]>([]);
  private readonly selectedAnswerState = signal<string | null>(null);
  private readonly submissionStateSignal = signal<AnswerSubmissionState>('idle');
  private readonly lastAnswerState = signal<AnswerAckEvent | null>(null);
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
    this.submissionStateSignal.set('accepted');
    this.lastAnswerState.set(event);
    this.errorState.set(null);
  }

  rejectAnswer(event: SocketErrorPayload): void {
    this.submissionStateSignal.set('rejected');
    this.errorState.set(event.error);
  }

  setScoreUpdate(event: ScoreUpdateEvent): void {
    this.leaderboardState.set(event.leaderboard);
  }

  setLeaderboard(event: LeaderboardUpdateEvent): void {
    this.leaderboardState.set(event.leaderboard);
  }

  closeRound(_event: RoundClosedEvent): void {
    if (this.submissionStateSignal() === 'idle') {
      this.submissionStateSignal.set('closed');
    }
  }

  endGame(event: GameEndedEvent): void {
    this.leaderboardState.set(event.leaderboard);
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
    this.selectedAnswerState.set(null);
    this.submissionStateSignal.set('idle');
    this.lastAnswerState.set(null);
    this.errorState.set(null);
    this.endedState.set(false);
    this.stopClock();
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
