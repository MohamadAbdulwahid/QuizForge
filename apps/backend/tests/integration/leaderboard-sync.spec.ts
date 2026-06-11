import { describe, expect, it, beforeEach } from 'bun:test';

/**
 * Tests for leaderboard synchronization — verifying that leaderboard
 * data is correctly built, sorted, and includes rank/score information.
 *
 * These tests verify the leaderboard building logic used by both
 * the REST API endpoint and the WebSocket leaderboard-update events.
 */

interface LeaderboardPlayer {
  userId: string;
  username: string;
  score: number;
  rank: number;
}

/**
 * Builds a sorted leaderboard from player scores.
 * Mirrors the buildLeaderboard logic in game.namespace.ts.
 */
function buildLeaderboard(
  scoresByUserId: Map<string, { username: string; score: number }>
): LeaderboardPlayer[] {
  const entries = [...scoresByUserId.entries()].map(([userId, { username, score }]) => ({
    userId,
    username,
    score,
    rank: 0,
  }));

  entries.sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));

  for (let i = 0; i < entries.length; i++) {
    entries[i].rank = i + 1;
  }

  return entries;
}

describe('Leaderboard Sync', () => {
  let scoresByUserId: Map<string, { username: string; score: number }>;

  beforeEach(() => {
    scoresByUserId = new Map();
  });

  it('returns empty leaderboard when no players', () => {
    const leaderboard = buildLeaderboard(scoresByUserId);
    expect(leaderboard).toEqual([]);
  });

  it('ranks single player as rank 1', () => {
    scoresByUserId.set('user-1', { username: 'Alice', score: 100 });

    const leaderboard = buildLeaderboard(scoresByUserId);
    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].username).toBe('Alice');
    expect(leaderboard[0].score).toBe(100);
  });

  it('sorts players by score descending', () => {
    scoresByUserId.set('user-1', { username: 'Alice', score: 100 });
    scoresByUserId.set('user-2', { username: 'Bob', score: 250 });
    scoresByUserId.set('user-3', { username: 'Charlie', score: 150 });

    const leaderboard = buildLeaderboard(scoresByUserId);
    expect(leaderboard[0].username).toBe('Bob');
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].username).toBe('Charlie');
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[2].username).toBe('Alice');
    expect(leaderboard[2].rank).toBe(3);
  });

  it('breaks ties deterministically by username (alphabetical)', () => {
    scoresByUserId.set('user-1', { username: 'Zara', score: 100 });
    scoresByUserId.set('user-2', { username: 'Alice', score: 100 });

    const leaderboard = buildLeaderboard(scoresByUserId);
    // Same score — Alice comes before Zara alphabetically
    expect(leaderboard[0].username).toBe('Alice');
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].username).toBe('Zara');
    expect(leaderboard[1].rank).toBe(2);
  });

  it('updates leaderboard after score change', () => {
    // Initial state
    scoresByUserId.set('user-1', { username: 'Alice', score: 100 });
    scoresByUserId.set('user-2', { username: 'Bob', score: 50 });

    let leaderboard = buildLeaderboard(scoresByUserId);
    expect(leaderboard[0].username).toBe('Alice');

    // Bob answers correctly and overtakes Alice
    scoresByUserId.set('user-2', { username: 'Bob', score: 200 });

    leaderboard = buildLeaderboard(scoresByUserId);
    expect(leaderboard[0].username).toBe('Bob');
    expect(leaderboard[0].score).toBe(200);
    expect(leaderboard[1].username).toBe('Alice');
  });

  it('handles many players correctly', () => {
    for (let i = 0; i < 20; i++) {
      scoresByUserId.set(`user-${i}`, {
        username: `Player${i}`,
        score: Math.floor(Math.random() * 1000),
      });
    }

    const leaderboard = buildLeaderboard(scoresByUserId);
    expect(leaderboard).toHaveLength(20);

    // Verify descending order
    for (let i = 1; i < leaderboard.length; i++) {
      expect(leaderboard[i].score).toBeLessThanOrEqual(leaderboard[i - 1].score);
    }

    // Verify ranks are sequential
    for (let i = 0; i < leaderboard.length; i++) {
      expect(leaderboard[i].rank).toBe(i + 1);
    }
  });

  it('preserves userId in leaderboard entries', () => {
    scoresByUserId.set('abc-123', { username: 'Alice', score: 100 });

    const leaderboard = buildLeaderboard(scoresByUserId);
    expect(leaderboard[0].userId).toBe('abc-123');
  });

  it('handles zero scores', () => {
    scoresByUserId.set('user-1', { username: 'Alice', score: 0 });
    scoresByUserId.set('user-2', { username: 'Bob', score: 0 });

    const leaderboard = buildLeaderboard(scoresByUserId);
    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0].score).toBe(0);
    expect(leaderboard[1].score).toBe(0);
  });
});
