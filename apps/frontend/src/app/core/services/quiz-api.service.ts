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

export interface QuizOptionDto {
  id: string;
  text: string;
}

export interface QuizQuestionDto {
  id: number;
  quiz_id: number;
  text: string;
  type: 'multiple-choice' | 'true-false' | 'open';
  options: QuizOptionDto[];
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

export interface QuizQuestionPayload {
  text: string;
  type: 'multiple-choice' | 'true-false' | 'open';
  options?: QuizOptionDto[];
  correct_answer: string;
  time_limit?: number;
  points?: number;
}

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
