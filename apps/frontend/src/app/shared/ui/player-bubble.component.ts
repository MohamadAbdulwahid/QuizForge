import { Component, input } from '@angular/core';

@Component({
  selector: 'app-player-bubble',
  standalone: true,
  template: `
    <article class="qf-soft-surface qf-tactile rounded-2xl p-3 text-center">
      <div
        class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-4xl shadow-sm"
      >
        {{ emoji() }}
      </div>
      <p class="mt-3 truncate text-sm font-bold text-slate-800">{{ name() }}</p>
      @if (meta()) {
        <p class="text-bubbly-primary mt-1 text-xs font-bold">{{ meta() }}</p>
      }
    </article>
  `,
})
export class PlayerBubbleComponent {
  readonly name = input.required<string>();
  readonly emoji = input('🫧');
  readonly meta = input<string | null>(null);
}
