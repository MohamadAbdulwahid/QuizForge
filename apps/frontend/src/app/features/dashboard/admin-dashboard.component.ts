import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import {
  AdminApiService,
  PlatformStats,
  RecentSession,
  StaleSession,
} from '../../core/services/admin-api.service';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, BubblyCardComponent, BubblyButtonComponent, PageHeadingComponent],
  template: `
    <div class="qf-page-container">
      <app-page-heading
        eyebrow="Administration"
        title="Platform Overview"
        description="Monitor sessions, players, and platform health."
      />

      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <span class="loading loading-spinner loading-lg text-[var(--bubbly-primary)]"></span>
        </div>
      } @else if (error()) {
        <div class="qf-alert-error mb-6 rounded-2xl p-4">{{ error() }}</div>
      } @else {
        <!-- Stats Cards -->
        <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (card of statCards(); track card.label) {
            <app-bubbly-card
              tone="surface"
              [padded]="true"
            >
              <div class="flex flex-col gap-1">
                <span class="text-sm text-[var(--bubbly-muted)]">{{ card.label }}</span>
                <span class="font-display text-3xl text-[var(--bubbly-text)]">
                  {{ card.value }}
                </span>
                @if (card.sub) {
                  <span class="text-xs text-[var(--bubbly-muted)]">{{ card.sub }}</span>
                }
              </div>
            </app-bubbly-card>
          }
        </div>

        <!-- Stale Sessions -->
        @if (staleSessions().length > 0) {
          <div class="mb-8">
            <h2 class="font-display mb-4 text-xl text-[var(--bubbly-accent)]">Stale Sessions</h2>
            <div class="space-y-3">
              @for (session of staleSessions(); track session.id) {
                <app-bubbly-card
                  tone="soft"
                  [padded]="true"
                >
                  <div class="flex items-center justify-between gap-4">
                    <div class="min-w-0 flex-1">
                      <div class="truncate font-semibold text-[var(--bubbly-text)]">
                        {{ session.quizTitle }}
                      </div>
                      <div class="text-sm text-[var(--bubbly-muted)]">
                        PIN: {{ session.pin }} &middot; {{ session.playerCount }} players &middot;
                        {{ session.minutesSinceStart }}min ago
                      </div>
                      <div class="text-xs text-[var(--bubbly-muted)]">
                        Host: {{ session.hostEmail }}
                      </div>
                    </div>
                    <app-bubbly-button
                      tone="accent"
                      size="sm"
                      (clicked)="terminateSession(session.id)"
                      [disabled]="terminatingId() === session.id"
                    >
                      {{ terminatingId() === session.id ? 'Terminating...' : 'Terminate' }}
                    </app-bubbly-button>
                  </div>
                </app-bubbly-card>
              }
            </div>
          </div>
        }

        <!-- Recent Sessions -->
        <div>
          <h2 class="font-display mb-4 text-xl text-[var(--bubbly-text)]">Recent Sessions</h2>
          <div class="overflow-x-auto">
            <table class="table-zebra table w-full">
              <thead>
                <tr class="text-sm text-[var(--bubbly-muted)]">
                  <th>PIN</th>
                  <th>Quiz</th>
                  <th>Host</th>
                  <th>Players</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                @for (session of recentSessions(); track session.id) {
                  <tr class="hover:bg-[var(--bubbly-surface-soft)]">
                    <td class="font-mono text-sm">{{ session.pin }}</td>
                    <td class="max-w-[200px] truncate">{{ session.quizTitle }}</td>
                    <td class="text-sm text-[var(--bubbly-muted)]">{{ session.hostEmail }}</td>
                    <td class="text-center">{{ session.playerCount }}</td>
                    <td>
                      <span
                        class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                        [class]="getStatusClass(session.status)"
                      >
                        {{ session.status }}
                      </span>
                    </td>
                    <td class="text-sm text-[var(--bubbly-muted)]">
                      {{ session.startedAt | date: 'short' }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td
                      colspan="6"
                      class="py-8 text-center text-[var(--bubbly-muted)]"
                    >
                      No sessions yet.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminDashboardComponent {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly stats = signal<PlatformStats | null>(null);
  protected readonly recentSessions = signal<RecentSession[]>([]);
  protected readonly staleSessions = signal<StaleSession[]>([]);
  protected readonly terminatingId = signal<number | null>(null);

  protected readonly statCards = signal<
    Array<{ label: string; value: string | number; sub?: string }>
  >([]);

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminApi
      .getStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.statCards.set([
            { label: 'Total Sessions', value: stats.totalSessions },
            { label: 'Active Sessions', value: stats.activeSessions },
            { label: 'Total Players', value: stats.totalPlayers },
            {
              label: 'Avg Players/Session',
              value: stats.averagePlayersPerSession,
            },
            {
              label: 'Completion Rate',
              value: `${stats.completionRate}%`,
              sub: `${stats.endedSessions} of ${stats.totalSessions} ended`,
            },
            { label: 'Ended Sessions', value: stats.endedSessions },
          ]);
        },
        error: (err) => {
          this.error.set(err?.error?.error ?? 'Failed to load platform stats');
        },
      });

    this.adminApi
      .getRecentSessions(20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) => this.recentSessions.set(sessions),
      });

    this.adminApi
      .getStaleSessions()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (stale) => this.staleSessions.set(stale),
      });
  }

  protected terminateSession(sessionId: number): void {
    this.terminatingId.set(sessionId);

    this.adminApi
      .terminateSession(sessionId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.terminatingId.set(null))
      )
      .subscribe({
        next: (result) => {
          if (result.terminated) {
            this.staleSessions.update((sessions) => sessions.filter((s) => s.id !== sessionId));
          }
        },
      });
  }

  protected getStatusClass(status: string): string {
    switch (status) {
      case 'waiting':
        return 'bg-[var(--bubbly-warning-bg)] text-[var(--bubbly-warning-text)]';
      case 'playing':
      case 'in-progress':
        return 'bg-[var(--bubbly-success-bg)] text-[var(--bubbly-success-text)]';
      case 'ended':
        return 'bg-[var(--bubbly-muted)]/10 text-[var(--bubbly-muted)]';
      default:
        return 'bg-[var(--bubbly-info-bg)] text-[var(--bubbly-info-text)]';
    }
  }
}
