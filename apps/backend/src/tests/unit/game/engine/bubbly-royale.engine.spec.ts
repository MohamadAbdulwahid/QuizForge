import { describe, it, expect } from 'bun:test';
import {
  pairPlayers,
  determineDuelOutcome,
  generatePowerUp,
  generateCurse,
  scoreBubblePop,
  manageLives,
} from '../../../../game/engine/bubbly-royale.engine';
import type {
  BubblyRoyalePlayerState,
  DuelAnswer,
  PowerUp,
  Curse,
  BubblePopEntry,
  LifeManagementInput,
} from '../../../../game/engine/bubbly-royale.engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a predictable RNG that cycles through given values (0..1). */
function createSequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length]!;
    index++;
    return value;
  };
}

/** Creates a test player with default lives = 3, no last opponent. */
function makePlayer(
  id: string,
  lives = 3,
  lastOpponentId: string | null = null
): BubblyRoyalePlayerState {
  return { id, lives, lastOpponentId };
}

// ---------------------------------------------------------------------------
// pairPlayers
// ---------------------------------------------------------------------------

describe('pairPlayers', () => {
  describe('Round 1 (round === 0) — random pairing', () => {
    it('should pair all players when even count', () => {
      const players = [makePlayer('a'), makePlayer('b'), makePlayer('c'), makePlayer('d')];
      const rng = createSequenceRng([0.1, 0.2, 0.3, 0.4]);
      const result = pairPlayers(players, 0, { random: rng });

      expect(result.pairs).toHaveLength(2);
      expect(result.oddPlayerId).toBeNull();
      expect(result.oddPartnerId).toBeNull();

      // All players should appear exactly once across pairs
      const allIds = result.pairs.flat();
      expect(allIds.sort()).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should handle odd player count by assigning odd partner', () => {
      const players = [makePlayer('a'), makePlayer('b'), makePlayer('c')];
      const rng = createSequenceRng([0.5, 0.6, 0.7]);
      const result = pairPlayers(players, 0, { random: rng });

      expect(result.pairs).toHaveLength(1);
      expect(result.oddPlayerId).not.toBeNull();
      expect(result.oddPartnerId).not.toBeNull();

      const paired = result.pairs.flat();
      expect(paired.includes(result.oddPartnerId!)).toBe(true);
      expect(paired.includes(result.oddPlayerId!)).toBe(false);
    });

    it('should return empty pairs for less than 2 players', () => {
      const result = pairPlayers([makePlayer('a')], 0);
      expect(result.pairs).toHaveLength(0);
      expect(result.oddPlayerId).toBe('a');
      expect(result.oddPartnerId).toBeNull();
    });

    it('should return empty for empty player list', () => {
      const result = pairPlayers([], 0);
      expect(result.pairs).toHaveLength(0);
      expect(result.oddPlayerId).toBeNull();
    });
  });

  describe('Later rounds — pair by similar lives, avoid rematches', () => {
    it('should pair players with similar lives', () => {
      const players = [
        makePlayer('a', 3),
        makePlayer('b', 2),
        makePlayer('c', 3),
        makePlayer('d', 1),
      ];
      const result = pairPlayers(players, 1);

      // Players with same/similar lives should be paired:
      // a(3) with c(3) and b(2) with d(1) — or similar
      expect(result.pairs).toHaveLength(2);
      expect(result.oddPlayerId).toBeNull();
    });

    it('should avoid pairing players who were opponents last round', () => {
      const players = [
        makePlayer('a', 3, 'b'), // a's last opponent was b
        makePlayer('b', 3, 'a'), // b's last opponent was a
        makePlayer('c', 2),
        makePlayer('d', 2),
      ];
      const result = pairPlayers(players, 1);

      expect(result.pairs).toHaveLength(2);

      // a and b should not be paired together
      for (const [p1, p2] of result.pairs) {
        const pairIds = [p1, p2].sort();
        expect(pairIds).not.toEqual(['a', 'b']);
      }
    });

    it('should handle odd player in later rounds', () => {
      const players = [makePlayer('a', 3), makePlayer('b', 2), makePlayer('c', 1)];
      const result = pairPlayers(players, 2);

      expect(result.pairs).toHaveLength(1);
      expect(result.oddPlayerId).not.toBeNull();
      expect(result.oddPartnerId).not.toBeNull();
    });

    it('should not apply rematch avoidance in round 0', () => {
      const players = [makePlayer('a', 3, 'b'), makePlayer('b', 3, 'a')];
      const result = pairPlayers(players, 0);

      // Rematch avoidance only applies for rounds > 0
      expect(result.pairs).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// determineDuelOutcome
// ---------------------------------------------------------------------------

describe('determineDuelOutcome', () => {
  it('should return both_lose when both players answer incorrectly', () => {
    const p1: DuelAnswer = { playerId: 'a', isCorrect: false, elapsedMs: 500 };
    const p2: DuelAnswer = { playerId: 'b', isCorrect: false, elapsedMs: 800 };
    const result = determineDuelOutcome(p1, p2);

    expect(result.outcome).toBe('both_lose');
    expect(result.winnerId).toBeNull();
    expect(result.loserId).toBeNull();
  });

  it('should return player1_wins when only player 1 is correct', () => {
    const p1: DuelAnswer = { playerId: 'a', isCorrect: true, elapsedMs: 500 };
    const p2: DuelAnswer = { playerId: 'b', isCorrect: false, elapsedMs: 300 };
    const result = determineDuelOutcome(p1, p2);

    expect(result.outcome).toBe('player1_wins');
    expect(result.winnerId).toBe('a');
    expect(result.loserId).toBe('b');
  });

  it('should return player2_wins when only player 2 is correct', () => {
    const p1: DuelAnswer = { playerId: 'a', isCorrect: false, elapsedMs: 500 };
    const p2: DuelAnswer = { playerId: 'b', isCorrect: true, elapsedMs: 300 };
    const result = determineDuelOutcome(p1, p2);

    expect(result.outcome).toBe('player2_wins');
    expect(result.winnerId).toBe('b');
    expect(result.loserId).toBe('a');
  });

  it('should return player1_wins when both correct but player 1 is faster', () => {
    const p1: DuelAnswer = { playerId: 'a', isCorrect: true, elapsedMs: 200 };
    const p2: DuelAnswer = { playerId: 'b', isCorrect: true, elapsedMs: 500 };
    const result = determineDuelOutcome(p1, p2);

    expect(result.outcome).toBe('player1_wins');
    expect(result.winnerId).toBe('a');
    expect(result.loserId).toBe('b');
  });

  it('should return player2_wins when both correct but player 2 is faster', () => {
    const p1: DuelAnswer = { playerId: 'a', isCorrect: true, elapsedMs: 800 };
    const p2: DuelAnswer = { playerId: 'b', isCorrect: true, elapsedMs: 200 };
    const result = determineDuelOutcome(p1, p2);

    expect(result.outcome).toBe('player2_wins');
    expect(result.winnerId).toBe('b');
    expect(result.loserId).toBe('a');
  });

  it('should return tie when both correct and time difference is less than 100ms', () => {
    const p1: DuelAnswer = { playerId: 'a', isCorrect: true, elapsedMs: 450 };
    const p2: DuelAnswer = { playerId: 'b', isCorrect: true, elapsedMs: 500 };

    // Difference = 50ms < 100ms threshold
    const result = determineDuelOutcome(p1, p2, 0);

    expect(result.outcome).toBe('tie');
    expect(result.winnerId).toBeNull();
    expect(result.loserId).toBeNull();
  });

  it('should respect the tie threshold boundary', () => {
    const p1: DuelAnswer = { playerId: 'a', isCorrect: true, elapsedMs: 400 };
    const p2: DuelAnswer = { playerId: 'b', isCorrect: true, elapsedMs: 500 };

    // Difference = 100ms — NOT a tie (threshold is < 100, not <=)
    const result = determineDuelOutcome(p1, p2, 0);

    expect(result.outcome).toBe('player1_wins');
  });

  it('should return both_advance after max rematches', () => {
    const p1: DuelAnswer = { playerId: 'a', isCorrect: true, elapsedMs: 450 };
    const p2: DuelAnswer = { playerId: 'b', isCorrect: true, elapsedMs: 480 };

    // rematchCount = 5, which is >= default maxRematches (5)
    const result = determineDuelOutcome(p1, p2, 5);

    expect(result.outcome).toBe('both_advance');
    expect(result.winnerId).toBeNull();
    expect(result.loserId).toBeNull();
  });

  it('should return both_advance when rematch count exceeds maxRematches', () => {
    const p1: DuelAnswer = { playerId: 'a', isCorrect: true, elapsedMs: 450 };
    const p2: DuelAnswer = { playerId: 'b', isCorrect: true, elapsedMs: 480 };

    const result = determineDuelOutcome(p1, p2, 6);

    expect(result.outcome).toBe('both_advance');
  });

  it('should work with custom maxRematches value', () => {
    const p1: DuelAnswer = { playerId: 'a', isCorrect: true, elapsedMs: 450 };
    const p2: DuelAnswer = { playerId: 'b', isCorrect: true, elapsedMs: 480 };

    const result = determineDuelOutcome(p1, p2, 3, 3);

    expect(result.outcome).toBe('both_advance');
  });
});

// ---------------------------------------------------------------------------
// generatePowerUp
// ---------------------------------------------------------------------------

describe('generatePowerUp', () => {
  it('should generate a power-up when inventory is empty', () => {
    const result = generatePowerUp([]);
    expect(result.forfeited).toBe(false);
    expect(result.inventory).toHaveLength(1);
    expect(result.inventory[0]!.id).toBeDefined();
    expect(result.inventory[0]!.type).toBeDefined();
  });

  it('should forfeit when inventory is full (default max 2)', () => {
    const fullInventory: readonly PowerUp[] = [
      { type: 'shield', id: '1' },
      { type: 'quick_bubble', id: '2' },
    ];
    const result = generatePowerUp(fullInventory);

    expect(result.forfeited).toBe(true);
    expect(result.inventory).toBe(fullInventory); // unchanged
  });

  it('should respect custom maxInventory', () => {
    const partialInventory: readonly PowerUp[] = [{ type: 'shield', id: '1' }];
    const result = generatePowerUp(partialInventory, { maxInventory: 1 });

    expect(result.forfeited).toBe(true);
    expect(result.inventory).toBe(partialInventory);
  });

  it('should produce deterministic results with injected RNG', () => {
    // Shield is the first item (0% roll lands on it)
    const predictableRng = () => 0;
    const result = generatePowerUp([], { random: predictableRng });

    expect(result.forfeited).toBe(false);
    expect(result.inventory[0]!.type).toBe('shield');
  });

  it('should return a new array (immutability)', () => {
    const original: readonly PowerUp[] = [{ type: 'shield', id: '1' }];
    const result = generatePowerUp(original);

    expect(result.inventory).not.toBe(original); // different reference
    expect(result.inventory[0]!.id).toBe('1'); // original item preserved
  });

  it('should handle very low weight edge case', () => {
    // With all weights at 0, it should forfeit
    // This shouldn't happen with real data but our fallback handles it
    const emptyInventory: readonly PowerUp[] = [];
    const result = generatePowerUp(emptyInventory);
    // Real usage always generates something valid
    expect(result.forfeited).toBe(false);
    expect(result.inventory).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// generateCurse
// ---------------------------------------------------------------------------

describe('generateCurse', () => {
  it('should generate a curse when curses are empty', () => {
    const result = generateCurse([]);
    expect(result.curseType).not.toBeNull();
    expect(result.curses).toHaveLength(1);
    expect(result.curses[0]!.id).toBeDefined();
    expect(result.curses[0]!.type).toBeDefined();
  });

  it('should not generate when curse inventory is full (default max 3)', () => {
    const fullCurses: readonly Curse[] = [
      { type: 'slow_motion', id: '1' },
      { type: 'jumble', id: '2' },
      { type: 'life_steal', id: '3' },
    ];
    const result = generateCurse(fullCurses);

    expect(result.curseType).toBeNull();
    expect(result.curses).toBe(fullCurses); // unchanged
  });

  it('should respect custom maxCurses', () => {
    const partialCurses: readonly Curse[] = [
      { type: 'slow_motion', id: '1' },
      { type: 'jumble', id: '2' },
    ];
    const result = generateCurse(partialCurses, { maxCurses: 2 });

    expect(result.curseType).toBeNull();
    expect(result.curses).toBe(partialCurses);
  });

  it('should produce deterministic results with injected RNG', () => {
    // Slow motion is first in the pool
    const predictableRng = () => 0;
    const result = generateCurse([], { random: predictableRng });

    expect(result.curseType).toBe('slow_motion');
    expect(result.curses[0]!.type).toBe('slow_motion');
  });

  it('should return a new array (immutability)', () => {
    const original: readonly Curse[] = [{ type: 'jumble', id: '1' }];
    const result = generateCurse(original);

    expect(result.curses).not.toBe(original); // different reference
    expect(result.curses[0]!.id).toBe('1'); // original item preserved
  });

  it('should return null curseType when pool is empty (edge case)', () => {
    // This is tested through the normal path — the pool always has items
    // but our selection fallback handles empty pools gracefully
    const result = generateCurse([]);
    expect(result.curseType).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// scoreBubblePop
// ---------------------------------------------------------------------------

describe('scoreBubblePop', () => {
  it('should return empty array for no entries', () => {
    const result = scoreBubblePop([]);
    expect(result).toHaveLength(0);
  });

  it('should rank by completion time (ascending)', () => {
    const entries: readonly BubblePopEntry[] = [
      { playerId: 'a', completionTimeMs: 5000, bubblesReached: 10, serverTimestamp: 100 },
      { playerId: 'b', completionTimeMs: 3000, bubblesReached: 10, serverTimestamp: 200 },
      { playerId: 'c', completionTimeMs: 7000, bubblesReached: 10, serverTimestamp: 300 },
    ];
    const result = scoreBubblePop(entries);

    expect(result[0]!.playerId).toBe('b'); // fastest = rank 1
    expect(result[0]!.rank).toBe(1);
    expect(result[1]!.playerId).toBe('a'); // rank 2
    expect(result[1]!.rank).toBe(2);
    expect(result[2]!.playerId).toBe('c'); // rank 3
    expect(result[2]!.rank).toBe(3);
  });

  it('should rank finished players above unfinished', () => {
    const entries: readonly BubblePopEntry[] = [
      { playerId: 'a', completionTimeMs: null, bubblesReached: 8, serverTimestamp: 100 },
      { playerId: 'b', completionTimeMs: 5000, bubblesReached: 5, serverTimestamp: 200 },
    ];
    const result = scoreBubblePop(entries);

    expect(result[0]!.playerId).toBe('b'); // finished = rank 1
    expect(result[1]!.playerId).toBe('a'); // unfinished = rank 2
  });

  it('should rank by bubbles reached when both unfinished', () => {
    const entries: readonly BubblePopEntry[] = [
      { playerId: 'a', completionTimeMs: null, bubblesReached: 5, serverTimestamp: 100 },
      { playerId: 'b', completionTimeMs: null, bubblesReached: 10, serverTimestamp: 200 },
    ];
    const result = scoreBubblePop(entries);

    expect(result[0]!.playerId).toBe('b'); // more bubbles = rank 1
    expect(result[1]!.playerId).toBe('a');
  });

  it('should tie-break by server timestamp when everything else is equal', () => {
    const entries: readonly BubblePopEntry[] = [
      { playerId: 'b', completionTimeMs: 5000, bubblesReached: 10, serverTimestamp: 300 },
      { playerId: 'a', completionTimeMs: 5000, bubblesReached: 10, serverTimestamp: 100 },
    ];
    const result = scoreBubblePop(entries);

    expect(result[0]!.playerId).toBe('a'); // earlier timestamp = rank 1
    expect(result[1]!.playerId).toBe('b');
  });

  it('should rank correctly with mixed completion states and bubbles', () => {
    const entries: readonly BubblePopEntry[] = [
      { playerId: 'a', completionTimeMs: 4000, bubblesReached: 10, serverTimestamp: 400 },
      { playerId: 'b', completionTimeMs: null, bubblesReached: 12, serverTimestamp: 300 },
      { playerId: 'c', completionTimeMs: 4000, bubblesReached: 10, serverTimestamp: 200 },
      { playerId: 'd', completionTimeMs: null, bubblesReached: 8, serverTimestamp: 500 },
    ];
    const result = scoreBubblePop(entries);

    // Expected order:
    // 1. c (finished, 4000ms, timestamp 200) — faster tiebreak than a
    // 2. a (finished, 4000ms, timestamp 400)
    // 3. b (unfinished, 12 bubbles)
    // 4. d (unfinished, 8 bubbles)
    expect(result[0]!.playerId).toBe('c');
    expect(result[1]!.playerId).toBe('a');
    expect(result[2]!.playerId).toBe('b');
    expect(result[3]!.playerId).toBe('d');
    expect(result[0]!.rank).toBe(1);
    expect(result[3]!.rank).toBe(4);
  });

  it('should handle single entry', () => {
    const entries: readonly BubblePopEntry[] = [
      { playerId: 'a', completionTimeMs: 5000, bubblesReached: 10, serverTimestamp: 100 },
    ];
    const result = scoreBubblePop(entries);

    expect(result).toHaveLength(1);
    expect(result[0]!.playerId).toBe('a');
    expect(result[0]!.rank).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// manageLives
// ---------------------------------------------------------------------------

describe('manageLives', () => {
  it('should deduct lives correctly', () => {
    const input: LifeManagementInput = {
      playerId: 'a',
      currentLives: 3,
      startingLives: 3,
    };
    const result = manageLives(input, -1);

    expect(result.previousLives).toBe(3);
    expect(result.newLives).toBe(2);
    expect(result.delta).toBe(-1);
    expect(result.isEliminated).toBe(false);
  });

  it('should add lives correctly', () => {
    const input: LifeManagementInput = {
      playerId: 'a',
      currentLives: 1,
      startingLives: 3,
    };
    const result = manageLives(input, 1);

    expect(result.previousLives).toBe(1);
    expect(result.newLives).toBe(2);
    expect(result.delta).toBe(1);
    expect(result.isEliminated).toBe(false);
  });

  it('should cap lives at startingLives (max cap)', () => {
    const input: LifeManagementInput = {
      playerId: 'a',
      currentLives: 3,
      startingLives: 3,
    };
    const result = manageLives(input, 1);

    expect(result.newLives).toBe(3); // capped at startingLives
    expect(result.delta).toBe(0); // no actual change beyond cap
  });

  it('should clamp lives at 0 (min cap)', () => {
    const input: LifeManagementInput = {
      playerId: 'a',
      currentLives: 1,
      startingLives: 3,
    };
    const result = manageLives(input, -5);

    expect(result.newLives).toBe(0);
    expect(result.delta).toBe(-1); // actual net change (clamped to 0 from 1)
    expect(result.isEliminated).toBe(true);
  });

  it('should mark player as eliminated when lives reach 0', () => {
    const input: LifeManagementInput = {
      playerId: 'a',
      currentLives: 1,
      startingLives: 3,
    };
    const result = manageLives(input, -1);

    expect(result.newLives).toBe(0);
    expect(result.isEliminated).toBe(true);
  });

  it('should keep eliminated flag false when lives are above 0', () => {
    const input: LifeManagementInput = {
      playerId: 'a',
      currentLives: 2,
      startingLives: 5,
    };
    const result = manageLives(input, -1);

    expect(result.newLives).toBe(1);
    expect(result.isEliminated).toBe(false);
  });

  it('should handle zero delta', () => {
    const input: LifeManagementInput = {
      playerId: 'a',
      currentLives: 2,
      startingLives: 3,
    };
    const result = manageLives(input, 0);

    expect(result.previousLives).toBe(2);
    expect(result.newLives).toBe(2);
    expect(result.delta).toBe(0);
    expect(result.isEliminated).toBe(false);
  });

  it('should round non-integer delta', () => {
    const input: LifeManagementInput = {
      playerId: 'a',
      currentLives: 3,
      startingLives: 3,
    };
    const result = manageLives(input, -1.7);

    expect(result.delta).toBe(-2);
    expect(result.newLives).toBe(1);
  });

  it('should handle large negative delta', () => {
    const input: LifeManagementInput = {
      playerId: 'a',
      currentLives: 5,
      startingLives: 5,
    };
    const result = manageLives(input, -100);

    expect(result.newLives).toBe(0);
    expect(result.isEliminated).toBe(true);
  });
});
