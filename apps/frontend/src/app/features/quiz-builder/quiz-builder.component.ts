import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  QuizApiService,
  type QuizDetailDto,
  type QuizQuestionDto,
  type QuizSavePayload,
} from '../../core/services/quiz-api.service';
import {
  createDefaultQuestion,
  Question,
  QuestionEditorComponent,
  validateQuestion,
} from './components/question-editor/question-editor.component';

type QuestionDraft = Question & { clientId: string };

@Component({
  selector: 'app-quiz-builder',
  standalone: true,
  imports: [CommonModule, RouterLink, QuestionEditorComponent],
  templateUrl: './quiz-builder.component.html',
  styleUrl: './quiz-builder.component.css',
})
export class QuizBuilderComponent {
  private readonly quizApiService = inject(QuizApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly quizId = signal<number | null>(this.resolveQuizId());
  readonly title = signal('');
  readonly description = signal('');
  readonly questions = signal<QuestionDraft[]>([this.createQuestionDraft()]);
  readonly errorMessage = signal<string | null>(null);
  readonly isSaving = signal(false);

  readonly isEditMode = computed(() => this.quizId() !== null);

  readonly quizResource = resource<QuizDetailDto | null, number | null>({
    params: () => this.quizId(),
    loader: async ({ params }) => {
      if (params === null) {
        return null;
      }

      return firstValueFrom(this.quizApiService.getQuizById(params));
    },
  });

  constructor() {
    effect(() => {
      const error = this.quizResource.error();

      if (error) {
        this.errorMessage.set('Could not load quiz details.');
      }
    });

    effect(() => {
      const quiz = this.quizResource.value();

      if (!quiz) {
        return;
      }

      this.populateForm(quiz);
    });
  }

  updateTitle(value: string): void {
    this.title.set(value);
  }

  updateDescription(value: string): void {
    this.description.set(value);
  }

  addQuestion(): void {
    this.questions.update((current) => [...current, this.createQuestionDraft()]);
  }

  removeQuestion(clientId: string): void {
    this.questions.update((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((question) => question.clientId !== clientId);
    });
  }

  updateQuestion(clientId: string, question: Question): void {
    this.questions.update((current) =>
      current.map((draft) => (draft.clientId === clientId ? { ...question, clientId } : draft))
    );
  }

  async saveQuiz(): Promise<void> {
    this.errorMessage.set(null);

    const validationMessage = this.validateQuiz();
    if (validationMessage) {
      this.errorMessage.set(validationMessage);
      return;
    }

    const payload = this.buildPayload();
    this.isSaving.set(true);
    const quizId = this.quizId();

    try {
      if (quizId === null) {
        await firstValueFrom(this.quizApiService.createQuiz(payload));
      } else {
        await firstValueFrom(this.quizApiService.updateQuiz(quizId, payload));
      }

      await this.router.navigateByUrl('/dashboard');
    } catch {
      this.errorMessage.set('Could not save quiz. Please try again.');
    } finally {
      this.isSaving.set(false);
    }
  }

  private validateQuiz(): string | null {
    if (!this.title().trim()) {
      return 'Quiz title is required.';
    }

    if (this.questions().length === 0) {
      return 'Add at least one question.';
    }

    const invalidQuestion = this.questions().find(
      (question) => validateQuestion(question).length > 0
    );
    if (invalidQuestion) {
      return 'Fix the highlighted question blocks before saving.';
    }

    return null;
  }

  private buildPayload(): QuizSavePayload {
    return {
      title: this.title().trim(),
      description: this.description().trim() || undefined,
      questions: this.questions().map(({ clientId: _clientId, ...question }) => ({
        text: question.text,
        type: question.type,
        options:
          question.type === 'multiple-choice' || question.type === 'true-false'
            ? question.options
            : undefined,
        correct_answer: question.correct_answer,
        time_limit: question.time_limit,
        points: question.points,
      })),
    };
  }

  questionTypeLabel(type: Question['type']): string {
    if (type === 'true-false') {
      return 'True / False';
    }

    if (type === 'open') {
      return 'Open Answer';
    }

    return 'Multiple Choice';
  }

  private populateForm(quiz: QuizDetailDto): void {
    this.title.set(quiz.title);
    this.description.set(quiz.description ?? '');
    this.questions.set(
      quiz.questions.length > 0
        ? quiz.questions.map((question) => this.createQuestionDraft(this.toDraftQuestion(question)))
        : [this.createQuestionDraft()]
    );
  }

  private toDraftQuestion(question: QuizQuestionDto): Question {
    return {
      text: question.text,
      type: question.type === 'true-false' ? 'true-false' : 'multiple-choice',
      options:
        question.options.length > 0
          ? question.options
          : question.type === 'true-false'
            ? [
                { id: 'A', text: 'True' },
                { id: 'B', text: 'False' },
              ]
            : createDefaultQuestion().options,
      correct_answer: question.correct_answer ?? 'A',
      time_limit: question.time_limit ?? 30,
      points: question.points,
    };
  }

  private createQuestionDraft(question: Question = createDefaultQuestion()): QuestionDraft {
    return {
      ...question,
      clientId:
        globalThis.crypto?.randomUUID?.() ?? `question-${Math.random().toString(36).slice(2)}`,
    };
  }

  private resolveQuizId(): number | null {
    const rawQuizId = this.route.snapshot.paramMap.get('id');

    if (!rawQuizId || rawQuizId === 'new') {
      return null;
    }

    const quizId = Number(rawQuizId);
    return Number.isInteger(quizId) && quizId > 0 ? quizId : null;
  }
}
