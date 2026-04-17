import { describe, expect, it, mock } from 'bun:test';
import { emitSocketValidationError, JoinGameMessageSchema } from '../../../src/websocket/validation/schemas';

describe('websocket zod schemas', () => {
  it('JoinGameMessageSchema rejects missing pin', () => {
    const result = JoinGameMessageSchema.safeParse({ username: 'Ada' });
    expect(result.success).toBe(false);
  });

  it('JoinGameMessageSchema allows redundant keys', () => {
    const result = JoinGameMessageSchema.safeParse({
      pin: '123456',
      username: 'Ada',
      extra: 'ignored',
    });

    expect(result.success).toBe(true);
  });

  it('JoinGameMessageSchema accepts valid payload', () => {
    const result = JoinGameMessageSchema.safeParse({
      pin: '123456',
      username: 'Ada',
    });

    expect(result.success).toBe(true);
  });

  it("validation interception emits socket 'error' payload", () => {
    const emit = mock();
    const parsed = JoinGameMessageSchema.safeParse({});

    if (parsed.success) {
      throw new Error('Expected parsing to fail for missing pin');
    }

    emitSocketValidationError({ emit }, parsed.error);

    expect(emit).toHaveBeenCalledTimes(1);
    const [eventName, payload] = emit.mock.calls[0] as [string, { code: string }];
    expect(eventName).toBe('error');
    expect(payload.code).toBe('VALIDATION_ERROR');
  });
});
