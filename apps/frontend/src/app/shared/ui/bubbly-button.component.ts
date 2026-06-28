import { NgClass } from '@angular/common';
import { Component, computed, input } from '@angular/core';

type BubblyButtonTone = 'primary' | 'accent' | 'ghost';
type BubblyButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-bubbly-button',
  standalone: true,
  imports: [NgClass],
  template: `
    <button
      [type]="type()"
      class="qf-tactile inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-2xl font-bold disabled:pointer-events-none disabled:opacity-60"
      [ngClass]="classes()"
      [disabled]="disabled()"
    >
      <ng-content />
    </button>
  `,
})
export class BubblyButtonComponent {
  readonly tone = input<BubblyButtonTone>('primary');
  readonly size = input<BubblyButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
  readonly full = input(false);

  protected readonly classes = computed(() => {
    const toneClass = {
      primary: 'qf-button-primary',
      accent: 'qf-button-accent',
      ghost: 'qf-button-ghost',
    }[this.tone()];

    const sizeClass = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-5 py-3 text-sm',
      lg: 'px-6 py-4 text-base',
    }[this.size()];

    return [toneClass, sizeClass, this.full() ? 'w-full' : ''].filter(Boolean).join(' ');
  });
}
