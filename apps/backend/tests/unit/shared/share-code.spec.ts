import { describe, expect, it } from 'bun:test';

const { generateShareCode } = await import('../../../src/shared/utils/share-code');

describe('share code utility', () => {
  it('generates 8-char code by default', () => {
    const code = generateShareCode();
    expect(code).toHaveLength(8);
  });

  it('uses only allowed characters', () => {
    const code = generateShareCode(64);
    expect(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/.test(code)).toBe(true);
  });

  it('supports custom length', () => {
    const code = generateShareCode(12);
    expect(code).toHaveLength(12);
  });

  it('produces mostly unique values across 100 generations', () => {
    const generated = new Set<string>();

    for (let i = 0; i < 100; i += 1) {
      generated.add(generateShareCode());
    }

    expect(generated.size).toBeGreaterThan(95);
  });
});
