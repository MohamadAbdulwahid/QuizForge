import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type SessionStatus = 'pending' | 'waiting' | 'playing' | 'paused' | 'ended' | 'in-progress';
export type SessionAction = 'start' | 'pause' | 'resume' | 'finish';

export interface SessionDto {
  id: number;
  quiz_id: number;
  host_id: string;
  pin: string;
  status: SessionStatus;
}

export interface CreateSessionResponse {
  session: SessionDto;
  pin: string;
}

export interface UpdateSessionStatusResponse {
  session: SessionDto;
  previousStatus: Exclude<SessionStatus, 'pending' | 'in-progress'>;
  nextStatus: Exclude<SessionStatus, 'pending' | 'in-progress'>;
}

export interface HostSessionSummary {
  id: number;
  pin: string;
  status: SessionStatus;
  quiz_id: number;
  quiz_title: string;
  started_at: string;
}

@Injectable({ providedIn: 'root' })
export class SessionApiService {
  private readonly httpClient = inject(HttpClient);

  createSession(quizId: number): Observable<CreateSessionResponse> {
    return this.httpClient.post<CreateSessionResponse>(`${environment.apiBaseUrl}/api/sessions`, {
      quiz_id: quizId,
    });
  }

  getSessionByPin(pin: string): Observable<SessionDto> {
    return this.httpClient.get<SessionDto>(`${environment.apiBaseUrl}/api/sessions/${pin}`);
  }

  updateSessionStatus(pin: string, action: SessionAction): Observable<UpdateSessionStatusResponse> {
    return this.httpClient.patch<UpdateSessionStatusResponse>(
      `${environment.apiBaseUrl}/api/sessions/${pin}/status`,
      { action }
    );
  }

  getMySessions(): Observable<HostSessionSummary[]> {
    return this.httpClient.get<HostSessionSummary[]>(`${environment.apiBaseUrl}/api/sessions/mine`);
  }
}
