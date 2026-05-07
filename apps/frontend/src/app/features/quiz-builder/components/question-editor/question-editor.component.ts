import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

/**
 * Question Option Model
 */
interface QuestionOption {
  id: string;
  text: string;
}

/**
 * Question Model (matches backend QuestionInput type)
 */
export interface Question {
  text: string;
  type: 'multiple-choice' | 'true-false' | 'open';
  options?: QuestionOption[];
  correct_answer: string;
  time_limit?: number;
  points?: number;
}

/**
 * Validation Error Model
 */
interface ValidationError {
  field: string;
  message: string;
}

/**
 * QuestionEditorComponent - Child component for editing individual questions in quiz builder
 *
 * Features:
 * - Question type selection (multiple-choice, true-false, open)
 * - Dynamic answer option management with "Add Answer" button
 * - Correct answer toggle/marking
 * - Form validation matching backend DTOs
 * - Bubbly Minimalism UI design
 *
 * @example
 * <app-question-editor
 *   [question]="currentQuestion()"
 *   (questionUpdated)="onQuestionUpdated($event)"
 *   (questionsRemoved)="onQuestionRemoved(index)"
 * />
 */
@Component({
  selector: 'app-question-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './question-editor.component.html',
  styleUrl: './question-editor.component.css',
})
export class QuestionEditorComponent implements OnInit {
  // ============ Inputs ============
  /** Individual question being edited - passed from parent quiz-builder */
  question = input<Question>();

  // ============ Outputs ============
  /** Emitted when question data changes */
  questionUpdated = output<Question>();

  // ============ Local State (Signals) ============
  /** Question text */
  questionText = signal<string>('');

  /** Question type: multiple-choice or true-false */
  questionType = signal<'multiple-choice' | 'true-false'>('multiple-choice');

  /** Array of answer options (only for multiple-choice and true-false) */
  answerOptions = signal<QuestionOption[]>([
    { id: 'A', text: '' },
    { id: 'B', text: '' },
  ]);

  /** Currently selected correct answer ID */
  correctAnswerId = signal<string>('A');

  /** Time limit in seconds (5-120) */
  timeLimit = signal<number>(30);

  /** Points value for the question (0-1000) */
  points = signal<number>(100);

  /** Validation errors */
  validationErrors = signal<ValidationError[]>([]);

  // ============ Computed Values ============
  /**
   * Validates entire question and returns true if all fields are valid
   */
  isValid = computed(() => {
    const errors: ValidationError[] = [];

    // Question text validation
    if (!this.questionText().trim()) {
      errors.push({ field: 'text', message: 'Question text is required' });
    } else if (this.questionText().length > 500) {
      errors.push({ field: 'text', message: 'Question must be 500 characters or less' });
    }

    // Type-specific validations
    const type = this.questionType();
    if (type === 'multiple-choice' || type === 'true-false') {
      const options = this.answerOptions();

      // Min 2 options validation
      if (options.length < 2) {
        errors.push({
          field: 'options',
          message: 'At least 2 answer options are required',
        });
      }

      // All options must have text
      options.forEach((option, idx) => {
        if (!option.text.trim()) {
          errors.push({
            field: `option-${idx}`,
            message: `Answer option ${option.id} cannot be empty`,
          });
        } else if (option.text.length > 500) {
          errors.push({
            field: `option-${idx}`,
            message: `Answer option must be 500 characters or less`,
          });
        }
      });

      // Correct answer validation - must match one of the option IDs
      const optionIds = new Set(options.map((o) => o.id));
      if (!optionIds.has(this.correctAnswerId())) {
        errors.push({
          field: 'correct_answer',
          message: 'A correct answer must be marked',
        });
      }
    }

    // Time limit validation (5-120 seconds)
    const time = this.timeLimit();
    if (time < 5 || time > 120) {
      errors.push({
        field: 'time_limit',
        message: 'Time limit must be between 5 and 120 seconds',
      });
    }

    // Points validation (0-1000)
    const pts = this.points();
    if (pts < 0 || pts > 1000) {
      errors.push({ field: 'points', message: 'Points must be between 0 and 1000' });
    }

    this.validationErrors.set(errors);
    return errors.length === 0;
  });

  /**
   * Returns the current question object based on signal values
   */
  currentQuestion = computed(() => {
    const question: Question = {
      text: this.questionText(),
      type: this.questionType(),
      correct_answer: this.correctAnswerId(),
      time_limit: this.timeLimit(),
      points: this.points(),
    };

    // Only include options for multiple-choice and true-false
    if (question.type === 'multiple-choice' || question.type === 'true-false') {
      question.options = this.answerOptions();
    }

    return question;
  });

  /**
   * Check if a specific field has validation error
   */
  hasFieldError = (fieldName: string) =>
    computed(() => this.validationErrors().some((e) => e.field === fieldName));

  /**
   * Get error message for a specific field
   */
  getFieldError = (fieldName: string) =>
    computed(() =>
      this.validationErrors().find((e) => e.field === fieldName)?.message || ''
    );

  // ============ Lifecycle ============
  constructor(private fb: FormBuilder) {
    // Effect to emit question update whenever signals change
    effect(() => {
      const isValidNow = this.isValid();
      if (isValidNow) {
        this.questionUpdated.emit(this.currentQuestion());
      }
    });
  }

  ngOnInit(): void {
    // Initialize from input if provided
    const inputQuestion = this.question();
    if (inputQuestion) {
      this.questionText.set(inputQuestion.text);
      this.questionType.set(inputQuestion.type as 'multiple-choice' | 'true-false');
      this.correctAnswerId.set(inputQuestion.correct_answer);
      this.timeLimit.set(inputQuestion.time_limit ?? 30);
      this.points.set(inputQuestion.points ?? 100);

      if (inputQuestion.options) {
        this.answerOptions.set(inputQuestion.options);
      }
    }
  }

  // ============ Methods ============
  /**
   * Update question text
   */
  updateQuestionText(text: string): void {
    this.questionText.set(text);
  }

  /**
   * Change question type
   */
  updateQuestionType(type: 'multiple-choice' | 'true-false'): void {
    this.questionType.set(type);

    // Reset answer options based on type
    if (type === 'true-false') {
      this.answerOptions.set([
        { id: 'A', text: 'True' },
        { id: 'B', text: 'False' },
      ]);
      this.correctAnswerId.set('A');
    } else if (type === 'multiple-choice') {
      this.answerOptions.set([
        { id: 'A', text: '' },
        { id: 'B', text: '' },
      ]);
      this.correctAnswerId.set('A');
    }
  }

  /**
   * Update a specific answer option text
   */
  updateAnswerOption(index: number, text: string): void {
    const options = [...this.answerOptions()];
    if (options[index]) {
      options[index].text = text;
      this.answerOptions.set(options);
    }
  }

  /**
   * Set which answer is correct
   */
  markAsCorrect(optionId: string): void {
    this.correctAnswerId.set(optionId);
  }

  /**
   * Add a new answer option (multiple-choice only)
   */
  addAnswerOption(): void {
    const options = [...this.answerOptions()];
    if (options.length < 6) {
      // Max 6 options
      const nextId = String.fromCharCode(65 + options.length); // A, B, C, D, E, F
      options.push({ id: nextId, text: '' });
      this.answerOptions.set(options);
    }
  }

  /**
   * Remove an answer option (only if more than 2 remain)
   */
  removeAnswerOption(index: number): void {
    const options = [...this.answerOptions()];
    if (options.length > 2) {
      const removedId = options[index].id;
      options.splice(index, 1);
      this.answerOptions.set(options);

      // If removed option was marked correct, mark the first one as correct
      if (removedId === this.correctAnswerId()) {
        this.correctAnswerId.set(options[0].id);
      }
    }
  }

  /**
   * Update time limit
   */
  updateTimeLimit(value: number): void {
    this.timeLimit.set(Math.max(5, Math.min(120, value)));
  }

  /**
   * Update points
   */
  updatePoints(value: number): void {
    this.points.set(Math.max(0, Math.min(1000, value)));
  }

  /**
   * Get all errors for display
   */
  getErrors(): ValidationError[] {
    return this.validationErrors();
  }
}
