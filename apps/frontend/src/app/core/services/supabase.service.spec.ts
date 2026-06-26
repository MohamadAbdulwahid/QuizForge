import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  const mockConfigService = {
    getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
    getSupabasePublishableKey: vi.fn(() => 'test-anon-key'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates client lazily on first access to client getter', async () => {
    vi.resetModules();
    const supabaseModule = await import('./supabase.service');
    const { createClient } = await import('@supabase/supabase-js');
    const configModule = await import('./config.service');

    TestBed.configureTestingModule({
      providers: [{ provide: configModule.ConfigService, useValue: mockConfigService }],
    });

    const service = TestBed.inject(supabaseModule.SupabaseService);

    expect(createClient).not.toHaveBeenCalled();
    const client = service.client;
    expect(createClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-anon-key');
    expect(client).toBeDefined();
  });

  it('creates client only once (singleton behavior)', async () => {
    vi.resetModules();
    const supabaseModule = await import('./supabase.service');
    const { createClient } = await import('@supabase/supabase-js');
    const configModule = await import('./config.service');

    TestBed.configureTestingModule({
      providers: [{ provide: configModule.ConfigService, useValue: mockConfigService }],
    });

    const service = TestBed.inject(supabaseModule.SupabaseService);

    void service.client;
    void service.client;
    void service.client;

    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('authChanges returns an observable stream', async () => {
    vi.resetModules();
    const supabaseModule = await import('./supabase.service');
    const configModule = await import('./config.service');

    TestBed.configureTestingModule({
      providers: [{ provide: configModule.ConfigService, useValue: mockConfigService }],
    });

    const service = TestBed.inject(supabaseModule.SupabaseService);
    const emittedEvents: string[] = [];

    // Access client to initialize the SupabaseClient
    void service.client;

    const subscription = service.authChanges().subscribe((payload) => {
      emittedEvents.push(payload.event);
    });

    expect(emittedEvents).toEqual(['SIGNED_IN']);

    subscription.unsubscribe();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('exposes typed client wrapper without using any', async () => {
    vi.resetModules();
    const supabaseModule = await import('./supabase.service');
    const configModule = await import('./config.service');

    TestBed.configureTestingModule({
      providers: [{ provide: configModule.ConfigService, useValue: mockConfigService }],
    });

    const service = TestBed.inject(supabaseModule.SupabaseService);

    expect(service.client!.auth).toBeDefined();
  });
});
