import { describe, it, expect } from 'bun:test';
import { validateChestPick } from '../../../../game/engine/chest-validation';

describe('Chest Validation', () => {
  describe('validateChestPick', () => {
    it('should accept valid chest pick', () => {
      const result = validateChestPick({
        answeredCorrectly: true,
        alreadyPicked: false,
        selectedIndex: 0,
        roundActive: true,
        gameActive: true,
      });
      expect(result.ok).toBe(true);
    });

    it('should reject pick when game is not active', () => {
      const result = validateChestPick({
        answeredCorrectly: true,
        alreadyPicked: false,
        selectedIndex: 0,
        roundActive: true,
        gameActive: false,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('GAME_ENDED');
      }
    });

    it('should reject pick when round is not active', () => {
      const result = validateChestPick({
        answeredCorrectly: true,
        alreadyPicked: false,
        selectedIndex: 0,
        roundActive: false,
        gameActive: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('ROUND_CLOSED');
      }
    });

    it('should reject pick when answer was incorrect', () => {
      const result = validateChestPick({
        answeredCorrectly: false,
        alreadyPicked: false,
        selectedIndex: 0,
        roundActive: true,
        gameActive: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INCORRECT_ANSWER');
      }
    });

    it('should reject pick when already picked', () => {
      const result = validateChestPick({
        answeredCorrectly: true,
        alreadyPicked: true,
        selectedIndex: 0,
        roundActive: true,
        gameActive: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('DUPLICATE_PICK');
      }
    });

    it('should reject pick with invalid index (too low)', () => {
      const result = validateChestPick({
        answeredCorrectly: true,
        alreadyPicked: false,
        selectedIndex: -1,
        roundActive: true,
        gameActive: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_CHEST_INDEX');
      }
    });

    it('should reject pick with invalid index (too high)', () => {
      const result = validateChestPick({
        answeredCorrectly: true,
        alreadyPicked: false,
        selectedIndex: 3,
        roundActive: true,
        gameActive: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_CHEST_INDEX');
      }
    });

    it('should accept pick at index 0', () => {
      const result = validateChestPick({
        answeredCorrectly: true,
        alreadyPicked: false,
        selectedIndex: 0,
        roundActive: true,
        gameActive: true,
      });
      expect(result.ok).toBe(true);
    });

    it('should accept pick at index 1', () => {
      const result = validateChestPick({
        answeredCorrectly: true,
        alreadyPicked: false,
        selectedIndex: 1,
        roundActive: true,
        gameActive: true,
      });
      expect(result.ok).toBe(true);
    });

    it('should accept pick at index 2', () => {
      const result = validateChestPick({
        answeredCorrectly: true,
        alreadyPicked: false,
        selectedIndex: 2,
        roundActive: true,
        gameActive: true,
      });
      expect(result.ok).toBe(true);
    });
  });
});
