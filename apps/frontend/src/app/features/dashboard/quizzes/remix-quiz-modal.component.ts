import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AiRemixRequest, AiRemixResponse, QuizApiService } from '../../../core/services/quiz-api.service';
import { BubblyAlertComponent } from '../../../shared/ui/bubbly-alert.component';
import { BubblyButtonComponent } from '../../../shared/ui/bubbly-button.component';
import { BubblyModalComponent } from '../../../shared/ui/bubbly-modal.component';
import { resolveAuthError } from '../../../shared/utils/auth-errors';

export interface RemixQuizEvent {
  sourceQuizId: number;
  /** The newly-created (or reused) remixed quiz returned by the backend. */
  newQuizId: number;
  shareCode: string;
  reused: boolean;
}

/**
 * Modal for remixing one of the user's own quizzes with a custom AI prompt.
 * The new quiz is created server-side (no preview step — the AI only sees
 * the user's own data, so the result is safe to save directly). On success
 * the modal emits a `remixSuccess` event with the new quiz's id so the
 * dashboard can navigate or refresh.
 */
@Component({
  selector: 'app-remix-quiz-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BubblyAlertComponent,
    BubblyButtonComponent,
    BubblyModalComponent,
  ],
  templateUrl: './remix-quiz-modal.component.html',
})
export class RemixQuizModalComponent {
  private readonly quizApi = inject(QuizApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  /** Whether the modal is currently visible. Two-way via (visibleChange). */
  readonly visible = input(false);
  /** Quiz to remix. Required when visible. */
  readonly sourceQuiz = input<{ id: number; title: string } | null>(null);

  /** Emitted when the modal opens or closes. Parent uses to update its signal. */
  readonly visibleChange = output<boolean>();
  /** Emitted on successful remix — parent navigates or refreshes. */
  readonly remixSuccess = output<RemixQuizEvent>();

  /* ─── State ─── */
  protected readonly instructions = signal('');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly canSubmit = (): boolean => !this.isLoading();
  protected readonly instructionsLength = (): number => this.instructions().trim().length;
  protected readonly instructionsTooLong = (): boolean => this.instructionsLength() > 1000;

  protected readonly messageText = computed(() => {
    const source = this.sourceQuiz();
    if (!source) return '';
    return `Create a new AI-remixed version of "${source.title}". The original is left untouched.`;
  });

  protected onInstructionsInput(event: Event): void {
    this.instructions.set((event.target as HTMLTextAreaElement).value);
    this.errorMessage.set(null);
  }

  protected generate(): void {
    const source = this.sourceQuiz();
    if (!source) return;

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isLoading.set(true);

    const payload: AiRemixRequest = {};
    const trimmed = this.instructions().trim();
    if (trimmed.length > 0) {
      payload.instructions = trimmed;
    }

    this.quizApi
      .aiRemixQuiz(source.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: AiRemixResponse) => {
          this.isLoading.set(false);
          this.successMessage.set('Remix created! Opening…');
          this.remixSuccess.emit({
            sourceQuizId: source.id,
            newQuizId: response.quiz.id,
            shareCode: response.shareCode,
            reused: response.reused,
          });
          // Auto-close after a short delay so the user sees the success message.
          setTimeout(() => this.dismiss(), 600);
        },
        error: (err: unknown) => {
          this.isLoading.set(false);
          this.errorMessage.set(this.formatError(err));
        },
      });
  }

  protected openNewQuiz(): void {
    const source = this.sourceQuiz();
    if (!source) return;
    // Best-effort navigation: navigate to the new quiz's builder.
    // The remixSuccess event also fires so the parent can re-fetch.
    const successEvent: RemixQuizEvent = {
      sourceQuizId: source.id,
      newQuizId: 0,
      shareCode: '',
      reused: false,
    };
    // Just trigger the success so the parent can navigate using its own state.
    this.remixSuccess.emit(successEvent);
    this.dismiss();
  }

  protected dismiss(): void {
    this.instructions.set('');
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isLoading.set(false);
    this.visibleChange.emit(false);
  }

  private formatError(err: unknown): string {
    const status = (err as { status?: number } | null)?.status;
    if (status === 429) {
      return 'AI service is rate limited. Please wait a moment and try again.';
    }
    if (status === 503) {
      return 'AI quiz remixing is not configured on the server.';
    }
    if (status === 504) {
      return 'AI request timed out. Please try again.';
    }
    if (status === 403) {
      return 'You can only remix quizzes you own.';
    }
    if (status === 404) {
      return 'The source quiz was not found.';
    }
    return resolveAuthError(err, 'Failed to remix quiz. Please try again.');
  }
}
