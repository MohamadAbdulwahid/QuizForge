/**
 * Treasure Forge game engine.
 *
 * Orchestrates the Treasure Forge round flow:
 * 1. Question displayed → players answer
 * 2. Correct answer → 3 chests generated (server-side only)
 * 3. Player picks a chest → outcome revealed
 * 4. Steal/Swap → player selects target
 * 5. Effect applied → gold updated
 * 6. All correct answerers done → next question
 *
 * Security: Chest outcomes are NEVER sent to the client until after picking.
 * All gold operations are server-side validated.
 */

import type { ChestOutcomeType } from '../../database/schema/session';
import type { ChestOutcome } from './chest-generation';
import { generateChests } from './chest-generation';
import { validateChestPick } from './chest-validation';
import { addGold, multiplyGold, loseGold, stealGold, swapGold } from './gold-calculation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Delay in ms before a wrong-answer player can proceed (anti-spam). */
export const WRONG_ANSWER_DELAY_MS = 1500;

/** Delay in ms before advancing to next question after round closes. */
export const ROUND_ADVANCE_DELAY_MS = 3000;

/** Penalty duration in ms for wrong answers in continuous mode. */
export const WRONG_ANSWER_PENALTY_MS = 3000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stored outcome info for pending steal/swap target selection. */
export interface PendingTfOutcome {
  /** Steal or swap. */
  readonly type: 'steal' | 'swap';
  /** Outcome value (steal percent, or unused for swap). */
  readonly value: number | null;
  /** Human-readable chest label. */
  readonly label: string;
}

/** Per-player question tracking for continuous Treasure Forge mode. */
export interface PlayerQuestionState {
  /** Shuffled question IDs for this player's pool. */
  readonly shuffledQuestionIds: number[];
  /** Current index into shuffledQuestionIds. */
  currentQuestionIndex: number;
  /** Timestamp (ms) until which the player is penalized — null if not penalized. */
  penaltyUntil: number | null;
  /** Whether the player has a pending chest pick. */
  hasPendingChest: boolean;
  /** Generated chest outcomes waiting to be picked. */
  pendingChestOutcomes: ChestOutcome[] | null;
  /** Pending chest outcome awaiting target selection (steal/swap). */
  pendingTfOutcome: PendingTfOutcome | null;
}

/** Per-player state for a Treasure Forge round. */
export interface TreasureForgePlayerRoundState {
  /** Whether the player answered correctly this round. */
  readonly answeredCorrectly: boolean;
  /** Whether the player has picked a chest this round. */
  readonly chestPicked: boolean;
  /** The chests generated for this player (server-side only). */
  readonly generatedChests: readonly ChestOutcome[] | null;
  /** The outcome type after picking (for audit). */
  readonly outcomeType: ChestOutcomeType | null;
  /** The outcome value after picking (for audit). */
  readonly outcomeValue: number | null;
  /** Target player ID for steal/swap (for audit). */
  readonly targetPlayerId: string | null;
}

/** Extended round state for Treasure Forge. */
export interface TreasureForgeRoundState {
  /** Per-player round state keyed by userId. */
  readonly playerStates: Map<string, TreasureForgePlayerRoundState>;
  /** Players who need to select a steal/swap target. */
  readonly pendingTargetSelection: Set<string>;
}

/** Result of a chest pick operation. */
export type ChestPickResult =
  | {
      readonly ok: true;
      readonly outcomeType: ChestOutcomeType;
      readonly outcomeValue: number | null;
      readonly goldDelta: number;
      readonly newTotal: number;
      readonly requiresTargetSelection: boolean;
      readonly label: string;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly error: string;
    };

/** Result of a steal target selection. */
export type StealTargetResult =
  | {
      readonly ok: true;
      readonly stolenAmount: number;
      readonly stealerNewTotal: number;
      readonly targetNewTotal: number;
      readonly targetUsername: string;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly error: string;
    };

/** Result of a swap target selection. */
export type SwapTargetResult =
  | {
      readonly ok: true;
      readonly playerNewTotal: number;
      readonly targetNewTotal: number;
      readonly targetUsername: string;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly error: string;
    };

// ---------------------------------------------------------------------------
// Player round state management
// ---------------------------------------------------------------------------

/**
 * Creates initial player round state for a Treasure Forge round.
 */
export function createPlayerRoundState(): TreasureForgePlayerRoundState {
  return {
    answeredCorrectly: false,
    chestPicked: false,
    generatedChests: null,
    outcomeType: null,
    outcomeValue: null,
    targetPlayerId: null,
  };
}

/**
 * Creates initial Treasure Forge round state.
 */
export function createTreasureForgeRoundState(): TreasureForgeRoundState {
  return {
    playerStates: new Map(),
    pendingTargetSelection: new Set(),
  };
}

/**
 * Marks a player as having answered correctly and generates their chests.
 * Returns the generated chests (to be sent to the player only).
 */
export function handleCorrectAnswer(
  roundState: TreasureForgeRoundState,
  userId: string,
  currentGold: number,
  playerRank: number,
  totalPlayers: number
): readonly ChestOutcome[] {
  const existing = roundState.playerStates.get(userId);
  if (existing?.answeredCorrectly) {
    // Already answered correctly — return existing chests
    return existing.generatedChests ?? [];
  }

  const { chests } = generateChests({
    currentGold,
    playerRank,
    totalPlayers,
  });

  roundState.playerStates.set(userId, {
    answeredCorrectly: true,
    chestPicked: false,
    generatedChests: chests,
    outcomeType: null,
    outcomeValue: null,
    targetPlayerId: null,
  });

  return chests;
}

/**
 * Marks a player as having answered incorrectly.
 */
export function handleIncorrectAnswer(roundState: TreasureForgeRoundState, userId: string): void {
  const existing = roundState.playerStates.get(userId);
  if (!existing) {
    roundState.playerStates.set(userId, createPlayerRoundState());
  }
}

/**
 * Validates and processes a chest pick.
 * Returns the outcome if valid, or an error.
 */
export function processChestPick(
  roundState: TreasureForgeRoundState,
  userId: string,
  chestIndex: number,
  roundActive: boolean,
  gameActive: boolean
): ChestPickResult {
  const playerState = roundState.playerStates.get(userId);

  const validation = validateChestPick({
    answeredCorrectly: playerState?.answeredCorrectly ?? false,
    alreadyPicked: playerState?.chestPicked ?? false,
    selectedIndex: chestIndex,
    roundActive,
    gameActive,
  });

  if (!validation.ok) {
    return { ok: false, code: validation.code, error: validation.error };
  }

  const chests = playerState!.generatedChests;
  if (!chests || chestIndex >= chests.length) {
    return { ok: false, code: 'INVALID_CHEST', error: 'Chest data not found' };
  }

  const selectedChest = chests[chestIndex];

  // Mark chest as picked
  roundState.playerStates.set(userId, {
    ...playerState!,
    chestPicked: true,
    outcomeType: selectedChest.type,
    outcomeValue: selectedChest.value,
  });

  // Determine if this outcome requires target selection
  const requiresTargetSelection = selectedChest.type === 'steal' || selectedChest.type === 'swap';

  if (requiresTargetSelection) {
    roundState.pendingTargetSelection.add(userId);
  }

  // Calculate gold delta for non-interactive outcomes
  let goldDelta = 0;
  let newTotal = 0;

  if (selectedChest.type === 'gold') {
    const result = addGold(0, selectedChest.value ?? 0);
    goldDelta = result.delta;
    newTotal = result.newTotal; // Will be added to current gold by caller
  } else if (selectedChest.type === 'loss') {
    // Loss is applied immediately
    goldDelta = -(selectedChest.value ?? 0);
    newTotal = 0; // Will be calculated by caller
  }
  // multiplier, steal, swap: gold delta calculated by caller with current gold

  return {
    ok: true,
    outcomeType: selectedChest.type,
    outcomeValue: selectedChest.value,
    goldDelta,
    newTotal,
    requiresTargetSelection,
    label: selectedChest.label,
  };
}

/**
 * Processes a steal target selection.
 * Returns the steal result if valid, or an error.
 */
export function processStealTarget(
  roundState: TreasureForgeRoundState,
  userId: string,
  targetUserId: string,
  stealerGold: number,
  targetGold: number,
  stealPercent: number
): StealTargetResult {
  if (!roundState.pendingTargetSelection.has(userId)) {
    return {
      ok: false,
      code: 'NO_PENDING_SELECTION',
      error: 'No pending target selection for this player',
    };
  }

  const playerState = roundState.playerStates.get(userId);
  if (!playerState || playerState.outcomeType !== 'steal') {
    return {
      ok: false,
      code: 'INVALID_STATE',
      error: 'Player is not in a steal state',
    };
  }

  if (userId === targetUserId) {
    return {
      ok: false,
      code: 'CANNOT_TARGET_SELF',
      error: 'You cannot steal from yourself',
    };
  }

  const result = stealGold({
    stealerGold,
    targetGold,
    percent: stealPercent,
  });

  // Update player state with target
  roundState.playerStates.set(userId, {
    ...playerState,
    targetPlayerId: targetUserId,
  });
  roundState.pendingTargetSelection.delete(userId);

  return {
    ok: true,
    stolenAmount: result.stolenAmount,
    stealerNewTotal: result.stealerNewTotal,
    targetNewTotal: result.targetNewTotal,
    targetUsername: '', // Caller fills this in
  };
}

/**
 * Processes a swap target selection.
 * Returns the swap result if valid, or an error.
 */
export function processSwapTarget(
  roundState: TreasureForgeRoundState,
  userId: string,
  targetUserId: string,
  playerGold: number,
  targetGold: number
): SwapTargetResult {
  if (!roundState.pendingTargetSelection.has(userId)) {
    return {
      ok: false,
      code: 'NO_PENDING_SELECTION',
      error: 'No pending target selection for this player',
    };
  }

  const playerState = roundState.playerStates.get(userId);
  if (!playerState || playerState.outcomeType !== 'swap') {
    return {
      ok: false,
      code: 'INVALID_STATE',
      error: 'Player is not in a swap state',
    };
  }

  if (userId === targetUserId) {
    return {
      ok: false,
      code: 'CANNOT_TARGET_SELF',
      error: 'You cannot swap with yourself',
    };
  }

  const result = swapGold(playerGold, targetGold);

  // Update player state with target
  roundState.playerStates.set(userId, {
    ...playerState,
    targetPlayerId: targetUserId,
  });
  roundState.pendingTargetSelection.delete(userId);

  return {
    ok: true,
    playerNewTotal: result.playerANewTotal,
    targetNewTotal: result.playerBNewTotal,
    targetUsername: '', // Caller fills this in
  };
}

/**
 * Applies a gold outcome to a player's current gold.
 * Used for gold, multiplier, and loss outcomes.
 */
export function applyGoldOutcome(
  currentGold: number,
  outcomeType: ChestOutcomeType,
  outcomeValue: number | null
): { newTotal: number; delta: number } {
  switch (outcomeType) {
    case 'gold':
      return addGold(currentGold, outcomeValue ?? 0);
    case 'multiplier':
      return multiplyGold(currentGold, outcomeValue ?? 2);
    case 'loss':
      return loseGold(currentGold, outcomeValue ?? 25);
    case 'nothing':
      return { newTotal: currentGold, delta: 0 };
    default:
      // steal/swap are handled separately
      return { newTotal: currentGold, delta: 0 };
  }
}

/**
 * Checks whether all correct answerers have completed their chest picks
 * (including target selection for steal/swap).
 * Returns true when the round can auto-advance.
 */
export function shouldAdvanceTreasureForgeRound(roundState: TreasureForgeRoundState): boolean {
  // All correct answerers must have picked their chests
  for (const [, state] of roundState.playerStates) {
    if (state.answeredCorrectly && !state.chestPicked) {
      return false;
    }
  }

  // All pending target selections must be resolved
  return roundState.pendingTargetSelection.size === 0;
}

/**
 * Gets the list of correct answerers who haven't picked a chest yet.
 */
export function getPendingChestPickers(roundState: TreasureForgeRoundState): string[] {
  const pending: string[] = [];
  for (const [userId, state] of roundState.playerStates) {
    if (state.answeredCorrectly && !state.chestPicked) {
      pending.push(userId);
    }
  }
  return pending;
}

/**
 * Gets the list of players who need to select a target.
 */
export function getPendingTargetSelectors(roundState: TreasureForgeRoundState): string[] {
  return [...roundState.pendingTargetSelection];
}

// ---------------------------------------------------------------------------
// Continuous mode: PlayerQuestionState management
// ---------------------------------------------------------------------------

/**
 * Creates a new PlayerQuestionState with shuffled question IDs.
 * Uses Fisher-Yates shuffle for unbiased randomization.
 */
export function createPlayerQuestionState(questionIds: number[]): PlayerQuestionState {
  const shuffled = [...questionIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return {
    shuffledQuestionIds: shuffled,
    currentQuestionIndex: 0,
    penaltyUntil: null,
    hasPendingChest: false,
    pendingChestOutcomes: null,
    pendingTfOutcome: null,
  };
}

/**
 * Gets the current question ID for a player, reshuffling if exhausted.
 * Returns null if the question pool is empty.
 */
export function getNextPlayerQuestion(state: PlayerQuestionState): number | null {
  if (state.shuffledQuestionIds.length === 0) return null;

  const id = state.shuffledQuestionIds[state.currentQuestionIndex];
  if (id === undefined) return null;

  return id;
}

/**
 * Advances the player to their next question.
 * If the pool is exhausted, reshuffles and restarts.
 */
export function advanceToNextQuestion(state: PlayerQuestionState): void {
  const nextIndex = state.currentQuestionIndex + 1;

  if (nextIndex >= state.shuffledQuestionIds.length) {
    // Reshuffle and restart
    const currentId = state.shuffledQuestionIds[state.currentQuestionIndex];
    const ids = state.shuffledQuestionIds.filter((id) => id !== currentId);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    (state as PlayerQuestionState).shuffledQuestionIds = ids;
    (state as PlayerQuestionState).currentQuestionIndex = 0;
  } else {
    (state as PlayerQuestionState).currentQuestionIndex = nextIndex;
  }

  // Reset chest/penalty state for the new question
  state.hasPendingChest = false;
  state.penaltyUntil = null;
  state.pendingChestOutcomes = null;
  state.pendingTfOutcome = null;
}

/**
 * Checks if a player is currently in penalty cooldown.
 */
export function isPlayerInPenalty(state: PlayerQuestionState, nowMs: number): boolean {
  return state.penaltyUntil !== null && nowMs < state.penaltyUntil;
}
