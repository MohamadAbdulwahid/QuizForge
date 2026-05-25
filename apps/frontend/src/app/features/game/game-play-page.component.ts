import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { buildDisplayName } from '../../shared/utils/display-name';
import { WebsocketService } from '../../core/services/websocket.service';
import { BubblyModalComponent } from '../../shared/ui/bubbly-modal.component';
import { GameStateService } from './services/game-state.service';

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

  // Animations / visual state
  protected readonly selectedAnswerId = signal<string | null>(null);
  protected readonly showCorrect = signal(false);
  protected readonly showIncorrect = signal(false);

  private pin = '';
  private readonly EMOJI_LIST = ['⚡', '🔥', '💎', '🌟', '🍀', '🎯', '🚀', '💫'];
  private readonly answerColors = [
    'bg-bubbly-primary text-white shadow-[0_6px_0_0_var(--bubbly-primary-deep)]',
    'bg-bubbly-accent text-white shadow-[0_6px_0_0_var(--bubbly-accent-deep)]',
    'bg-emerald-500 text-white shadow-[0_6px_0_0_rgba(16,185,129,1)]',
    'bg-violet-500 text-white shadow-[0_6px_0_0_rgba(139,92,246,1)]',
  ];

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
    this.websocketService.leaveGame(this.pin, 'game-page-destroy');
    this.websocketService.disconnect();
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

  /** Returns color-coded CSS classes for an answer option tile. */
  protected getAnswerTileClass(optionId: string): string {
    const question = this.gameState.currentQuestion();
    if (!question) {
      return '';
    }
    const index = question.options.findIndex((o) => o.id === optionId);
    const base = this.answerColors[index % this.answerColors.length];

    // Selected answer gets a highlighted ring
    if (this.selectedAnswerId() === optionId) {
      return `${base} ring-4 ring-white scale-[1.02]`;
    }

    // After submission, dim unselected answers
    if (this.gameState.submissionState() !== 'idle') {
      return `${base} opacity-60`;
    }

    // Idle state: hover lift effect
    return `${base} hover:scale-[1.02] hover:brightness-110`;
  }

  /** Returns a consistent emoji for a user based on their ID hash. */
  protected getPlayerEmoji(userId: string): string {
    const hash = Array.from(userId).reduce((s, c) => s + c.charCodeAt(0), 0);
    return this.EMOJI_LIST[hash % this.EMOJI_LIST.length];
  }

  /** Converts array index to a letter label (0 → A, 1 → B, etc.). */
  protected getOptionLabel(index: number): string {
    return String.fromCharCode(65 + index);
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
      // Reset visual states for new question
      this.selectedAnswerId.set(null);
      this.showCorrect.set(false);
      this.showIncorrect.set(false);
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
        // Navigate to leaderboards with real data
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
