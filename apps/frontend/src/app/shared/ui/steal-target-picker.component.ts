import { CommonModule } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { BubblyButtonComponent } from './bubbly-button.component';

export interface TargetPlayer {
  readonly userId: string;
  readonly username: string;
  readonly gold: number;
}

export interface TargetSelectedEvent {
  readonly targetUserId: string;
  readonly targetUsername: string;
}

@Component({
  selector: 'app-steal-target-picker',
  standalone: true,
  imports: [CommonModule, BubblyButtonComponent],
  styles: `
    :host {
      display: block;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
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

    .picker-card {
      background: var(--bubbly-surface, #fff);
      border-radius: 1.5rem;
      padding: 2rem;
      max-width: 400px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .picker-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--bubbly-text, #1a1a1a);
      text-align: center;
      margin-bottom: 0.5rem;
    }

    .picker-subtitle {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--bubbly-text-muted, #666);
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .player-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .player-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      border-radius: 1rem;
      border: 2px solid transparent;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--bubbly-surface-soft, #f5f5f5);
    }

    .player-option:hover {
      border-color: var(--bubbly-primary, #6366f1);
      background: var(--bubbly-surface, #fff);
    }

    .player-option.selected {
      border-color: var(--bubbly-primary, #6366f1);
      background: var(--bubbly-primary-soft, #eef2ff);
    }

    .player-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .player-avatar {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      background: var(--bubbly-primary, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      color: white;
      font-weight: 700;
    }

    .player-name {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--bubbly-text, #1a1a1a);
    }

    .player-gold {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.875rem;
      font-weight: 700;
      color: #8b6914;
    }

    .player-gold .gold-icon {
      font-size: 1rem;
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;
      justify-content: flex-end;
    }
  `,
  template: `
    @if (visible()) {
      <div
        class="overlay"
        role="button"
        tabindex="0"
        (click)="onCancel()"
        (keyup.enter)="onCancel()"
        (keyup.space)="onCancel()"
      >
        <div
          class="picker-card"
          tabindex="-1"
          (click)="$event.stopPropagation()"
          (keyup)="$event.stopPropagation()"
        >
          <h3 class="picker-title">
            {{ actionType() === 'steal' ? '🤏 Choose a Target' : '🔄 Choose a Swap Partner' }}
          </h3>
          <p class="picker-subtitle">
            {{
              actionType() === 'steal'
                ? 'Select a player to steal ' + stealPercent() + '% of their gold'
                : 'Select a player to swap gold totals with'
            }}
          </p>

          <div class="player-list">
            @for (player of players(); track player.userId) {
              <div
                class="player-option"
                [class.selected]="selectedTarget() === player.userId"
                role="button"
                tabindex="0"
                (click)="selectTarget(player)"
                (keyup.enter)="selectTarget(player)"
                (keyup.space)="selectTarget(player)"
              >
                <div class="player-info">
                  <div class="player-avatar">
                    {{ player.username.charAt(0).toUpperCase() }}
                  </div>
                  <span class="player-name">{{ player.username }}</span>
                </div>
                <div class="player-gold">
                  <span class="gold-icon">🪙</span>
                  <span>{{ player.gold }}</span>
                </div>
              </div>
            }
          </div>

          <div class="actions">
            <app-bubbly-button
              tone="ghost"
              size="sm"
              (click)="onCancel()"
            >
              Cancel
            </app-bubbly-button>
            <app-bubbly-button
              tone="primary"
              size="sm"
              [disabled]="selectedTarget() === null"
              (click)="onConfirm()"
            >
              {{ actionType() === 'steal' ? 'Steal!' : 'Swap!' }}
            </app-bubbly-button>
          </div>
        </div>
      </div>
    }
  `,
})
export class StealTargetPickerComponent {
  readonly visible = input(false);
  readonly players = input.required<readonly TargetPlayer[]>();
  readonly actionType = input<'steal' | 'swap'>('steal');
  readonly stealPercent = input(10);
  readonly targetSelected = output<TargetSelectedEvent>();
  readonly cancelled = output<void>();

  protected readonly selectedTarget = signal<string | null>(null);

  protected selectTarget(player: TargetPlayer): void {
    this.selectedTarget.set(player.userId);
  }

  protected onConfirm(): void {
    const targetId = this.selectedTarget();
    if (!targetId) return;

    const target = this.players().find((p) => p.userId === targetId);
    if (!target) return;

    this.targetSelected.emit({
      targetUserId: targetId,
      targetUsername: target.username,
    });
    this.selectedTarget.set(null);
  }

  protected onCancel(): void {
    this.selectedTarget.set(null);
    this.cancelled.emit();
  }
}
