import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import type { LeaderboardPlayerEvent } from '../../core/services/websocket.service';

@Component({
  selector: 'app-leaderboards-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboards-page.component.html',
})
export class LeaderboardsPageComponent implements OnInit {
  private readonly router = inject(Router);

  protected readonly leaderboardSignal = signal<LeaderboardPlayerEvent[]>([]);
  protected readonly quizTitleSignal = signal<string>('');

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
    } | null;

    if (state?.leaderboard) {
      this.leaderboardSignal.set(state.leaderboard);
      this.quizTitleSignal.set(state.quizTitle ?? '');
      return;
    }

    // 2. Fallback: history.state (survives page refresh via same-window navigation)
    const histState = history.state as
      | { leaderboard?: LeaderboardPlayerEvent[]; quizTitle?: string }
      | undefined;

    if (histState?.leaderboard) {
      this.leaderboardSignal.set(histState.leaderboard);
      this.quizTitleSignal.set(histState.quizTitle ?? '');
    }
  }

  /** Returns a consistent emoji for a user based on their ID hash. */
  protected getPlayerEmoji(userId: string): string {
    const hash = Array.from(userId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
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
}
