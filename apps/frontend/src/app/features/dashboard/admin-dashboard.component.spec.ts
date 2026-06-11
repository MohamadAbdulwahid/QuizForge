import { provideZonelessChangeDetection } from '@angular/core';
import { type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboardComponent } from './admin-dashboard.component';

/** Stat card shape used by AdminDashboardComponent. */
interface StatCard {
  label: string;
  value: string | number;
  sub?: string;
}

/**
 * Component tests for AdminDashboardComponent.
 * Verifies component creation and basic state management.
 */

// Helper to access private writable signals in tests
function access<T>(component: AdminDashboardComponent, key: string): WritableSignal<T> {
  return (component as unknown as Record<string, WritableSignal<T>>)[key];
}

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('has loading state true on creation', () => {
      expect(access<boolean>(component, 'loading')()).toBe(true);
    });

    it('has null stats initially', () => {
      expect(access<unknown>(component, 'stats')()).toBeNull();
    });

    it('has empty stale sessions initially', () => {
      expect(access<unknown[]>(component, 'staleSessions')()).toEqual([]);
    });

    it('has empty recent sessions initially', () => {
      expect(access<unknown[]>(component, 'recentSessions')()).toEqual([]);
    });

    it('has empty stat cards initially', () => {
      expect(access<StatCard[]>(component, 'statCards')()).toEqual([]);
    });
  });

  describe('stat cards', () => {
    it('can be populated manually', () => {
      const cards = access<StatCard[]>(component, 'statCards');
      cards.set([
        { label: 'Total Sessions', value: 10 },
        { label: 'Active Sessions', value: 3 },
        { label: 'Completion Rate', value: '70%', sub: '7 of 10 ended' },
      ]);

      const result = cards();
      expect(result).toHaveLength(3);
      expect(result[0].label).toBe('Total Sessions');
      expect(result[2].value).toContain('70');
    });
  });

  describe('error state', () => {
    it('can be set', () => {
      access<string | null>(component, 'error').set('Failed to load');
      expect(access<string | null>(component, 'error')()).toBe('Failed to load');
    });

    it('can be cleared', () => {
      const error = access<string | null>(component, 'error');
      error.set('Error');
      error.set(null);
      expect(error()).toBeNull();
    });
  });
});
