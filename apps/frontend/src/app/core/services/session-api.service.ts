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
  game_mode: GameMode;
}

export interface CreateSessionResponse {
  session: SessionDto;
  pin: string;
}

export type SessionBroadcastMode = 'private' | 'selected-groups' | 'all-my-groups';
export type GameMode = 'forge-classic' | 'treasure-forge' | 'bubbly-royale';

export interface CreateSessionPayload {
  quiz_id: number;
  broadcast_mode?: SessionBroadcastMode;
  group_ids?: number[];
  game_mode?: GameMode;
  tf_end_mode?: 'timer' | 'gold_goal' | null;
  tf_timer_minutes?: number;
  tf_gold_goal?: number;
  /** Bubbly Royale: number of top players to rank (1-8, default 3) */
  br_top_n?: number;
  /** Bubbly Royale: starting lives per player (2-5, default 3) */
  br_starting_lives?: number;
  /** Bubbly Royale: duel timer in seconds (10-45, default 25) */
  br_duel_timer_s?: number;
  /** Bubbly Royale: power bubble timer in seconds (8-30, default 15) */
  br_power_bubble_timer_s?: number;
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
