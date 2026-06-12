import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { SessionSseService } from '../../core/services/session-sse.service';
import { buildDisplayName } from '../../shared/utils/display-name';

interface AppNavItem {
  label: string;
  route: string;
  exact?: boolean;
  icon: string;
  accent?: 'primary' | 'accent' | 'amber' | 'violet';
}

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard-shell.component.html',
  styles: [
    `
      .profile-menu {
        animation: slide-out-right 0.25s ease-out forwards;
      }

      /* Hover bridge: extends the hover target to cover the gap between
         the profile trigger and the menu buttons, so moving the cursor
         from one to the other doesn't trigger mouseleave on the container. */
      .profile-menu::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        right: 100%;
        width: 12px;
      }

      @keyframes slide-out-right {
        from {
          transform: translateX(-20px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `,
  ],
})
export class DashboardShellComponent {
  private readonly authService = inject(AuthService);
  private readonly sessionSse = inject(SessionSseService);
  private readonly adminApi = inject(AdminApiService);
  private readonly router = inject(Router);

  protected readonly currentUser = this.authService.currentUser;
  protected readonly mobileNavOpen = signal(false);
  protected readonly profileDropdownOpen = signal(false);
  protected readonly isAdmin = signal(false);

  protected readonly navItems = computed<AppNavItem[]>(() => {
    const items: AppNavItem[] = [
      { label: 'Home', route: '/dashboard', exact: true, icon: 'home' },
      { label: 'My Quizzes', route: '/dashboard/quizzes', icon: 'quizzes' },
      { label: 'Groups', route: '/dashboard/groups', icon: 'groups' },
      { label: 'Discover', route: '/dashboard/groups/discover', icon: 'discover' },
      {
        label: 'Create Session',
        route: '/dashboard/create-session',
        icon: 'create-session',
        accent: 'accent',
      },
      {
        label: 'Marketplace',
        route: '/dashboard/marketplace',
        icon: 'marketplace',
        accent: 'violet',
      },
    ];
    if (this.isAdmin()) {
      items.push({ label: 'Admin', route: '/dashboard/admin', icon: 'admin', accent: 'amber' });
    }
    return items;
  });

  protected readonly displayName = () => buildDisplayName(this.currentUser(), 'QuizForger');

  constructor() {
    // SSE stays alive across all dashboard sub-routes via the shell component.
    this.sessionSse.connect();
    inject(DestroyRef).onDestroy(() => this.sessionSse.disconnect());

    // Check admin status (non-blocking)
    this.adminApi
      .getStats()
      .pipe(
        takeUntilDestroyed(),
        catchError(() => of(null))
      )
      .subscribe((stats) => {
        if (stats) this.isAdmin.set(true);
      });
  }

  /**
   * Curated, well-aligned icons (24×24, currentColor) for the nav rail.
   * These are real semantic icons — not generic placeholders.
   */
  protected readonly iconPaths: Record<string, string> = {
    // Home — a stylised house with a chimney
    home: 'M11.47 3.84a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.06l-8.69-8.69a2.25 2.25 0 0 0-3.18 0l-8.69 8.69a.75.75 0 0 0 1.06 1.06l8.69-8.69ZM12 5.43l7.5 7.5V19.5a2.25 2.25 0 0 1-2.25 2.25h-3v-6h-4.5v6h-3A2.25 2.25 0 0 1 4.5 19.5v-6.57l7.5-7.5Z',
    // Quizzes — stack of question cards
    quizzes:
      'M5.25 4.5h11.25a2.25 2.25 0 0 1 2.25 2.25v12.75A2.25 2.25 0 0 1 16.5 21.75H5.25A2.25 2.25 0 0 1 3 19.5V6.75A2.25 2.25 0 0 1 5.25 4.5Zm1.5 4.5h8.25a.75.75 0 0 0 0-1.5H6.75a.75.75 0 0 0 0 1.5Zm0 4.5h8.25a.75.75 0 0 0 0-1.5H6.75a.75.75 0 0 0 0 1.5Zm0 4.5h5.25a.75.75 0 0 0 0-1.5H6.75a.75.75 0 0 0 0 1.5Z',
    // Groups — three people
    groups:
      'M15 7.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 13.875c-1.78 0-3.326 1.067-4 2.583A4.5 4.5 0 0 0 4.5 18v.75A2.25 2.25 0 0 0 6.75 21h6.36a6.7 6.7 0 0 1-.36-2.25v-.473A6.749 6.749 0 0 1 16.5 12a4.5 4.5 0 0 0-1.5-3.436A8.97 8.97 0 0 0 9 13.875Zm10.5 4.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM19.5 21a.75.75 0 0 0 .75-.75v-.226a2.999 2.999 0 0 0-.879-2.121l-.879-.879a.75.75 0 0 0-1.061 0l-.879.88a2.999 2.999 0 0 0-.879 2.12v.226a.75.75 0 0 0 .75.75h3Z',
    // Discover — compass
    discover:
      'M10.5 2.25a8.25 8.25 0 1 0 4.5 15.114l4.616 1.65a.75.75 0 0 0 .97-.97l-1.65-4.616A8.25 8.25 0 0 0 10.5 2.25Zm-3 11.25a.75.75 0 0 1 .514-.706l3-1a.75.75 0 0 1 .723.162l2.21 1.95a.75.75 0 0 1-.073 1.156l-3 2.25a.75.75 0 0 1-1.156-.073l-2-2.667a.75.75 0 0 1-.218-1.072Z',
    // Create Session — rocket
    'create-session':
      'M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
    // Marketplace — storefront
    marketplace:
      'M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0 0 21 9.349m-18 0a2.999 2.999 0 0 0 2.25 1.017 2.999 2.999 0 0 0 2.25-1.017m14.999 0a3 3 0 0 0-2.25-1.017m-12.749 0a3 3 0 0 0-2.25 1.017M3 21h18M9.75 17.25h4.5',
    // Admin — shield with check
    admin:
      'M9 12.75 11.25 15 15 9.75M21 12c0 5.523-4.477 10-10 10S1 17.523 1 12c0-1.708.428-3.314 1.181-4.717l1.732.866C3.317 9.296 2.875 10.61 2.875 12c0 4.486 3.639 8.125 8.125 8.125s8.125-3.639 8.125-8.125c0-1.39-.442-2.704-1.038-3.851l1.732-.866A10.04 10.04 0 0 1 21 12Z',
  };

  protected closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  protected toggleMobileNav(): void {
    this.mobileNavOpen.update((open) => !open);
  }

  protected onProfileHover(open: boolean): void {
    this.profileDropdownOpen.set(open);
  }

  protected async logout(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl('/login');
  }

  protected openSettings(): void {
    this.profileDropdownOpen.set(false);
    // Settings page not yet implemented — close dropdown only
  }

  protected iconBgFor(item: AppNavItem): string {
    if (item.accent === 'accent') {
      return 'bg-bubbly-accent/15 text-bubbly-accent';
    }
    if (item.accent === 'amber') {
      return 'bg-amber-100 text-amber-700';
    }
    if (item.accent === 'violet') {
      return 'bg-violet-100 text-violet-700';
    }
    return 'bg-bubbly-primary/15 text-bubbly-primary-deep';
  }
}
