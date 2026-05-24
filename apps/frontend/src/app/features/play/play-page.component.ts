import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-play-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './play-page.component.html',
})
export class PlayPageComponent {
  private readonly router = inject(Router);

  protected gameId = '';
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected joinGame(): void {
    this.errorMessage.set(null);

    if (!/^\d{6}$/.test(this.gameId)) {
      this.errorMessage.set('Game ID must be exactly 6 digits.');
      return;
    }

    this.busy.set(true);
    void this.router.navigate(['/game-lobby', this.gameId]).finally(() => {
      this.busy.set(false);
    });
  }
}
