import { NgClass } from '@angular/common';
import { Component, computed, input } from '@angular/core';

type BubblyCardTone = 'surface' | 'soft' | 'primary' | 'accent';

@Component({
  selector: 'app-bubbly-card',
  standalone: true,
  imports: [NgClass],
  template: `
    <section
      class="rounded-3xl"
      [ngClass]="classes()"
    >
      <ng-content />
    </section>
  `,
})
export class BubblyCardComponent {
  readonly tone = input<BubblyCardTone>('surface');
  readonly padded = input(true);
  readonly interactive = input(false);

  protected readonly classes = computed(() => {
    const toneClass = {
      surface: 'qf-surface',
      soft: 'qf-soft-surface',
      primary: 'bg-bubbly-primary text-white shadow-[0_6px_0_0_var(--bubbly-primary-deep)]',
      accent: 'bg-bubbly-accent text-white shadow-[0_6px_0_0_var(--bubbly-accent-deep)]',
    }[this.tone()];

    return [toneClass, this.padded() ? 'p-5 md:p-6' : '', this.interactive() ? 'qf-tactile' : '']
      .filter(Boolean)
      .join(' ');
  });
}
