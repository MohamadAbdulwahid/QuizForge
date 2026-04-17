import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  HostSessionSummary,
  SessionAction,
  SessionApiService,
  SessionStatus,
} from '../../core/services/session-api.service';

type ActionCapableStatus = Exclude<SessionStatus, 'ended'>;

@Component({
  selector: 'app-dashboard-sessions-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-sessions-page.component.html',
  styleUrl: './dashboard-sessions-page.component.css',
})
export class DashboardSessionsPageComponent {
  private readonly sessionApiService = inject(SessionApiService);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly sessions = signal<HostSessionSummary[]>([]);
  protected readonly actionPin = signal<string | null>(null);

  constructor() {
    this.loadSessions();
  }

  protected refresh(): void {
    this.loadSessions();
  }

  protected runAction(pin: string, action: SessionAction): void {
    this.errorMessage.set(null);
    this.actionPin.set(pin);

    this.sessionApiService
      .updateSessionStatus(pin, action)
      .pipe(
        finalize(() => {
          this.actionPin.set(null);
        })
      )
      .subscribe({
        next: (response) => {
          const nextSession = response.session;
          this.sessions.update((sessions) =>
            sessions.map((session) => {
              if (session.pin !== pin) {
                return session;
              }

              return {
                ...session,
                status: nextSession.status,
              };
            })
          );
        },
        error: () => {
          this.errorMessage.set('Could not update session state.');
        },
      });
  }

  protected availableActions(status: SessionStatus): SessionAction[] {
    const mappedStatus = this.normalizeStatus(status);

    if (mappedStatus === 'waiting') {
      return ['start'];
    }

    if (mappedStatus === 'playing') {
      return ['pause', 'finish'];
    }

    if (mappedStatus === 'paused') {
      return ['resume', 'finish'];
    }

    return [];
  }

  protected copyPin(pin: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    void navigator.clipboard.writeText(pin);
  }

  protected statusClass(status: SessionStatus): string {
    const mappedStatus = this.normalizeStatus(status);

    if (mappedStatus === 'waiting') {
      return 'bg-[#fef9c3] text-[#854d0e]';
    }

    if (mappedStatus === 'playing') {
      return 'bg-[#dcfce7] text-[#166534]';
    }

    if (mappedStatus === 'paused') {
      return 'bg-[#e0f2fe] text-[#155e75]';
    }

    return 'bg-[#f1f5f9] text-[#475569]';
  }

  protected isActionRunning(pin: string): boolean {
    return this.actionPin() === pin;
  }

  private normalizeStatus(status: SessionStatus): ActionCapableStatus | 'ended' {
    if (status === 'in-progress') {
      return 'playing';
    }

    return status;
  }

  private loadSessions(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.sessionApiService
      .getMySessions()
      .pipe(
        finalize(() => {
          this.loading.set(false);
        })
      )
      .subscribe({
        next: (sessions) => {
          this.sessions.set(sessions);
        },
        error: () => {
          this.errorMessage.set('Could not load your sessions.');
        },
      });
  }
}
