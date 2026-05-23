import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-heading',
  standalone: true,
  template: `
    <header class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p class="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">{{ eyebrow() }}</p>
        <h1 class="font-display text-bubbly-primary mt-2 text-3xl font-bold md:text-4xl">
          {{ title() }}
        </h1>
        @if (description()) {
          <p class="mt-2 max-w-3xl text-sm font-semibold text-slate-600 md:text-base">
            {{ description() }}
          </p>
        }
      </div>

      @if (hasActions()) {
        <div class="flex flex-wrap gap-3">
          <ng-content select="[page-actions]" />
        </div>
      }
    </header>
  `,
})
export class PageHeadingComponent {
  readonly eyebrow = input('QuizForge');
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly hasActions = input(false);
}
