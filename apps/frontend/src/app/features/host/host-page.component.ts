import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { SessionApiService } from '../../core/services/session-api.service';
import { SessionEventBus } from '../../core/services/session-event-bus.service';
import { LeaderboardPlayerEvent, WebsocketService } from '../../core/services/websocket.service';
import { buildDisplayName } from '../../shared/utils/display-name';
import { BubblyModalComponent } from '../../shared/ui/bubbly-modal.component';

interface OptionPreview {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface QuestionPreview {
  id: number;
  text: string;
  type: string;
  options: OptionPreview[];
  orderIndex: number;
  timeLimit: number;
  points: number;
}

interface HostPlayerState {
  userId: string;
  username: string;
  hasAnswered: boolean;
  score: number;
  rank: number;
}

/** Raw question shape from the GET /api/sessions/:pin/host response. */
interface RawQuestion {
  id: number;
  text: string;
  type: string;
  options?: Array<{ id: string; text: string }>;
  correct_answer: string;
  order_index: number;
  time_limit?: number;
  points?: number;
}

/** Raw player shape from the GET /api/sessions/:pin/host response. */
interface RawPlayer {
  user_id: string;
  username?: string;
}

/** Shape of the GET /api/sessions/:pin/host response body. */
interface HostSessionData {
  session: { id: number };
  players: RawPlayer[];
  questions: RawQuestion[];
}

@Component({
  selector: 'app-host-page',
  standalone: true,
  imports: [CommonModule, BubblyModalComponent],
  templateUrl: './host-page.component.html',
})
export class HostPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly sessionApiService = inject(SessionApiService);
  private readonly sessionEventBus = inject(SessionEventBus);
  private readonly websocketService = inject(WebsocketService);

  // Session state
  protected readonly pin = signal('');
  protected readonly sessionId = signal<number | null>(null);
  protected readonly playerCount = signal(0);
  protected readonly statusMessage = signal('Connecting...');
  protected readonly connected = this.websocketService.connected;
  protected readonly errorMessage = signal<string | null>(null);

  // Game state
  protected readonly currentQuestionIndex = signal(-1); // -1 = lobby, 0+ = game started
  protected readonly questions = signal<QuestionPreview[]>([]);
  protected readonly currentQuestion = computed(() => {
    const idx = this.currentQuestionIndex();
    return idx >= 0 && idx < this.questions().length ? this.questions()[idx] : null;
  });
  protected readonly totalQuestions = computed(() => this.questions().length);
  protected readonly isGameActive = computed(() => this.currentQuestionIndex() >= 0);
  protected readonly isLastQuestion = computed(
    () => this.currentQuestionIndex() >= this.totalQuestions() - 1 && this.totalQuestions() > 0
  );
  protected readonly gameEnded = signal(false);

  // Players
  protected readonly players = signal<HostPlayerState[]>([]);
  protected readonly answeredCount = computed(
    () => this.players().filter((p) => p.hasAnswered).length
  );
  protected readonly allAnswered = computed(
    () => this.answeredCount() >= this.playerCount() && this.playerCount() > 0
  );

  // Leaderboard
  protected readonly leaderboard = signal<LeaderboardPlayerEvent[]>([]);
  protected readonly topPlayers = computed(() => this.leaderboard().slice(0, 5));

  // Loading
  protected readonly initialLoading = signal(true);

  // Modals
  protected readonly showEndConfirmModal = signal(false);
  protected readonly showSessionClosedModal = signal(false);
  protected readonly sessionClosedReason = signal('');

  private readonly emojiPool = [
    '🦊',
    '🐼',
    '🦁',
    '🐯',
    '🐸',
    '🐙',
    '🦄',
    '🐧',
    '🦉',
    '🐺',
    '🐱',
    '🐶',
    '🐰',
    '🐭',
    '🐹',
    '🐻',
    '🐲',
    '👽',
    '🤖',
    '👾',
    '🫅',
    '🐨',
  ];

  private hasJoined = false;

  async ngOnInit(): Promise<void> {
    const pin = this.route.snapshot.paramMap.get('pin') ?? '';
    this.pin.set(pin);

    if (!/^\d{6}$/.test(pin)) {
      this.errorMessage.set('Invalid PIN format.');
      return;
    }

    await this.authService.whenReady();
    const token = this.authService.accessToken();
    const currentUser = this.authService.currentUser();

    if (!token || !currentUser) {
      await this.router.navigateByUrl('/login');
      return;
    }

    // Fetch initial session data (questions + players)
    try {
      await this.loadHostData(pin);

      // Connect WebSocket
      this.bindSocketEvents();
      this.websocketService.connect(token);
      this.websocketService.joinGame(pin, buildDisplayName(currentUser, 'Host'));
      this.hasJoined = true;
      this.initialLoading.set(false);
    } catch {
      this.errorMessage.set('Failed to load session data. Is the session running?');
      this.initialLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.leaveInternal();
  }

  /** Helper to label options A, B, C, D in the template. */
  protected getOptionLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  /** Returns a consistent emoji for a user based on their ID hash. */
  protected getPlayerEmoji(userId: string): string {
    const hash = Array.from(userId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return this.emojiPool[hash % this.emojiPool.length];
  }

  private async loadHostData(pin: string): Promise<void> {
    const data = (await firstValueFrom(
      this.sessionApiService.getHostSessionData(pin)
    )) as HostSessionData;
    this.sessionId.set(data.session.id);
    this.playerCount.set(data.players.length);

    this.questions.set(
      data.questions.map((q: RawQuestion) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        options: (q.options ?? []).map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.id === q.correct_answer,
        })),
        orderIndex: q.order_index,
        timeLimit: q.time_limit ?? 30000,
        points: q.points ?? 100,
      }))
    );

    this.players.set(
      data.players.map((p: RawPlayer) => ({
        userId: p.user_id,
        username: p.username ?? 'Player',
        hasAnswered: false,
        score: 0,
        rank: 0,
      }))
    );
  }

  private bindSocketEvents(): void {
    this.websocketService.lobbyState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.playerCount.set(event.players.length);
      });

    this.websocketService.roundStarted$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      // Game has started / next question
      this.gameEnded.set(false);
      // Reset answered state
      this.players.update((list) => list.map((p) => ({ ...p, hasAnswered: false })));
    });

    this.websocketService.question$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      // Find the question index by looking at the order field (1-based)
      const idx = event.order - 1;
      this.currentQuestionIndex.set(idx >= 0 ? idx : 0);
    });

    // Host receives score-update events when any player answers correctly/incorrectly
    this.websocketService.scoreUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.players.update((list) =>
          list.map((p) =>
            p.userId === event.playerId ? { ...p, hasAnswered: true, score: event.totalScore } : p
          )
        );
        this.leaderboard.set(event.leaderboard);
      });

    this.websocketService.leaderboardUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.leaderboard.set(event.leaderboard);
      });

    this.websocketService.roundClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      // Round closed — no special handling needed on host view
    });

    this.websocketService.gameEnded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameEnded.set(true);
        this.leaderboard.set(event.leaderboard);
        this.currentQuestionIndex.set(-1);
        // Navigate to leaderboard after brief delay
        setTimeout(() => {
          void this.router.navigate(['/leaderboards'], {
            state: { leaderboard: event.leaderboard, quizTitle: 'Game Complete' },
          });
        }, 3000);
      });

    this.websocketService.sessionClosed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.hasJoined = false;
        this.websocketService.disconnect();
        this.sessionClosedReason.set(event.reason);
        this.showSessionClosedModal.set(true);
      });

    this.websocketService.socketError$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.errorMessage.set(event.error);
      });
  }

  // Host controls

  protected skipQuestion(): void {
    this.websocketService.skipQuestion(this.pin());
  }

  protected requestEndSession(): void {
    this.showEndConfirmModal.set(true);
  }

  protected confirmEndSession(): void {
    this.showEndConfirmModal.set(false);
    this.websocketService.endSession(this.pin());
    this.sessionEventBus.emit();
    this.websocketService.disconnect();
    void this.router.navigateByUrl('/dashboard');
  }

  protected cancelEndSession(): void {
    this.showEndConfirmModal.set(false);
  }

  protected dismissSessionClosed(): void {
    this.showSessionClosedModal.set(false);
    void this.router.navigateByUrl('/dashboard');
  }

  private leaveInternal(): void {
    if (!this.hasJoined) {
      return;
    }

    this.hasJoined = false;
    this.websocketService.leaveGame(this.pin(), 'host-page-destroy');
    this.websocketService.disconnect();
  }

  protected isCorrectAnswer(optionId: string): boolean {
    const q = this.currentQuestion();
    return q?.options.some((o) => o.id === optionId && o.isCorrect) ?? false;
  }
}
