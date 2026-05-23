import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WebsocketService } from '../../core/services/websocket.service';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { GameStateService } from './services/game-state.service';

@Component({
  selector: 'app-game-play-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    BubblyButtonComponent,
    BubblyCardComponent,
    PageHeadingComponent,
    StatusPillComponent,
  ],
  templateUrl: './game-play-page.component.html',
})
export class GamePlayPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly websocketService = inject(WebsocketService);
  protected readonly gameState = inject(GameStateService);
  protected readonly connected = this.websocketService.connected;
  protected readonly isHost = computed(
    () => this.authService.currentUser()?.id === this.gameState.hostUserId()
  );

  private pin = '';

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
    this.websocketService.joinGame(this.pin, this.displayName());
  }

  ngOnDestroy(): void {
    this.websocketService.leaveGame(this.pin, 'game-page-destroy');
    this.websocketService.disconnect();
  }

  protected selectAnswer(optionId: string): void {
    this.gameState.selectAnswer(optionId);
  }

  protected submitAnswer(): void {
    const question = this.gameState.currentQuestion();
    const selectedAnswer = this.gameState.selectedAnswer();
    if (!question || !selectedAnswer || !this.gameState.canSubmit()) {
      return;
    }

    this.gameState.markPending();
    this.websocketService.submitAnswer(
      this.pin,
      question.sessionId,
      question.questionId,
      selectedAnswer
    );
  }

  protected nextQuestion(): void {
    this.websocketService.nextQuestion(this.pin);
  }

  private bindSocketEvents(): void {
    this.websocketService.lobbyState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.gameState.setLobbyState(event));
    this.websocketService.roundStarted$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.gameState.setRound(event));
    this.websocketService.question$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.gameState.setQuestion(event));
    this.websocketService.answerAck$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.gameState.acceptAnswer(event));
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
      .subscribe((event) => this.gameState.endGame(event));
  }

  private displayName(): string {
    const user = this.authService.currentUser();
    const username = String(user?.user_metadata?.['username'] ?? '').trim();
    return username || user?.email?.split('@')[0] || 'Player';
  }
}
