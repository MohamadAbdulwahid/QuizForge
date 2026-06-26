import { Component, computed, input } from '@angular/core';

/**
 * Royal player card — colorful avatar card for the host projector.
 * Shows username, lives (mini hearts), and three status modes:
 *  - 'active' (default, cyan)
 *  - 'eliminated' (dimmed, grayscale)
 *  - 'spectating' (purple, indicates active spectator with curses)
 */
@Component({
  selector: 'app-br-royal-player-card',
  standalone: true,
  template: `
    <div
      class="br-royal-player-card"
      [class.eliminated]="status() === 'eliminated'"
      [class.spectating]="status() === 'spectating'"
      [attr.aria-label]="ariaLabel()"
    >
      <div class="br-royal-player-avatar" aria-hidden="true">
        {{ status() === 'spectating' ? '👁️' : '🫧' }}
      </div>
      <span class="br-royal-player-name">{{ name() }}</span>
      <div class="br-royal-player-lives" role="list" aria-label="Lives">
        @for (i of lifeIndices(); track i) {
          <span
            class="mini-heart"
            [class.lost]="i >= remainingLives()"
            role="listitem"
            [attr.aria-label]="i < remainingLives() ? 'Life remaining' : 'Life lost'"
          >
            {{ i < remainingLives() ? '❤️' : '🤍' }}
          </span>
        }
      </div>
    </div>
  `,
})
export class BrRoyalPlayerCardComponent {
  readonly name = input.required<string>();
  readonly remainingLives = input.required<number>();
  readonly startingLives = input.required<number>();
  readonly status = input<'active' | 'eliminated' | 'spectating'>('active');

  protected readonly lifeIndices = computed(() =>
    Array.from({ length: Math.max(0, this.startingLives()) }, (_, i) => i)
  );

  protected readonly ariaLabel = computed(() => {
    const lives = this.remainingLives();
    const total = this.startingLives();
    const statusLabel =
      this.status() === 'eliminated'
        ? 'eliminated'
        : this.status() === 'spectating'
          ? 'spectator'
          : 'active';
    return `${this.name()}, ${lives} of ${total} lives, ${statusLabel}`;
  });
}
