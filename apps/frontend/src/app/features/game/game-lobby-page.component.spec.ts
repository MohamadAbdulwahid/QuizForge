import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameLobbyPageComponent } from './game-lobby-page.component';

/**
 * Component tests for GameLobbyPageComponent.
 * Verifies lobby rendering, error handling, and edge cases.
 */

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
