import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type SessionStatus = 'pending' | 'waiting' | 'playing' | 'paused' | 'ended' | 'in-progress';
export type SessionAction = 'start' | 'pause' | 'resume' | 'finish';

/** Public-facing session — no host_id or broadcast_mode exposed. */
export interface SessionDto {
  id: number;
  quiz_id: number;
  pin: string;
  status: SessionStatus;
  started_at: string | null;
  isHost: boolean;
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

/** Public leaderboard entry — no internal user IDs. */
export interface LeaderboardEntry {
  username: string;
  score: number;
  rank: number;
}

export interface SessionLeaderboardResponse {
  quizTitle: string;
  leaderboard: LeaderboardEntry[];
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

  getLeaderboard(pin: string): Observable<SessionLeaderboardResponse> {
    return this.apiService.get<SessionLeaderboardResponse>(`/api/sessions/${pin}/leaderboard`);
  }
}
