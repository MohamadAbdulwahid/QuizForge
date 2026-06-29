import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { QuizApiService, QuizSummary, QuizVisibility } from '../../core/services/quiz-api.service';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { BubblyAlertComponent } from '../../shared/ui/bubbly-alert.component';
import {
  RemixQuizEvent,
  RemixQuizModalComponent,
} from './quizzes/remix-quiz-modal.component';
import {
  TranslateQuizEvent,
  TranslateQuizModalComponent,
} from './quizzes/translate-quiz-modal.component';

type QuizSortMode = 'newest' | 'oldest' | 'title';

@Component({
  selector: 'app-dashboard-quizzes-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BubblyButtonComponent,
    BubblyCardComponent,
    StatusPillComponent,
    BubblyAlertComponent,
    RemixQuizModalComponent,
    TranslateQuizModalComponent,
  ],
  templateUrl: './dashboard-quizzes-page.component.html',
})
export class DashboardQuizzesPageComponent {
  private readonly quizApiService = inject(QuizApiService);
  private readonly router = inject(Router);

  protected readonly searchTerm = signal('');
  protected readonly sortMode = signal<QuizSortMode>('newest');

  protected readonly quizzesResource = rxResource<QuizSummary[], number>({
    params: () => 0,
    stream: () => this.quizApiService.getMyQuizzes(),
  });

  protected readonly loading = computed(() => this.quizzesResource.isLoading());
  protected readonly errorMessage = computed(() =>
    this.quizzesResource.error() ? 'Could not load your quizzes. Please try again.' : null
  );
  protected readonly quizzes = computed(() => this.quizzesResource.value() ?? []);

  /* ─── AI transform modal state ─── */
  protected readonly remixModalVisible = signal(false);
  protected readonly translateModalVisible = signal(false);
  protected readonly remixSource = signal<{ id: number; title: string } | null>(null);
  protected readonly translateSource = signal<{
    id: number;
    title: string;
    language: string;
  } | null>(null);
  protected readonly toastMessage = signal<string | null>(null);

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
    this.quizzesResource.reload();
  }

  /* ─── AI transform actions ─── */

  protected openRemix(quiz: QuizSummary): void {
    this.remixSource.set({ id: quiz.id, title: quiz.title });
    this.remixModalVisible.set(true);
  }

  protected openTranslate(quiz: QuizSummary): void {
    this.translateSource.set({
      id: quiz.id,
      title: quiz.title,
      language: quiz.language ?? 'en',
    });
    this.translateModalVisible.set(true);
  }

  protected closeRemix(): void {
    this.remixModalVisible.set(false);
    this.remixSource.set(null);
  }

  protected closeTranslate(): void {
    this.translateModalVisible.set(false);
    this.translateSource.set(null);
  }

  protected onRemixSuccess(event: RemixQuizEvent): void {
    if (event.newQuizId > 0) {
      this.toastMessage.set(
        event.reused
          ? 'Reusing your existing remix.'
          : 'Remix created! Opening it now…'
      );
      // Re-fetch the quiz list so the new quiz appears, then navigate.
      this.refresh();
      void this.router.navigate(['/dashboard/quizzes', event.newQuizId]);
    } else {
      // Fallback when the new quiz id wasn't available.
      this.refresh();
    }
    setTimeout(() => this.toastMessage.set(null), 4000);
  }

  protected onTranslateSuccess(event: TranslateQuizEvent): void {
    if (event.newQuizId > 0) {
      this.toastMessage.set(
        event.reused
          ? 'You already had a translation in this language — opening it.'
          : 'Translation created! Opening it now…'
      );
      this.refresh();
      void this.router.navigate(['/dashboard/quizzes', event.newQuizId]);
    } else {
      this.refresh();
    }
    setTimeout(() => this.toastMessage.set(null), 4000);
  }

  /* ─── Visibility pill helpers (Quiz Visibility & Discovery) ─── */

  /** Maps a quiz's visibility to the StatusPill tone. */
  protected visibilityTone(visibility: QuizVisibility | undefined): 'info' | 'success' | 'neutral' {
    if (visibility === 'public') return 'success';
    if (visibility === 'unlisted') return 'info';
    return 'neutral';
  }

  /** Human-readable label for the visibility pill. */
  protected visibilityLabel(visibility: QuizVisibility | undefined): string {
    if (!visibility) return 'Unlisted';
    return visibility.charAt(0).toUpperCase() + visibility.slice(1);
  }
}
