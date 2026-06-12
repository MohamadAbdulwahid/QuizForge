/**
 * Treasure Forge chest pick validation.
 *
 * Validates that a chest selection is legitimate:
 * - Player must have answered correctly this round
 * - Player must not have already picked a chest this round
 * - Selected chest index must be valid (0..CHEST_COUNT-1)
 * - Player must be in an active Treasure Forge game
 *
 * Pure function — no side effects.
 */

import { CHEST_COUNT } from './chest-generation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChestPickValidationInput {
  /** Whether the player answered the current question correctly. */
  readonly answeredCorrectly: boolean;
  /** Whether the player has already picked a chest this round. */
  readonly alreadyPicked: boolean;
  /** The chest index the player selected (0-based). */
  readonly selectedIndex: number;
  /** Whether the round is still active (not closed). */
  readonly roundActive: boolean;
  /** Whether the game is still active. */
  readonly gameActive: boolean;
}

export type ChestPickValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly error: string };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates a chest pick request against the current game state.
 * @param input - Validation context.
 * @returns Validation result.
 */
export function validateChestPick(input: ChestPickValidationInput): ChestPickValidationResult {
  if (!input.gameActive) {
    return { ok: false, code: 'GAME_ENDED', error: 'This game has ended' };
  }

  if (!input.roundActive) {
    return { ok: false, code: 'ROUND_CLOSED', error: 'This round has already closed' };
  }

  if (!input.answeredCorrectly) {
    return {
      ok: false,
      code: 'INCORRECT_ANSWER',
      error: 'Only players who answered correctly can pick a chest',
    };
  }

  if (input.alreadyPicked) {
    return {
      ok: false,
      code: 'DUPLICATE_PICK',
      error: 'You have already picked a chest this round',
    };
  }

  if (
    !Number.isInteger(input.selectedIndex) ||
    input.selectedIndex < 0 ||
    input.selectedIndex >= CHEST_COUNT
  ) {
    return {
      ok: false,
      code: 'INVALID_CHEST_INDEX',
      error: `Chest index must be between 0 and ${CHEST_COUNT - 1}`,
    };
  }

  return { ok: true };
}
