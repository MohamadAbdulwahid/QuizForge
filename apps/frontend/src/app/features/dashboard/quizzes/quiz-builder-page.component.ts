import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { QuizApiService, QuizQuestionDto } from '../../../core/services/quiz-api.service';
import { BubblyAlertComponent } from '../../../shared/ui/bubbly-alert.component';
import { BubblyButtonComponent } from '../../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../../shared/ui/bubbly-card.component';

/* ─── Types ─── */

interface QuestionOption {
  id: string;
  text: string;
}

interface QuestionDraft {
  clientId: string;
  text: string;
  type: 'multiple-choice' | 'true-false';
  options: QuestionOption[];
  correctAnswerId: string;
  timeLimit: number;
  points: number;
}

interface FieldError {
  field: string;
  message: string;
}

/* ─── Helpers ─── */

function createOption(id: string, text = ''): QuestionOption {
  return { id, text };
}

function createDefaultQuestion(): QuestionDraft {
  const optionA = createOption(crypto.randomUUID(), '');
  const optionB = createOption(crypto.randomUUID(), '');
  return {
    clientId: crypto.randomUUID(),
    text: '',
    type: 'multiple-choice',
    options: [optionA, optionB],
    correctAnswerId: optionA.id,
    timeLimit: 30,
    points: 100,
  };
}

function validateQuestion(q: QuestionDraft): FieldError[] {
  const errors: FieldError[] = [];
  if (!q.text.trim()) {
    errors.push({ field: `${q.clientId}-text`, message: 'Question text is required.' });
  } else if (q.text.length > 500) {
    errors.push({
      field: `${q.clientId}-text`,
      message: 'Question text must be under 500 characters.',
    });
  }

  if (q.type === 'multiple-choice') {
    if (q.options.length < 2) {
      errors.push({ field: `${q.clientId}-options`, message: 'At least 2 options required.' });
    }
    q.options.forEach((opt, i) => {
      if (!opt.text.trim()) {
        errors.push({
          field: `${q.clientId}-opt-${i}`,
          message: `Option ${String.fromCharCode(65 + i)} cannot be empty.`,
        });
      } else if (opt.text.length > 500) {
        errors.push({
          field: `${q.clientId}-opt-${i}`,
          message: `Option ${String.fromCharCode(65 + i)} must be under 500 characters.`,
        });
      }
    });
    if (!q.correctAnswerId || !q.options.find((o) => o.id === q.correctAnswerId)) {
      errors.push({ field: `${q.clientId}-correct`, message: 'Select a correct answer.' });
    }
  } else {
    if (!q.correctAnswerId) {
      errors.push({
        field: `${q.clientId}-correct`,
        message: 'Select True or False as the correct answer.',
      });
    }
  }

  if (q.timeLimit < 5 || q.timeLimit > 120) {
    errors.push({
      field: `${q.clientId}-time`,
      message: 'Time limit must be between 5 and 120 seconds.',
    });
  }
  if (q.points < 0 || q.points > 1000) {
    errors.push({ field: `${q.clientId}-points`, message: 'Points must be between 0 and 1000.' });
  }

  return errors;
}

@Component({
  selector: 'app-quiz-builder-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BubblyCardComponent,
    BubblyButtonComponent,
    BubblyAlertComponent,
  ],
  templateUrl: './quiz-builder-page.component.html',
})
export class QuizBuilderPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizApi = inject(QuizApiService);
  private readonly destroyRef = inject(DestroyRef);

  /* ─── State ─── */
  protected readonly quizId = signal<number | null>(null);
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly questions = signal<QuestionDraft[]>([createDefaultQuestion()]);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  /* ─── Selection state (new) ─── */
  protected readonly selectedQuestionId = signal<string | null>(null);
  protected readonly showDescription = signal(false);

  /* ─── Computed ─── */
  protected readonly isEditMode = computed(() => this.quizId() !== null);
  protected readonly pageTitle = computed(() => (this.isEditMode() ? 'Edit Quiz' : 'Create Quiz'));
  protected readonly hasMultipleQuestions = computed(() => this.questions().length > 1);
  protected readonly activeQuestion = computed<QuestionDraft | null>(() => {
    const id = this.selectedQuestionId();
    if (!id) return null;
    return this.questions().find((q) => q.clientId === id) ?? null;
  });
  protected readonly selectedIndex = computed<number>(() => {
    const id = this.selectedQuestionId();
    if (!id) return 0;
    return this.questions().findIndex((q) => q.clientId === id) + 1;
  });

  /* ─── Lifecycle ─── */
  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = parseInt(idParam, 10);
      if (!isNaN(id)) {
        this.quizId.set(id);
        this.loadQuiz(id);
      }
    }
    this.initSelection();
  }

  /**
   * Keeps the selected question valid as the list changes.
   * - Picks the first question if nothing is selected or the current selection is gone
   * - Clears selection when the list is empty
   * Runs on initial mount and after loadQuiz replaces the questions array.
   */
  private initSelection(): void {
    effect(() => {
      const qs = this.questions();
      const current = this.selectedQuestionId();
      if (qs.length === 0) {
        if (current !== null) this.selectedQuestionId.set(null);
        return;
      }
      const stillValid = current !== null && qs.some((q) => q.clientId === current);
      if (!stillValid) {
        this.selectedQuestionId.set(qs[0].clientId);
      }
    });
  }

  /* ─── Quiz loading ─── */
  private loadQuiz(id: number): void {
    this.quizApi
      .getQuizById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quiz) => {
          this.title.set(quiz.title);
          this.description.set(quiz.description ?? '');
          this.questions.set(quiz.questions.map((q) => this.detailToDraft(q)));
        },
        error: () => {
          this.errorMessage.set('Failed to load quiz. It may have been deleted.');
        },
      });
  }

  private detailToDraft(q: QuizQuestionDto): QuestionDraft {
    const options = (q.options as QuestionOption[] | null) ?? [];
    return {
      clientId: crypto.randomUUID(),
      text: q.text,
      type: q.type as 'multiple-choice' | 'true-false',
      options: options.length ? options : this.defaultOptions(q.type),
      correctAnswerId: q.correct_answer ?? options[0]?.id ?? '',
      timeLimit: q.time_limit ?? 30,
      points: q.points ?? 100,
    };
  }

  private defaultOptions(type: string): QuestionOption[] {
    if (type === 'true-false') {
      return [
        createOption(crypto.randomUUID(), 'True'),
        createOption(crypto.randomUUID(), 'False'),
      ];
    }
    return [createOption(crypto.randomUUID(), ''), createOption(crypto.randomUUID(), '')];
  }

  /* ─── Question mutations ─── */
  protected addQuestion(): void {
    this.questions.update((qs) => [...qs, createDefaultQuestion()]);
  }

  protected removeQuestion(clientId: string): void {
    this.questions.update((qs) => {
      if (qs.length <= 1) return qs;
      return qs.filter((q) => q.clientId !== clientId);
    });
  }

  protected updateQuestionText(clientId: string, text: string): void {
    this.questions.update((qs) => qs.map((q) => (q.clientId === clientId ? { ...q, text } : q)));
  }

  protected updateQuestionType(clientId: string, type: 'multiple-choice' | 'true-false'): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId) return q;
        if (type === 'true-false') {
          const trueOpt = createOption(crypto.randomUUID(), 'True');
          const falseOpt = createOption(crypto.randomUUID(), 'False');
          return { ...q, type, options: [trueOpt, falseOpt], correctAnswerId: trueOpt.id };
        }
        return {
          ...q,
          type,
          options: [createOption(crypto.randomUUID(), ''), createOption(crypto.randomUUID(), '')],
          correctAnswerId: '',
        };
      })
    );
  }

  protected updateOptionText(clientId: string, optionIdx: number, text: string): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId) return q;
        const options = q.options.map((opt, i) => (i === optionIdx ? { ...opt, text } : opt));
        return { ...q, options };
      })
    );
  }

  protected markCorrect(clientId: string, optionId: string): void {
    this.questions.update((qs) =>
      qs.map((q) => (q.clientId === clientId ? { ...q, correctAnswerId: optionId } : q))
    );
  }

  protected addOption(clientId: string): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.options.length >= 6) return q;
        return { ...q, options: [...q.options, createOption(crypto.randomUUID(), '')] };
      })
    );
  }

  protected removeOption(clientId: string, optionIdx: number): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.options.length <= 2) return q;
        const removed = q.options[optionIdx];
        const options = q.options.filter((_, i) => i !== optionIdx);
        const correctAnswerId =
          q.correctAnswerId === removed.id ? (options[0]?.id ?? '') : q.correctAnswerId;
        return { ...q, options, correctAnswerId };
      })
    );
  }

  protected updateTimeLimit(clientId: string, value: number): void {
    this.questions.update((qs) =>
      qs.map((q) =>
        q.clientId === clientId ? { ...q, timeLimit: Math.max(5, Math.min(120, value)) } : q
      )
    );
  }

  protected updatePoints(clientId: string, value: number): void {
    this.questions.update((qs) =>
      qs.map((q) =>
        q.clientId === clientId ? { ...q, points: Math.max(0, Math.min(1000, value)) } : q
      )
    );
  }

  /* ─── Validation & Save ─── */
  protected getQuestionErrors(clientId: string): FieldError[] {
    const q = this.questions().find((qt) => qt.clientId === clientId);
    return q ? validateQuestion(q) : [];
  }

  protected isValid(): boolean {
    if (!this.title().trim()) return false;
    return this.questions().every((q) => validateQuestion(q).length === 0);
  }

  protected save(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (!this.title().trim()) {
      this.errorMessage.set('Please enter a quiz title.');
      return;
    }

    const allErrors: FieldError[] = [];
    for (const q of this.questions()) {
      allErrors.push(...validateQuestion(q));
    }

    if (allErrors.length > 0) {
      // Scroll to first error by focusing the title — user can see red indicators
      this.errorMessage.set(
        `${allErrors.length} issue${allErrors.length > 1 ? 's' : ''} need${allErrors.length === 1 ? 's' : ''} fixing.`
      );
      return;
    }

    this.isSaving.set(true);

    const questionsPayload = this.questions().map((q) => ({
      text: q.text.trim(),
      type: q.type,
      options: q.options,
      correct_answer: q.correctAnswerId,
      time_limit: q.timeLimit,
      points: q.points,
    }));

    const payload = {
      title: this.title().trim(),
      description: this.description().trim() || undefined,
      questions: questionsPayload,
    };

    const isEdit = this.isEditMode() && this.quizId() !== null;

    if (isEdit) {
      this.quizApi
        .updateQuiz(this.quizId()!, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(this.saveHandler('Quiz updated successfully!'));
    } else {
      this.quizApi
        .createQuiz(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(this.saveHandler('Quiz created successfully!'));
    }
  }

  private saveHandler(successMessage: string) {
    return {
      next: () => {
        this.successMessage.set(successMessage);
        setTimeout(() => {
          void this.router.navigate(['/dashboard/quizzes']);
        }, 800);
      },
      error: () => {
        this.errorMessage.set('Something went wrong. Please try again.');
        this.isSaving.set(false);
      },
      complete: () => {
        this.isSaving.set(false);
      },
    };
  }

  /* ─── Navigation ─── */
  protected goBack(): void {
    void this.router.navigate(['/dashboard/quizzes']);
  }

  /* ─── Selection helper (new) ─── */
  protected selectQuestion(clientId: string): void {
    this.selectedQuestionId.set(clientId);
  }

  /* ─── Description toggle (new) ─── */
  protected toggleDescription(): void {
    this.showDescription.update((v) => !v);
  }

  /* ─── Template helpers for `$event` casting ─── */
  protected onTitleInput(event: Event): void {
    this.title.set((event.target as HTMLInputElement).value);
  }

  protected onDescriptionInput(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value);
  }

  protected onQuestionTextInput(clientId: string, event: Event): void {
    this.updateQuestionText(clientId, (event.target as HTMLTextAreaElement).value);
  }

  protected onOptionTextInput(clientId: string, optionIdx: number, event: Event): void {
    this.updateOptionText(clientId, optionIdx, (event.target as HTMLInputElement).value);
  }

  protected onTypeSelect(clientId: string, event: Event): void {
    this.updateQuestionType(
      clientId,
      (event.target as HTMLSelectElement).value as 'multiple-choice' | 'true-false'
    );
  }

  protected onTimeLimitInput(clientId: string, event: Event): void {
    this.updateTimeLimit(clientId, parseInt((event.target as HTMLInputElement).value) || 30);
  }

  protected onPointsInput(clientId: string, event: Event): void {
    this.updatePoints(clientId, parseInt((event.target as HTMLInputElement).value) || 0);
  }

  /* ─── Type helpers (used in template) ─── */
  protected readonly questionTypeOptions = [
    { value: 'multiple-choice', label: 'Multiple Choice' },
    { value: 'true-false', label: 'True / False' },
  ];

  protected optionLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  /** Returns a short label for the question type, used in the left list chips. */
  protected questionTypeLabel(type: 'multiple-choice' | 'true-false'): string {
    return type === 'multiple-choice' ? 'Multiple Choice' : 'True / False';
  }
}
