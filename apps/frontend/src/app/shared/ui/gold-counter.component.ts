import { Component, effect, input, OnDestroy, signal } from '@angular/core';

@Component({
  selector: 'app-gold-counter',
  standalone: true,
  styles: `
    :host {
      display: block;
    }

    .gold-counter {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      background: linear-gradient(135deg, #2d1f0a 0%, #4a350a 50%, #2d1f0a 100%);
      border: 2px solid #8b6914;
      border-radius: 1rem;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      transform: scale(1);
      transition: transform 0.2s ease;
    }

    .gold-counter.pulse {
      transform: scale(1.08);
    }

    .gold-icon {
      font-size: 1.5rem;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    }

    .gold-amount {
      font-size: 1.25rem;
      font-weight: 800;
      color: #f5e6c8;
      font-variant-numeric: tabular-nums;
      min-width: 3rem;
      text-align: right;
    }

    .gold-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #8b6914;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Delta animation */
    .gold-delta {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.875rem;
      font-weight: 700;
      opacity: 0;
      pointer-events: none;
    }

    .gold-delta.positive {
      color: #2d8a4e;
      animation: delta-up 1.5s ease-out forwards;
    }

    .gold-delta.negative {
      color: #8a2d2d;
      animation: delta-down 1.5s ease-out forwards;
    }

    @keyframes delta-up {
      0% {
        opacity: 1;
        transform: translateY(-50%);
      }
      100% {
        opacity: 0;
        transform: translateY(-150%);
      }
    }

    @keyframes delta-down {
      0% {
        opacity: 1;
        transform: translateY(-50%);
      }
      100% {
        opacity: 0;
        transform: translateY(50%);
      }
    }

    .gold-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
  `,
  template: `
    <div
      class="gold-counter"
      [class.pulse]="pulsing()"
    >
      <div class="gold-wrapper">
        <span class="gold-icon">🪙</span>
        <div>
          <span class="gold-amount">{{ amount() }}</span>
          <div class="gold-label">Gold</div>
        </div>
        @if (delta() !== 0) {
          <div
            class="gold-delta"
            [class.positive]="delta() > 0"
            [class.negative]="delta() < 0"
          >
            {{ delta() > 0 ? '+' : '' }}{{ delta() }}
          </div>
        }
      </div>
    </div>
  `,
})
export class GoldCounterComponent implements OnDestroy {
  readonly amount = input(0);
  readonly delta = input(0);

  protected readonly pulsing = signal(false);

  private pulseTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      // Read amount to track changes — display snaps instantly with no interval
      this.amount();
      // Trigger a smooth CSS scale pulse that extends on rapid updates
      this.triggerPulse();
    });
  }

  ngOnDestroy(): void {
    if (this.pulseTimeout !== null) {
      clearTimeout(this.pulseTimeout);
    }
  }

  private triggerPulse(): void {
    // Reset the timer on each call — rapid updates extend the pulse
    if (this.pulseTimeout !== null) {
      clearTimeout(this.pulseTimeout);
    }

    this.pulsing.set(true);
    this.pulseTimeout = setTimeout(() => {
      this.pulsing.set(false);
      this.pulseTimeout = null;
    }, 200);
  }
}
