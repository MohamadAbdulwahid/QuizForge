import { Component, computed, input, output } from '@angular/core';
import type { BrPowerUpType } from '../../features/game/services/game-state.service';

/** Curated icon set for power-ups. Falls back to ✨. */
const POWER_UP_ICONS: Readonly<Record<BrPowerUpType, string>> = {
  Shield: '🛡️',
  QuickBubble: '⚡',
  DoublePop: '💥',
  Freeze: '❄️',
  BubbleHeal: '💖',
};

/** Display label for power-ups. */
const POWER_UP_LABELS: Readonly<Record<BrPowerUpType, string>> = {
  Shield: 'Shield',
  QuickBubble: 'Quick',
  DoublePop: 'Double',
  Freeze: 'Freeze',
  BubbleHeal: 'Heal',
};

/**
 * Power-up card — vivid display card for a single power-up in the
 * player's inventory. Shows a "Use" button only for the power-up that
 * requires manual activation (BubbleHeal). Other power-ups are auto-
 * consumed by the backend.
 */
@Component({
  selector: 'app-br-power-up-card',
  standalone: true,
  template: `
    <div
      class="br-powerup-card"
      [class.consumed]="consumed()"
      [attr.aria-label]="ariaLabel()"
    >
      <span class="br-powerup-icon" aria-hidden="true">{{ icon() }}</span>
      <span class="br-powerup-name">{{ label() }}</span>
      @if (showUse() && !consumed()) {
        <button
          type="button"
          class="br-powerup-use"
          (click)="usePressed.emit()"
          [attr.aria-label]="'Use ' + label()"
        >
          USE
        </button>
      } @else if (consumed()) {
        <span class="br-powerup-name opacity-60">USED</span>
      }
    </div>
  `,
})
export class BrPowerUpCardComponent {
  readonly type = input.required<BrPowerUpType>();
  readonly consumed = input<boolean>(false);
  /** Whether this power-up has a manual "Use" button. Defaults to BubbleHeal only. */
  readonly manualUse = input<boolean>(false);

  readonly usePressed = output<void>();

  protected readonly icon = computed(() => POWER_UP_ICONS[this.type()]);
  protected readonly label = computed(() => POWER_UP_LABELS[this.type()]);
  protected readonly showUse = computed(() => this.manualUse() || this.type() === 'BubbleHeal');
  protected readonly ariaLabel = computed(
    () => `${this.label()} power-up${this.consumed() ? ' (used)' : ''}`
  );
}
