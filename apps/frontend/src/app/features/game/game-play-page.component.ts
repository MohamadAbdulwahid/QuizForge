import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { buildDisplayName } from '../../shared/utils/display-name';
import { WebsocketService } from '../../core/services/websocket.service';
import { BubblyModalComponent } from '../../shared/ui/bubbly-modal.component';
import { GameStateService } from './services/game-state.service';

interface OptionShape {
  id: string;
  shape: 'square' | 'circle' | 'triangle' | 'diamond';
  colorClass: string;
  bgClass: string;
  borderClass: string;
  label: string;
}

@Component({
  selector: 'app-game-play-page',
  standalone: true,
  imports: [CommonModule, BubblyModalComponent],
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

  // Track entering animation
  protected readonly optionEntered = signal<Set<string>>(new Set());

  // Blooket-style option shapes — each option gets a color + shape
  private readonly shapeConfigs = [
    {
      shape: 'square' as const,
      colorClass: 'text-sky-400',
      bgClass: 'bg-sky-500',
      borderClass: 'border-sky-500',
      label: 'A',
    },
    {
      shape: 'circle' as const,
      colorClass: 'text-rose-400',
      bgClass: 'bg-rose-500',
      borderClass: 'border-rose-500',
      label: 'B',
    },
    {
      shape: 'triangle' as const,
      colorClass: 'text-emerald-400',
      bgClass: 'bg-emerald-500',
      borderClass: 'border-emerald-500',
      label: 'C',
    },
    {
      shape: 'diamond' as const,
      colorClass: 'text-violet-400',
      bgClass: 'bg-violet-500',
      borderClass: 'border-violet-500',
      label: 'D',
    },
  ];

  // Computed: mapped options with shapes
  protected optionShapes = signal<OptionShape[]>([]);

  private pin = '';
  private animationTimeouts: ReturnType<typeof setTimeout>[] = [];

  async ngOnInit(): Promise<void> {
    this.pin = this.route.snapshot.paramMap.get('pin') ?? '';
    await this.authService.whenReady();
    this.bindSocketEvents();

    const token = this.authService.accessToken();
    const currentUser = this.authService.currentUser();
    if (!token || !currentUser) {
      return;
    }

    this.websocketService.connect(token);
    this.websocketService.joinGame(this.pin, buildDisplayName(currentUser, 'Player'));
  }

  ngOnDestroy(): void {
    this.clearAnimationTimeouts();
    this.websocketService.leaveGame(this.pin, 'game-page-destroy');
    this.websocketService.disconnect();
  }

  /** Returns the shape config for a given option index. */
  protected getShapeForOption(index: number): OptionShape {
    return {
      ...this.shapeConfigs[index % this.shapeConfigs.length],
      id: this.gameState.currentQuestion()?.options[index]?.id ?? '',
    };
  }

  /** Build the mapped option shapes from the current question. */
  private buildOptionShapes(): void {
    const question = this.gameState.currentQuestion();
    if (!question) {
      this.optionShapes.set([]);
      return;
    }

    this.optionShapes.set(
      question.options.map((opt, i) => ({
        ...this.shapeConfigs[i % this.shapeConfigs.length],
        id: opt.id,
      }))
    );
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

  /** Returns CSS classes for an option button based on its shape and selection state. */
  protected getOptionButtonClass(shape: OptionShape, _index: number): string {
    const base = `${shape.bgClass} shadow-[0_8px_0_0_rgba(0,0,0,0.3)]`;
    if (this.selectedAnswerId() === shape.id) {
      return `${base} player-option-selected`;
    }
    return base;
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
      // Build shape mappings and trigger animation
      this.buildOptionShapes();
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
      .subscribe((event) => this.gameState.closeRound(event));
    this.websocketService.gameEnded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameState.endGame(event);
        void this.router.navigate(['/leaderboards'], {
          state: {
            leaderboard: event.leaderboard,
            quizTitle: 'Game Complete',
          },
        });
      });
    this.websocketService.sessionClosed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.websocketService.disconnect();
        this.sessionClosedReason.set(event.reason);
        this.showSessionClosedModal.set(true);
      });
  }
}
