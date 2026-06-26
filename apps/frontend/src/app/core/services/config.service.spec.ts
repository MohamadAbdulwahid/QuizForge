import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from './config.service';
import { environment } from '../../../environments/environment';

const mockConfig = {
  supabaseUrl: 'https://test.supabase.co',
  supabasePublishableKey: 'test-anon-key',
  sentryDsn: 'https://sentry.io/test',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number): Response {
  return new Response('Not Found', { status });
}

function stubFetch(...responses: unknown[]): void {
  const fn = vi.fn();
  for (const r of responses) {
    if (r instanceof Response) {
      fn.mockResolvedValueOnce(r);
    } else {
      fn.mockRejectedValueOnce(r);
    }
  }
  vi.stubGlobal('fetch', fn);
}

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        ConfigService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(ConfigService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have default values from environment before load', () => {
    expect(service.backendUrl()).toBe(environment.apiBaseUrl);
    expect(service.supabaseUrl()).toBe('');
    expect(service.supabasePublishableKey()).toBe('');
    expect(service.sentryDsn()).toBe('');
  });

  it('should start with isReady as false', () => {
    expect(service.isReady()).toBe(false);
  });

  it('should load config from backend and update signals', async () => {
    stubFetch(jsonResponse(mockConfig));

    await service.load();

    expect(service.isReady()).toBe(true);
    expect(service.supabaseUrl()).toBe('https://test.supabase.co');
    expect(service.supabasePublishableKey()).toBe('test-anon-key');
    expect(service.sentryDsn()).toBe('https://sentry.io/test');
  });

  it('should resolve whenReady() after load completes', async () => {
    stubFetch(jsonResponse(mockConfig));

    await service.load();

    await expect(service.whenReady()).resolves.toBeUndefined();
  });

  it('should use empty defaults when backend fetch fails', async () => {
    stubFetch(errorResponse(404));

    await service.load();

    expect(service.isReady()).toBe(true);
    expect(service.supabaseUrl()).toBe('');
    expect(service.supabasePublishableKey()).toBe('');
    expect(service.sentryDsn()).toBe('');
  });

  it('should use empty defaults when fetch throws', async () => {
    stubFetch(new Error('Network error'));

    await service.load();

    expect(service.isReady()).toBe(true);
    expect(service.supabaseUrl()).toBe('');
    expect(service.supabasePublishableKey()).toBe('');
    expect(service.sentryDsn()).toBe('');
  });

  it('should return correct values from getter methods', async () => {
    stubFetch(jsonResponse({
      supabaseUrl: 'https://getter-test.supabase.co',
      supabasePublishableKey: 'getter-key',
      sentryDsn: 'https://sentry.io/getter',
    }));

    await service.load();

    expect(service.getSupabaseUrl()).toBe('https://getter-test.supabase.co');
    expect(service.getSupabasePublishableKey()).toBe('getter-key');
    expect(service.getSentryDsn()).toBe('https://sentry.io/getter');
  });

  it('should switch backend and update all signals', async () => {
    stubFetch(
      jsonResponse({
        supabaseUrl: 'https://first.supabase.co',
        supabasePublishableKey: 'first-key',
        sentryDsn: '',
      }),
      jsonResponse({
        supabaseUrl: 'https://second.supabase.co',
        supabasePublishableKey: 'second-key',
        sentryDsn: 'https://sentry.io/second',
      }),
    );

    await service.load();
    await service.switchBackend('https://new-backend.example.com');

    expect(service.backendUrl()).toBe('https://new-backend.example.com');
    expect(service.supabaseUrl()).toBe('https://second.supabase.co');
    expect(service.supabasePublishableKey()).toBe('second-key');
    expect(service.sentryDsn()).toBe('https://sentry.io/second');
  });

  it('should throw when switchBackend fails', async () => {
    stubFetch(
      jsonResponse(mockConfig),
      new Error('Network error'),
    );

    await service.load();

    await expect(service.switchBackend('https://unreachable.example.com')).rejects.toThrow();
  });

  it('should strip trailing slashes from backend URL in switchBackend', async () => {
    stubFetch(jsonResponse(mockConfig));

    await service.switchBackend('https://backend.example.com///');

    expect(service.backendUrl()).toBe('https://backend.example.com');
    expect(globalThis.fetch).toHaveBeenCalledWith('https://backend.example.com/api/config');
  });

  it('should work in SSR mode (non-browser platform)', async () => {
    stubFetch(); // Should NOT be called in SSR

    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [
        ConfigService,
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });

    const ssrService = TestBed.inject(ConfigService);

    // SSR mode returns early without making HTTP requests
    await ssrService.load();

    expect(ssrService.isReady()).toBe(true);
    expect(ssrService.getBackendUrl()).toBe(environment.apiBaseUrl);

    // No fetch calls should have been made in SSR mode
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should cache profile to localStorage after successful load', async () => {
    stubFetch(jsonResponse(mockConfig));

    await service.load();

    const stored = JSON.parse(localStorage.getItem('qf-backend-profiles') ?? '{}');
    expect(stored.backends).toHaveLength(1);
    expect(stored.backends[0].supabaseUrl).toBe('https://test.supabase.co');
  });

  it('should use cached config on subsequent loads', async () => {
    stubFetch(jsonResponse(mockConfig));
    await service.load();

    // Second load — should apply cached config instantly then fetch fresh
    stubFetch(jsonResponse(mockConfig));
    await service.load();

    expect(service.supabaseUrl()).toBe('https://test.supabase.co');
  });
});
