import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

export interface ChestEffect {
  readonly outcomeType: string;
  readonly outcomeValue: number | null;
  readonly label: string;
  readonly goldDelta: number;
  readonly newTotal: number;
  readonly targetUsername?: string;
}

@Component({
  selector: 'app-chest-effect-announcement',
  standalone: true,
  imports: [CommonModule],
  styles: `
    :host {
      display: block;
    }

    .announcement {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      pointer-events: none;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .announcement-card {
      background: var(--bubbly-surface, #fff);
      border-radius: 2rem;
      padding: 2.5rem 3rem;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      max-width: 90vw;
    }

    @keyframes popIn {
      from {
        transform: scale(0.8);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    .effect-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
    }

    .effect-label {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--bubbly-text, #1a1a1a);
      margin-bottom: 0.5rem;
    }

    .effect-detail {
      font-size: 1rem;
      font-weight: 600;
      color: var(--bubbly-text-muted, #666);
      margin-bottom: 1rem;
    }

    .gold-change {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 1rem;
      font-size: 1.25rem;
      font-weight: 800;
    }

    .gold-change.positive {
      background: rgba(45, 138, 78, 0.1);
      color: #2d8a4e;
    }

    .gold-change.negative {
      background: rgba(138, 45, 45, 0.1);
      color: #8a2d2d;
    }

    .gold-change.neutral {
      background: rgba(100, 100, 100, 0.1);
      color: #666;
    }

    /* Outcome-specific colors */
    .outcome-gold .announcement-card {
      border: 3px solid #d4a017;
    }
    .outcome-multiplier .announcement-card {
      border: 3px solid #2d8a4e;
    }
    .outcome-steal .announcement-card {
      border: 3px solid #8a2d4e;
    }
    .outcome-swap .announcement-card {
      border: 3px solid #2d4e8a;
    }
    .outcome-loss .announcement-card {
      border: 3px solid #8a1a1a;
    }
    .outcome-nothing .announcement-card {
      border: 3px solid #4a4a4a;
    }
  `,
  template: `
    @if (effect(); as e) {
      <div
        class="announcement"
        [class]="'outcome-' + e.outcomeType"
        role="button"
        tabindex="0"
        (click)="onDismiss()"
        (keyup.enter)="onDismiss()"
        (keyup.space)="onDismiss()"
      >
        <div class="announcement-card">
          <div class="effect-icon">{{ getIcon(e.outcomeType) }}</div>
          <div class="effect-label">{{ e.label }}</div>

          @if (e.targetUsername) {
            <div class="effect-detail">
              {{ e.outcomeType === 'steal' ? 'From' : 'With' }}: {{ e.targetUsername }}
            </div>
          }

          @if (e.outcomeType !== 'steal' && e.outcomeType !== 'swap') {
            <div
              class="gold-change"
              [class.positive]="e.goldDelta > 0"
              [class.negative]="e.goldDelta < 0"
              [class.neutral]="e.goldDelta === 0"
            >
              <span>🪙</span>
              <span>{{ e.goldDelta > 0 ? '+' : '' }}{{ e.goldDelta }}</span>
            </div>
          }

          <div
            class="effect-detail"
            style="margin-top: 0.5rem;"
          >
            Total: 🪙 {{ e.newTotal }}
          </div>
        </div>
      </div>
    }
  `,
})
export class ChestEffectAnnouncementComponent {
  readonly effect = input<ChestEffect | null>(null);
  readonly dismissed = output<void>();

  protected onDismiss(): void {
    this.dismissed.emit();
  }

  protected getIcon(type: string): string {
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
