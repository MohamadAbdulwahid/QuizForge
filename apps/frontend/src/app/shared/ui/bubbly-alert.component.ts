import { NgClass } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';

type BubblyAlertVariant = 'error' | 'info' | 'success' | 'warning';

@Component({
  selector: 'app-bubbly-alert',
  standalone: true,
  imports: [NgClass],
  template: `
    @if (visible()) {
      <div
        role="alert"
        class="flex items-start justify-between gap-3"
        [ngClass]="alertClasses()"
      >
        <p class="flex-1 text-sm leading-relaxed font-bold">
          {{ message() ?? '' }}
        </p>

        @if (dismissible()) {
          <button
            type="button"
            class="flex-shrink-0 text-sm font-bold opacity-70 transition hover:opacity-100"
            (click)="dismiss()"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        }
      </div>
    }
  `,
})
export class BubblyAlertComponent {
  readonly message = input<string | null>(null);
  readonly variant = input<BubblyAlertVariant>('error');
  readonly dismissible = input(false);

  protected visible = signal(true);

  protected readonly alertClasses = computed(() => {
    const variantClass = {
      error: 'qf-alert-error',
      info: 'qf-alert-info',
      success: 'qf-alert-success',
      warning: 'qf-alert-warning',
    }[this.variant()];

    return [variantClass].filter(Boolean).join(' ');
  });

  protected dismiss(): void {
    this.visible.set(false);
  }
}
