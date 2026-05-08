import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

describe('AuthService', () => {
  const session = {
    access_token: 'token-123',
    refresh_token: 'refresh-123',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      email: 'tester@example.com',
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      user_metadata: {
        username: 'tester',
      },
    },
  } as Session;

  const signInWithPasswordMock = vi.fn().mockResolvedValue({
    data: { session },
    error: null,
  });
  const signUpMock = vi.fn().mockResolvedValue({
    data: { session },
    error: null,
  });
  const signOutMock = vi.fn().mockResolvedValue({ error: null });
  const getSessionMock = vi.fn().mockResolvedValue({
    data: { session: null },
    error: null,
  });
  const onAuthStateChangeMock = vi.fn(
    (callback: (event: string, session: Session | null) => void) => {
      callback('INITIAL_SESSION', null);
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    }
  );

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              auth: {
                getSession: getSessionMock,
                onAuthStateChange: onAuthStateChangeMock,
                signInWithPassword: signInWithPasswordMock,
                signUp: signUpMock,
                signOut: signOutMock,
              },
            },
          },
        },
      ],
    });
  });

  it('isAuthenticated becomes true when a user signs in', async () => {
    const service = TestBed.inject(AuthService);

    await service.whenReady();
    await service.signIn({ email: 'tester@example.com', password: 'password' });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.id).toBe(session.user.id);
  });

  it('signOut clears the currentUser signal', async () => {
    const service = TestBed.inject(AuthService);

    await service.signIn({ email: 'tester@example.com', password: 'password' });
    await service.signOut();

    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' });
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });
});
