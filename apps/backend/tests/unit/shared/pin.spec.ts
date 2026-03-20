import { describe, expect, it } from 'bun:test';

const { generatePin } = await import('../../../src/shared/utils/pin');

describe('pin utility', () => {
  it('generates 6-digit pin by default', () => {
    const pin = generatePin();
    expect(pin).toMatch(/^\d{6}$/);
  });

  it('supports custom pin length', () => {
    const pin = generatePin(4);
    expect(pin).toMatch(/^\d{4}$/);
  });

  it('returns zero padded values', () => {
    const pin = generatePin(6);
    expect(pin.length).toBe(6);
  });
});
