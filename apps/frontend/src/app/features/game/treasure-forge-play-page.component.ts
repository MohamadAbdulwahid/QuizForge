import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { WebsocketService } from '../../core/services/websocket.service';
import { GameStateService } from './services/game-state.service';
import {
  ChestPickerComponent,
  ChestOption,
  ChestRevealEvent,
} from '../../shared/ui/chest-picker.component';
import { GoldCounterComponent } from '../../shared/ui/gold-counter.component';
import {
  StealTargetPickerComponent,
  TargetPlayer,
  TargetSelectedEvent,
} from '../../shared/ui/steal-target-picker.component';
import {
  ChestEffectAnnouncementComponent,
  ChestEffect,
} from '../../shared/ui/chest-effect-announcement.component';
import {
  serializeFibAnswer,
  serializeMatchingAnswer,
  serializeOrderingAnswer,
} from '../quiz/types/question-types';
import { OrderingAnswerPanelComponent } from '../quiz/answer-panels/ordering-answer-panel.component';
import { MatchingAnswerPanelComponent } from '../quiz/answer-panels/matching-answer-panel.component';
import { FillInBlankAnswerPanelComponent } from '../quiz/answer-panels/fill-in-blank-answer-panel.component';

const PENALTY_DURATION_MS = 3000;
const FEEDBACK_DELAY_MS = 1000;
// const EFFECT_DELAY_MS = 2500; // unused - kept for reference

const OPTION_COLORS = [
  'bg-rose-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-fuchsia-500',
] as const;

@Component({
  selector: 'app-treasure-forge-play-page',
  standalone: true,
  imports: [
    CommonModule,
    ChestPickerComponent,
    GoldCounterComponent,
    StealTargetPickerComponent,
    ChestEffectAnnouncementComponent,
    OrderingAnswerPanelComponent,
    MatchingAnswerPanelComponent,
    FillInBlankAnswerPanelComponent,
  ],
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: linear-gradient(180deg, #b8892e 0%, #8b6914 50%, #5a4408 100%);
      }

      @keyframes tf-fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes tf-pop-in {
        from {
          transform: scale(0.8);
          opacity: 0;
        }
        to {
          transform: scale(1);
          opacity: 1;
        }
      }

      @keyframes tf-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.4;
        }
      }

      .tf-feedback-overlay {
        animation: tf-fade-in 0.3s ease-out;
      }

      .tf-feedback-card {
        animation: tf-pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .tf-waiting-pulse {
        animation: tf-pulse 1.5s ease-in-out infinite;
      }
    `,
  ],
  template: `
    <div class="flex min-h-screen w-full flex-col">
      <!-- ── Top bar: question counter (left) + gold counter (right) ── -->
      <header
        class="relative z-10 flex items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5"
      >
        <div class="flex items-center gap-3">
          <div
            class="rounded-full bg-black/30 px-5 py-2 text-base font-bold text-white shadow-lg backdrop-blur-sm sm:px-6 sm:py-2.5 sm:text-lg"
            style="box-shadow: 0 4px 0 0 rgba(0, 0, 0, 0.4);"
          >
            @if (currentQuestion(); as q) {
              Question {{ q.order }} / {{ q.totalQuestions }}
            } @else if (!waitingForQuestion()) {
              Get ready!
            } @else {
              Loading...
            }
          </div>
        </div>

        <app-gold-counter
          [amount]="gold()"
          [delta]="goldDelta()"
        />
      </header>

      <!-- ── Main content area (with right padding on desktop for fixed leaderboard) ── -->
      <main
        class="relative z-10 flex flex-1 flex-col items-center justify-start gap-4 px-4 pb-6 sm:gap-6 lg:pr-[18rem]"
      >
        @if (currentQuestion(); as q) {
          <div class="flex w-full max-w-5xl flex-col items-center gap-4 sm:gap-6">
            <!-- Question text -->
            <div
              class="w-full rounded-2xl bg-white/5 px-4 py-4 text-center backdrop-blur-sm sm:px-6 sm:py-5"
            >
              <h2
                class="font-display text-3xl font-bold text-white drop-shadow-lg sm:text-4xl md:text-5xl"
              >
                {{ q.text }}
              </h2>
            </div>

            <!-- Answer options: dynamic grid based on count. MC/TF keep
                 immediate-submit on click; structured types render their
                 own panel and rely on the SUBMIT bar below. -->
            @switch (q.type) {
              @case ('multiple-choice') {
                @if (!answered()) {
                  <div [class]="getAnswerGridClass(q.options.length)">
                    @for (option of q.options; track option.id; let i = $index) {
                      <button
                        type="button"
                        [class]="getOptionClasses(i, false)"
                        [class.ring-4]="selectedAnswer() === option.id"
                        [class.ring-white]="selectedAnswer() === option.id"
                        [disabled]="showFeedback()"
                        (click)="selectAnswer(option.id)"
                      >
                        <span
                          class="font-display text-5xl font-black text-white drop-shadow-md sm:text-6xl"
                        >
                          {{ getOptionLetter(i) }}
                        </span>
                        <span
                          class="flex-1 text-xl font-bold text-white drop-shadow-md sm:text-2xl"
                        >
                          {{ option.text }}
                        </span>
                      </button>
                    }
                  </div>
                } @else {
                  <div [class]="getAnswerGridClass(q.options.length, true)">
                    @for (option of q.options; track option.id; let i = $index) {
                      <button
                        type="button"
                        [class]="getOptionClasses(i, true)"
                        [class.ring-4]="selectedAnswer() === option.id"
                        [class.ring-white]="selectedAnswer() === option.id"
                        disabled
                      >
                        <span
                          class="font-display text-5xl font-black text-white drop-shadow-md sm:text-6xl"
                        >
                          {{ getOptionLetter(i) }}
                        </span>
                        <span
                          class="flex-1 text-xl font-bold text-white drop-shadow-md sm:text-2xl"
                        >
                          {{ option.text }}
                        </span>
                      </button>
                    }
                  </div>
                }
              }
              @case ('true-false') {
                @if (!answered()) {
                  <div [class]="getAnswerGridClass(q.options.length)">
                    @for (option of q.options; track option.id; let i = $index) {
                      <button
                        type="button"
                        [class]="getOptionClasses(i, false)"
                        [class.ring-4]="selectedAnswer() === option.id"
                        [class.ring-white]="selectedAnswer() === option.id"
                        [disabled]="showFeedback()"
                        (click)="selectAnswer(option.id)"
                      >
                        <span
                          class="font-display text-5xl font-black text-white drop-shadow-md sm:text-6xl"
                        >
                          {{ getOptionLetter(i) }}
                        </span>
                        <span
                          class="flex-1 text-xl font-bold text-white drop-shadow-md sm:text-2xl"
                        >
                          {{ option.text }}
                        </span>
                      </button>
                    }
                  </div>
                } @else {
                  <div [class]="getAnswerGridClass(q.options.length, true)">
                    @for (option of q.options; track option.id; let i = $index) {
                      <button
                        type="button"
                        [class]="getOptionClasses(i, true)"
                        [class.ring-4]="selectedAnswer() === option.id"
                        [class.ring-white]="selectedAnswer() === option.id"
                        disabled
                      >
                        <span
                          class="font-display text-5xl font-black text-white drop-shadow-md sm:text-6xl"
                        >
                          {{ getOptionLetter(i) }}
                        </span>
                        <span
                          class="flex-1 text-xl font-bold text-white drop-shadow-md sm:text-2xl"
                        >
                          {{ option.text }}
                        </span>
                      </button>
                    }
                  </div>
                }
              }
              @case ('ordering') {
                <app-ordering-answer-panel
                  class="w-full"
                  [items]="q.options"
                  [value]="gameState.draftOrdering()"
                  [disabled]="answered()"
                  (valueChange)="gameState.setDraftOrdering($event)"
                />
              }
              @case ('matching') {
                <app-matching-answer-panel
                  class="w-full"
                  [leftItems]="q.options"
                  [rightItems]="q.rightOptions ?? []"
                  [value]="gameState.draftMatching()"
                  [disabled]="answered()"
                  (valueChange)="gameState.setDraftMatching($event)"
                />
              }
              @case ('fill-in-blank') {
                <app-fill-in-blank-answer-panel
                  class="w-full"
                  [value]="gameState.draftText()"
                  [disabled]="answered()"
                  (valueChange)="gameState.setDraftText($event)"
                  (submitRequest)="submitStructured()"
                />
              }
            }

            <!-- Sticky-style SUBMIT bar for structured question types.
                 Shown only when the player hasn't submitted yet. -->
            @if (isStructuredQuestion() && !answered()) {
              <div class="mt-2 w-full">
                <button
                  type="button"
                  class="qf-tactile qf-button-accent w-full rounded-2xl px-6 py-5 text-2xl font-black text-white sm:text-3xl"
                  [disabled]="!canSubmitStructured()"
                  (click)="submitStructured()"
                >
                  <span class="flex items-center justify-center gap-2">
                    <span>SUBMIT ANSWER</span>
                    <span aria-hidden="true">✓</span>
                  </span>
                </button>
              </div>
            }
          </div>

          <!-- Chest picker after correct answer -->
          @if (showChests()) {
            <div class="w-full max-w-3xl rounded-3xl bg-black/30 p-6 shadow-2xl backdrop-blur-md">
              <h3 class="font-display mb-2 text-center text-2xl font-bold text-white sm:text-3xl">
                Choose a Chest!
              </h3>
              <p class="mb-4 text-center text-base text-white/70">Pick one to reveal your reward</p>
              <app-chest-picker
                [chests]="chests()"
                [disabled]="chestPicked()"
                (chestSelected)="onChestSelected($event)"
              />
            </div>
          }

          <!-- Penalty banner for wrong answers -->
          @if (penaltyActive()) {
            <div
              class="w-full max-w-2xl rounded-3xl border-2 border-red-400/50 bg-red-900/40 p-6 text-center shadow-2xl backdrop-blur-md"
            >
              <h3 class="font-display text-3xl font-bold text-red-200 sm:text-4xl">Too slow!</h3>
              <p class="mt-2 text-base font-semibold text-red-200/80 sm:text-lg">
                Wait {{ penaltyRemaining() }}s before the next question
              </p>
              <div
                class="font-display mt-3 text-5xl font-bold text-red-300 sm:text-6xl"
                style="font-variant-numeric: tabular-nums;"
              >
                {{ penaltyRemaining() }}
              </div>
            </div>
          }
        } @else if (waitingForQuestion()) {
          <!-- Waiting for next question -->
          <div class="flex flex-1 flex-col items-center justify-center text-center">
            <div class="tf-waiting-pulse mb-4 text-8xl sm:text-9xl">💎</div>
            <p class="font-display text-3xl font-bold text-white/70 sm:text-4xl md:text-5xl">
              Loading next question...
            </p>
          </div>
        }

        <!-- ── Mobile/Tablet leaderboard (below main content) ── -->
        @if (leaderboard().length > 0) {
          <section class="w-full max-w-3xl lg:hidden">
            <div class="rounded-3xl bg-black/40 p-5 shadow-2xl backdrop-blur-md">
              <h3 class="font-display mb-4 text-2xl font-bold text-amber-300 sm:text-3xl">
                🏆 Leaderboard
              </h3>
              <div class="flex flex-col gap-2">
                @for (entry of leaderboard().slice(0, 8); track entry.userId) {
                  <div
                    class="flex items-center justify-between rounded-2xl px-4 py-3"
                    [class.bg-amber-500/25]="entry.rank === 1"
                    [class.bg-white/10]="entry.rank !== 1"
                    [class.border]="entry.userId === currentUserId()"
                    [class.border-amber-400/40]="entry.userId === currentUserId()"
                  >
                    <div class="flex items-center gap-3">
                      <span
                        class="text-base font-bold sm:text-lg"
                        [class.text-amber-300]="entry.rank === 1"
                        [class.text-white/40]="entry.rank !== 1"
                      >
                        #{{ entry.rank }}
                      </span>
                      <span class="text-base font-bold text-white/80 sm:text-lg">
                        {{ entry.username }}
                      </span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span class="text-lg sm:text-xl">🪙</span>
                      <span class="font-display text-lg font-bold text-amber-300 sm:text-xl">
                        {{ entry.score }}
                      </span>
                    </div>
                  </div>
                }
              </div>
            </div>
          </section>
        }
      </main>
    </div>

    <!-- ── Leaderboard sidebar (desktop only) ── -->
    @if (leaderboard().length > 0) {
      <aside
        class="hidden lg:fixed lg:top-0 lg:right-0 lg:z-20 lg:block lg:h-full lg:w-72 lg:overflow-y-auto lg:border-l lg:border-white/10 lg:bg-black/40 lg:p-5 lg:backdrop-blur-md"
      >
        <h3 class="font-display mb-5 text-2xl font-bold text-amber-300 sm:text-3xl">
          🏆 Leaderboard
        </h3>
        <div class="flex flex-col gap-2">
          @for (entry of leaderboard().slice(0, 8); track entry.userId) {
            <div
              class="flex items-center justify-between rounded-2xl px-4 py-3"
              [class.bg-amber-500/25]="entry.rank === 1"
              [class.bg-white/10]="entry.rank !== 1"
              [class.border]="entry.userId === currentUserId()"
              [class.border-amber-400/40]="entry.userId === currentUserId()"
            >
              <div class="flex items-center gap-3">
                <span
                  class="text-base font-bold sm:text-lg"
                  [class.text-amber-300]="entry.rank === 1"
                  [class.text-white/40]="entry.rank !== 1"
                >
                  #{{ entry.rank }}
                </span>
                <span class="text-base font-bold text-white/80 sm:text-lg">
                  {{ entry.username }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-lg sm:text-xl">🪙</span>
                <span class="font-display text-lg font-bold text-amber-300 sm:text-xl">
                  {{ entry.score }}
                </span>
              </div>
            </div>
          }
        </div>
      </aside>
    }

    <!-- ── Feedback overlay (correct/incorrect) ── -->
    @if (showFeedback()) {
      <div
        class="tf-feedback-overlay fixed inset-0 z-50 flex items-center justify-center"
        [class.bg-emerald-500/20]="lastAnswerCorrect()"
        [class.bg-rose-500/20]="!lastAnswerCorrect()"
        style="backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
      >
        <div
          class="tf-feedback-card rounded-3xl px-12 py-8 text-center shadow-2xl sm:px-16 sm:py-10"
          [class.bg-emerald-500]="lastAnswerCorrect()"
          [class.bg-rose-500]="!lastAnswerCorrect()"
        >
          <span class="text-6xl sm:text-7xl">
            {{ lastAnswerCorrect() ? '✅' : '❌' }}
          </span>
          <p class="font-display mt-3 text-4xl font-bold text-white drop-shadow-lg sm:text-5xl">
            {{ lastAnswerCorrect() ? 'Correct!' : 'Incorrect' }}
          </p>
          @if (lastAnswerCorrect()) {
            <p class="mt-2 text-xl font-semibold text-emerald-100 sm:text-2xl">
              Preparing chests...
            </p>
          } @else {
            <p class="mt-2 text-xl font-semibold text-rose-100 sm:text-2xl">3 second penalty</p>
          }
        </div>
      </div>
    }

    <!-- ── Steal/Swap target picker ── -->
    <app-steal-target-picker
      [visible]="showTargetPicker()"
      [players]="targetPlayers()"
      [actionType]="targetActionType()"
      [stealPercent]="targetStealPercent()"
      (targetSelected)="onTargetSelected($event)"
      (cancelled)="onTargetCancelled()"
    />

    <!-- ── Chest effect announcement ── -->
    <app-chest-effect-announcement
      [effect]="currentEffect()"
      (dismissed)="onEffectDismissed()"
    />
  `,
})
export class TreasureForgePlayPageComponent {
  private readonly router = inject(Router);
  private readonly websocketService = inject(WebsocketService);
  protected readonly gameState = inject(GameStateService);
  private readonly destroyRef = inject(DestroyRef);

  // Question state
  protected readonly currentQuestion = computed(() => this.gameState.currentQuestion());
  protected readonly leaderboard = computed(() => this.gameState.leaderboard());
  protected readonly currentUserId = computed(() => this.gameState.currentUserId());

  // Answer state
  protected readonly selectedAnswer = signal<string | null>(null);
  protected readonly answered = signal(false);

  // Feedback
  protected readonly showFeedback = signal(false);
  protected readonly lastAnswerCorrect = signal(false);

  // Chests
  protected readonly chests = signal<readonly ChestOption[]>([]);
  protected readonly showChests = signal(false);
  protected readonly chestPicked = signal(false);

  // Penalty
  protected readonly penaltyActive = signal(false);
  protected readonly penaltyRemaining = signal(0);

  // Effect
  protected readonly currentEffect = signal<ChestEffect | null>(null);

  // Target picker
  protected readonly showTargetPicker = signal(false);
  protected readonly targetPlayers = signal<readonly TargetPlayer[]>([]);
  protected readonly targetActionType = signal<'steal' | 'swap'>('steal');
  protected readonly targetStealPercent = signal(10);

  // Waiting
  protected readonly waitingForQuestion = signal(true);

  // Gold
  protected readonly gold = signal(0);
  protected readonly goldDelta = signal(0);

  // Whether the current outcome requires a target pick (steal/swap)
  private pendingStealSwapOutcome = false;
  private penaltyTimer: ReturnType<typeof setTimeout> | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private effectTimer: ReturnType<typeof setTimeout> | null = null;
  private pin = '';

  constructor() {
    this.setupSubscriptions();
  }

  // ── Answer actions ──

  protected selectAnswer(answerId: string): void {
    if (this.answered()) return;
    this.selectedAnswer.set(answerId);
    this.answered.set(true);

    const question = this.currentQuestion();
    const sessionId = this.gameState.sessionId();
    if (!question || !this.pin || !sessionId) return;

    this.websocketService.submitAnswer(this.pin, sessionId, question.questionId, answerId);
  }

  /**
   * Submits a structured answer (ordering, matching, fill-in-blank). The
   * draft is read from the game state, serialized, and sent over WS.
   * Mirrors `selectAnswer` for the MC immediate-submit path: marks the
   * player as answered and shows the feedback overlay.
   */
  protected submitStructured(): void {
    if (this.answered()) return;
    const state = this.gameState;
    const question = this.currentQuestion();
    const sessionId = state.sessionId();
    if (!question || !this.pin || !sessionId) return;

    let serialized: string | null = null;
    switch (question.type) {
      case 'ordering': {
        const order = state.draftOrdering();
        if (order.length === 0) return;
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
        if (text.trim().length === 0) return;
        serialized = serializeFibAnswer(text);
        break;
      }
      default:
        return;
    }

    if (serialized === null) return;

    this.answered.set(true);
    this.websocketService.submitAnswer(this.pin, sessionId, question.questionId, serialized);
  }

  /** Whether the current question is one of the structured types. */
  protected readonly isStructuredQuestion = computed(() => {
    const t = this.gameState.currentQuestion()?.type;
    return t === 'ordering' || t === 'matching' || t === 'fill-in-blank';
  });

  /** Whether the structured answer is valid (non-empty) and ready to submit. */
  protected readonly canSubmitStructured = computed(() => {
    const state = this.gameState;
    const question = state.currentQuestion();
    if (!question || this.answered()) return false;
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

  protected onChestSelected(event: ChestRevealEvent): void {
    if (this.chestPicked()) return;
    this.chestPicked.set(true);

    const question = this.currentQuestion();
    const sessionId = this.gameState.sessionId();
    if (!question || !this.pin || !sessionId) return;

    this.websocketService.selectChest(this.pin, sessionId, question.questionId, event.index);
  }

  protected onTargetSelected(event: TargetSelectedEvent): void {
    this.showTargetPicker.set(false);
    this.pendingStealSwapOutcome = false;

    const question = this.currentQuestion();
    const sessionId = this.gameState.sessionId();
    if (!question || !this.pin || !sessionId) return;

    this.waitingForQuestion.set(true);
    this.websocketService.selectStealTarget(
      this.pin,
      sessionId,
      question.questionId,
      event.targetUserId
    );
  }

  protected onTargetCancelled(): void {
    this.showTargetPicker.set(false);
    this.pendingStealSwapOutcome = false;
    this.requestNextQuestion();
  }

  protected onEffectDismissed(): void {
    this.currentEffect.set(null);
    // Always advance to next question after chest effect is dismissed.
    // For steal/swap, the target-needed event was already handled before
    // the chest-effect (result) arrived — no need to wait.
    this.requestNextQuestion();
  }

  // ── Layout helpers ──

  /**
   * Returns the full Tailwind class string for the answer options grid.
   * ≤2 → 1 col, 3–4 → 2 cols, 5–6 → 3 cols.
   */
  protected getAnswerGridClass(count: number, dimmed = false): string {
    const base = 'grid w-full max-w-5xl gap-3 sm:gap-4 md:gap-5';
    const opacity = dimmed ? ' opacity-70' : '';
    if (count <= 2) return base + ' grid-cols-1' + opacity;
    if (count <= 4) return base + ' grid-cols-1 sm:grid-cols-2' + opacity;
    return base + ' grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' + opacity;
  }

  /**
   * Returns the full Tailwind class string for a single answer option button.
   * Combines layout, color (cycles through 6 vibrant colors), and state styles.
   */
  protected getOptionClasses(i: number, disabled: boolean): string {
    const layout =
      'flex min-h-28 items-center gap-3 rounded-3xl px-4 py-4 text-left shadow-2xl sm:min-h-32 sm:gap-4 sm:px-6 sm:py-5';
    const color = OPTION_COLORS[i % OPTION_COLORS.length];
    const state = disabled
      ? 'cursor-not-allowed opacity-70'
      : 'transition-transform active:scale-95';
    return `${layout} ${color} ${state}`;
  }

  /**
   * Returns the letter label (A, B, C, ...) for an option at index i.
   */
  protected getOptionLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  // ── Subscriptions ──

  private setupSubscriptions(): void {
    // Current question from server
    this.websocketService.question$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      this.gameState.setQuestion(event);
      this.pin = event.pin;
      this.resetForNewQuestion();
      this.waitingForQuestion.set(false);
    });

    // Answer acknowledgement
    this.websocketService.answerAck$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameState.acceptAnswer(event);
        this.lastAnswerCorrect.set(event.correct);
        this.showFeedback.set(true);

        // Sync gold from totalScore (may be 0 in TF, but useful to track)
        this.gold.set(event.totalScore);

        if (event.correct) {
          // Correct → show feedback, then chests appear after chests-revealed event
          this.feedbackTimer = setTimeout(() => {
            this.showFeedback.set(false);
          }, FEEDBACK_DELAY_MS);
        } else {
          // Incorrect → show feedback, then penalty
          this.feedbackTimer = setTimeout(() => {
            this.showFeedback.set(false);
            this.startPenalty();
          }, FEEDBACK_DELAY_MS);
        }
      });

    // Chests revealed (only for correct answers)
    this.websocketService.chestsRevealed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.chests.set(event.chests);
        this.showChests.set(true);
      });

    // Chest effect outcome
    this.websocketService.chestEffect$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.showChests.set(false);
        this.gold.set(event.newTotal);
        this.goldDelta.set(event.goldDelta);
        this.currentEffect.set({
          outcomeType: event.outcomeType,
          outcomeValue: event.outcomeValue,
          label: event.label,
          goldDelta: event.goldDelta,
          newTotal: event.newTotal,
          targetUsername: event.targetUsername,
        });

        // Auto-dismiss effect after 2.5 seconds
        this.clearTimers();
        this.effectTimer = setTimeout(() => {
          this.onEffectDismissed();
        }, 2500);

        // chest-effect for steal/swap is the RESULT after target was already selected.
        // The target-needed event has already been handled — proceed to next question.
        this.pendingStealSwapOutcome = false;
      });

    // Target needed (steal/swap)
    this.websocketService.targetNeeded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.pendingStealSwapOutcome = false;
        this.targetActionType.set(event.outcomeType);
        this.targetStealPercent.set(event.stealPercent ?? 10);

        const players = this.leaderboard()
          .filter((entry) => entry.userId !== this.currentUserId())
          .map(
            (entry) =>
              ({
                userId: entry.userId,
                username: entry.username,
                gold: entry.score,
              }) as TargetPlayer
          );

        this.targetPlayers.set(players);
        this.showTargetPicker.set(true);
      });

    // Gold updates (refresh gold + leaderboard)
    this.websocketService.goldUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.playerId === this.currentUserId()) {
          // Don't update gold while chest effect is showing (chestEffect$ handles it)
          if (!this.currentEffect()) {
            this.gold.set(event.newTotal);
            this.goldDelta.set(event.goldDelta);
          }
        }

        // Always update the leaderboard from gold-update events,
        // regardless of which player triggered it.
        this.gameState.setLeaderboard({
          pin: event.pin,
          sessionId: event.sessionId,
          leaderboard: event.leaderboard,
        });
      });

    // Leaderboard updates
    this.websocketService.leaderboardUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameState.setLeaderboard(event);
      });

    // Game ended
    this.websocketService.gameEnded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameState.endGame(event);
        void this.router.navigate(['/leaderboards'], {
          state: {
            leaderboard: event.leaderboard,
            quizTitle: 'Treasure Forge',
            pin: this.pin,
          },
        });
      });

    // Session closed
    this.websocketService.sessionClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.websocketService.disconnect();
      void this.router.navigateByUrl('/dashboard');
    });

    // Socket error
    this.websocketService.socketError$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      // Non-critical in TF mode
    });

    // Request first question when game is confirmed started.
    // Uses ReplaySubject(1) so this fires even if game-started arrived
    // before the component was created.
    this.websocketService.gameStarted$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pin = this.gameState.pin() ?? '';
      if (this.pin) {
        this.requestNextQuestion();
      }
    });
  }

  // ── Helpers ──

  private requestNextQuestion(): void {
    this.resetForNewQuestion();
    this.waitingForQuestion.set(true);
    if (this.pin) {
      this.websocketService.requestNextQuestion(this.pin);
    }
  }

  private startPenalty(): void {
    this.penaltyActive.set(true);
    this.penaltyRemaining.set(Math.ceil(PENALTY_DURATION_MS / 1000));

    // Countdown display update every second
    const countdownInterval = setInterval(() => {
      this.penaltyRemaining.update((r) => Math.max(0, r - 1));
    }, 1000);

    this.penaltyTimer = setTimeout(() => {
      this.penaltyActive.set(false);
      this.penaltyRemaining.set(0);
      clearInterval(countdownInterval);
      this.requestNextQuestion();
    }, PENALTY_DURATION_MS);
  }

  private resetForNewQuestion(): void {
    this.selectedAnswer.set(null);
    this.answered.set(false);
    this.showFeedback.set(false);
    this.lastAnswerCorrect.set(false);
    this.chests.set([]);
    this.showChests.set(false);
    this.chestPicked.set(false);
    this.penaltyActive.set(false);
    this.penaltyRemaining.set(0);
    this.showTargetPicker.set(false);
    this.pendingStealSwapOutcome = false;
    this.waitingForQuestion.set(false);
    this.goldDelta.set(0);
    this.currentEffect.set(null);

    // Clear any pending timers
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    if (this.penaltyTimer) {
      clearTimeout(this.penaltyTimer);
      this.penaltyTimer = null;
    }
    if (this.effectTimer) {
      clearTimeout(this.effectTimer);
      this.effectTimer = null;
    }
  }
}
