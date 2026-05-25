import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

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

export type SessionBroadcastMode = 'private' | 'selected-groups' | 'all-my-groups';

export interface CreateSessionPayload {
  quiz_id: number;
  broadcast_mode?: SessionBroadcastMode;
  group_ids?: number[];
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
  private readonly apiService = inject(ApiService);

  createSession(payload: CreateSessionPayload): Observable<CreateSessionResponse> {
    return this.apiService.post<CreateSessionResponse>('/api/sessions', payload);
  }

  getSessionByPin(pin: string): Observable<SessionDto> {
    return this.apiService.get<SessionDto>(`/api/sessions/${pin}`);
  }

  updateSessionStatus(pin: string, action: SessionAction): Observable<UpdateSessionStatusResponse> {
    return this.apiService.patch<UpdateSessionStatusResponse>(`/api/sessions/${pin}/status`, {
      action,
    });
  }

  getMySessions(): Observable<HostSessionSummary[]> {
    return this.apiService.get<HostSessionSummary[]>('/api/sessions/mine');
  }

  getHostSessionData(pin: string): Observable<unknown> {
    return this.apiService.get<unknown>(`/api/sessions/${pin}/host`);
  }
}
