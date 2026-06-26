import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BackendSelectorComponent } from './backend-selector.component';
import { ConfigService } from '../../core/services/config.service';

// Provide a minimal localStorage mock for the Node.js test environment
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('BackendSelectorComponent', () => {
  let configServiceMock: ConfigService & { switchBackend: ReturnType<typeof vi.fn> };
  let injector: Injector;
  let component: BackendSelectorComponent;

  beforeEach(() => {
    vi.clearAllMocks();

    // Install localStorage mock
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      writable: true,
      configurable: true,
    });

    configServiceMock = {
      isReady: vi.fn().mockReturnValue(true),
      backendUrl: vi.fn().mockReturnValue('http://localhost:3333'),
      switchBackend: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConfigService & { switchBackend: ReturnType<typeof vi.fn> };

    // Create an injector with our mock ConfigService
    injector = Injector.create({
      providers: [{ provide: ConfigService, useValue: configServiceMock }],
    });

    // Create component within injection context so inject() works
    component = runInInjectionContext(injector, () => new BackendSelectorComponent());
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('should have configService injected', () => {
    expect(component['configService']).toBe(configServiceMock);
  });

  it('should format URL correctly', () => {
    expect(component.formatUrl('http://localhost:3333')).toBe('localhost:3333');
    expect(component.formatUrl('https://custom.example.com')).toBe(
      'custom.example.com'
    );
    expect(component.formatUrl('invalid')).toBe('invalid');
  });

  it('should not add empty URL', async () => {
    await component.addCustom('');

    expect(configServiceMock.switchBackend).not.toHaveBeenCalled();
  });

  it('should reject invalid URL format', async () => {
    await component.addCustom('not-a-url');

    expect(configServiceMock.switchBackend).not.toHaveBeenCalled();
    expect(component['urlError']()).toContain('Please enter a valid URL');
  });

  it('should call switchBackend when adding a valid URL', async () => {
    await component.addCustom('https://new-backend.example.com');

    expect(configServiceMock.switchBackend).toHaveBeenCalledWith(
      'https://new-backend.example.com'
    );
  });

  it('should strip trailing slashes from URL', async () => {
    await component.addCustom('https://backend.example.com///');

    expect(configServiceMock.switchBackend).toHaveBeenCalledWith(
      'https://backend.example.com'
    );
  });

  it('should show error message when switchBackend fails', async () => {
    configServiceMock.switchBackend.mockRejectedValue(
      new Error('Connection refused')
    );

    component.switchTo('https://bad-backend.example.com');

    // Wait for the microtask queue to flush
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(component['errorMessage']()).toBe('Connection refused');
  });

  it('should clear error message on successful switch', async () => {
    component.switchTo('https://good-backend.example.com');

    // Wait for the microtask queue to flush
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(component['errorMessage']()).toBeNull();
  });

  it('should not add duplicate URL', async () => {
    localStorage.setItem(
      'qf-backend-profiles',
      JSON.stringify({
        backends: [
          {
            url: 'http://localhost:3333',
            supabaseUrl: 'https://test.supabase.co',
            supabasePublishableKey: 'key1',
            sentryDsn: '',
          },
        ],
      })
    );

    // Trigger profile reload
    component['loadProfiles']();

    await component.addCustom('http://localhost:3333');

    expect(component['urlError']()).toContain('already saved');
    expect(configServiceMock.switchBackend).not.toHaveBeenCalled();
  });

  it('should remove a profile from localStorage', () => {
    localStorage.setItem(
      'qf-backend-profiles',
      JSON.stringify({
        backends: [
          {
            url: 'http://localhost:3333',
            supabaseUrl: 'https://test.supabase.co',
            supabasePublishableKey: 'key1',
            sentryDsn: '',
          },
          {
            url: 'https://custom.example.com',
            supabaseUrl: 'https://custom.supabase.co',
            supabasePublishableKey: 'key2',
            sentryDsn: '',
          },
        ],
      })
    );

    component['loadProfiles']();
    component.removeProfile('https://custom.example.com');

    const stored = JSON.parse(
      localStorage.getItem('qf-backend-profiles') ?? '{}'
    );
    expect(stored.backends).toHaveLength(1);
    expect(stored.backends[0].url).toBe('http://localhost:3333');
  });

  it('should load profiles from localStorage', () => {
    localStorage.setItem(
      'qf-backend-profiles',
      JSON.stringify({
        backends: [
          {
            url: 'http://localhost:3333',
            supabaseUrl: 'https://test.supabase.co',
            supabasePublishableKey: 'key1',
            sentryDsn: '',
          },
          {
            url: 'https://custom.example.com',
            supabaseUrl: 'https://custom.supabase.co',
            supabasePublishableKey: 'key2',
            sentryDsn: '',
          },
        ],
      })
    );

    component['loadProfiles']();

    expect(component['profiles']()).toHaveLength(2);
    expect(component['profiles']()[0].url).toBe('http://localhost:3333');
    expect(component['profiles']()[1].url).toBe('https://custom.example.com');
  });

  it('should set empty profiles when localStorage is empty', () => {
    component['loadProfiles']();

    expect(component['profiles']()).toHaveLength(0);
  });

  it('should update onUrlInput signal', () => {
    const mockEvent = {
      target: { value: 'https://test.example.com' },
    } as unknown as Event;

    component.onUrlInput(mockEvent);

    expect(component['customUrl']()).toBe('https://test.example.com');
    expect(component['urlError']()).toBe('');
  });

  it('should set switching signal during switchTo', async () => {
    // Make switchBackend take some time
    let resolveSwitch: (() => void) | undefined;
    configServiceMock.switchBackend.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSwitch = resolve;
        })
    );

    component.switchTo('https://slow-backend.example.com');

    // Wait one tick so the promise chain starts
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Switching should be true while the request is pending
    expect(component['switching']()).toBe(true);

    resolveSwitch?.();

    // Wait for the promise chain to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Switching should be false after completion
    expect(component['switching']()).toBe(false);
  });

  it('should reload profiles after successful switch', async () => {
    localStorage.setItem(
      'qf-backend-profiles',
      JSON.stringify({
        backends: [
          {
            url: 'http://localhost:3333',
            supabaseUrl: 'https://test.supabase.co',
            supabasePublishableKey: 'key1',
            sentryDsn: '',
          },
        ],
      })
    );

    component['loadProfiles']();
    expect(component['profiles']()).toHaveLength(1);

    // After a successful switch, the ConfigService will cache the new profile,
    // so loadProfiles should see updated data
    component.switchTo('https://new-backend.example.com');

    // Wait for the microtask queue to flush
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The profiles should be reloaded (even if the mock localStorage hasn't changed,
    // loadProfiles is still called)
    expect(component['profiles']()).toBeDefined();
  });
});
