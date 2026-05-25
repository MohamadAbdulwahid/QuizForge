import { EventEmitter } from 'node:events';

export interface SessionLifecycleEvent {
  type: 'created' | 'ended';
  sessionId: number;
  groupIds: number[];
  timestamp: string;
}

/**
 * In-memory event emitter for session lifecycle events.
 *
 * Used by:
 * - The SSE endpoint (`session-events.routes.ts`) to stream events to clients.
 * - The session service (`session.service.ts`) to emit on create / finish.
 * - The WebSocket game namespace (`game.namespace.ts`) to emit on end-session.
 *
 * The EventEmitter is a singleton at module scope so all parts of the app
 * share the same bus without DI wiring.
 */
export const sessionEventEmitter = new EventEmitter();

// Allow many concurrent SSE listeners without a warning.
sessionEventEmitter.setMaxListeners(500);

/**
 * Emit a session lifecycle event so SSE clients can react.
 */
export function emitSessionEvent(
  type: SessionLifecycleEvent['type'],
  sessionId: number,
  groupIds: number[]
): void {
  const event: SessionLifecycleEvent = {
    type,
    sessionId,
    groupIds,
    timestamp: new Date().toISOString(),
  };

  sessionEventEmitter.emit('session-change', event);
}
