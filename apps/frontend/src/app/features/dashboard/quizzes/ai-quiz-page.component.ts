import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AiGenerateRequest,
  AiGeneratedQuestion,
  AiGenerateResponse,
  QuestionType,
  QuizApiService,
  QuizOptionDto,
  QuizQuestionPayload,
  QuizSavePayload,
} from '../../../core/services/quiz-api.service';
import { BubblyAlertComponent } from '../../../shared/ui/bubbly-alert.component';
import { BubblyButtonComponent } from '../../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../../shared/ui/bubbly-card.component';
import { QUESTION_TYPES } from '../../quiz/types/question-types';

@Component({
  selector: 'app-ai-quiz-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BubblyButtonComponent,
    BubblyAlertComponent,
    BubblyCardComponent,
  ],
  templateUrl: './ai-quiz-page.component.html',
})
export class AiQuizPageComponent {
  private readonly quizApi = inject(QuizApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /* ─── Form state ─── */
  protected readonly title = signal('');
  protected readonly notes = signal('');
  protected readonly instructions = signal('');

  /* ─── Generation state ─── */
  protected readonly isLoading = signal(false);
  protected readonly generatedQuestions = signal<AiGeneratedQuestion[]>([]);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal<string | null>(null);

  /* ─── Computed ─── */
  protected readonly canGenerate = (): boolean =>
    this.title().trim().length > 0 && this.notes().trim().length >= 10;

  protected readonly hasQuestions = (): boolean => this.generatedQuestions().length > 0;

  protected questionTypeLabel(type: QuestionType): string {
    return QUESTION_TYPES.find((t) => t.id === type)?.label ?? type;
  }

  /* ─── Actions ─── */

  protected generateQuiz(): void {
    this.errorMessage.set(null);
    this.generatedQuestions.set([]);
    this.isLoading.set(true);

    const payload: AiGenerateRequest = {
      title: this.title().trim(),
      notes: this.notes().trim(),
    };

    const instructions = this.instructions().trim();
    if (instructions) {
      payload.instructions = instructions;
    }

    this.quizApi
      .aiGenerateQuiz(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: AiGenerateResponse) => {
          this.generatedQuestions.set(response.data.questions);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);

          const status = err?.status;
          const body = err?.error;

          if (status === 429) {
            this.errorMessage.set('AI service is rate limited. Please wait a moment and try again.');
          } else if (status === 503) {
            this.errorMessage.set('AI quiz generation is not configured on the server.');
          } else if (status === 504) {
            this.errorMessage.set('AI request timed out. Your notes may be too long — try shortening them.');
          } else {
            this.errorMessage.set(
              body?.message || body?.error || 'Failed to generate quiz. Please try again.'
            );
          }
        },
      });
  }

  protected saveQuiz(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const questions = this.generatedQuestions();
    if (questions.length === 0) {
      this.errorMessage.set('No questions to save.');
      return;
    }

    this.isSaving.set(true);

    const questionsPayload: QuizQuestionPayload[] = questions.map(
      (q): QuizQuestionPayload => {
        if (q.type === 'matching') {
          return {
            text: q.text,
            type: 'matching',
            options: q.options as { left: QuizOptionDto[]; right: QuizOptionDto[] },
            correct_answer: q.correct_answer,
            time_limit: q.time_limit,
            points: q.points,
          };
        }
        return {
          text: q.text,
          type: q.type as Exclude<QuestionType, 'matching'>,
          options: q.options as QuizOptionDto[],
          correct_answer: q.correct_answer,
          time_limit: q.time_limit,
          points: q.points,
        };
      }
    );

    const payload: QuizSavePayload = {
      title: this.title().trim(),
      questions: questionsPayload,
    };

    this.quizApi
      .createQuiz(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.successMessage.set('Quiz created successfully!');
          setTimeout(() => {
            void this.router.navigate(['/dashboard/quizzes']);
          }, 800);
        },
        error: () => {
          this.errorMessage.set('Failed to save quiz. Please try again.');
          this.isSaving.set(false);
        },
        complete: () => {
          this.isSaving.set(false);
        },
      });
  }

  /* ─── Navigation ─── */
  protected goBack(): void {
    void this.router.navigate(['/dashboard/quizzes']);
  }

  /* ─── Event handlers ─── */
  protected onTitleInput(event: Event): void {
    this.title.set((event.target as HTMLInputElement).value);
  }

  protected onNotesInput(event: Event): void {
    this.notes.set((event.target as HTMLTextAreaElement).value);
  }

  protected onInstructionsInput(event: Event): void {
    this.instructions.set((event.target as HTMLTextAreaElement).value);
  }
}
