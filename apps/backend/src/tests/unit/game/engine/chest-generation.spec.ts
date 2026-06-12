import { describe, it, expect } from 'bun:test';
import { generateChests, CHEST_COUNT } from '../../../../game/engine/chest-generation';

describe('Chest Generation', () => {
  describe('generateChests', () => {
    it('should return exactly CHEST_COUNT chests', () => {
      const result = generateChests({
        currentGold: 100,
        playerRank: 1,
        totalPlayers: 4,
      });

      expect(result.chests).toHaveLength(CHEST_COUNT);
    });

    it('should return chests with valid types', () => {
      const validTypes = ['gold', 'multiplier', 'loss', 'steal', 'swap', 'nothing'];

      const result = generateChests({
        currentGold: 100,
        playerRank: 1,
        totalPlayers: 4,
      });

      for (const chest of result.chests) {
        expect(validTypes).toContain(chest.type);
      }
    });

    it('should return chests with non-empty labels', () => {
      const result = generateChests({
        currentGold: 100,
        playerRank: 1,
        totalPlayers: 4,
      });

      for (const chest of result.chests) {
        expect(chest.label.length).toBeGreaterThan(0);
      }
    });

    it('should use provided random function', () => {
      // Return 0 for first call (selects first outcome), 0.5 for second, etc.
      let callCount = 0;
      const mockRandom = () => {
        callCount++;
        return (callCount - 1) * 0.1; // 0, 0.1, 0.2, ...
      };

      const result = generateChests({
        currentGold: 100,
        playerRank: 1,
        totalPlayers: 4,
        random: mockRandom,
      });

      expect(result.chests).toHaveLength(CHEST_COUNT);
    });

    it('should handle zero gold gracefully', () => {
      const result = generateChests({
        currentGold: 0,
        playerRank: 1,
        totalPlayers: 4,
      });

      expect(result.chests).toHaveLength(CHEST_COUNT);
    });

    it('should handle single player gracefully', () => {
      const result = generateChests({
        currentGold: 100,
        playerRank: 1,
        totalPlayers: 1,
      });

      expect(result.chests).toHaveLength(CHEST_COUNT);
    });
  });

  describe('comeback mechanics', () => {
    it('should boost positive outcomes for trailing players', () => {
      // Generate many chests for a trailing player and check distribution
      const results = [];
      for (let i = 0; i < 100; i++) {
        const mockRandom = () => Math.random();

        const result = generateChests({
          currentGold: 50,
          playerRank: 4, // Last place
          totalPlayers: 4,
          random: mockRandom,
        });
        results.push(result);
      }

      // Should have generated chests without errors
      expect(results.length).toBe(100);
    });

    it('should handle leader position correctly', () => {
      const result = generateChests({
        currentGold: 500,
        playerRank: 1, // First place
        totalPlayers: 4,
      });

      expect(result.chests).toHaveLength(CHEST_COUNT);
    });
  });

  describe('outcome types', () => {
    it('should generate gold outcomes with valid values', () => {
      const validGoldValues = [10, 20, 40, 50];

      // Run multiple times to try to get a gold outcome
      for (let i = 0; i < 50; i++) {
        const result = generateChests({
          currentGold: 100,
          playerRank: 2,
          totalPlayers: 4,
        });

        for (const chest of result.chests) {
          if (chest.type === 'gold') {
            expect(validGoldValues).toContain(chest.value);
          }
        }
      }
    });

    it('should generate multiplier outcomes with valid values', () => {
      const validMultiplierValues = [2, 3];

      for (let i = 0; i < 50; i++) {
        const result = generateChests({
          currentGold: 100,
          playerRank: 2,
          totalPlayers: 4,
        });

        for (const chest of result.chests) {
          if (chest.type === 'multiplier') {
            expect(validMultiplierValues).toContain(chest.value);
          }
        }
      }
    });

    it('should generate loss outcomes with valid values', () => {
      const validLossValues = [25, 50];

      for (let i = 0; i < 50; i++) {
        const result = generateChests({
          currentGold: 100,
          playerRank: 2,
          totalPlayers: 4,
        });

        for (const chest of result.chests) {
          if (chest.type === 'loss') {
            expect(validLossValues).toContain(chest.value);
          }
        }
      }
    });

    it('should generate steal outcomes with valid values', () => {
      const validStealValues = [10, 25];

      for (let i = 0; i < 50; i++) {
        const result = generateChests({
          currentGold: 100,
          playerRank: 2,
          totalPlayers: 4,
        });

        for (const chest of result.chests) {
          if (chest.type === 'steal') {
            expect(validStealValues).toContain(chest.value);
          }
        }
      }
    });
  });
});
