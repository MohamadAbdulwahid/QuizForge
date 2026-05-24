import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BubblyButtonComponent, BubblyCardComponent],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent {
  private readonly router = inject(Router);

  protected quickJoinPin = '';

  protected readonly busyAction = signal<'join' | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected joinByPin(): void {
    this.errorMessage.set(null);

    if (!/^\d{6}$/.test(this.quickJoinPin)) {
      this.errorMessage.set('Game PIN must be exactly 6 digits.');
      return;
    }

    this.busyAction.set('join');
    void this.router.navigate(['/game-lobby', this.quickJoinPin]).finally(() => {
      this.busyAction.set(null);
    });
  }
}
