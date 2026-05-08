import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';

const unsubscribeMock = vi.fn();
const onAuthStateChangeMock = vi.fn((callback: (event: 'SIGNED_IN', session: null) => void) => {
  callback('SIGNED_IN', null);
  return {
    data: {
      subscription: {
        unsubscribe: unsubscribeMock,
      },
    },
  };
});

const createClientMock = vi.fn(() => ({
  auth: {
    onAuthStateChange: onAuthStateChangeMock,
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('SupabaseService', () => {
  let supabaseService: typeof import('./supabase.service').SupabaseService;
  let createClient: typeof import('@supabase/supabase-js').createClient;

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  beforeEach(async () => {
    vi.resetModules();
    ({ SupabaseService: supabaseService } = await import('./supabase.service'));
    ({ createClient } = await import('@supabase/supabase-js'));
  });

  it('instantiates with environment values', () => {
    const service = TestBed.inject(supabaseService);

    expect(service).toBeTruthy();
    expect(createClient).toHaveBeenCalledWith(
      environment.supabaseUrl,
      environment.supabasePublishableKey
    );
  });

  it('authChanges returns an observable stream', () => {
    const service = TestBed.inject(supabaseService);
    const emittedEvents: string[] = [];

    const subscription = service.authChanges().subscribe((payload) => {
      emittedEvents.push(payload.event);
    });

    expect(emittedEvents).toEqual(['SIGNED_IN']);

    subscription.unsubscribe();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('exposes typed client wrapper without using any', () => {
    const service = TestBed.inject(supabaseService);

    expect(service.client.auth).toBeDefined();
  });
});
