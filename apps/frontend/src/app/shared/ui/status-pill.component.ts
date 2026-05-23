import { NgClass } from '@angular/common';
import { Component, computed, input } from '@angular/core';

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-status-pill',
  standalone: true,
  imports: [NgClass],
  template: `
    <span
      class="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-[0.08em] uppercase"
      [ngClass]="classes()"
    >
      <ng-content />
    </span>
  `,
})
export class StatusPillComponent {
  readonly tone = input<StatusTone>('neutral');

  protected readonly classes = computed(() => {
    return {
      neutral: 'bg-slate-100 text-slate-600',
      info: 'bg-sky-100 text-sky-700',
      success: 'bg-emerald-100 text-emerald-700',
      warning: 'bg-amber-100 text-amber-800',
      danger: 'bg-rose-100 text-rose-700',
    }[this.tone()];
  });
}
