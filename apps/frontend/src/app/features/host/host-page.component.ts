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

type QuestionPhase = 'centered' | 'moving' | 'top';

interface OptionPreview {
  id: string;
  text: string;
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

/** Shape of the GET /api/sessions/:pin/host response body. */
interface HostSessionData {
  session: { id: number };
  players: Array<{ user_id: string; username?: string }>;
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

  // ── Session state ──
  protected readonly pin = signal('');
  protected readonly sessionId = signal<number | null>(null);
  protected readonly playerCount = signal(0);
  protected readonly statusMessage = signal('Connecting...');
  protected readonly connected = this.websocketService.connected;
  protected readonly reconnecting = this.websocketService.reconnecting;
  protected readonly errorMessage = signal<string | null>(null);

  // ── Game state ──
  protected readonly currentQuestionIndex = signal(-1);
  protected readonly questions = signal<QuestionPreview[]>([]);
  protected readonly currentQuestion = computed(() => {
    const idx = this.currentQuestionIndex();
    return idx >= 0 && idx < this.questions().length ? this.questions()[idx] : null;
  });
  protected readonly totalQuestions = computed(() => this.questions().length);
  protected readonly isGameActive = computed(() => this.currentQuestionIndex() >= 0);
  protected readonly gameEnded = signal(false);

  // ── Timer ──
  private readonly serverStartTimeMs = signal(0);
  protected readonly timeLimitMs = signal(0);
  private readonly nowMsSignal = signal(Date.now());
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  protected readonly timeRemainingMs = computed(() => {
    const limit = this.timeLimitMs();
    if (limit <= 0) return 0;
    const elapsed = this.nowMsSignal() - this.serverStartTimeMs();
    return Math.max(0, limit - elapsed);
  });
  protected readonly timeRemainingSeconds = computed(() =>
    Math.ceil(this.timeRemainingMs() / 1000)
  );
  protected readonly timerProgress = computed(() => {
    const limit = this.timeLimitMs();
    if (limit <= 0) return 100;
    return (this.timeRemainingMs() / limit) * 100;
  });
  protected readonly timerUrgency = computed<'safe' | 'warning' | 'danger'>(() => {
    const secs = this.timeRemainingSeconds();
    if (secs <= 3) return 'danger';
    if (secs <= 8) return 'warning';
    return 'safe';
  });

  // ── Animation state ──
  protected readonly questionPhase = signal<QuestionPhase>('centered');
  protected readonly visibleOptionIds = signal<Set<string>>(new Set());

  // ── Players & Leaderboard (kept for data, no longer rendered in sidebar) ──
  protected readonly leaderboard = signal<LeaderboardPlayerEvent[]>([]);
  protected readonly answeredCount = signal(0);

  // ── Loading & modals ──
  protected readonly initialLoading = signal(true);
  protected readonly showEndConfirmModal = signal(false);
  protected readonly showSessionClosedModal = signal(false);
  protected readonly sessionClosedReason = signal('');
  protected readonly showRoundSummary = signal(false);

  private hasJoined = false;
  private animationTimeouts: ReturnType<typeof setTimeout>[] = [];
  private roundSummaryTimeout: ReturnType<typeof setTimeout> | null = null;

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

    try {
      await this.loadHostData(pin);
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
    this.stopTimer();
    this.clearAnimationTimeouts();
    this.clearRoundSummaryTimeout();
    this.leaveInternal();
  }

  /** Option letter label: 0→A, 1→B, … */
  protected getOptionLabel(index: number): string {
    return String.fromCharCode(65 + index);
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
        options: (q.options ?? []).map((o) => ({ id: o.id, text: o.text })),
        orderIndex: q.order_index,
        timeLimit: q.time_limit ?? 30000,
        points: q.points ?? 100,
      }))
    );
  }

  private bindSocketEvents(): void {
    this.websocketService.roundStarted$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameEnded.set(false);
        // Start timer
        this.serverStartTimeMs.set(event.serverStartTimeMs);
        this.timeLimitMs.set(event.timeLimitMs);
        this.startTimer();
      });

    this.websocketService.question$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      const idx = event.order - 1;
      this.currentQuestionIndex.set(idx >= 0 ? idx : 0);
      this.answeredCount.set(0);
      this.showRoundSummary.set(false);
      this.clearRoundSummaryTimeout();
      // Kick off entrance animation
      this.startQuestionAnimation(this.currentQuestion());
    });

    this.websocketService.scoreUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.answeredCount.update((c) => c + 1);
        this.leaderboard.set(event.leaderboard);
      });

    this.websocketService.leaderboardUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.leaderboard.set(event.leaderboard);
      });

    this.websocketService.roundClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.stopTimer();
      this.showRoundSummary.set(true);
      this.clearRoundSummaryTimeout();
      this.roundSummaryTimeout = setTimeout(() => {
        this.showRoundSummary.set(false);
      }, 3000);
    });

    this.websocketService.gameEnded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.gameEnded.set(true);
        this.stopTimer();
        this.currentQuestionIndex.set(-1);
        setTimeout(() => {
          void this.router.navigate(['/leaderboards'], {
            state: { leaderboard: event.leaderboard, quizTitle: 'Game Complete', pin: this.pin() },
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

  // ── Timer ──

  private startTimer(): void {
    this.stopTimer();
    this.nowMsSignal.set(Date.now());
    this.timerInterval = setInterval(() => {
      this.nowMsSignal.set(Date.now());
    }, 250);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ── Question entrance animation ──

  private startQuestionAnimation(question: QuestionPreview | null): void {
    this.clearAnimationTimeouts();
    if (!question) return;

    this.questionPhase.set('centered');
    this.visibleOptionIds.set(new Set());

    // Hold centered for 800ms, then start moving
    const pause = setTimeout(() => {
      this.questionPhase.set('moving');

      // After the move animation completes (700ms), reveal options
      const show = setTimeout(() => {
        this.questionPhase.set('top');
        this.revealOptions(question);
      }, 750); // slightly more than the CSS transition duration

      this.animationTimeouts.push(show);
    }, 800);

    this.animationTimeouts.push(pause);
  }

  /**
   * Calculates reading time for an option using the formula:
   *   delay = 1500ms  (initial pause before reading)
   *   wpm = 180       (readable words per minute)
   *   wordLength = 5  (standardized chars per word)
   *   words = text.length / wordLength
   *   wordsTime = ((words / wpm) × 60) × 1000
   *   bonus = 1000ms  (extra time)
   *   total = delay + wordsTime + bonus
   */
  private calculateReadTime(text: string): number {
    const delay = 1500;
    const wpm = 180;
    const wordLength = 5;
    const words = text.length / wordLength;
    const wordsTime = (words / wpm) * 60 * 1000;
    const bonus = 1000;
    return delay + wordsTime + bonus;
  }

  private revealOptions(question: QuestionPreview): void {
    if (question.type === 'true-false') {
      this.visibleOptionIds.set(new Set(question.options.map((o) => o.id)));
      return;
    }

    // Multiple choice: staggered reveal, each option gets its own reading time
    let delay = 0;
    for (const option of question.options) {
      const readTime = this.calculateReadTime(option.text);
      const timeout = setTimeout(() => {
        this.visibleOptionIds.update((prev) => {
          const next = new Set(prev);
          next.add(option.id);
          return next;
        });
      }, delay);
      this.animationTimeouts.push(timeout);
      delay += readTime;
    }
  }

  private clearAnimationTimeouts(): void {
    for (const t of this.animationTimeouts) clearTimeout(t);
    this.animationTimeouts = [];
  }

  private clearRoundSummaryTimeout(): void {
    if (this.roundSummaryTimeout) {
      clearTimeout(this.roundSummaryTimeout);
      this.roundSummaryTimeout = null;
    }
  }

  // ── Host controls ──

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
    if (!this.hasJoined) return;
    this.hasJoined = false;
    this.websocketService.leaveGame(this.pin(), 'host-page-destroy');
    this.websocketService.disconnect();
  }
}
