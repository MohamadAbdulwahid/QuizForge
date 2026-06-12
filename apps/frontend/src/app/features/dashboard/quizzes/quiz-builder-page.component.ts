import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  QuestionType,
  QuizApiService,
  QuizQuestionDto,
  QuizOptionDto,
  QuizQuestionPayload,
  QuizSavePayload,
} from '../../../core/services/quiz-api.service';
import { BubblyAlertComponent } from '../../../shared/ui/bubbly-alert.component';
import { BubblyButtonComponent } from '../../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../../shared/ui/bubbly-card.component';
import { QUESTION_TYPES, QuestionTypeConfig } from '../../quiz/types/question-types';

/* ─── Types ─── */

/**
 * Alias for the canonical option shape from the API. Reusing it (instead of
 * redefining) keeps the draft layer and the save payload in lock-step —
 * matching options get `matchId`, FIB options get `answer`/`caseSensitive`,
 * the rest just need `id` + `text`.
 */
type QuestionOption = QuizOptionDto;

interface QuestionDraft {
  clientId: string;
  text: string;
  type: QuestionType;
  /**
   * Flat options list. For `multiple-choice`, `true-false`, and `ordering`
   * each entry is `{id, text}`. For `fill-in-blank` each entry is
   * `{id, answer, caseSensitive}` (text is unused / blank). For `matching`
   * this is the LEFT column (with `matchId` pointing to a right option).
   */
  options: QuestionOption[];
  /** Matching only: the RIGHT column (text only, no matchId). */
  rightOptions?: QuestionOption[];
  /**
   * Id of the correct option (MC, TF) or ignored for types where the
   * correct answer is derived from the option order or matchId.
   */
  correctAnswerId: string;
  timeLimit: number;
  points: number;
}

interface FieldError {
  field: string;
  message: string;
}

/* ─── Constants ─── */

const MIN_MC_OPTIONS = 2;
const MAX_MC_OPTIONS = 6;
const MIN_ORDERING_ITEMS = 2;
const MAX_ORDERING_ITEMS = 8;
const MIN_MATCHING_PAIRS = 2;
const MAX_MATCHING_PAIRS = 6;

/* ─── Helpers ─── */

function createOption(id: string, text = ''): QuestionOption {
  return { id, text };
}

function createFibOption(id: string, answer = ''): QuestionOption {
  return { id, text: '', answer, caseSensitive: false };
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

/**
 * Returns the seed options for a freshly-added question of the given type.
 * For matching, returns both columns. The `correctAnswerId` is set by the
 * caller (initially empty except for TF where it points at the "True" option).
 */
function defaultOptionsForType(type: QuestionType): {
  left: QuestionOption[];
  right?: QuestionOption[];
} {
  switch (type) {
    case 'true-false': {
      const trueOpt = createOption(crypto.randomUUID(), 'True');
      const falseOpt = createOption(crypto.randomUUID(), 'False');
      return { left: [trueOpt, falseOpt], right: undefined };
    }
    case 'matching': {
      return {
        left: [createOption(crypto.randomUUID(), ''), createOption(crypto.randomUUID(), '')],
        right: [createOption(crypto.randomUUID(), ''), createOption(crypto.randomUUID(), '')],
      };
    }
    case 'fill-in-blank':
      return { left: [createFibOption(crypto.randomUUID(), '')], right: undefined };
    case 'ordering':
      return {
        left: [createOption(crypto.randomUUID(), ''), createOption(crypto.randomUUID(), '')],
        right: undefined,
      };
    case 'multiple-choice':
    default:
      return {
        left: [createOption(crypto.randomUUID(), ''), createOption(crypto.randomUUID(), '')],
        right: undefined,
      };
  }
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

  switch (q.type) {
    case 'multiple-choice': {
      if (q.options.length < MIN_MC_OPTIONS) {
        errors.push({
          field: `${q.clientId}-options`,
          message: `At least ${MIN_MC_OPTIONS} options required.`,
        });
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
      break;
    }
    case 'true-false': {
      if (!q.correctAnswerId || !q.options.find((o) => o.id === q.correctAnswerId)) {
        errors.push({
          field: `${q.clientId}-correct`,
          message: 'Select True or False as the correct answer.',
        });
      }
      break;
    }
    case 'ordering': {
      if (q.options.length < MIN_ORDERING_ITEMS) {
        errors.push({
          field: `${q.clientId}-options`,
          message: `At least ${MIN_ORDERING_ITEMS} items required.`,
        });
      }
      q.options.forEach((opt, i) => {
        if (!opt.text.trim()) {
          errors.push({
            field: `${q.clientId}-opt-${i}`,
            message: `Item ${i + 1} cannot be empty.`,
          });
        } else if (opt.text.length > 500) {
          errors.push({
            field: `${q.clientId}-opt-${i}`,
            message: `Item ${i + 1} must be under 500 characters.`,
          });
        }
      });
      break;
    }
    case 'matching': {
      const left = q.options;
      const right = q.rightOptions ?? [];
      if (left.length < MIN_MATCHING_PAIRS || right.length < MIN_MATCHING_PAIRS) {
        errors.push({
          field: `${q.clientId}-options`,
          message: `At least ${MIN_MATCHING_PAIRS} pairs required.`,
        });
      }
      const rightIds = new Set(right.map((o) => o.id));
      left.forEach((opt, i) => {
        if (!opt.text.trim()) {
          errors.push({
            field: `${q.clientId}-opt-${i}`,
            message: `Prompt ${String.fromCharCode(65 + i)} cannot be empty.`,
          });
        } else if (opt.text.length > 500) {
          errors.push({
            field: `${q.clientId}-opt-${i}`,
            message: `Prompt ${String.fromCharCode(65 + i)} must be under 500 characters.`,
          });
        }
        if (!opt.matchId || !rightIds.has(opt.matchId)) {
          errors.push({
            field: `${q.clientId}-opt-${i}`,
            message: `Prompt ${String.fromCharCode(65 + i)} must be paired with an answer.`,
          });
        }
      });
      right.forEach((opt, i) => {
        if (!opt.text.trim()) {
          errors.push({
            field: `${q.clientId}-right-${i}`,
            message: `Answer ${i + 1} cannot be empty.`,
          });
        } else if (opt.text.length > 500) {
          errors.push({
            field: `${q.clientId}-right-${i}`,
            message: `Answer ${i + 1} must be under 500 characters.`,
          });
        }
      });
      break;
    }
    case 'fill-in-blank': {
      if (q.options.length < 1) {
        errors.push({
          field: `${q.clientId}-options`,
          message: 'At least one accepted answer is required.',
        });
      }
      q.options.forEach((opt, i) => {
        const answer = opt.answer ?? '';
        if (!answer.trim()) {
          errors.push({
            field: `${q.clientId}-opt-${i}`,
            message: `Answer ${i + 1} cannot be empty.`,
          });
        } else if (answer.length > 500) {
          errors.push({
            field: `${q.clientId}-opt-${i}`,
            message: `Answer ${i + 1} must be under 500 characters.`,
          });
        }
      });
      break;
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

  /* ─── Selection state ─── */
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

  /** Exposed to the template so `@for` can render the segmented type picker. */
  protected readonly questionTypes: readonly QuestionTypeConfig[] = QUESTION_TYPES;

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

          const rawQuestions = quiz.questions;
          if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
            this.questions.set([]);
            return;
          }

          const drafts = rawQuestions.map((q) => this.detailToDraft(q));
          this.questions.set(drafts);
        },
        error: () => {
          this.errorMessage.set('Failed to load quiz. It may have been deleted.');
        },
      });
  }

  /**
   * Converts a `QuizQuestionDto` (the API contract) into the in-memory
   * `QuestionDraft` used by the editor. Handles all 5 question types.
   *
   * For matching, the wire contract splits the saved `{left, right}` blob
   * into a flat `options` (left) + optional `rightOptions` (right). If the
   * API ever returns matching data as `{left, right}` inside `options` (the
   * raw jsonb shape), we still recover gracefully.
   */
  private detailToDraft(q: QuizQuestionDto): QuestionDraft {
    const base = {
      clientId: crypto.randomUUID(),
      text: q.text,
      timeLimit: q.time_limit ?? 30,
      points: q.points ?? 100,
    };

    switch (q.type) {
      case 'true-false': {
        const trueOpt =
          q.options.find((o) => o.text === 'True') ?? createOption(crypto.randomUUID(), 'True');
        const falseOpt =
          q.options.find((o) => o.text === 'False') ?? createOption(crypto.randomUUID(), 'False');
        const storedAnswer = q.correct_answer ?? '';
        // Prefer the option whose text matches the stored answer; fall back to True.
        const match =
          q.options.find((o) => o.text.toLowerCase() === storedAnswer.toLowerCase()) ??
          (storedAnswer === 'false' ? falseOpt : trueOpt);
        return {
          ...base,
          type: 'true-false',
          options: [trueOpt, falseOpt],
          correctAnswerId: match.id,
        };
      }
      case 'matching': {
        // Prefer the DTO contract (options = left, rightOptions = right). Fall
        // back to the raw `{left, right}` jsonb shape if `rightOptions` is
        // missing — defensive against older data.
        let left: QuestionOption[] = [];
        let right: QuestionOption[] = q.rightOptions ?? [];

        // Detect the raw `{left, right}` jsonb shape at runtime — the typed
        // surface is always a flat array, so we cast and probe the shape.
        const rawOptions = q.options as unknown;
        if (
          rawOptions &&
          typeof rawOptions === 'object' &&
          !Array.isArray(rawOptions) &&
          'left' in rawOptions &&
          'right' in rawOptions
        ) {
          const shaped = rawOptions as { left?: QuestionOption[]; right?: QuestionOption[] };
          left = shaped.left ?? [];
          if (right.length === 0) {
            right = shaped.right ?? [];
          }
        } else if (Array.isArray(q.options)) {
          // Standard DTO contract: options is the left column.
          left = q.options;
        }
        // Fill any missing column with defaults (preserves the other column).
        if (left.length === 0) {
          left = defaultOptionsForType('matching').left;
        }
        if (right.length === 0) {
          right = defaultOptionsForType('matching').right ?? [];
        }
        // Ensure every left has a matchId pointing to a real right (rehydrate
        // from the saved `correct_answer` JSON if needed).
        const rightIds = new Set(right.map((o) => o.id));
        const pairs = this.parseMatchingPairs(q.correct_answer);
        left = left.map((opt) => {
          if (opt.matchId && rightIds.has(opt.matchId)) {
            return opt;
          }
          const fallback = pairs[opt.id];
          if (fallback && rightIds.has(fallback)) {
            return { ...opt, matchId: fallback };
          }
          // Last resort: pair by index.
          const idx = left.indexOf(opt);
          return { ...opt, matchId: right[idx]?.id ?? '' };
        });
        return {
          ...base,
          type: 'matching',
          options: left,
          rightOptions: right,
          correctAnswerId: '',
        };
      }
      case 'fill-in-blank': {
        const answers =
          q.options.length > 0
            ? q.options.map((o) => ({
                id: o.id,
                text: '',
                answer: o.answer ?? '',
                caseSensitive: o.caseSensitive ?? false,
              }))
            : [createFibOption(crypto.randomUUID(), '')];
        return {
          ...base,
          type: 'fill-in-blank',
          options: answers,
          correctAnswerId: '',
        };
      }
      case 'ordering': {
        const items = q.options.length > 0 ? q.options : defaultOptionsForType('ordering').left;
        return {
          ...base,
          type: 'ordering',
          options: items.map((o) => ({ id: o.id, text: o.text })),
          correctAnswerId: '',
        };
      }
      case 'multiple-choice':
      default: {
        const options =
          q.options.length > 0 ? q.options : defaultOptionsForType('multiple-choice').left;
        return {
          ...base,
          type: 'multiple-choice',
          options,
          correctAnswerId: q.correct_answer ?? options[0]?.id ?? '',
        };
      }
    }
  }

  /**
   * Decodes a matching question's `correct_answer` (a JSON object string
   * of `{leftId: rightId}`) into a plain record. Returns an empty object
   * on any parse failure.
   */
  private parseMatchingPairs(correctAnswer: string | null): Record<string, string> {
    if (!correctAnswer) return {};
    try {
      const parsed = JSON.parse(correctAnswer) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      /* ignore */
    }
    return {};
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

  /**
   * Switches a question's type. Resets the options, right options, and
   * correct answer id to the canonical defaults for the new type so the
   * editor always opens with a valid skeleton.
   */
  protected updateQuestionType(clientId: string, type: QuestionType): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId) return q;
        const defaults = defaultOptionsForType(type);
        let correctAnswerId = '';
        if (type === 'true-false') {
          // Default the correct answer to the "True" option.
          correctAnswerId = defaults.left[0]?.id ?? '';
        } else if (type === 'matching') {
          // Pre-pair each left with the right of the same index.
          const right = defaults.right ?? [];
          const left = defaults.left.map((opt, i) => ({
            ...opt,
            matchId: right[i]?.id ?? '',
          }));
          return { ...q, type, options: left, rightOptions: right, correctAnswerId };
        }
        return { ...q, type, options: defaults.left, rightOptions: undefined, correctAnswerId };
      })
    );
  }

  /* ─── MC option mutations ─── */

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
        if (q.clientId !== clientId || q.type !== 'multiple-choice') return q;
        if (q.options.length >= MAX_MC_OPTIONS) return q;
        return { ...q, options: [...q.options, createOption(crypto.randomUUID(), '')] };
      })
    );
  }

  protected removeOption(clientId: string, optionIdx: number): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'multiple-choice') return q;
        if (q.options.length <= MIN_MC_OPTIONS) return q;
        const removed = q.options[optionIdx];
        const options = q.options.filter((_, i) => i !== optionIdx);
        const correctAnswerId =
          q.correctAnswerId === removed.id ? (options[0]?.id ?? '') : q.correctAnswerId;
        return { ...q, options, correctAnswerId };
      })
    );
  }

  /* ─── Ordering mutations ─── */

  protected addOrderingItem(clientId: string): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'ordering') return q;
        if (q.options.length >= MAX_ORDERING_ITEMS) return q;
        return { ...q, options: [...q.options, createOption(crypto.randomUUID(), '')] };
      })
    );
  }

  protected removeOrderingItem(clientId: string, idx: number): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'ordering') return q;
        if (q.options.length <= MIN_ORDERING_ITEMS) return q;
        return { ...q, options: q.options.filter((_, i) => i !== idx) };
      })
    );
  }

  protected moveOrderingItem(clientId: string, idx: number, direction: 'up' | 'down'): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'ordering') return q;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= q.options.length) return q;
        const options = [...q.options];
        [options[idx], options[targetIdx]] = [options[targetIdx], options[idx]];
        return { ...q, options };
      })
    );
  }

  /* ─── Matching mutations ─── */

  /** Adds a blank left option and a blank right option (paired by index). */
  protected addMatchingPair(clientId: string): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'matching') return q;
        const leftLen = q.options.length;
        const rightLen = q.rightOptions?.length ?? 0;
        if (leftLen >= MAX_MATCHING_PAIRS || rightLen >= MAX_MATCHING_PAIRS) return q;
        const newRight = createOption(crypto.randomUUID(), '');
        const newLeft = { ...createOption(crypto.randomUUID(), ''), matchId: newRight.id };
        return {
          ...q,
          options: [...q.options, newLeft],
          rightOptions: [...(q.rightOptions ?? []), newRight],
        };
      })
    );
  }

  /**
   * Removes a pair (left + right at the same index) and re-pairs any left
   * whose matchId pointed to the removed right so all remaining lefts
   * stay bound to a valid right.
   */
  protected removeMatchingPair(clientId: string, idx: number): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'matching') return q;
        const leftLen = q.options.length;
        const rightLen = q.rightOptions?.length ?? 0;
        if (leftLen <= MIN_MATCHING_PAIRS || rightLen <= MIN_MATCHING_PAIRS) return q;
        const removedRightId = q.rightOptions?.[idx]?.id;
        const options = q.options
          .filter((_, i) => i !== idx)
          .map((opt) =>
            opt.matchId === removedRightId
              ? {
                  ...opt,
                  matchId: q.rightOptions?.[idx + 1]?.id ?? q.rightOptions?.[idx - 1]?.id ?? '',
                }
              : opt
          );
        const rightOptions = (q.rightOptions ?? []).filter((_, i) => i !== idx);
        return { ...q, options, rightOptions };
      })
    );
  }

  protected updateMatchingLeftText(clientId: string, idx: number, text: string): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'matching') return q;
        const options = q.options.map((opt, i) => (i === idx ? { ...opt, text } : opt));
        return { ...q, options };
      })
    );
  }

  protected updateMatchingRightText(clientId: string, idx: number, text: string): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'matching') return q;
        const rightOptions = (q.rightOptions ?? []).map((opt, i) =>
          i === idx ? { ...opt, text } : opt
        );
        return { ...q, rightOptions };
      })
    );
  }

  /** Sets `options[leftIdx].matchId = matchId` (the id of a right option). */
  protected updateMatchingPairing(clientId: string, leftIdx: number, matchId: string): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'matching') return q;
        const options = q.options.map((opt, i) => (i === leftIdx ? { ...opt, matchId } : opt));
        return { ...q, options };
      })
    );
  }

  /* ─── Fill-in-blank mutations ─── */

  protected addFibAnswer(clientId: string): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'fill-in-blank') return q;
        return { ...q, options: [...q.options, createFibOption(crypto.randomUUID(), '')] };
      })
    );
  }

  protected removeFibAnswer(clientId: string, idx: number): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'fill-in-blank') return q;
        if (q.options.length <= 1) return q;
        return { ...q, options: q.options.filter((_, i) => i !== idx) };
      })
    );
  }

  protected updateFibAnswerText(clientId: string, idx: number, text: string): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'fill-in-blank') return q;
        const options = q.options.map((opt, i) =>
          i === idx ? { ...opt, answer: text, text: '' } : opt
        );
        return { ...q, options };
      })
    );
  }

  protected toggleFibCaseSensitive(clientId: string, idx: number): void {
    this.questions.update((qs) =>
      qs.map((q) => {
        if (q.clientId !== clientId || q.type !== 'fill-in-blank') return q;
        const options = q.options.map((opt, i) =>
          i === idx ? { ...opt, caseSensitive: !opt.caseSensitive } : opt
        );
        return { ...q, options };
      })
    );
  }

  /* ─── Time/points ─── */

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

  /**
   * Builds the per-type save payload. The discriminated union in
   * `QuizQuestionPayload` is the source of truth: MC/TF/ordering/FIB
   * use the flat `options` shape; matching uses the `{left, right}` shape.
   * `correct_answer` semantics vary by type and are documented inline.
   */
  private buildQuestionPayload(q: QuestionDraft): QuizQuestionPayload {
    const text = q.text.trim();
    const timeLimit = q.timeLimit;
    const points = q.points;

    if (q.type === 'matching') {
      const left = q.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        matchId: opt.matchId ?? '',
      }));
      const right = (q.rightOptions ?? []).map((opt) => ({ id: opt.id, text: opt.text }));
      // Build the `{leftId: rightId}` map from each left's matchId.
      const pairs: Record<string, string> = {};
      for (const opt of left) {
        if (opt.matchId) pairs[opt.id] = opt.matchId;
      }
      return {
        text,
        type: 'matching',
        options: { left, right },
        correct_answer: JSON.stringify(pairs),
        time_limit: timeLimit,
        points,
      };
    }

    if (q.type === 'true-false') {
      // Read the text of the marked-correct option and lowercase it — the
      // backend's Zod enum requires the literal strings 'true' or 'false'.
      const chosen = q.options.find((o) => o.id === q.correctAnswerId);
      const literal = (chosen?.text ?? 'True').toLowerCase() as 'true' | 'false';
      return {
        text,
        type: 'true-false',
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        correct_answer: literal,
        time_limit: timeLimit,
        points,
      };
    }

    if (q.type === 'ordering') {
      // The canonical answer is the option-id list in the saved order.
      return {
        text,
        type: 'ordering',
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        correct_answer: JSON.stringify(q.options.map((o) => o.id)),
        time_limit: timeLimit,
        points,
      };
    }

    if (q.type === 'fill-in-blank') {
      // The first answer is the canonical one (per spec).
      const first = q.options[0];
      const canonical = first?.answer ?? '';
      return {
        text,
        type: 'fill-in-blank',
        options: q.options.map((o) => ({
          id: o.id,
          text: '',
          answer: o.answer ?? '',
          caseSensitive: o.caseSensitive ?? false,
        })),
        correct_answer: canonical,
        time_limit: timeLimit,
        points,
      };
    }

    // multiple-choice
    return {
      text,
      type: 'multiple-choice',
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      correct_answer: q.correctAnswerId,
      time_limit: timeLimit,
      points,
    };
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
      this.errorMessage.set(
        `${allErrors.length} issue${allErrors.length > 1 ? 's' : ''} need${allErrors.length === 1 ? 's' : ''} fixing.`
      );
      return;
    }

    this.isSaving.set(true);

    const questionsPayload: QuizQuestionPayload[] = this.questions().map((q) =>
      this.buildQuestionPayload(q)
    );

    const payload: QuizSavePayload = {
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

  /* ─── Selection helpers ─── */
  protected selectQuestion(clientId: string): void {
    this.selectedQuestionId.set(clientId);
  }

  /* ─── Description toggle ─── */
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

  protected onTypeSelect(clientId: string, type: QuestionType): void {
    this.updateQuestionType(clientId, type);
  }

  protected onTimeLimitInput(clientId: string, event: Event): void {
    this.updateTimeLimit(clientId, parseInt((event.target as HTMLInputElement).value) || 30);
  }

  protected onPointsInput(clientId: string, event: Event): void {
    this.updatePoints(clientId, parseInt((event.target as HTMLInputElement).value) || 0);
  }

  /* ─── Type / option label helpers ─── */

  /** Returns the human label for a question type, used in the left list chips. */
  protected questionTypeLabel(type: QuestionType): string {
    return QUESTION_TYPES.find((t) => t.id === type)?.label ?? type;
  }

  protected optionLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  /** True if the given left option has a non-empty matchId (UI: shows a checkmark). */
  protected isPaired(option: QuestionOption): boolean {
    return !!option.matchId;
  }
}
