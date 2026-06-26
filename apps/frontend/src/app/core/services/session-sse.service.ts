import { inject, Injectable, signal } from '@angular/core';
import { ConfigService } from './config.service';
import { AuthService } from './auth.service';
import { SessionEventBus } from './session-event-bus.service';

/**
 * Lightweight SSE (Server-Sent Events) client for session lifecycle events.
 *
 * Connects to GET /api/sessions/events and streams `created` / `ended`
 * events from the server. Each event triggers SessionEventBus.emit(),
 * which the DashboardCacheService picks up to refresh joinable sessions.
 *
 * No polling, no WebSocket — pure HTTP push with automatic reconnection.
 */
@Injectable({ providedIn: 'root' })
export class SessionSseService {
  private readonly authService = inject(AuthService);
  private readonly sessionEventBus = inject(SessionEventBus);
  private readonly configService = inject(ConfigService);

  private abortController: AbortController | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly connected = signal(false);
  private isDestroyed = false;

  /** Whether the SSE connection is currently established. */
  readonly isConnected = this.connected.asReadonly();

  /**
   * Open the SSE connection. Safe to call multiple times —
   * any existing connection is torn down first.
   */
  connect(): void {
    this.disconnect();
    this.isDestroyed = false;
    this.startConnection();
  }

  /**
   * Close the SSE connection and cancel any pending reconnect.
   */
  disconnect(): void {
    this.isDestroyed = true;
    this.abortController?.abort();
    this.abortController = null;

    if (this.retryTimeout !== null) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    this.connected.set(false);
  }

  private async startConnection(): Promise<void> {
    // Use the async method so we wait for Supabase to finish loading the session
    const token = await this.authService.getAccessToken();

    if (!token) {
      // Not authenticated yet — retry after a short delay
      this.scheduleReconnect(2000);
      return;
    }

    this.abortController = new AbortController();

    try {
      const response = await fetch(`${this.configService.getBackendUrl()}/api/sessions/events`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        console.warn(
          `[SessionSseService] SSE connection failed (HTTP ${response.status}), will retry.`
        );
        this.scheduleReconnect(5000);
        return;
      }

      this.connected.set(true);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!this.isDestroyed) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE format: lines separated by \n
        // data: {...}\n\n  ← event
        // :keepalive\n\n    ← comment (ignore)
        const lines = buffer.split('\n');
        // Keep the last partial line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            // Any session lifecycle event → trigger a cache refresh
            this.sessionEventBus.emit();
          }
          // Lines starting with ':' are comments (e.g., keep-alive), ignore them
        }
      }
    } catch (err) {
      if (this.isDestroyed) return;
      // Ignore abort errors (intentional disconnect)
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('[SessionSseService] Connection error, will retry.', err);
    }

    // Stream ended or error — reconnect unless destroyed
    if (!this.isDestroyed) {
      this.connected.set(false);
      this.scheduleReconnect(5000);
    }
  }

  private scheduleReconnect(delayMs: number): void {
    if (this.isDestroyed) return;

    this.retryTimeout = setTimeout(() => {
      if (!this.isDestroyed) {
        void this.startConnection();
      }
    }, delayMs);
  }
}
