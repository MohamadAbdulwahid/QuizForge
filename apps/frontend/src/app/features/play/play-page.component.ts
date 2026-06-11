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
  protected username = '';
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected joinGame(): void {
    this.errorMessage.set(null);

    if (!/^\d{6}$/.test(this.gameId)) {
      this.errorMessage.set('Game ID must be exactly 6 digits.');
      return;
    }

    const trimmedUsername = this.username.trim();
    if (trimmedUsername.length < 1) {
      this.errorMessage.set('Please enter a username.');
      return;
    }
    if (trimmedUsername.length > 60) {
      this.errorMessage.set('Username must be 60 characters or less.');
      return;
    }

    this.busy.set(true);
    void this.router
      .navigate(['/game-lobby', this.gameId], {
        state: { username: trimmedUsername },
      })
      .finally(() => {
        this.busy.set(false);
      });
  }
}
