import { describe, expect, it } from 'bun:test';
import { RoomEventRateLimiter, ThrottledEvent } from '../../../src/websocket/rate-limit';

describe('RoomEventRateLimiter', () => {
  it('throttles rapid non-critical broadcasts', async () => {
    const limiter = new RoomEventRateLimiter(20);
    const delivered: ThrottledEvent<{ value: number }>[] = [];

    limiter.emit(
      { room: '123456', event: 'score-update', payload: { value: 1 } },
      (event) => {
        delivered.push(event);
      },
      1000
    );
    limiter.emit(
      { room: '123456', event: 'score-update', payload: { value: 2 } },
      (event) => {
        delivered.push(event);
      },
      1005
    );
    limiter.emit(
      { room: '123456', event: 'score-update', payload: { value: 3 } },
      (event) => {
        delivered.push(event);
      },
      1010
    );

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(delivered).toHaveLength(2);
    expect(delivered[1].payload.value).toBe(3);
    limiter.clear();
  });

  it('delivers critical events immediately', () => {
    const limiter = new RoomEventRateLimiter(100);
    const delivered: ThrottledEvent<{ value: number }>[] = [];

    limiter.emit(
      { room: '123456', event: 'question', payload: { value: 1 } },
      (event) => {
        delivered.push(event);
      },
      1000
    );
    limiter.emit(
      { room: '123456', event: 'question', payload: { value: 2 }, critical: true },
      (event) => {
        delivered.push(event);
      },
      1001
    );

    expect(delivered).toHaveLength(2);
    expect(delivered[1].payload.value).toBe(2);
    limiter.clear();
  });
});
