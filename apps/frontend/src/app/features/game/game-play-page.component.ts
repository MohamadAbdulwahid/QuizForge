import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { buildDisplayName } from '../../shared/utils/display-name';
import { WebsocketService } from '../../core/services/websocket.service';
import { BubblyModalComponent } from '../../shared/ui/bubbly-modal.component';
import { GameStateService } from './services/game-state.service';
import { TreasureForgePlayPageComponent } from './treasure-forge-play-page.component';
import {
  serializeFibAnswer,
  serializeMatchingAnswer,
  serializeOrderingAnswer,
} from '../quiz/types/question-types';
import { OrderingAnswerPanelComponent } from '../quiz/answer-panels/ordering-answer-panel.component';
import { MatchingAnswerPanelComponent } from '../quiz/answer-panels/matching-answer-panel.component';
import { FillInBlankAnswerPanelComponent } from '../quiz/answer-panels/fill-in-blank-answer-panel.component';

interface OptionStyle {
  readonly bgClass: string;
  readonly accentClass: string;
  readonly label: string;
}

const OPTION_STYLES: readonly OptionStyle[] = [
  { bgClass: 'bg-sky-500', accentClass: 'text-sky-300', label: 'A' },
  { bgClass: 'bg-rose-500', accentClass: 'text-rose-300', label: 'B' },
  { bgClass: 'bg-emerald-500', accentClass: 'text-emerald-300', label: 'C' },
  { bgClass: 'bg-violet-500', accentClass: 'text-violet-300', label: 'D' },
  { bgClass: 'bg-amber-500', accentClass: 'text-amber-300', label: 'E' },
  { bgClass: 'bg-fuchsia-500', accentClass: 'text-fuchsia-300', label: 'F' },
];

@Component({
  selector: 'app-game-play-page',
  standalone: true,
  imports: [
    CommonModule,
    BubblyModalComponent,
    TreasureForgePlayPageComponent,
    OrderingAnswerPanelComponent,
    MatchingAnswerPanelComponent,
    FillInBlankAnswerPanelComponent,
  ],
  templateUrl: './game-play-page.component.html',
})
export class GamePlayPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly websocketService = inject(WebsocketService);
  protected readonly gameState = inject(GameStateService);

  // Session-closed modal
  protected readonly showSessionClosedModal = signal(false);
  protected readonly sessionClosedReason = signal('');

  // Visual state
  protected readonly selectedAnswerId = signal<string | null>(null);
  protected readonly showCorrect = signal(false);
  protected readonly showIncorrect = signal(false);
  protected readonly showRoundSummary = signal(false);
  protected readonly reconnecting = this.websocketService.reconnecting;
  private roundSummaryTimeout: ReturnType<typeof setTimeout> | null = null;

  // Track entering animation
  protected readonly optionEntered = signal<Set<string>>(new Set());

  private pin = '';
  private animationTimeouts: ReturnType<typeof setTimeout>[] = [];
  private didConnect = false;

  async ngOnInit(): Promise<void> {
    this.pin = this.route.snapshot.paramMap.get('pin') ?? '';
    await this.authService.whenReady();

    const token = this.authService.accessToken();
    const currentUser = this.authService.currentUser();
    if (!token || !currentUser) {
      return;
    }

    // Bind socket events for all game modes
    this.bindSocketEvents();
    this.websocketService.connect(token);
    this.websocketService.joinGame(this.pin, buildDisplayName(currentUser, 'Player'));
    this.didConnect = true;
  }

  ngOnDestroy(): void {
    this.clearAnimationTimeouts();
    this.clearRoundSummaryTimeout();
    if (this.didConnect) {
      this.websocketService.leaveGame(this.pin, 'game-page-destroy');
      this.websocketService.disconnect();
    }
  }

  /** Returns the option style (color + letter) for a given option index. */
  protected getOptionStyle(index: number): OptionStyle {
    return OPTION_STYLES[index % OPTION_STYLES.length];
  }

  /** Returns Tailwind classes for the answer options grid based on option count. */
  protected getAnswerGridClass(count: number): string {
    const base = 'grid w-full max-w-5xl gap-3 sm:gap-4 md:gap-5';
    if (count <= 2) {
      return `${base} grid-cols-1`;
    }
    if (count <= 4) {
      return `${base} grid-cols-1 sm:grid-cols-2`;
    }
    return `${base} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  }

  /** Returns full Tailwind class string for a single option button. */
  protected getOptionClasses(index: number, disabled: boolean): string {
    const style = this.getOptionStyle(index);
    const layout =
      'flex min-h-24 items-center gap-3 rounded-3xl px-4 py-4 text-left shadow-2xl sm:min-h-28 sm:gap-4 sm:px-6 sm:py-5';
    const state = disabled
      ? 'cursor-not-allowed opacity-70'
      : 'transition-transform active:scale-95';
    return `${layout} ${style.bgClass} ${state}`;
  }

  /** Selects an answer tile — immediately submits (no separate submit button). */
  protected selectAnswer(optionId: string): void {
    if (this.gameState.submissionState() !== 'idle' || this.gameState.timeRemainingMs() <= 0) {
      return;
    }

    this.selectedAnswerId.set(optionId);
    this.gameState.markPending();

    const question = this.gameState.currentQuestion();
    if (!question) {
      return;
    }

    this.websocketService.submitAnswer(this.pin, question.sessionId, question.questionId, optionId);
  }

  /**
   * Submits a structured answer (ordering, matching, fill-in-blank). The
   * draft is read from the game state, serialized to the canonical string
   * the backend expects, and sent over the WebSocket.
   */
  protected submitStructured(): void {
    const state = this.gameState;
    if (state.submissionState() !== 'idle' || state.timeRemainingMs() <= 0) {
      return;
    }

    const question = state.currentQuestion();
    if (!question) {
      return;
    }

    let serialized: string | null = null;
    switch (question.type) {
      case 'ordering': {
        const order = state.draftOrdering();
        if (order.length === 0) {
          return;
        }
        serialized = serializeOrderingAnswer([...order]);
        break;
      }
      case 'matching': {
        const pairs = state.draftMatching();
        serialized = serializeMatchingAnswer({ ...pairs });
        break;
      }
      case 'fill-in-blank': {
        const text = state.draftText();
        if (text.trim().length === 0) {
          return;
        }
        serialized = serializeFibAnswer(text);
        break;
      }
      default:
        return;
    }

    if (serialized === null) {
      return;
    }

    state.markPending();
    this.websocketService.submitAnswer(
      this.pin,
      question.sessionId,
      question.questionId,
      serialized
    );
  }

  /**
   * Whether the current structured question has a valid answer ready
   * (ordering: at least 1 item, matching: any pairs, fill-in-blank: non-blank).
   * Used by the SUBMIT button's disabled state.
   */
  protected readonly canSubmitStructured = computed(() => {
    const state = this.gameState;
    const question = state.currentQuestion();
    if (!question) {
      return false;
    }
    if (state.submissionState() !== 'idle' || state.timeRemainingMs() <= 0) {
      return false;
    }
    switch (question.type) {
      case 'ordering':
        return state.draftOrdering().length > 0;
      case 'matching':
        return Object.keys(state.draftMatching()).length > 0;
      case 'fill-in-blank':
        return state.draftText().trim().length > 0;
      default:
        return false;
    }
  });

  /** True when the current question is one of the structured types. */
  protected readonly isStructuredQuestion = computed(() => {
    const t = this.gameState.currentQuestion()?.type;
    return t === 'ordering' || t === 'matching' || t === 'fill-in-blank';
  });

  protected abs(value: number | undefined): number {
    return value ? Math.abs(value) : 0;
  }

  /** Shows correct/incorrect feedback for 2 seconds after answer ack. */
  protected onAnswerResult(correct: boolean): void {
    if (correct) {
      this.showCorrect.set(true);
      setTimeout(() => this.showCorrect.set(false), 2000);
    } else {
      this.showIncorrect.set(true);
      setTimeout(() => this.showIncorrect.set(false), 2000);
    }
  }

  /**
   * Triggers staggered entrance animation:
   * - True/false: both appear at once
   * - Multiple choice: one by one (68ms per character)
   */
  private animateOptionsIn(): void {
    this.clearAnimationTimeouts();

    const question = this.gameState.currentQuestion();
    if (!question) {
      return;
    }

    this.optionEntered.set(new Set());

    if (question.type === 'true-false') {
      this.optionEntered.set(new Set(question.options.map((o) => o.id)));
      return;
    }

    // Staggered entry
    let delay = 0;
    for (const option of question.options) {
      const timeout = setTimeout(() => {
        this.optionEntered.update((prev) => {
          const next = new Set(prev);
          next.add(option.id);
          return next;
        });
      }, delay);
      this.animationTimeouts.push(timeout);
      delay += 68 * option.text.length;
    }
  }

  private clearAnimationTimeouts(): void {
    for (const t of this.animationTimeouts) {
      clearTimeout(t);
    }
    this.animationTimeouts = [];
  }

  private clearRoundSummaryTimeout(): void {
    if (this.roundSummaryTimeout) {
      clearTimeout(this.roundSummaryTimeout);
      this.roundSummaryTimeout = null;
    }
  }

  protected dismissSessionClosed(): void {
    this.showSessionClosedModal.set(false);
    void this.router.navigateByUrl('/dashboard');
  }

  private bindSocketEvents(): void {
    this.websocketService.lobbyState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.gameState.setLobbyState(event));
    this.websocketService.roundStarted$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.gameState.setRound(event));
    this.websocketService.question$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      this.gameState.setQuestion(event);
      // Reset visual states
      this.selectedAnswerId.set(null);
      this.showCorrect.set(false);
      this.showIncorrect.set(false);
      this.showRoundSummary.set(false);
      this.clearRoundSummaryTimeout();
      this.animateOptionsIn();
    });
    this.websocketService.answerAck$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameState.acceptAnswer(event);
        this.onAnswerResult(event.correct);
      });
    this.websocketService.answerRejected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.gameState.rejectAnswer(event));
    this.websocketService.scoreUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.gameState.setScoreUpdate(event));
    this.websocketService.leaderboardUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.gameState.setLeaderboard(event));
    this.websocketService.roundClosed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameState.closeRound(event);
        this.showRoundSummary.set(true);
        this.clearRoundSummaryTimeout();
        this.roundSummaryTimeout = setTimeout(() => {
          this.showRoundSummary.set(false);
        }, 3000);
      });
    this.websocketService.gameEnded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        // Forge Classic handles game-ended directly; TF mode handled by child component
        if (this.gameState.gameMode() === 'treasure-forge') return;
        this.gameState.endGame(event);
        void this.router.navigate(['/leaderboards'], {
          state: {
            leaderboard: event.leaderboard,
            quizTitle: 'Game Complete',
            pin: this.pin,
          },
        });
      });
    this.websocketService.sessionClosed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        // Forge Classic shows a modal; TF mode handled by child component
        if (this.gameState.gameMode() === 'treasure-forge') return;
        this.websocketService.disconnect();
        this.sessionClosedReason.set(event.reason);
        this.showSessionClosedModal.set(true);
      });
  }
}
