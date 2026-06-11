import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { GroupApiService, MyGroupSummary } from '../../core/services/group-api.service';
import { QuizApiService, QuizSummary } from '../../core/services/quiz-api.service';
import { SessionApiService, SessionBroadcastMode } from '../../core/services/session-api.service';
import { SessionEventBus } from '../../core/services/session-event-bus.service';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';

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
  protected readonly quizzesError = signal<string | null>(null);
  protected readonly groupsError = signal<string | null>(null);
  protected readonly createError = signal<string | null>(null);

  protected readonly errorMessage = computed(
    () => this.createError() ?? this.quizzesError() ?? this.groupsError()
  );

  protected readonly selectedQuiz = computed(() => {
    const selectedId = this.selectedQuizId();
    if (selectedId === null) {
      return null;
    }

    return this.quizzes().find((quiz) => quiz.id === selectedId) ?? null;
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
  }

  protected toggleBroadcastGroup(groupId: number): void {
    this.selectedBroadcastGroupIds.update((current) =>
      current.includes(groupId)
        ? current.filter((value) => value !== groupId)
        : [...current, groupId]
    );
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
