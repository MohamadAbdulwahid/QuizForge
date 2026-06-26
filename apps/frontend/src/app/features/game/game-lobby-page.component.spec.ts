import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameLobbyPageComponent } from './game-lobby-page.component';
import { ConfigService } from '../../core/services/config.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { WebsocketService } from '../../core/services/websocket.service';

/**
 * Component tests for GameLobbyPageComponent.
 * Verifies lobby rendering, error handling, and edge cases.
 */

const mockConfigService = {
  getBackendUrl: vi.fn().mockReturnValue('http://localhost:3333'),
  getSupabaseUrl: vi.fn().mockReturnValue('https://test.supabase.co'),
  getSupabasePublishableKey: vi.fn().mockReturnValue('test-key'),
  getSentryDsn: vi.fn().mockReturnValue(''),
  isReady: vi.fn().mockReturnValue(true),
  whenReady: vi.fn().mockResolvedValue(undefined),
  load: vi.fn().mockResolvedValue(undefined),
  switchBackend: vi.fn().mockResolvedValue(undefined),
  backendUrl: vi.fn().mockReturnValue('http://localhost:3333'),
  supabaseUrl: vi.fn().mockReturnValue('https://test.supabase.co'),
  supabasePublishableKey: vi.fn().mockReturnValue('test-key'),
  sentryDsn: vi.fn().mockReturnValue(''),
};

const mockSupabaseService = {
  client: {
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
  authChanges: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
};

const mockAuthService = {
  isReady: vi.fn().mockReturnValue(true),
  whenReady: vi.fn().mockResolvedValue(undefined),
  currentUser: vi.fn().mockReturnValue(null),
  isAnonymous: vi.fn().mockReturnValue(true),
  getAccessToken: vi.fn().mockResolvedValue(null),
};

const mockWebsocketService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
};

describe('GameLobbyPageComponent', () => {
  let component: GameLobbyPageComponent;
  let fixture: ComponentFixture<GameLobbyPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [GameLobbyPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: vi.fn().mockReturnValue('123456') } },
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: WebsocketService, useValue: mockWebsocketService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameLobbyPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('error handling', () => {
    it('resolveSocketError handles DUPLICATE_USERNAME', () => {
      const errorMsg = (
        component as unknown as {
          resolveSocketError: (e: { code: string; error: string }) => string;
        }
      ).resolveSocketError({
        code: 'DUPLICATE_USERNAME',
        error: 'Username taken',
      });

      expect(errorMsg).toContain('username');
      expect(errorMsg).toContain('taken');
    });

    it('resolveSocketError handles SESSION_ENDED', () => {
      const errorMsg = (
        component as unknown as {
          resolveSocketError: (e: { code: string; error: string }) => string;
        }
      ).resolveSocketError({
        code: 'SESSION_ENDED',
        error: 'Session ended',
      });

      expect(errorMsg).toContain('ended');
    });

    it('resolveSocketError handles SESSION_NOT_FOUND', () => {
      const errorMsg = (
        component as unknown as {
          resolveSocketError: (e: { code: string; error: string }) => string;
        }
      ).resolveSocketError({
        code: 'SESSION_NOT_FOUND',
        error: 'Not found',
      });

      expect(errorMsg).toContain('Not found');
    });

    it('resolveSocketError returns fallback for unknown errors', () => {
      const errorMsg = (
        component as unknown as {
          resolveSocketError: (e: { code: string; error: string }) => string;
        }
      ).resolveSocketError({
        code: 'UNKNOWN',
        error: 'Something broke',
      });

      expect(errorMsg).toContain('Something broke');
    });
  });

  describe('emoji generation', () => {
    it('selectEmoji returns a string from the emoji pool', () => {
      const emoji = (component as unknown as { selectEmoji: (id: string) => string }).selectEmoji(
        'test-user-id'
      );
      expect(typeof emoji).toBe('string');
      expect(emoji.length).toBeGreaterThan(0);
    });
  });
});
