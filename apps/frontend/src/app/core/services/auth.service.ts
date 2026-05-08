import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload {
  email: string;
  password: string;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly platformId = inject(PLATFORM_ID);

  private readonly session = signal<Session | null>(null);
  private readonly ready = signal(false);
  private resolveReady: (() => void) | undefined;
  private readonly readyPromise = new Promise<void>((resolve) => {
    this.resolveReady = resolve;
  });

  readonly accessToken = computed(() => this.session()?.access_token ?? null);
  readonly currentUser = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isReady = this.ready.asReadonly();

  constructor() {
    this.initializeSession();
  }

  async signIn(payload: SignInPayload): Promise<void> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });

    if (error) {
      console.error('Sign-in error:', error);
      throw error;
    }

    this.session.set(data.session ?? null);
  }

  async signUp(payload: SignUpPayload): Promise<void> {
    const { data, error } = await this.supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          username: payload.username,
        },
      },
    });

    if (error) {
      console.error('Sign-up error:', error);
      throw error;
    }

    this.session.set(data.session ?? null);
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut({ scope: 'local' });

    if (error) {
      throw error;
    }

    this.session.set(null);
  }

  async whenReady(): Promise<void> {
    await this.readyPromise;
  }

  async getAccessToken(): Promise<string | null> {
    await this.whenReady();
    return this.accessToken();
  }

  private initializeSession(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.markReady();
      return;
    }

    void this.supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          this.session.set(null);
        } else {
          this.session.set(data.session ?? null);
        }
        this.markReady();
      })
      .catch(() => {
        this.session.set(null);
        this.markReady();
      });

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session ?? null);
      this.markReady();
    });
  }

  private markReady(): void {
    if (this.ready()) {
      return;
    }

    this.ready.set(true);
    this.resolveReady?.();
    this.resolveReady = undefined;
  }
}
