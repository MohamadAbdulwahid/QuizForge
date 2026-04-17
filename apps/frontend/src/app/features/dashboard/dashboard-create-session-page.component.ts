import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { QuizApiService, QuizSummary } from '../../core/services/quiz-api.service';
import { SessionApiService } from '../../core/services/session-api.service';

@Component({
  selector: 'app-dashboard-create-session-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-create-session-page.component.html',
  styleUrl: './dashboard-create-session-page.component.css',
})
export class DashboardCreateSessionPageComponent {
  private readonly quizApiService = inject(QuizApiService);
  private readonly sessionApiService = inject(SessionApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loadingQuizzes = signal(false);
  protected readonly creatingSession = signal(false);
  protected readonly quizzes = signal<QuizSummary[]>([]);
  protected readonly selectedQuizId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly selectedQuiz = computed(() => {
    const selectedId = this.selectedQuizId();
    if (selectedId === null) {
      return null;
    }

    return this.quizzes().find((quiz) => quiz.id === selectedId) ?? null;
  });

  constructor() {
    this.loadQuizzes();

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
      this.errorMessage.set('Select a quiz first.');
      return;
    }

    this.errorMessage.set(null);
    this.creatingSession.set(true);

    this.sessionApiService
      .createSession(quizId)
      .pipe(
        finalize(() => {
          this.creatingSession.set(false);
        })
      )
      .subscribe({
        next: (response) => {
          void this.router.navigate(['/game-lobby', response.pin]);
        },
        error: () => {
          this.errorMessage.set(
            'Could not create session. You may already have an active one for this quiz.'
          );
        },
      });
  }

  private loadQuizzes(): void {
    this.loadingQuizzes.set(true);
    this.errorMessage.set(null);

    this.quizApiService
      .getMyQuizzes()
      .pipe(
        finalize(() => {
          this.loadingQuizzes.set(false);
        })
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
          this.errorMessage.set('Could not load your quizzes.');
        },
      });
  }
}
