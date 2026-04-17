import { TestBed } from '@angular/core/testing';
import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { SupabaseService } from './supabase.service';

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

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      onAuthStateChange: onAuthStateChangeMock,
    },
  })),
}));

describe('SupabaseService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('instantiates with environment values', () => {
    const service = TestBed.inject(SupabaseService);

    expect(service).toBeTruthy();
    expect(createClient).toHaveBeenCalledWith(
      environment.supabaseUrl,
      environment.supabasePublishableKey
    );
  });

  it('authChanges returns an observable stream', () => {
    const service = TestBed.inject(SupabaseService);
    const emittedEvents: string[] = [];

    const subscription = service.authChanges().subscribe((payload) => {
      emittedEvents.push(payload.event);
    });

    expect(emittedEvents).toEqual(['SIGNED_IN']);

    subscription.unsubscribe();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('exposes typed client wrapper without using any', () => {
    const service = TestBed.inject(SupabaseService);

    expect(service.client.auth).toBeDefined();
  });
});
