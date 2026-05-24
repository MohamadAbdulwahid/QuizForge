import { NgClass } from '@angular/common';
import { Component, computed, input } from '@angular/core';

type BubblyBadgeTone = 'primary' | 'accent' | 'success' | 'warning' | 'error';
type BubblyBadgeSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-bubbly-badge',
  standalone: true,
  imports: [NgClass],
  template: `
    @if (isVisible()) {
      <span
        class="inline-flex items-center justify-center leading-none font-bold select-none"
        [ngClass]="classes()"
        [attr.aria-label]="ariaLabel()"
        role="status"
      >
        {{ displayText() }}
      </span>
    }
  `,
})
export class BubblyBadgeComponent {
  readonly count = input<number | undefined>(undefined);
  readonly tone = input<BubblyBadgeTone>('accent');
  readonly size = input<BubblyBadgeSize>('sm');

  /** Whether the badge should be rendered (count > 0). */
  protected readonly isVisible = computed(() => {
    const c = this.count();
    return c !== undefined && c > 0;
  });

  /** Text to display — caps at "99+" for counts over 99. */
  protected readonly displayText = computed(() => {
    const c = this.count();
    if (c === undefined || c <= 0) return '';
    return c > 99 ? '99+' : String(c);
  });

  /** Accessible label for screen readers. */
  protected readonly ariaLabel = computed(() => {
    const c = this.count();
    if (c === undefined || c <= 0) return '';
    return c > 99 ? 'More than 99 notifications' : `${c} notification${c === 1 ? '' : 's'}`;
  });

  protected readonly classes = computed(() => {
    const toneClass = {
      primary: 'bg-bubbly-primary text-white',
      accent: 'bg-bubbly-accent text-white',
      success: 'text-bubbly-success-text bg-bubbly-success-bg',
      warning: 'text-bubbly-warning-text bg-bubbly-warning-bg',
      error: 'text-bubbly-error-text bg-bubbly-error-bg',
    }[this.tone()];

    const sizeClass = {
      sm: 'min-w-[1.25rem] h-5 px-1 text-[0.625rem] rounded-full',
      md: 'min-w-[1.5rem] h-6 px-1.5 text-xs rounded-full',
      lg: 'min-w-[1.75rem] h-7 px-2 text-sm rounded-2xl',
    }[this.size()];

    return [toneClass, sizeClass].filter(Boolean).join(' ');
  });
}
