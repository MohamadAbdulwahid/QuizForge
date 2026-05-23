import { describe, expect, it } from 'bun:test';
import { calculateForgeClassicScore } from '../../../src/game/engine/scoring';

describe('Forge Classic scoring', () => {
  it('scores a fast correct answer higher than a slow correct answer', () => {
    const fast = calculateForgeClassicScore({
      isCorrect: true,
      basePoints: 100,
      timeLimitMs: 30000,
      elapsedMs: 1000,
    });
    const slow = calculateForgeClassicScore({
      isCorrect: true,
      basePoints: 100,
      timeLimitMs: 30000,
      elapsedMs: 25000,
    });

    expect(fast.points).toBeGreaterThan(slow.points);
  });

  it('returns zero points for incorrect answers', () => {
    const result = calculateForgeClassicScore({
      isCorrect: false,
      basePoints: 100,
      timeLimitMs: 30000,
      elapsedMs: 1000,
    });

    expect(result.points).toBe(0);
  });

  it('clamps invalid timing data before score calculation', () => {
    const result = calculateForgeClassicScore({
      isCorrect: true,
      basePoints: 100,
      timeLimitMs: -1,
      elapsedMs: -500,
    });

    expect(result.remainingMs).toBe(1);
    expect(result.points).toBe(200);
  });
});
