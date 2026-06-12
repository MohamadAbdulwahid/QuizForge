/**
 * Treasure Forge chest generation engine.
 *
 * Generates 3 weighted-random chest outcomes per correct answer.
 * Applies comeback mechanics: trailing players get better odds on
 * positive outcomes; leaders get worse odds.
 *
 * All functions are pure — same input produces same output (given the same RNG).
 */

import type { ChestOutcomeType } from '../../database/schema/session';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of chests shown to a player after a correct answer. */
export const CHEST_COUNT = 3;

/** Minimum total weight after adjustment to avoid division by zero. */
const MIN_TOTAL_WEIGHT = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChestOutcome {
  readonly type: ChestOutcomeType;
  readonly value: number | null;
  readonly label: string;
}

interface WeightedEntry {
  readonly type: ChestOutcomeType;
  readonly value: number | null;
  readonly label: string;
  readonly baseWeight: number;
}

export interface ChestGenerationInput {
  /** Player's current gold total. */
  readonly currentGold: number;
  /** Player's leaderboard rank (1 = first place). */
  readonly playerRank: number;
  /** Total number of players in the game. */
  readonly totalPlayers: number;
  /** Injected RNG for determinism in tests (default: Math.random). */
  readonly random?: () => number;
}

export interface ChestGenerationResult {
  readonly chests: readonly ChestOutcome[];
}

// ---------------------------------------------------------------------------
// Loot table (base weights sum to 100)
// ---------------------------------------------------------------------------

const LOOT_TABLE: readonly WeightedEntry[] = [
  { type: 'gold', value: 10, label: '+10 Gold', baseWeight: 5 },
  { type: 'gold', value: 20, label: '+20 Gold', baseWeight: 12.5 },
  { type: 'gold', value: 40, label: '+40 Gold', baseWeight: 15 },
  { type: 'gold', value: 50, label: '+50 Gold', baseWeight: 13.5 },
  { type: 'multiplier', value: 2, label: 'Double Gold!', baseWeight: 9 },
  { type: 'multiplier', value: 3, label: 'Triple Gold!', baseWeight: 4 },
  { type: 'loss', value: 25, label: 'Lose 25%', baseWeight: 3 },
  { type: 'loss', value: 50, label: 'Lose 50%', baseWeight: 1 },
  { type: 'steal', value: 10, label: 'Steal 10%', baseWeight: 4 },
  { type: 'steal', value: 25, label: 'Steal 25%', baseWeight: 4 },
  { type: 'swap', value: null, label: 'SWAP!', baseWeight: 2 },
  { type: 'nothing', value: null, label: 'Nothing', baseWeight: 2 },
];

// ---------------------------------------------------------------------------
// Comeback mechanics
// ---------------------------------------------------------------------------

/**
 * Computes a weight multiplier based on leaderboard position.
 * Trailing players (high rank number) get boosted positive outcomes
 * and dampened negative outcomes. Leaders get the inverse.
 *
 * Scale: rank 1 (leader) → 0.7× positive / 1.3× negative
 *        rank N (last)   → 1.3× positive / 0.7× negative
 *        midpoint         → 1.0× (no adjustment)
 */
function computeComebackMultiplier(
  playerRank: number,
  totalPlayers: number,
  isPositiveOutcome: boolean
): number {
  if (totalPlayers <= 1) {
    return 1;
  }

  // Normalized position: 0 = leader, 1 = last place
  const normalizedPosition = (playerRank - 1) / (totalPlayers - 1);

  // Positive outcomes: boost trailing (1.3×), dampen leader (0.7×)
  // Negative outcomes: dampen trailing (0.7×), boost leader (1.3×)
  const minMultiplier = 0.7;
  const maxMultiplier = 1.3;

  if (isPositiveOutcome) {
    return minMultiplier + (maxMultiplier - minMultiplier) * normalizedPosition;
  }

  // Negative: inverted
  return maxMultiplier - (maxMultiplier - minMultiplier) * normalizedPosition;
}

/**
 * Determines whether an outcome type is positive (beneficial to the player).
 */
function isPositiveOutcome(type: ChestOutcomeType): boolean {
  return type === 'gold' || type === 'multiplier' || type === 'steal';
}

/**
 * Determines whether an outcome type is negative (detrimental to the player).
 */
function isNegativeOutcome(type: ChestOutcomeType): boolean {
  return type === 'loss';
}

// ---------------------------------------------------------------------------
// Weighted random selection
// ---------------------------------------------------------------------------

/**
 * Adjusts loot table weights based on the player's leaderboard position.
 * Returns a new array with adjusted weights — does not mutate the original.
 */
function adjustWeights(
  playerRank: number,
  totalPlayers: number
): ReadonlyArray<{ entry: WeightedEntry; adjustedWeight: number }> {
  return LOOT_TABLE.map((entry) => {
    let multiplier = 1;

    if (isPositiveOutcome(entry.type)) {
      multiplier = computeComebackMultiplier(playerRank, totalPlayers, true);
    } else if (isNegativeOutcome(entry.type)) {
      multiplier = computeComebackMultiplier(playerRank, totalPlayers, false);
    }
    // 'swap' and 'nothing' are neutral — no adjustment

    return {
      entry,
      adjustedWeight: Math.max(0, entry.baseWeight * multiplier),
    };
  });
}

/**
 * Selects a single outcome using weighted random selection.
 * @param weightedEntries - Entries with adjusted weights.
 * @param rng - Random number generator (0..1).
 * @returns Selected chest outcome.
 */
function selectWeightedOutcome(
  weightedEntries: ReadonlyArray<{ entry: WeightedEntry; adjustedWeight: number }>,
  rng: () => number
): ChestOutcome {
  const totalWeight = weightedEntries.reduce((sum, item) => sum + item.adjustedWeight, 0);

  if (totalWeight < MIN_TOTAL_WEIGHT) {
    // Fallback: return nothing
    return { type: 'nothing', value: null, label: 'Nothing' };
  }

  let roll = rng() * totalWeight;

  for (const item of weightedEntries) {
    roll -= item.adjustedWeight;
    if (roll <= 0) {
      return {
        type: item.entry.type,
        value: item.entry.value,
        label: item.entry.label,
      };
    }
  }

  // Fallback (should not happen with valid weights)
  const last = weightedEntries[weightedEntries.length - 1];
  return { type: last.entry.type, value: last.entry.value, label: last.entry.label };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates CHEST_COUNT unique chest outcomes for a player.
 * Each chest is independently rolled — duplicates are allowed
 * (the player sees 3 separate chests to pick from).
 *
 * @param input - Player context for comeback mechanics.
 * @returns Array of CHEST_COUNT chest outcomes.
 */
export function generateChests(input: ChestGenerationInput): ChestGenerationResult {
  const rng = input.random ?? Math.random;
  const weightedEntries = adjustWeights(input.playerRank, input.totalPlayers);

  const chests: ChestOutcome[] = [];
  for (let i = 0; i < CHEST_COUNT; i++) {
    chests.push(selectWeightedOutcome(weightedEntries, rng));
  }

  return { chests };
}
