import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  LeaderboardEntry,
  SessionApiService,
  SessionLeaderboardResponse,
} from '../../core/services/session-api.service';
import type { LeaderboardPlayerEvent } from '../../core/services/websocket.service';

@Component({
  selector: 'app-leaderboards-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboards-page.component.html',
})
export class LeaderboardsPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly sessionApiService = inject(SessionApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly leaderboardSignal = signal<LeaderboardEntry[]>([]);
  protected readonly quizTitleSignal = signal<string>('');
  protected readonly loadingSignal = signal(false);
  protected readonly errorSignal = signal<string | null>(null);

  /** Top 3 players sorted by rank ascending. */
  protected readonly podium = computed(() =>
    this.leaderboardSignal()
      .filter((p) => p.rank <= 3)
      .sort((a, b) => a.rank - b.rank)
  );

  /** The #1 player. */
  protected readonly first = computed(() => this.podium().find((p) => p.rank === 1) ?? null);

  /** The #2 and #3 players. */
  protected readonly secondThird = computed(() =>
    this.podium()
      .filter((p) => p.rank > 1)
      .sort((a, b) => a.rank - b.rank)
  );

  /** Players ranked 4th and below, sorted by rank ascending. */
  protected readonly chasers = computed(() =>
    this.leaderboardSignal()
      .filter((p) => p.rank > 3)
      .sort((a, b) => a.rank - b.rank)
  );

  /** Whether any leaderboard data is available. */
  protected readonly hasData = computed(() => this.leaderboardSignal().length > 0);

  private readonly emojiPool = [
    '🦊',
    '🐼',
    '🦁',
    '🐯',
    '🐸',
    '🐙',
    '🦄',
    '🐧',
    '🦉',
    '🐺',
    '🐱',
    '🐶',
    '🐰',
    '🐭',
    '🐹',
    '🐻',
    '🐲',
    '👽',
    '🤖',
    '👾',
    '🫅',
    '🐨',
  ];

  ngOnInit(): void {
    // 1. Try current navigation extras (most reliable during same-app navigation)
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras.state as {
      leaderboard?: LeaderboardPlayerEvent[];
      quizTitle?: string;
      pin?: string;
    } | null;

    if (state?.leaderboard) {
      this.leaderboardSignal.set(
        state.leaderboard.map((p, i) => ({
          username: p.username,
          score: p.score,
          rank: p.rank ?? i + 1,
        }))
      );
      this.quizTitleSignal.set(state.quizTitle ?? '');
      return;
    }

    // 2. Fallback: history.state (survives page refresh via same-window navigation)
    const histState = history.state as
      | { leaderboard?: LeaderboardPlayerEvent[]; quizTitle?: string; pin?: string }
      | undefined;

    if (histState?.leaderboard) {
      this.leaderboardSignal.set(
        histState.leaderboard.map((p, i) => ({
          username: p.username,
          score: p.score,
          rank: p.rank ?? i + 1,
        }))
      );
      this.quizTitleSignal.set(histState.quizTitle ?? '');
      return;
    }

    // 3. API fallback: fetch from server using PIN from state or URL
    const pin = state?.pin ?? histState?.pin ?? this.extractPinFromUrl();

    if (pin) {
      this.fetchLeaderboard(pin);
    }
  }

  /** Returns a consistent emoji for a user based on their username hash. */
  protected getPlayerEmoji(username: string): string {
    const hash = Array.from(username).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return this.emojiPool[hash % this.emojiPool.length];
  }

  protected goToDashboard(): void {
    void this.router.navigateByUrl('/dashboard');
  }

  /** Medal icon for top 3 ranks. */
  protected getRankIcon(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  }

  private extractPinFromUrl(): string | null {
    // Check referrer or URL params for PIN
    const url = new URL(window.location.href);
    const pinParam = url.searchParams.get('pin');
    if (pinParam && /^\d{6}$/.test(pinParam)) {
      return pinParam;
    }
    return null;
  }

  private fetchLeaderboard(pin: string): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.sessionApiService
      .getLeaderboard(pin)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: SessionLeaderboardResponse) => {
          this.leaderboardSignal.set(response.leaderboard);
          this.quizTitleSignal.set(response.quizTitle);
          this.loadingSignal.set(false);
        },
        error: () => {
          this.errorSignal.set('Could not load leaderboard data.');
          this.loadingSignal.set(false);
        },
      });
  }
}
