import { CommonModule } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  text: string;
  type: 'multiple-choice' | 'true-false' | 'open';
  options?: QuestionOption[];
  correct_answer: string;
  time_limit?: number;
  points?: number;
}

export interface QuestionValidationError {
  field: string;
  message: string;
}

export function createDefaultQuestion(): Question {
  return {
    text: '',
    type: 'multiple-choice',
    options: [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
    ],
    correct_answer: 'A',
    time_limit: 30,
    points: 100,
  };
}

export function validateQuestion(question: Question): QuestionValidationError[] {
  const errors: QuestionValidationError[] = [];

  if (!question.text.trim()) {
    errors.push({ field: 'text', message: 'Question text is required' });
  } else if (question.text.length > 500) {
    errors.push({ field: 'text', message: 'Question must be 500 characters or less' });
  }

  if (question.type === 'multiple-choice' || question.type === 'true-false') {
    const options = question.options ?? [];

    if (options.length < 2) {
      errors.push({ field: 'options', message: 'At least 2 answer options are required' });
    }

    options.forEach((option, index) => {
      if (!option.text.trim()) {
        errors.push({
          field: `option-${index}`,
          message: `Answer option ${option.id} cannot be empty`,
        });
      } else if (option.text.length > 500) {
        errors.push({
          field: `option-${index}`,
          message: 'Answer option must be 500 characters or less',
        });
      }
    });

    const optionIds = new Set(options.map((option) => option.id));
    if (!optionIds.has(question.correct_answer)) {
      errors.push({ field: 'correct_answer', message: 'A correct answer must be marked' });
    }
  }

  const timeLimit = question.time_limit ?? 30;
  if (timeLimit < 5 || timeLimit > 120) {
    errors.push({ field: 'time_limit', message: 'Time limit must be between 5 and 120 seconds' });
  }

  const points = question.points ?? 100;
  if (points < 0 || points > 1000) {
    errors.push({ field: 'points', message: 'Points must be between 0 and 1000' });
  }

  return errors;
}

@Component({
  selector: 'app-question-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './question-editor.component.html',
  styleUrl: './question-editor.component.css',
})
export class QuestionEditorComponent {
  question = input<Question | undefined>();
  questionUpdated = output<Question>();

  questionText = signal('');
  questionType = signal<'multiple-choice' | 'true-false'>('multiple-choice');
  answerOptions = signal<QuestionOption[]>([
    { id: 'A', text: '' },
    { id: 'B', text: '' },
  ]);
  correctAnswerId = signal('A');
  timeLimit = signal(30);
  points = signal(100);
  validationErrors = signal<QuestionValidationError[]>([]);

  readonly isValid = computed(() => this.validationErrors().length === 0);

  readonly currentQuestion = computed<Question>(() => {
    const question: Question = {
      text: this.questionText(),
      type: this.questionType(),
      correct_answer: this.correctAnswerId(),
      time_limit: this.timeLimit(),
      points: this.points(),
    };

    if (question.type === 'multiple-choice' || question.type === 'true-false') {
      question.options = this.answerOptions();
    }

    return question;
  });

  private readonly ready = signal(false);
  private readonly loadedQuestion = signal<Question | null>(null);

  constructor() {
    effect(() => {
      const inputQuestion = this.question();
      const loadedQuestion = this.loadedQuestion();

      if (inputQuestion) {
        if (!loadedQuestion || !this.questionsMatch(inputQuestion, loadedQuestion)) {
          this.loadQuestion(inputQuestion);
          this.loadedQuestion.set(this.cloneQuestion(inputQuestion));
          this.ready.set(true);
        }

        return;
      }

      if (!loadedQuestion) {
        const defaultQuestion = createDefaultQuestion();
        this.loadQuestion(defaultQuestion);
        this.loadedQuestion.set(this.cloneQuestion(defaultQuestion));
        this.ready.set(true);
      }
    });

    effect(() => {
      const currentQuestion = this.currentQuestion();

      this.validationErrors.set(validateQuestion(currentQuestion));

      if (this.ready()) {
        this.questionUpdated.emit(currentQuestion);
      }
    });
  }

  hasFieldError(fieldName: string): boolean {
    return this.validationErrors().some((error) => error.field === fieldName);
  }

  getFieldError(fieldName: string): string {
    return this.validationErrors().find((error) => error.field === fieldName)?.message ?? '';
  }

  updateQuestionText(text: string): void {
    this.questionText.set(text);
  }

  onQuestionTextInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    this.updateQuestionText(target?.value ?? '');
  }

  updateQuestionType(type: 'multiple-choice' | 'true-false'): void {
    this.questionType.set(type);

    if (type === 'true-false') {
      this.answerOptions.set([
        { id: 'A', text: 'True' },
        { id: 'B', text: 'False' },
      ]);
      this.correctAnswerId.set('A');
      return;
    }

    this.answerOptions.set([
      { id: 'A', text: '' },
      { id: 'B', text: '' },
    ]);
    this.correctAnswerId.set('A');
  }

  updateAnswerOption(index: number, text: string): void {
    const options = [...this.answerOptions()];

    if (!options[index]) {
      return;
    }

    options[index] = { ...options[index], text };
    this.answerOptions.set(options);
  }

  onAnswerOptionInput(index: number, event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.updateAnswerOption(index, target?.value ?? '');
  }

  markAsCorrect(optionId: string): void {
    this.correctAnswerId.set(optionId);
  }

  addAnswerOption(): void {
    if (this.questionType() !== 'multiple-choice') {
      return;
    }

    const options = [...this.answerOptions()];

    if (options.length >= 6) {
      return;
    }

    const nextId = String.fromCharCode(65 + options.length);
    this.answerOptions.set([...options, { id: nextId, text: '' }]);
  }

  removeAnswerOption(index: number): void {
    if (this.questionType() !== 'multiple-choice') {
      return;
    }

    const options = [...this.answerOptions()];

    if (options.length <= 2 || !options[index]) {
      return;
    }

    const removedId = options[index].id;
    options.splice(index, 1);
    this.answerOptions.set(options);

    if (removedId === this.correctAnswerId()) {
      this.correctAnswerId.set(options[0].id);
    }
  }

  updateTimeLimit(value: number): void {
    this.timeLimit.set(Math.max(5, Math.min(120, value)));
  }

  onTimeLimitInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.updateTimeLimit(Number(target?.value ?? 0));
  }

  updatePoints(value: number): void {
    this.points.set(Math.max(0, Math.min(1000, value)));
  }

  onPointsInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.updatePoints(Number(target?.value ?? 0));
  }

  getErrors(): QuestionValidationError[] {
    return this.validationErrors();
  }

  private loadQuestion(question: Question): void {
    this.questionText.set(question.text);

    if (question.type === 'true-false') {
      this.questionType.set('true-false');
      this.answerOptions.set(
        question.options?.length
          ? question.options
          : [
              { id: 'A', text: 'True' },
              { id: 'B', text: 'False' },
            ]
      );
    } else {
      this.questionType.set('multiple-choice');
      this.answerOptions.set(
        question.options?.length
          ? question.options
          : [
              { id: 'A', text: '' },
              { id: 'B', text: '' },
            ]
      );
    }

    this.correctAnswerId.set(question.correct_answer);
    this.timeLimit.set(question.time_limit ?? 30);
    this.points.set(question.points ?? 100);
  }

  private cloneQuestion(question: Question): Question {
    return {
      ...question,
      options: question.options?.map((option) => ({ ...option })),
    };
  }

  private questionsMatch(left: Question, right: Question): boolean {
    if (
      left.text !== right.text ||
      left.type !== right.type ||
      left.correct_answer !== right.correct_answer ||
      (left.time_limit ?? 30) !== (right.time_limit ?? 30) ||
      (left.points ?? 100) !== (right.points ?? 100)
    ) {
      return false;
    }

    const leftOptions = left.options ?? [];
    const rightOptions = right.options ?? [];

    if (leftOptions.length !== rightOptions.length) {
      return false;
    }

    return leftOptions.every(
      (option, index) =>
        option.id === rightOptions[index]?.id && option.text === rightOptions[index]?.text
    );
  }
}
