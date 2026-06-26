import { Component, computed, input } from '@angular/core';
import type { BrCurseType } from '../../features/game/services/game-state.service';

/** Icon set for curse tokens. */
const CURSE_ICONS: Readonly<Record<BrCurseType, string>> = {
  SlowMotion: '🐌',
  Jumble: '🔀',
  LifeSteal: '💀',
};

/** Display label for curse tokens. */
const CURSE_LABELS: Readonly<Record<BrCurseType, string>> = {
  SlowMotion: 'Slow',
  Jumble: 'Jumble',
  LifeSteal: 'Steal',
};

/**
 * Curse token card — purple-themed card for a single curse in a
 * spectator's inventory. Visually dims when the curse has been cast.
 */
@Component({
  selector: 'app-br-curse-token-card',
  standalone: true,
  template: `
    <div
      class="br-curse-card"
      [class.cast]="cast()"
      [attr.aria-label]="ariaLabel()"
    >
      <span class="br-curse-icon" aria-hidden="true">{{ icon() }}</span>
      <span class="br-curse-name">{{ label() }}</span>
      @if (cast()) {
        <span class="br-curse-name opacity-60">CAST</span>
      }
    </div>
  `,
})
export class BrCurseTokenCardComponent {
  readonly type = input.required<BrCurseType>();
  readonly cast = input<boolean>(false);

  protected readonly icon = computed(() => CURSE_ICONS[this.type()]);
  protected readonly label = computed(() => CURSE_LABELS[this.type()]);
  protected readonly ariaLabel = computed(
    () => `${this.label()} curse${this.cast() ? ' (cast)' : ''}`
  );
}
