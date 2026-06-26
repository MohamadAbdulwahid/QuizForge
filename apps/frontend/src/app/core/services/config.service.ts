import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

interface BackendProfile {
  url: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  sentryDsn: string;
}

interface BackendProfiles {
  backends: BackendProfile[];
}

interface ConfigResponse {
  supabaseUrl: string;
  supabasePublishableKey: string;
  sentryDsn: string;
}

const STORAGE_KEY = 'qf-backend-profiles';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly platformId = inject(PLATFORM_ID);

  // Config signals — defaults are empty strings; ConfigService.load() populates from backend
  private readonly _backendUrl = signal(environment.apiBaseUrl);
  private readonly _supabaseUrl = signal('');
  private readonly _supabasePublishableKey = signal('');
  private readonly _sentryDsn = signal('');

  // Ready state pattern (matching auth.service.ts)
  private readonly ready = signal(false);
  private resolveReady: (() => void) | undefined;
  private readonly readyPromise = new Promise<void>((resolve) => {
    this.resolveReady = resolve;
  });

  // Public readonly signals
  readonly backendUrl = this._backendUrl.asReadonly();
  readonly supabaseUrl = this._supabaseUrl.asReadonly();
  readonly supabasePublishableKey = this._supabasePublishableKey.asReadonly();
  readonly sentryDsn = this._sentryDsn.asReadonly();
  readonly isReady = this.ready.asReadonly();

  /**
   * Wait for config to be loaded and ready.
   * Used by downstream services that depend on config values.
   */
  async whenReady(): Promise<void> {
    await this.readyPromise;
  }

  /**
   * Get the active backend URL.
   */
  getBackendUrl(): string {
    return this.backendUrl();
  }

  /**
   * Get the Supabase URL from the backend's config endpoint.
   */
  getSupabaseUrl(): string {
    return this.supabaseUrl();
  }

  /**
   * Get the Supabase publishable key from the backend's config endpoint.
   */
  getSupabasePublishableKey(): string {
    return this.supabasePublishableKey();
  }

  /**
   * Get the Sentry DSN from the backend's config endpoint.
   */
  getSentryDsn(): string {
    return this.sentryDsn();
  }

  /**
   * Load configuration from the backend.
   * Called by provideAppInitializer during app bootstrap.
   *
   * Strategy:
   * 1. Determine backend URL (localStorage → origin → environment fallback)
   * 2. Try to load cached config from localStorage (instant)
   * 3. Fetch fresh config from backend
   * 4. Update signals and cache
   */
  async load(): Promise<void> {
    // Determine the backend URL to use
    const backendUrl = this.resolveBackendUrl();

    // SSR at build time: no backend available, mark ready immediately with defaults
    if (!isPlatformBrowser(this.platformId)) {
      this._backendUrl.set(backendUrl);
      this.markReady();
      return;
    }

    // Apply cached config instantly if available (for fast perceived load)
    this.applyCachedConfig(backendUrl);

    try {
      // Fetch fresh config from the backend (native fetch — no auth needed for this public endpoint)
      const response = await fetch(`${backendUrl}/api/config`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const config: ConfigResponse = await response.json();

      // Update signals with fresh data
      this._backendUrl.set(backendUrl);
      this._supabaseUrl.set(config.supabaseUrl);
      this._supabasePublishableKey.set(config.supabasePublishableKey);
      this._sentryDsn.set(config.sentryDsn);

      // Cache the profile for next load
      this.cacheProfile({
        url: backendUrl,
        supabaseUrl: config.supabaseUrl,
        supabasePublishableKey: config.supabasePublishableKey,
        sentryDsn: config.sentryDsn,
      });
    } catch (error) {
      console.warn('ConfigService: Failed to fetch config from backend, using defaults', error);
      // On error, keep the fallback defaults from environment.ts (already set in signals)
    }

    this.markReady();
  }

  /**
   * Switch to a different backend URL and load its config.
   */
  async switchBackend(url: string): Promise<void> {
    // Normalize URL (strip trailing slash)
    const normalizedUrl = url.replace(/\/+$/, '');

    try {
      const response = await fetch(`${normalizedUrl}/api/config`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const config: ConfigResponse = await response.json();

      this._backendUrl.set(normalizedUrl);
      this._supabaseUrl.set(config.supabaseUrl);
      this._supabasePublishableKey.set(config.supabasePublishableKey);
      this._sentryDsn.set(config.sentryDsn);

      this.cacheProfile({
        url: normalizedUrl,
        supabaseUrl: config.supabaseUrl,
        supabasePublishableKey: config.supabasePublishableKey,
        sentryDsn: config.sentryDsn,
      });
    } catch (error) {
      console.error('ConfigService: Failed to switch backend', error);
      throw error;
    }
  }

  /**
   * Determine the backend URL based on platform and stored profiles.
   */
  private resolveBackendUrl(): string {
    if (!isPlatformBrowser(this.platformId)) {
      // SSR: use environment fallback
      return environment.apiBaseUrl;
    }

    // Try to read saved profile from localStorage
    const savedProfile = this.readCachedProfile();
    if (savedProfile) {
      return savedProfile.url;
    }

    // Default: use the configured backend URL
    return environment.apiBaseUrl;
  }

  /**
   * Apply cached config to signals for instant display while fetching fresh data.
   */
  private applyCachedConfig(backendUrl: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const profiles = this.readProfilesFromStorage();
    if (!profiles) {
      return;
    }

    const profile = profiles.backends.find((b) => b.url === backendUrl);
    if (profile) {
      this._backendUrl.set(profile.url);
      this._supabaseUrl.set(profile.supabaseUrl);
      this._supabasePublishableKey.set(profile.supabasePublishableKey);
      this._sentryDsn.set(profile.sentryDsn);
    }
  }

  /**
   * Read the cached profile for a given backend URL.
   */
  private readCachedProfile(): BackendProfile | null {
    const profiles = this.readProfilesFromStorage();
    if (!profiles || profiles.backends.length === 0) {
      return null;
    }

    return profiles.backends[0];
  }

  /**
   * Cache a backend profile to localStorage.
   * Moves the profile to the front of the list (making it the active one).
   */
  private cacheProfile(profile: BackendProfile): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const profiles = this.readProfilesFromStorage() ?? { backends: [] };

    // Remove existing entry for this URL (if any)
    const filtered = profiles.backends.filter((b) => b.url !== profile.url);

    // Add the profile at the front (active position)
    profiles.backends = [profile, ...filtered];

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch (error) {
      console.warn('ConfigService: Failed to cache profile', error);
    }
  }

  /**
   * Read profiles from localStorage.
   */
  private readProfilesFromStorage(): BackendProfiles | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as BackendProfiles;
      if (parsed && Array.isArray(parsed.backends)) {
        return parsed;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Mark the service as ready, resolving the readyPromise.
   */
  private markReady(): void {
    if (this.ready()) {
      return;
    }

    this.ready.set(true);
    this.resolveReady?.();
    this.resolveReady = undefined;
  }
}
