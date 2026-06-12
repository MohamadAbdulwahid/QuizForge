import { CommonModule } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';

export interface ChestOption {
  readonly type: string;
  readonly label: string;
}

export type ChestState = 'idle' | 'hovering' | 'selected' | 'revealed';

export interface ChestRevealEvent {
  readonly index: number;
  readonly chest: ChestOption;
}

@Component({
  selector: 'app-chest-picker',
  standalone: true,
  imports: [CommonModule],
  styles: `
    :host {
      display: block;
    }

    .chest-container {
      display: flex;
      justify-content: center;
      gap: 2rem;
      padding: 2rem 0;
    }

    .chest-wrapper {
      position: relative;
      cursor: pointer;
      transition: transform 0.2s ease;
    }

    .chest-wrapper:hover {
      transform: translateY(-4px);
    }

    .chest-wrapper.selected {
      transform: scale(1.05);
    }

    .chest {
      width: 100px;
      height: 100px;
      position: relative;
      perspective: 500px;
    }

    .chest-body {
      width: 100%;
      height: 100%;
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.6s ease;
    }

    .chest-wrapper.selected .chest-body {
      transform: rotateY(180deg);
    }

    .chest-front,
    .chest-back {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      border-radius: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
    }

    .chest-front {
      background: linear-gradient(135deg, #8b6914 0%, #d4a017 50%, #8b6914 100%);
      border: 3px solid #6b4f0a;
      box-shadow:
        0 4px 8px rgba(0, 0, 0, 0.3),
        inset 0 2px 4px rgba(255, 255, 255, 0.2);
    }

    .chest-front::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 30px;
      height: 20px;
      background: #6b4f0a;
      border-radius: 4px;
      border: 2px solid #8b6914;
    }

    .chest-back {
      background: linear-gradient(135deg, #2d1f0a 0%, #4a350a 50%, #2d1f0a 100%);
      border: 3px solid #1a1005;
      transform: rotateY(180deg);
      flex-direction: column;
      gap: 0.25rem;
    }

    .chest-back .outcome-icon {
      font-size: 2rem;
    }

    .chest-back .outcome-label {
      font-size: 0.625rem;
      font-weight: 700;
      color: #f5e6c8;
      text-align: center;
      line-height: 1.2;
      max-width: 80px;
    }

    /* Wobble animation on hover */
    @keyframes wobble {
      0%,
      100% {
        transform: rotate(0deg);
      }
      25% {
        transform: rotate(-5deg);
      }
      75% {
        transform: rotate(5deg);
      }
    }

    .chest-wrapper:hover .chest {
      animation: wobble 0.5s ease-in-out infinite;
    }

    .chest-wrapper.selected .chest {
      animation: none;
    }

    /* Glow effect for selected chest */
    .chest-wrapper.selected .chest-front {
      box-shadow:
        0 0 20px rgba(212, 160, 23, 0.6),
        0 0 40px rgba(212, 160, 23, 0.3),
        0 4px 8px rgba(0, 0, 0, 0.3);
    }

    /* Pulse animation for idle chests */
    @keyframes pulse-glow {
      0%,
      100% {
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.3),
          inset 0 2px 4px rgba(255, 255, 255, 0.2);
      }
      50% {
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.3),
          inset 0 2px 4px rgba(255, 255, 255, 0.2),
          0 0 15px rgba(212, 160, 23, 0.4);
      }
    }

    .chest-wrapper:not(.selected) .chest {
      animation: pulse-glow 2s ease-in-out infinite;
    }

    .chest-wrapper:hover .chest {
      animation: wobble 0.5s ease-in-out infinite;
    }

    /* Outcome-specific colors */
    .outcome-gold .chest-back {
      background: linear-gradient(135deg, #8b6914 0%, #d4a017 50%, #8b6914 100%);
    }
    .outcome-multiplier .chest-back {
      background: linear-gradient(135deg, #1a472a 0%, #2d8a4e 50%, #1a472a 100%);
    }
    .outcome-steal .chest-back {
      background: linear-gradient(135deg, #4a1a2d 0%, #8a2d4e 50%, #4a1a2d 100%);
    }
    .outcome-swap .chest-back {
      background: linear-gradient(135deg, #1a2d4a 0%, #2d4e8a 50%, #1a2d4a 100%);
    }
    .outcome-loss .chest-back {
      background: linear-gradient(135deg, #4a0a0a 0%, #8a1a1a 50%, #4a0a0a 100%);
    }
    .outcome-nothing .chest-back {
      background: linear-gradient(135deg, #2a2a2a 0%, #4a4a4a 50%, #2a2a2a 100%);
    }

    .disabled {
      pointer-events: none;
      opacity: 0.6;
    }
  `,
  template: `
    <div class="chest-container">
      @for (chest of chests(); track $index) {
        <div
          class="chest-wrapper"
          [class.selected]="selectedChest() === $index"
          [class.disabled]="disabled() || selectedChest() !== null"
          [class]="'outcome-' + chest.type"
          role="button"
          tabindex="0"
          [attr.aria-disabled]="disabled() || selectedChest() !== null"
          (click)="onChestClick($index)"
          (keyup.enter)="onChestClick($index)"
          (keyup.space)="onChestClick($index)"
        >
          <div class="chest">
            <div class="chest-body">
              <div class="chest-front">
                <span>&#128142;</span>
              </div>
              <div class="chest-back">
                <span class="outcome-icon">{{ getOutcomeIcon(chest.type) }}</span>
                <span class="outcome-label">{{ chest.label }}</span>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ChestPickerComponent {
  readonly chests = input.required<readonly ChestOption[]>();
  readonly disabled = input(false);
  readonly chestSelected = output<ChestRevealEvent>();

  protected readonly selectedChest = signal<number | null>(null);

  protected onChestClick(index: number): void {
    if (this.disabled() || this.selectedChest() !== null) {
      return;
    }

    this.selectedChest.set(index);
    this.chestSelected.emit({
      index,
      chest: this.chests()[index],
    });
  }

  protected getOutcomeIcon(type: string): string {
    const icons: Record<string, string> = {
      gold: '🪙',
      multiplier: '✨',
      steal: '🤏',
      swap: '🔄',
      loss: '💀',
      nothing: '💨',
    };
    return icons[type] ?? '❓';
  }
}
