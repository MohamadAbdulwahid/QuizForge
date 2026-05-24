import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardCacheService } from '../../core/services/dashboard-cache.service';
import { buildDisplayName } from '../../shared/utils/display-name';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent {
  private readonly authService = inject(AuthService);
  private readonly dashboardCache = inject(DashboardCacheService);
  private readonly router = inject(Router);

  // Delegate to cache service signals
  protected readonly loading = this.dashboardCache.isLoading;
  protected readonly errorMessage = this.dashboardCache.errorMessage;
  protected readonly groups = this.dashboardCache.groups;
  protected readonly joinableSessions = this.dashboardCache.joinableSessions;
  protected readonly hasJoinableSessions = this.dashboardCache.hasJoinableSessions;
  protected readonly hasGroups = this.dashboardCache.hasGroups;

  // Computed
  protected readonly displayName = computed(() =>
    buildDisplayName(this.authService.currentUser(), 'QuizForger')
  );

  protected readonly firstName = computed(() => {
    const name = this.displayName();
    return name.split(' ')[0] ?? name;
  });

  protected readonly userInitials = computed(() => {
    const name = this.displayName();
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  constructor() {
    // Load from cache instantly — only fetches from API if stale or empty
    this.dashboardCache.load();
  }

  protected joinSession(pin: string): void {
    void this.router.navigate(['/game-lobby', pin]);
  }
}
