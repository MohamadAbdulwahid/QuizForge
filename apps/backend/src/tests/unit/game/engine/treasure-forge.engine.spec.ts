import { describe, it, expect } from 'bun:test';
import {
  createTreasureForgeRoundState,
  handleCorrectAnswer,
  handleIncorrectAnswer,
  processChestPick,
  processStealTarget,
  processSwapTarget,
  applyGoldOutcome,
  shouldAdvanceTreasureForgeRound,
} from '../../../../game/engine/treasure-forge.engine';

describe('Treasure Forge Engine', () => {
  describe('createTreasureForgeRoundState', () => {
    it('should create an empty round state', () => {
      const state = createTreasureForgeRoundState();
      expect(state.playerStates.size).toBe(0);
      expect(state.pendingTargetSelection.size).toBe(0);
    });
  });

  describe('handleCorrectAnswer', () => {
    it('should generate 3 chests for a correct answer', () => {
      const state = createTreasureForgeRoundState();
      const chests = handleCorrectAnswer(state, 'user-1', 100, 2, 4);

      expect(chests).toHaveLength(3);
      expect(state.playerStates.has('user-1')).toBe(true);
    });

    it('should set player state with correct values', () => {
      const state = createTreasureForgeRoundState();
      handleCorrectAnswer(state, 'user-1', 100, 2, 4);

      const playerState = state.playerStates.get('user-1');
      expect(playerState?.answeredCorrectly).toBe(true);
      expect(playerState?.generatedChests).toHaveLength(3);
      expect(playerState?.chestPicked).toBe(false);
      expect(playerState?.outcomeType).toBeNull();
    });
  });

  describe('handleIncorrectAnswer', () => {
    it('should mark player as incorrect', () => {
      const state = createTreasureForgeRoundState();
      handleIncorrectAnswer(state, 'user-1');

      const playerState = state.playerStates.get('user-1');
      expect(playerState?.answeredCorrectly).toBe(false);
      expect(playerState?.generatedChests).toBeNull();
    });
  });

  describe('processChestPick', () => {
    it('should reject pick when player did not answer correctly', () => {
      const state = createTreasureForgeRoundState();
      handleIncorrectAnswer(state, 'user-1');

      const result = processChestPick(state, 'user-1', 0, true, true);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INCORRECT_ANSWER');
      }
    });

    it('should reject pick when already picked', () => {
      const state = createTreasureForgeRoundState();
      handleCorrectAnswer(state, 'user-1', 100, 2, 4);

      // First pick
      processChestPick(state, 'user-1', 0, true, true);

      // Second pick
      const result = processChestPick(state, 'user-1', 1, true, true);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('DUPLICATE_PICK');
      }
    });

    it('should accept valid pick and return outcome', () => {
      const state = createTreasureForgeRoundState();
      handleCorrectAnswer(state, 'user-1', 100, 2, 4);

      const result = processChestPick(state, 'user-1', 0, true, true);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.outcomeType).toBeDefined();
        expect(result.label).toBeDefined();
      }
    });

    it('should update player state after pick', () => {
      const state = createTreasureForgeRoundState();
      handleCorrectAnswer(state, 'user-1', 100, 2, 4);

      processChestPick(state, 'user-1', 0, true, true);

      const playerState = state.playerStates.get('user-1');
      expect(playerState?.chestPicked).toBe(true);
      expect(playerState?.outcomeType).toBeDefined();
    });
  });

  describe('processStealTarget', () => {
    it('should reject steal when player has no pending selection', () => {
      const state = createTreasureForgeRoundState();

      const result = processStealTarget(state, 'user-1', 'user-2', 100, 200, 10);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('NO_PENDING_SELECTION');
      }
    });

    it('should reject steal when outcome type is not steal', () => {
      const state = createTreasureForgeRoundState();
      handleCorrectAnswer(state, 'user-1', 100, 2, 4);
      processChestPick(state, 'user-1', 0, true, true);

      // If the outcome is not steal, it should reject
      const playerState = state.playerStates.get('user-1');
      if (playerState?.outcomeType !== 'steal') {
        const result = processStealTarget(state, 'user-1', 'user-2', 100, 200, 10);
        expect(result.ok).toBe(false);
      }
    });
  });

  describe('processSwapTarget', () => {
    it('should reject swap when player has no pending selection', () => {
      const state = createTreasureForgeRoundState();

      const result = processSwapTarget(state, 'user-1', 'user-2', 100, 200);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('NO_PENDING_SELECTION');
      }
    });
  });

  describe('applyGoldOutcome', () => {
    it('should apply gold outcome correctly', () => {
      const result = applyGoldOutcome(100, 'gold', 20);
      expect(result.newTotal).toBe(120);
      expect(result.delta).toBe(20);
    });

    it('should apply multiplier outcome correctly', () => {
      const result = applyGoldOutcome(100, 'multiplier', 2);
      expect(result.newTotal).toBe(200);
      expect(result.delta).toBe(100);
    });

    it('should apply loss outcome correctly', () => {
      const result = applyGoldOutcome(100, 'loss', 25);
      expect(result.newTotal).toBe(75);
      expect(result.delta).toBe(-25);
    });

    it('should apply nothing outcome correctly', () => {
      const result = applyGoldOutcome(100, 'nothing', null);
      expect(result.newTotal).toBe(100);
      expect(result.delta).toBe(0);
    });
  });

  describe('shouldAdvanceTreasureForgeRound', () => {
    it('should return true when no players have state', () => {
      const state = createTreasureForgeRoundState();
      expect(shouldAdvanceTreasureForgeRound(state)).toBe(true);
    });

    it('should return false when players have pending chest picks', () => {
      const state = createTreasureForgeRoundState();
      handleCorrectAnswer(state, 'user-1', 100, 2, 4);
      // Player hasn't picked yet

      expect(shouldAdvanceTreasureForgeRound(state)).toBe(false);
    });

    it('should return true when all players have picked', () => {
      const state = createTreasureForgeRoundState();
      handleCorrectAnswer(state, 'user-1', 100, 2, 4);
      processChestPick(state, 'user-1', 0, true, true);

      // If no pending target selections
      const playerState = state.playerStates.get('user-1');
      if (playerState?.outcomeType !== 'steal' && playerState?.outcomeType !== 'swap') {
        expect(shouldAdvanceTreasureForgeRound(state)).toBe(true);
      }
    });
  });
});
