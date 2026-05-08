import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface QuizSummary {
  id: number;
  title: string;
  description: string | null;
  share_code: string | null;
  created_at: string;
  questionCount: number;
}

@Injectable({ providedIn: 'root' })
export class QuizApiService {
  private readonly httpClient = inject(HttpClient);

  getMyQuizzes(): Observable<QuizSummary[]> {
    return this.httpClient.get<QuizSummary[]>(`${environment.apiBaseUrl}/api/quizzes`);
  }
}
