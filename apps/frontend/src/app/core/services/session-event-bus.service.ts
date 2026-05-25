import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Lightweight in-memory event bus for session lifecycle changes.
 *
 * Components that create or end sessions emit a signal-free event here.
 * The DashboardCacheService subscribes and refreshes joinable sessions
 * on demand — no polling, no WebSocket dependency.
 *
 * Why a Subject and not an Angular signal?
 *   A Subject lets us bridge imperative actions (button clicks, WebSocket
 *   callbacks) into the reactive Observable pipeline that feeds the cache.
 *   The cache ultimately updates its public signals, keeping the rest of
 *   the app fully signal-based.
 */
@Injectable({ providedIn: 'root' })
export class SessionEventBus {
  private readonly sessionChanges = new Subject<void>();

  /** Subscribe to be notified when a session is created or ended. */
  readonly sessionChanges$ = this.sessionChanges.asObservable();

  /** Call after a session is created or has transitioned to an ended state. */
  emit(): void {
    this.sessionChanges.next();
  }
}
