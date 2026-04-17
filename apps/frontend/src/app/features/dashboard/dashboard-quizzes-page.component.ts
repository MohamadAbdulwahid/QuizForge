import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { QuizApiService, QuizSummary } from '../../core/services/quiz-api.service';

type QuizSortMode = 'newest' | 'oldest' | 'title';

@Component({
  selector: 'app-dashboard-quizzes-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-quizzes-page.component.html',
  styleUrl: './dashboard-quizzes-page.component.css',
})
export class DashboardQuizzesPageComponent {
  private readonly quizApiService = inject(QuizApiService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly quizzes = signal<QuizSummary[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly sortMode = signal<QuizSortMode>('newest');

  protected readonly filteredQuizzes = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const sortMode = this.sortMode();

    const filtered = this.quizzes().filter((quiz) => {
      if (!term) {
        return true;
      }

      const titleMatches = quiz.title.toLowerCase().includes(term);
      const descriptionMatches = (quiz.description ?? '').toLowerCase().includes(term);
      return titleMatches || descriptionMatches;
    });

    return [...filtered].sort((left, right) => {
      if (sortMode === 'title') {
        return left.title.localeCompare(right.title);
      }

      const leftTime = new Date(left.created_at).getTime();
      const rightTime = new Date(right.created_at).getTime();
      return sortMode === 'oldest' ? leftTime - rightTime : rightTime - leftTime;
    });
  });

  constructor() {
    this.loadQuizzes();
  }

  protected updateSearch(term: string): void {
    this.searchTerm.set(term);
  }

  protected updateSort(mode: QuizSortMode): void {
    this.sortMode.set(mode);
  }

  protected startSession(quizId: number): void {
    void this.router.navigate(['/dashboard/create-session'], {
      queryParams: { quizId },
    });
  }

  protected refresh(): void {
    this.loadQuizzes();
  }

  private loadQuizzes(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.quizApiService
      .getMyQuizzes()
      .pipe(
        finalize(() => {
          this.loading.set(false);
        })
      )
      .subscribe({
        next: (quizzes) => {
          this.quizzes.set(quizzes);
        },
        error: () => {
          this.errorMessage.set('Could not load your quizzes. Please try again.');
        },
      });
  }
}
