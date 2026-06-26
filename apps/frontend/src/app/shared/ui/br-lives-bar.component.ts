import { Component, computed, input } from '@angular/core';

/**
 * Lives bar — shows starting lives as heart bubbles, with one removed
 * per loss. The just-lost slot triggers a pop animation.
 *
 * Pure presentational component. Wires up via the `poppingIndex` input.
 */
@Component({
  selector: 'app-br-lives-bar',
  standalone: true,
  template: `
    <div
      class="flex items-center gap-2"
      [attr.aria-label]="ariaLabel()"
    >
      <span class="font-display text-base font-bold tracking-wider text-white/90 uppercase drop-shadow-md">
        Lives
      </span>
      <div class="flex items-center gap-1.5" role="list">
        @for (i of lifeIndices(); track i) {
          <span
            class="br-life-heart"
            [class.lost]="i >= remaining()"
            [class.popping]="i === poppingIndex()"
            [attr.aria-label]="
              i < remaining() ? 'Life ' + (i + 1) + ' remaining' : 'Life ' + (i + 1) + ' lost'
            "
            role="listitem"
          >
            {{ i < remaining() ? '❤️' : '🤍' }}
          </span>
        }
      </div>
    </div>
  `,
})
export class BrLivesBarComponent {
  /** Total lives at game start (e.g. 3). */
  readonly startingLives = input.required<number>();
  /** Currently remaining lives. */
  readonly remaining = input.required<number>();
  /** Index (0-based) of a life that was just lost, to trigger the pop animation. `null` = no pop. */
  readonly poppingIndex = input<number | null>(null);

  protected readonly lifeIndices = computed(() =>
    Array.from({ length: Math.max(0, this.startingLives()) }, (_, i) => i)
  );

  protected readonly ariaLabel = computed(
    () => `${this.remaining()} of ${this.startingLives()} lives remaining`
  );
}
