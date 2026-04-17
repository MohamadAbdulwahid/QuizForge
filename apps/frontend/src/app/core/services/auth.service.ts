import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthResponse {
  user: AuthUser;
  session: AuthSession;
}

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
  private readonly httpClient = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly apiVersionHeaders = new HttpHeaders({
    'API-Version': '1.0',
  });

  private readonly tokenStorageKey = 'quizforge.access-token';
  private readonly userStorageKey = 'quizforge.user';

  readonly accessToken = signal<string | null>(null);
  readonly user = signal<AuthUser | null>(null);
  readonly isAuthenticated = computed(() => this.accessToken() !== null);

  constructor() {
    this.restorePersistedSession();
  }

  signIn(payload: SignInPayload): Observable<AuthResponse> {
    return this.httpClient
      .post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/login`, payload, {
        headers: this.apiVersionHeaders,
      })
      .pipe(tap((response) => this.persistSession(response)));
  }

  signUp(payload: SignUpPayload): Observable<AuthResponse> {
    return this.httpClient
      .post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/signup`, payload, {
        headers: this.apiVersionHeaders,
      })
      .pipe(tap((response) => this.persistSession(response)));
  }

  signOut(): void {
    this.accessToken.set(null);
    this.user.set(null);

    if (isPlatformBrowser(this.platformId)) {
      globalThis.localStorage.removeItem(this.tokenStorageKey);
      globalThis.localStorage.removeItem(this.userStorageKey);
    }
  }

  getAuthorizedHeaders(): HttpHeaders {
    const token = this.accessToken();
    if (!token) {
      return this.apiVersionHeaders;
    }

    return this.apiVersionHeaders.set('Authorization', `Bearer ${token}`);
  }

  private restorePersistedSession(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const persistedToken = globalThis.localStorage.getItem(this.tokenStorageKey);
    const persistedUserRaw = globalThis.localStorage.getItem(this.userStorageKey);

    if (!persistedToken || !persistedUserRaw) {
      return;
    }

    try {
      const persistedUser = JSON.parse(persistedUserRaw) as AuthUser;
      this.accessToken.set(persistedToken);
      this.user.set(persistedUser);
    } catch {
      globalThis.localStorage.removeItem(this.tokenStorageKey);
      globalThis.localStorage.removeItem(this.userStorageKey);
      this.accessToken.set(null);
      this.user.set(null);
    }
  }

  private persistSession(response: AuthResponse): void {
    this.accessToken.set(response.session.accessToken);
    this.user.set(response.user);

    if (isPlatformBrowser(this.platformId)) {
      globalThis.localStorage.setItem(this.tokenStorageKey, response.session.accessToken);
      globalThis.localStorage.setItem(this.userStorageKey, JSON.stringify(response.user));
    }
  }
}
