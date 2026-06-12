import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface QuizSummary {
  id: number;
  title: string;
  description: string | null;
  share_code: string | null;
  created_at: string;
  questionCount: number;
}

/**
 * Canonical question type union. The backend stores and returns one of these
 * strings in the `questions.type` column. The frontend uses the same vocabulary
 * in save payloads, websocket events (as a plain string), and UI builders.
 */
export type QuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'ordering'
  | 'matching'
  | 'fill-in-blank';

/**
 * A single option row. The shape is intentionally permissive: most fields are
 * optional and only relevant for a subset of question types.
 *
 * - `matchId`     — matching only: id of the right-side item this left item
 *                   pairs with. Stripped from public payloads.
 * - `answer`      — fill-in-blank only: the canonical accepted text. Stripped
 *                   from public payloads (replaced with `text: '___'`).
 * - `caseSensitive` — fill-in-blank only: per-answer case sensitivity flag.
 *                   Stripped from public payloads.
 */
export interface QuizOptionDto {
  id: string;
  text: string;
  matchId?: string;
  answer?: string;
  caseSensitive?: boolean;
}

/**
 * Shape of the `options` field for the public/player-facing question payload
 * (correct answers stripped). For matching, the left items live in `options`
 * and the shuffled right items live in `rightOptions` on the question itself.
 */
export type QuizOptions = QuizOptionDto[];

/**
 * Player-facing question payload. `correct_answer` is `null` for the public
 * payload — the server strips it. `rightOptions` is matching-only and holds
 * the right column items with `matchId` removed.
 */
export interface QuizQuestionDto {
  id: number;
  quiz_id: number;
  text: string;
  type: QuestionType;
  options: QuizOptionDto[];
  rightOptions?: QuizOptionDto[];
  correct_answer: string | null;
  time_limit: number | null;
  points: number;
  order_index: number;
}

export interface QuizDetailDto {
  id: number;
  title: string;
  description: string | null;
  share_code: string | null;
  created_at: string;
  questions: QuizQuestionDto[];
}

export interface QuizSaveResponse {
  quiz: {
    id: number;
    title: string;
    description: string | null;
    creator_id: string;
    share_code: string | null;
    created_at: string;
  };
  shareCode: string;
}

/**
 * Save payload for a single question.
 *
 * The `options` field is a flat `QuizOptionDto[]` for `multiple-choice`,
 * `true-false`, `ordering`, and `fill-in-blank` (the `correct_answer`
 * semantics vary by type — see the type-specific notes below). For
 * `matching`, `options` is the richer `{ left, right }` shape.
 *
 * - `multiple-choice` — `correct_answer` is the chosen option id.
 * - `true-false` — `correct_answer` is the literal `'true'` or `'false'`.
 * - `ordering` — `correct_answer` is JSON of the correct order id list.
 * - `matching` — `correct_answer` is JSON of the `{ leftId: rightId }` map.
 * - `fill-in-blank` — `correct_answer` is the canonical (first) accepted answer.
 */
export type QuizQuestionPayload =
  | {
      text: string;
      type: 'multiple-choice' | 'true-false' | 'ordering' | 'fill-in-blank';
      options: QuizOptionDto[];
      correct_answer: string;
      time_limit?: number;
      points?: number;
    }
  | {
      text: string;
      type: 'matching';
      options: { left: QuizOptionDto[]; right: QuizOptionDto[] };
      correct_answer: string;
      time_limit?: number;
      points?: number;
    };

export interface QuizSavePayload {
  title: string;
  description?: string;
  questions: QuizQuestionPayload[];
}

@Injectable({ providedIn: 'root' })
export class QuizApiService {
  private readonly apiService = inject(ApiService);

  getMyQuizzes(): Observable<QuizSummary[]> {
    return this.apiService.get<QuizSummary[]>('/api/quizzes');
  }

  getQuizById(quizId: number): Observable<QuizDetailDto> {
    return this.apiService.get<QuizDetailDto>(`/api/quizzes/${quizId}`);
  }

  createQuiz(payload: QuizSavePayload): Observable<QuizSaveResponse> {
    return this.apiService.post<QuizSaveResponse>('/api/quizzes', payload);
  }

  updateQuiz(quizId: number, payload: QuizSavePayload): Observable<QuizDetailDto> {
    return this.apiService.patch<QuizDetailDto>(`/api/quizzes/${quizId}`, payload);
  }

  deleteQuiz(quizId: number): Observable<void> {
    return this.apiService.delete<void>(`/api/quizzes/${quizId}`);
  }
}
