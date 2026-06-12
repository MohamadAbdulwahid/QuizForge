/**
 * Treasure Forge gold calculation engine.
 *
 * Pure functions for all gold operations: add, multiply, steal, swap, loss.
 * Every function returns a GoldResult with the new total and delta.
 * No side effects — safe for server-side validation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoldResult {
  /** New gold total after the operation. */
  readonly newTotal: number;
  /** Change in gold (positive = gain, negative = loss). */
  readonly delta: number;
}

export interface StealInput {
  /** Stealer's current gold. */
  readonly stealerGold: number;
  /** Target's current gold. */
  readonly targetGold: number;
  /** Percentage to steal (10 or 25). */
  readonly percent: number;
}

export interface StealResult {
  /** Stealer's new gold total. */
  readonly stealerNewTotal: number;
  /** Target's new gold total. */
  readonly targetNewTotal: number;
  /** Gold transferred. */
  readonly stolenAmount: number;
}

export interface SwapResult {
  /** Player A's new gold (was B's). */
  readonly playerANewTotal: number;
  /** Player B's new gold (was A's). */
  readonly playerBNewTotal: number;
}

// ---------------------------------------------------------------------------
// Gold operations
// ---------------------------------------------------------------------------

/**
 * Adds a fixed amount of gold.
 * @param currentGold - Player's current gold.
 * @param amount - Gold to add (must be positive).
 * @returns New total and delta.
 */
export function addGold(currentGold: number, amount: number): GoldResult {
  const safeAmount = Math.max(0, Math.floor(amount));
  const newTotal = Math.max(0, Math.floor(currentGold)) + safeAmount;
  return { newTotal, delta: safeAmount };
}

/**
 * Multiplies the player's entire gold total.
 * @param currentGold - Player's current gold.
 * @param multiplier - Multiplier (2 for double, 3 for triple).
 * @returns New total and delta.
 */
export function multiplyGold(currentGold: number, multiplier: number): GoldResult {
  const safeGold = Math.max(0, Math.floor(currentGold));
  const safeMultiplier = Math.max(1, Math.floor(multiplier));
  const newTotal = safeGold * safeMultiplier;
  return { newTotal, delta: newTotal - safeGold };
}

/**
 * Reduces the player's gold by a percentage.
 * @param currentGold - Player's current gold.
 * @param percent - Percentage to lose (25 or 50).
 * @returns New total and delta (negative).
 */
export function loseGold(currentGold: number, percent: number): GoldResult {
  const safeGold = Math.max(0, Math.floor(currentGold));
  const safePercent = Math.max(0, Math.min(100, percent));
  const loss = Math.floor(safeGold * (safePercent / 100));
  const newTotal = safeGold - loss;
  return { newTotal, delta: -loss };
}

/**
 * Steals a percentage of the target's gold and adds it to the stealer.
 * If the target has 0 gold, nothing is stolen.
 *
 * @param input - Steal operation parameters.
 * @returns Updated totals for both players and the stolen amount.
 */
export function stealGold(input: StealInput): StealResult {
  const safeStealerGold = Math.max(0, Math.floor(input.stealerGold));
  const safeTargetGold = Math.max(0, Math.floor(input.targetGold));
  const safePercent = Math.max(0, Math.min(100, input.percent));

  const stolenAmount = Math.floor(safeTargetGold * (safePercent / 100));

  return {
    stealerNewTotal: safeStealerGold + stolenAmount,
    targetNewTotal: safeTargetGold - stolenAmount,
    stolenAmount,
  };
}

/**
 * Swaps the entire gold totals between two players.
 * @param playerAGold - Player A's current gold.
 * @param playerBGold - Player B's current gold.
 * @returns Both players' new totals (swapped).
 */
export function swapGold(playerAGold: number, playerBGold: number): SwapResult {
  return {
    playerANewTotal: Math.max(0, Math.floor(playerBGold)),
    playerBNewTotal: Math.max(0, Math.floor(playerAGold)),
  };
}
