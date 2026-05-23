export interface ThrottledEvent<TPayload> {
  room: string;
  event: string;
  payload: TPayload;
  critical?: boolean;
}

/**
 * Room/event throttle that preserves the latest non-critical payload in a window.
 */
export class RoomEventRateLimiter {
  private readonly lastEmitMs = new Map<string, number>();
  private readonly pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingEvents = new Map<string, ThrottledEvent<unknown>>();

  constructor(private readonly windowMs = 100) {}

  emit<TPayload>(
    event: ThrottledEvent<TPayload>,
    deliver: (event: ThrottledEvent<TPayload>) => void,
    nowMs = Date.now()
  ): void {
    const key = `${event.room}:${event.event}`;

    if (event.critical) {
      this.lastEmitMs.set(key, nowMs);
      deliver(event);
      return;
    }

    const lastEmitMs = this.lastEmitMs.get(key) ?? 0;
    const elapsedMs = nowMs - lastEmitMs;

    if (elapsedMs >= this.windowMs) {
      this.lastEmitMs.set(key, nowMs);
      deliver(event);
      return;
    }

    this.pendingEvents.set(key, event as ThrottledEvent<unknown>);

    if (this.pendingTimers.has(key)) {
      return;
    }

    const delayMs = this.windowMs - elapsedMs;
    const timer = setTimeout(() => {
      const pendingEvent = this.pendingEvents.get(key) as ThrottledEvent<TPayload> | undefined;
      this.pendingEvents.delete(key);
      this.pendingTimers.delete(key);

      if (!pendingEvent) {
        return;
      }

      this.lastEmitMs.set(key, Date.now());
      deliver(pendingEvent);
    }, delayMs);

    this.pendingTimers.set(key, timer);
  }

  clear(): void {
    for (const timer of this.pendingTimers.values()) {
      clearTimeout(timer);
    }

    this.pendingTimers.clear();
    this.pendingEvents.clear();
    this.lastEmitMs.clear();
  }
}
