import { describe, it, expect } from 'bun:test';
import {
  addGold,
  multiplyGold,
  loseGold,
  stealGold,
  swapGold,
} from '../../../../game/engine/gold-calculation';

describe('Gold Calculation', () => {
  describe('addGold', () => {
    it('should add gold correctly', () => {
      const result = addGold(100, 20);
      expect(result.newTotal).toBe(120);
      expect(result.delta).toBe(20);
    });

    it('should handle zero addition', () => {
      const result = addGold(100, 0);
      expect(result.newTotal).toBe(100);
      expect(result.delta).toBe(0);
    });

    it('should clamp negative amounts to zero', () => {
      const result = addGold(100, -20);
      expect(result.newTotal).toBe(100);
      expect(result.delta).toBe(0);
    });

    it('should handle large numbers safely', () => {
      const result = addGold(Number.MAX_SAFE_INTEGER - 10, 20);
      expect(result.newTotal).toBeGreaterThan(0);
      expect(result.delta).toBeGreaterThan(0);
    });
  });

  describe('multiplyGold', () => {
    it('should double gold correctly', () => {
      const result = multiplyGold(100, 2);
      expect(result.newTotal).toBe(200);
      expect(result.delta).toBe(100);
    });

    it('should triple gold correctly', () => {
      const result = multiplyGold(100, 3);
      expect(result.newTotal).toBe(300);
      expect(result.delta).toBe(200);
    });

    it('should handle 1x multiplier', () => {
      const result = multiplyGold(100, 1);
      expect(result.newTotal).toBe(100);
      expect(result.delta).toBe(0);
    });

    it('should clamp multiplier below 1 to 1', () => {
      const result = multiplyGold(100, 0.5);
      expect(result.newTotal).toBe(100);
      expect(result.delta).toBe(0);
    });

    it('should clamp very high multiplier', () => {
      const result = multiplyGold(100, 1000);
      expect(result.newTotal).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('loseGold', () => {
    it('should lose 25% correctly', () => {
      const result = loseGold(100, 25);
      expect(result.newTotal).toBe(75);
      expect(result.delta).toBe(-25);
    });

    it('should lose 50% correctly', () => {
      const result = loseGold(100, 50);
      expect(result.newTotal).toBe(50);
      expect(result.delta).toBe(-50);
    });

    it('should not go below zero', () => {
      const result = loseGold(10, 50);
      expect(result.newTotal).toBe(5);
      expect(result.delta).toBe(-5);
    });

    it('should handle 100% loss', () => {
      const result = loseGold(100, 100);
      expect(result.newTotal).toBe(0);
      expect(result.delta).toBe(-100);
    });

    it('should clamp loss percentage above 100', () => {
      const result = loseGold(100, 150);
      expect(result.newTotal).toBe(0);
      expect(result.delta).toBe(-100);
    });

    it('should clamp loss percentage below 0', () => {
      const result = loseGold(100, -10);
      expect(result.newTotal).toBe(100);
      expect(result.delta).toBeLessThanOrEqual(0);
    });
  });

  describe('stealGold', () => {
    it('should steal 10% correctly', () => {
      const result = stealGold({ stealerGold: 100, targetGold: 200, percent: 10 });
      expect(result.stealerNewTotal).toBe(120);
      expect(result.targetNewTotal).toBe(180);
      expect(result.stolenAmount).toBe(20);
    });

    it('should steal 25% correctly', () => {
      const result = stealGold({ stealerGold: 100, targetGold: 200, percent: 25 });
      expect(result.stealerNewTotal).toBe(150);
      expect(result.targetNewTotal).toBe(150);
      expect(result.stolenAmount).toBe(50);
    });

    it('should handle zero target gold', () => {
      const result = stealGold({ stealerGold: 100, targetGold: 0, percent: 10 });
      expect(result.stealerNewTotal).toBe(100);
      expect(result.targetNewTotal).toBe(0);
      expect(result.stolenAmount).toBe(0);
    });

    it('should clamp steal percentage above 100', () => {
      const result = stealGold({ stealerGold: 100, targetGold: 200, percent: 150 });
      expect(result.stealerNewTotal).toBe(300);
      expect(result.targetNewTotal).toBe(0);
      expect(result.stolenAmount).toBe(200);
    });

    it('should clamp steal percentage below 0', () => {
      const result = stealGold({ stealerGold: 100, targetGold: 200, percent: -10 });
      expect(result.stealerNewTotal).toBe(100);
      expect(result.targetNewTotal).toBe(200);
      expect(result.stolenAmount).toBe(0);
    });
  });

  describe('swapGold', () => {
    it('should swap gold totals correctly', () => {
      const result = swapGold(100, 200);
      expect(result.playerANewTotal).toBe(200);
      expect(result.playerBNewTotal).toBe(100);
    });

    it('should handle equal gold', () => {
      const result = swapGold(100, 100);
      expect(result.playerANewTotal).toBe(100);
      expect(result.playerBNewTotal).toBe(100);
    });

    it('should handle zero gold', () => {
      const result = swapGold(0, 200);
      expect(result.playerANewTotal).toBe(200);
      expect(result.playerBNewTotal).toBe(0);
    });

    it('should handle both zero', () => {
      const result = swapGold(0, 0);
      expect(result.playerANewTotal).toBe(0);
      expect(result.playerBNewTotal).toBe(0);
    });
  });
});
