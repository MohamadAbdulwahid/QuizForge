/**
 * Bubbly Royale game engine — pure functions for survival-style competitive mode.
 *
 * Provides deterministic (with injectable RNG) game logic for:
 * 1. Player pairing — round 1 random, later rounds by lives avoiding rematches.
 * 2. Duel outcome determination — speed + correctness, ties, 5-tie rule.
 * 3. Power-up generation — weighted random, max inventory 2.
 * 4. Curse generation — weighted random, max inventory 3.
 * 5. Bubble Pop scoring — rank by completion time, bubbles reached, server timestamp.
 * 6. Life management — deduct/add with caps, elimination check.
 *
 * All functions are pure — same input + same RNG produces the same output.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default max power-up inventory slots. */
export const DEFAULT_MAX_POWER_UPS = 2;

/** Default max curse inventory slots. */
export const DEFAULT_MAX_CURSES = 3;

/** Default number of rematches allowed before both players advance. */
export const DEFAULT_MAX_REMATCHES = 5;

/** Threshold in ms under which a duel is considered a tie (both correct). */
export const DUEL_TIE_THRESHOLD_MS = 100;

/** Minimum total weight to avoid division by zero in weighted selection. */
const MIN_TOTAL_WEIGHT = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Power-up types available in Bubbly Royale. */
export type PowerUpType = 'shield' | 'quick_bubble' | 'double_pop' | 'freeze' | 'bubble_heal';

/** Curse types available in Bubbly Royale. */
export type CurseType = 'slow_motion' | 'jumble' | 'life_steal';

/** A power-up item in a player's inventory. */
export interface PowerUp {
  readonly type: PowerUpType;
  /** Unique identifier for the power-up instance. */
  readonly id: string;
}

/** A curse item affecting a player. */
export interface Curse {
  readonly type: CurseType;
  /** Unique identifier for the curse instance. */
  readonly id: string;
}

/** Lightweight player state needed by the engine (lives and pairing history). */
export interface BubblyRoyalePlayerState {
  readonly id: string;
  readonly lives: number;
  /** ID of the player this player last dueled against (null if first round). */
  readonly lastOpponentId: string | null;
}

/** Result of the pairPlayers function. */
export interface PairingResult {
  /** Pairs of player IDs matched together. */
  readonly pairs: readonly (readonly [string, string])[];
  /** The odd player out (null if even count). */
  readonly oddPlayerId: string | null;
  /** The partner the odd player is paired with (someone who already has a pair). */
  readonly oddPartnerId: string | null;
}

/** A player's answer in a duel. */
export interface DuelAnswer {
  readonly playerId: string;
  readonly isCorrect: boolean;
  readonly elapsedMs: number;
}

/** Possible outcomes of a duel. */
export type DuelOutcomeType =
  | 'player1_wins'
  | 'player2_wins'
  | 'both_lose'
  | 'tie'
  | 'both_advance';

/** Result of determineDuelOutcome. */
export interface DuelOutcome {
  readonly outcome: DuelOutcomeType;
  /** ID of the winning player (null for tie/both_lose/both_advance). */
  readonly winnerId: string | null;
  /** ID of the losing player (null for tie/both_advance). */
  readonly loserId: string | null;
}

/** Entry for Bubble Pop scoring — one per player. */
export interface BubblePopEntry {
  readonly playerId: string;
  /** Time in ms to complete all bubbles, or null if player didn't finish. */
  readonly completionTimeMs: number | null;
  /** Highest bubble number reached (used as fallback if completion time is null). */
  readonly bubblesReached: number;
  /** Server timestamp for final tie-breaking (earlier = better). */
  readonly serverTimestamp: number;
}

/** Ranked result for a single player in Bubble Pop. */
export interface BubblePopRanking {
  readonly playerId: string;
  /** 1-based rank (1 = best). */
  readonly rank: number;
}

/** Input for life management operations. */
export interface LifeManagementInput {
  readonly playerId: string;
  readonly currentLives: number;
  readonly startingLives: number;
}

/** Result of a life management operation. */
export interface LifeManagementResult {
  readonly playerId: string;
  readonly previousLives: number;
  readonly newLives: number;
  readonly delta: number;
  /** Whether the player has been eliminated (0 lives). */
  readonly isEliminated: boolean;
}

/** Options for pairPlayers — injectable RNG for determinism in tests. */
export interface PairingOptions {
  /** Random number generator (0..1). Default: Math.random. */
  readonly random?: () => number;
}

/** Options for generatePowerUps — injectable RNG and config overrides. */
export interface PowerUpGenerationOptions {
  /** Random number generator (0..1). Default: Math.random. */
  readonly random?: () => number;
  /** Max inventory size. Default: 2 (DEFAULT_MAX_POWER_UPS). */
  readonly maxInventory?: number;
}

/** Options for generateCurses — injectable RNG and config overrides. */
export interface CurseGenerationOptions {
  /** Random number generator (0..1). Default: Math.random. */
  readonly random?: () => number;
  /** Max curses a player can hold. Default: 3 (DEFAULT_MAX_CURSES). */
  readonly maxCurses?: number;
}

// ---------------------------------------------------------------------------
// Weighted random selection helper
// ---------------------------------------------------------------------------

interface WeightedEntry<T> {
  readonly item: T;
  readonly weight: number;
}

/**
 * Selects a single item using weighted random selection.
 * Returns the selected item or null if the pool is empty or all weights are 0.
 */
function selectWeightedRandom<T>(
  entries: readonly WeightedEntry<T>[],
  rng: () => number
): T | null {
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight < MIN_TOTAL_WEIGHT) return null;

  let roll = rng() * totalWeight;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }

  // Fallback (should not happen with valid weights)
  return entries[entries.length - 1]?.item ?? null;
}

// ---------------------------------------------------------------------------
// Fisher-Yates shuffle (for Round 1 random pairing)
// ---------------------------------------------------------------------------

/**
 * Returns a new shuffled copy of the array using Fisher-Yates.
 * Does not mutate the input.
 */
function shuffleArray<T>(array: readonly T[], rng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

// ---------------------------------------------------------------------------
// 1. Player Pairing
// ---------------------------------------------------------------------------

/**
 * Pairs players for a Bubbly Royale duel round.
 *
 * Round 1 (round === 0): Random shuffling, then sequential pairing.
 * Later rounds: Players are sorted by lives (descending), then greedily paired
 * avoiding recent rematches. The odd player (if any) is paired with someone
 * who already has a partner.
 *
 * @param players - Active players with lives and pairing history.
 * @param round - 0-indexed round number.
 * @param options - Optional injectable RNG.
 * @returns Pairing result with pairs, odd player, and odd partner.
 */
export function pairPlayers(
  players: readonly BubblyRoyalePlayerState[],
  round: number,
  options: PairingOptions = {}
): PairingResult {
  if (players.length < 2) {
    return { pairs: [], oddPlayerId: players[0]?.id ?? null, oddPartnerId: null };
  }

  const rng = options.random ?? Math.random;

  let ordered: readonly BubblyRoyalePlayerState[];

  if (round === 0) {
    // Round 1: random shuffle
    ordered = shuffleArray(players, rng);
  } else {
    // Later rounds: sort by lives descending (similar lives paired together)
    ordered = [...players].sort((a, b) => b.lives - a.lives);
  }

  const used = new Set<string>();
  const pairs: [string, string][] = [];

  for (let i = 0; i < ordered.length; i++) {
    const player = ordered[i]!;
    if (used.has(player.id)) continue;

    // Find a suitable partner: next unused player that isn't last opponent
    let partnerIndex = -1;
    for (let j = i + 1; j < ordered.length; j++) {
      const candidate = ordered[j]!;
      if (used.has(candidate.id)) continue;
      // Avoid pairing with last opponent (only for rounds > 0)
      if (round > 0 && player.lastOpponentId === candidate.id) continue;
      partnerIndex = j;
      break;
    }

    if (partnerIndex !== -1) {
      const partner = ordered[partnerIndex]!;
      pairs.push([player.id, partner.id]);
      used.add(player.id);
      used.add(partner.id);
    }
  }

  // Collect remaining unpaired players
  const unpaired = ordered.filter((p) => !used.has(p.id));

  if (unpaired.length === 0) {
    return { pairs, oddPlayerId: null, oddPartnerId: null };
  }

  // Odd player: pair with someone who already played (first pair's first player)
  const oddPlayer = unpaired[0]!;
  const oddPartner = pairs.length > 0 ? pairs[0]![0]! : null;

  return { pairs, oddPlayerId: oddPlayer.id, oddPartnerId: oddPartner };
}

// ---------------------------------------------------------------------------
// 2. Duel Outcome Determination
// ---------------------------------------------------------------------------

/**
 * Determines the outcome of a 1v1 duel based on correctness and speed.
 *
 * Rules (in priority order):
 * 1. Both wrong → both lose a life.
 * 2. One correct → correct player wins.
 * 3. Both correct, difference >= 100ms → faster player wins.
 * 4. Both correct, difference < 100ms (tie) → rematch.
 * 5. After 5 consecutive ties (rematchCount >= 5) → both advance (no one loses).
 *
 * @param player1 - Answer from player 1.
 * @param player2 - Answer from player 2.
 * @param rematchCount - Number of consecutive ties already occurred (0-indexed).
 * @param maxRematches - Max rematches before both advance. Default: 5.
 * @returns Duel outcome with winner/loser IDs.
 */
export function determineDuelOutcome(
  player1: DuelAnswer,
  player2: DuelAnswer,
  rematchCount = 0,
  maxRematches: number = DEFAULT_MAX_REMATCHES
): DuelOutcome {
  // Both wrong → both lose
  if (!player1.isCorrect && !player2.isCorrect) {
    return { outcome: 'both_lose', winnerId: null, loserId: null };
  }

  // Only player1 correct → player1 wins
  if (player1.isCorrect && !player2.isCorrect) {
    return { outcome: 'player1_wins', winnerId: player1.playerId, loserId: player2.playerId };
  }

  // Only player2 correct → player2 wins
  if (!player1.isCorrect && player2.isCorrect) {
    return { outcome: 'player2_wins', winnerId: player2.playerId, loserId: player1.playerId };
  }

  // Both correct — compare speed
  const timeDiff = Math.abs(player1.elapsedMs - player2.elapsedMs);

  // Tie: difference < 100ms
  if (timeDiff < DUEL_TIE_THRESHOLD_MS) {
    // 5 ties → both advance
    if (rematchCount >= maxRematches) {
      return { outcome: 'both_advance', winnerId: null, loserId: null };
    }
    return { outcome: 'tie', winnerId: null, loserId: null };
  }

  // Faster player wins
  if (player1.elapsedMs < player2.elapsedMs) {
    return { outcome: 'player1_wins', winnerId: player1.playerId, loserId: player2.playerId };
  }

  return { outcome: 'player2_wins', winnerId: player2.playerId, loserId: player1.playerId };
}

// ---------------------------------------------------------------------------
// 3. Power-Up Generation
// ---------------------------------------------------------------------------

/** Weighted power-up pool. Weights sum to 100 for percentage-based odds. */
const POWER_UP_POOL: readonly WeightedEntry<PowerUpType>[] = [
  { item: 'shield', weight: 35 },
  { item: 'quick_bubble', weight: 25 },
  { item: 'double_pop', weight: 18 },
  { item: 'freeze', weight: 14 },
  { item: 'bubble_heal', weight: 8 },
];

let powerUpIdCounter = 0;

/**
 * Generates a single power-up using weighted random selection.
 *
 * If the player's inventory is full (maxInventory), the power-up is forfeited.
 * Returns the updated inventory (immutable) and a forfeited flag.
 *
 * @param currentInventory - Player's current power-up inventory.
 * @param options - Optional injectable RNG and max inventory override.
 * @returns New inventory array and forfeited status.
 */
export function generatePowerUp(
  currentInventory: readonly PowerUp[],
  options: PowerUpGenerationOptions = {}
): { readonly inventory: readonly PowerUp[]; readonly forfeited: boolean } {
  const maxInventory = options.maxInventory ?? DEFAULT_MAX_POWER_UPS;
  const rng = options.random ?? Math.random;

  if (currentInventory.length >= maxInventory) {
    return { inventory: currentInventory, forfeited: true };
  }

  const selectedType = selectWeightedRandom(POWER_UP_POOL, rng);
  if (!selectedType) {
    return { inventory: currentInventory, forfeited: true };
  }

  const newPowerUp: PowerUp = {
    type: selectedType,
    id: `${selectedType}_${Date.now()}_${++powerUpIdCounter}_${Math.floor(rng() * 10000)}`,
  };

  return { inventory: [...currentInventory, newPowerUp], forfeited: false };
}

// ---------------------------------------------------------------------------
// 4. Curse Generation
// ---------------------------------------------------------------------------

/** Weighted curse pool. Weights sum to 100 for percentage-based odds. */
const CURSE_POOL: readonly WeightedEntry<CurseType>[] = [
  { item: 'slow_motion', weight: 35 },
  { item: 'jumble', weight: 35 },
  { item: 'life_steal', weight: 30 },
];

let curseIdCounter = 0;

/**
 * Generates a single curse using weighted random selection and applies it to the player.
 *
 * Returns the updated curses array (immutable). If the player's curse inventory is
 * at max capacity (default 3), the curse is still "generated" and the calling code
 * is informed; the curse is added. Per the spec: max inventory 3 — we enforce
 * the cap by not exceeding it.
 *
 * @param currentCurses - Player's current active curses.
 * @param options - Optional injectable RNG and max curses override.
 * @returns Updated curses array and the type of curse generated.
 */
export function generateCurse(
  currentCurses: readonly Curse[],
  options: CurseGenerationOptions = {}
): { readonly curses: readonly Curse[]; readonly curseType: CurseType | null } {
  const maxCurses = options.maxCurses ?? DEFAULT_MAX_CURSES;
  const rng = options.random ?? Math.random;

  if (currentCurses.length >= maxCurses) {
    // Already at max — no new curse applied
    return { curses: currentCurses, curseType: null };
  }

  const selectedType = selectWeightedRandom(CURSE_POOL, rng);
  if (!selectedType) {
    return { curses: currentCurses, curseType: null };
  }

  const newCurse: Curse = {
    type: selectedType,
    id: `curse_${selectedType}_${Date.now()}_${++curseIdCounter}_${Math.floor(rng() * 10000)}`,
  };

  return { curses: [...currentCurses, newCurse], curseType: selectedType };
}

// ---------------------------------------------------------------------------
// 5. Bubble Pop Scoring
// ---------------------------------------------------------------------------

/**
 * Ranks players in a Bubble Pop challenge (sorting / "last standing" mini-game).
 *
 * Ranking priority:
 * 1. Completion time (ascending — faster = better). Players who didn't finish (null)
 *    are ranked last.
 * 2. If both finished or both didn't: higher bubbles reached = better.
 * 3. Tie-break: earlier server timestamp = better rank.
 *
 * @param entries - One entry per player with timing and progress data.
 * @returns Ranked results with 1-based rank for each player.
 */
export function scoreBubblePop(entries: readonly BubblePopEntry[]): readonly BubblePopRanking[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => {
    // Both finished — compare by time (ascending)
    if (a.completionTimeMs !== null && b.completionTimeMs !== null) {
      const timeDiff = a.completionTimeMs - b.completionTimeMs;
      if (timeDiff !== 0) return timeDiff;
      // Equal times — fall through to tie-break by timestamp
    }

    // One finished, one didn't — finished player ranks higher
    if (a.completionTimeMs !== null && b.completionTimeMs === null) return -1;
    if (a.completionTimeMs === null && b.completionTimeMs !== null) return 1;

    // Neither finished — compare by bubbles reached (descending)
    if (a.bubblesReached !== b.bubblesReached) {
      return b.bubblesReached - a.bubblesReached;
    }

    // Tie-break: earlier server timestamp = better
    return a.serverTimestamp - b.serverTimestamp;
  });

  return sorted.map((entry, index) => ({
    playerId: entry.playerId,
    rank: index + 1,
  }));
}

// ---------------------------------------------------------------------------
// 6. Life Management
// ---------------------------------------------------------------------------

/**
 * Adjusts a player's life count and checks for elimination.
 *
 * Lives are clamped between 0 and startingLives (max cap).
 * When lives reach 0, the player is marked as eliminated.
 *
 * @param input - Player life state.
 * @param delta - Number of lives to add (positive) or subtract (negative).
 * @returns Updated life state with elimination flag.
 */
export function manageLives(input: LifeManagementInput, delta: number): LifeManagementResult {
  const clampedDelta = Math.round(delta); // Ensure integer delta
  const rawLives = input.currentLives + clampedDelta;
  const newLives = Math.max(0, Math.min(input.startingLives, rawLives));

  return {
    playerId: input.playerId,
    previousLives: input.currentLives,
    newLives,
    delta: newLives - input.currentLives,
    isEliminated: newLives <= 0,
  };
}
