import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';

export interface PlatformStats {
  totalSessions: number;
  activeSessions: number;
  endedSessions: number;
  totalPlayers: number;
  averagePlayersPerSession: number;
  completionRate: number;
}

export interface RecentSession {
  id: number;
  pin: string;
  status: string;
  quizTitle: string;
  hostEmail: string;
  playerCount: number;
  startedAt: string;
}

export interface SessionAnalytics {
  sessionId: number;
  pin: string;
  quizTitle: string;
  status: string;
  playerCount: number;
  totalQuestions: number;
  answeredQuestions: number;
  averageAnswerTimeMs: number | null;
  startedAt: string;
}

export interface StaleSession {
  id: number;
  pin: string;
  status: string;
  quizTitle: string;
  hostEmail: string;
  playerCount: number;
  startedAt: string;
  minutesSinceStart: number;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly api = inject(ApiService);

  getStats() {
    return this.api.get<PlatformStats>('/api/admin/stats');
  }

  getRecentSessions(limit = 20) {
    return this.api.get<RecentSession[]>(`/api/admin/sessions?limit=${limit}`);
  }

  getSessionAnalytics(sessionId: number) {
    return this.api.get<SessionAnalytics>(`/api/admin/sessions/${sessionId}/analytics`);
  }

  getStaleSessions() {
    return this.api.get<StaleSession[]>('/api/admin/sessions/stale');
  }

  terminateSession(sessionId: number) {
    return this.api.post<{ terminated: boolean }>(`/api/admin/sessions/${sessionId}/terminate`, {});
  }
}
