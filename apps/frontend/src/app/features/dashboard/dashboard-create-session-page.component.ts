import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { GroupApiService, MyGroupSummary } from '../../core/services/group-api.service';
import { QuizApiService, QuizSummary } from '../../core/services/quiz-api.service';
import {
  GameMode,
  SessionApiService,
  SessionBroadcastMode,
} from '../../core/services/session-api.service';
import { SessionEventBus } from '../../core/services/session-event-bus.service';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';

interface VisibilityOption {
  readonly id: SessionBroadcastMode;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
}

interface GameModeOption {
  readonly id: GameMode;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
}

interface StepItem {
  readonly id: 1 | 2 | 3;
  readonly label: string;
}

@Component({
  selector: 'app-dashboard-create-session-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    BubblyButtonComponent,
    BubblyCardComponent,
    PageHeadingComponent,
  ],
  templateUrl: './dashboard-create-session-page.component.html',
})
export class DashboardCreateSessionPageComponent {
  private readonly quizApiService = inject(QuizApiService);
  private readonly groupApiService = inject(GroupApiService);
  private readonly sessionApiService = inject(SessionApiService);
  private readonly sessionEventBus = inject(SessionEventBus);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loadingQuizzes = signal(false);
  protected readonly creatingSession = signal(false);
  protected readonly quizzes = signal<QuizSummary[]>([]);
  protected readonly groups = signal<MyGroupSummary[]>([]);
  protected readonly selectedQuizId = signal<number | null>(null);
  protected readonly broadcastMode = signal<SessionBroadcastMode>('private');
  protected readonly selectedBroadcastGroupIds = signal<number[]>([]);
  protected readonly gameMode = signal<GameMode>('forge-classic');
  protected readonly tfEndMode = signal<'timer' | 'gold_goal' | null>(null);
  protected readonly tfTimerMinutes = signal<number>(7);
  protected readonly tfGoldGoal = signal<number>(100);
  protected readonly brTopN = signal<number>(3);
  protected readonly brStartingLives = signal<number>(3);
  protected readonly brDuelTimerS = signal<number>(25);
  protected readonly brPowerBubbleTimerS = signal<number>(15);
  protected readonly quizzesError = signal<string | null>(null);
  protected readonly groupsError = signal<string | null>(null);
  protected readonly createError = signal<string | null>(null);
  protected readonly currentStep = signal<1 | 2 | 3>(1);

  protected readonly stepList: readonly StepItem[] = [
    { id: 1, label: 'Pick a Quiz' },
    { id: 2, label: 'Choose Visibility' },
    { id: 3, label: 'Game Mode' },
  ];

  protected readonly visibilityOptions: readonly VisibilityOption[] = [
    {
      id: 'private',
      label: 'Private',
      description: 'Only you can start sessions with this quiz.',
      icon: '🔒',
    },
    {
      id: 'selected-groups',
      label: 'Selected Groups',
      description: 'Broadcast to specific groups you belong to.',
      icon: '👥',
    },
    {
      id: 'all-my-groups',
      label: 'All My Groups',
      description: 'Available to all your groups.',
      icon: '🌐',
    },
  ];

  protected readonly gameModeOptions: readonly GameModeOption[] = [
    {
      id: 'forge-classic',
      label: 'Forge Classic',
      description: 'Time-weighted scoring. Answer fast for more points.',
      icon: '⚔️',
    },
    {
      id: 'treasure-forge',
      label: 'Treasure Forge',
      description: 'Correct answers reveal chests with gold, steals, and surprises.',
      icon: '💎',
    },
    {
      id: 'bubbly-royale',
      label: 'Bubbly Royale',
      description: '1v1 elimination tournament with power-ups, curses, and Bubble Pop challenges.',
      icon: '🏆',
    },
  ];

  /** Network/load errors only — `createError` is surfaced inline in the footer. */
  protected readonly pageError = computed(() => this.quizzesError() ?? this.groupsError());

  protected readonly selectedQuiz = computed(() => {
    const selectedId = this.selectedQuizId();
    if (selectedId === null) {
      return null;
    }

    return this.quizzes().find((quiz) => quiz.id === selectedId) ?? null;
  });

  protected readonly canAdvance = computed<boolean>(() => {
    const step = this.currentStep();
    if (step === 1) {
      return this.selectedQuizId() !== null;
    }
    if (step === 2) {
      if (this.broadcastMode() === 'selected-groups') {
        return this.selectedBroadcastGroupIds().length > 0;
      }
      return true;
    }
    // Step 3 — Treasure Forge end mode is optional
    return true;
  });

  constructor() {
    this.loadQuizzes();
    this.loadGroups();

    const rawQuizId = this.route.snapshot.queryParamMap.get('quizId');
    const parsedQuizId = rawQuizId ? Number(rawQuizId) : null;

    if (parsedQuizId && Number.isInteger(parsedQuizId) && parsedQuizId > 0) {
      this.selectedQuizId.set(parsedQuizId);
    }
  }

  protected selectQuiz(quizId: number): void {
    this.selectedQuizId.set(quizId);
    this.createError.set(null);
  }

  protected selectGameMode(mode: GameMode): void {
    this.gameMode.set(mode);
    if (mode !== 'treasure-forge') {
      this.tfEndMode.set(null);
    }
  }

  protected onTfTimerMinutesInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.tfTimerMinutes.set(value);
  }

  protected onTfGoldGoalInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.tfGoldGoal.set(value);
  }

  protected onBrTopNInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.brTopN.set(value);
  }

  protected onBrStartingLivesInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.brStartingLives.set(value);
  }

  protected onBrDuelTimerSInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.brDuelTimerS.set(value);
  }

  protected onBrPowerBubbleTimerSInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.brPowerBubbleTimerS.set(value);
  }

  protected nextStep(): void {
    if (!this.canAdvance()) {
      this.createError.set(this.stepValidationMessage());
      return;
    }

    this.createError.set(null);
    const current = this.currentStep();
    if (current < 3) {
      this.currentStep.set((current + 1) as 1 | 2 | 3);
    }
  }

  protected previousStep(): void {
    this.createError.set(null);
    const current = this.currentStep();
    if (current > 1) {
      this.currentStep.set((current - 1) as 1 | 2 | 3);
    }
  }

  protected createSession(): void {
    const quizId = this.selectedQuizId();

    if (!quizId) {
      this.createError.set('Select a quiz first.');
      return;
    }

    if (
      this.broadcastMode() === 'selected-groups' &&
      this.selectedBroadcastGroupIds().length === 0
    ) {
      this.createError.set('Select at least one group when broadcasting to selected groups.');
      return;
    }

    this.createError.set(null);
    this.creatingSession.set(true);

    this.sessionApiService
      .createSession({
        quiz_id: quizId,
        broadcast_mode: this.broadcastMode(),
        group_ids: this.selectedBroadcastGroupIds(),
        game_mode: this.gameMode(),
        ...(this.gameMode() === 'treasure-forge'
          ? {
              tf_end_mode: this.tfEndMode(),
              tf_timer_minutes: this.tfTimerMinutes(),
              tf_gold_goal: this.tfGoldGoal(),
            }
          : {}),
        ...(this.gameMode() === 'bubbly-royale'
          ? {
              br_top_n: this.brTopN(),
              br_starting_lives: this.brStartingLives(),
              br_duel_timer_s: this.brDuelTimerS(),
              br_power_bubble_timer_s: this.brPowerBubbleTimerS(),
            }
          : {}),
      })
      .pipe(
        finalize(() => {
          this.creatingSession.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.sessionEventBus.emit();
          void this.router.navigate(['/game-lobby', response.pin]);
        },
        error: () => {
          this.createError.set(
            'Could not create session. You may already have an active one for this quiz.'
          );
        },
      });
  }

  protected updateBroadcastMode(mode: SessionBroadcastMode): void {
    this.broadcastMode.set(mode);

    if (mode !== 'selected-groups') {
      this.selectedBroadcastGroupIds.set([]);
    }

    this.createError.set(null);
  }

  protected toggleBroadcastGroup(groupId: number): void {
    this.selectedBroadcastGroupIds.update((current) =>
      current.includes(groupId)
        ? current.filter((value) => value !== groupId)
        : [...current, groupId]
    );
    this.createError.set(null);
  }

  protected stepCircleClass(stepId: 1 | 2 | 3): string {
    const current = this.currentStep();
    if (current === stepId) {
      return 'bg-bubbly-primary text-white shadow-sm';
    }
    if (current > stepId) {
      return 'bg-[var(--bubbly-success-bg)] text-[var(--bubbly-success-text)] border border-[var(--bubbly-success-border)]';
    }
    return 'bg-[var(--bubbly-surface-soft)] text-[var(--bubbly-muted)] border border-[var(--bubbly-border)]';
  }

  protected stepLabelClass(stepId: 1 | 2 | 3): string {
    return this.currentStep() >= stepId
      ? 'text-[var(--bubbly-text)]'
      : 'text-[var(--bubbly-muted)]';
  }

  private stepValidationMessage(): string {
    const step = this.currentStep();
    if (step === 1) {
      return 'Pick a quiz to continue.';
    }
    if (step === 2 && this.broadcastMode() === 'selected-groups') {
      return 'Select at least one group to continue.';
    }
    return '';
  }

  private loadQuizzes(): void {
    this.loadingQuizzes.set(true);
    this.quizzesError.set(null);

    this.quizApiService
      .getMyQuizzes()
      .pipe(
        finalize(() => {
          this.loadingQuizzes.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (quizzes) => {
          this.quizzes.set(quizzes);

          if (quizzes.length === 0) {
            this.selectedQuizId.set(null);
            return;
          }

          const currentSelection = this.selectedQuizId();
          const selectedExists =
            currentSelection !== null && quizzes.some((quiz) => quiz.id === currentSelection);

          if (!selectedExists) {
            this.selectedQuizId.set(quizzes[0].id);
          }
        },
        error: () => {
          this.quizzesError.set('Could not load your quizzes.');
        },
      });
  }

  private loadGroups(): void {
    this.groupApiService
      .getMyGroups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups) => {
          this.groups.set(groups);
        },
        error: () => {
          this.groupsError.set('Could not load your groups.');
        },
      });
  }
}
