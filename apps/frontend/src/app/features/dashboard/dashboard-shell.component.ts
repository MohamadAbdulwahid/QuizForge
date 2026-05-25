import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { buildDisplayName } from '../../shared/utils/display-name';

interface AppNavItem {
  label: string;
  route: string;
  exact?: boolean;
  icon: string;
}

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard-shell.component.html',
})
export class DashboardShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly currentUser = this.authService.currentUser;
  protected readonly mobileNavOpen = signal(false);
  protected readonly profileDropdownOpen = signal(false);
  protected readonly navItems: AppNavItem[] = [
    { label: 'Home', route: '/dashboard', exact: true, icon: 'home' },
    { label: 'My Quizzes', route: '/dashboard/quizzes', icon: 'quizzes' },
    { label: 'Groups', route: '/dashboard/groups', icon: 'groups' },
    { label: 'Discover', route: '/dashboard/groups/discover', icon: 'discover' },
    { label: 'Create Session', route: '/dashboard/create-session', icon: 'create-session' },
  ];

  protected readonly displayName = () => buildDisplayName(this.currentUser(), 'QuizForger');

  protected readonly iconPaths: Record<string, string> = {
    home: 'M12.504 2.036a2.5 2.5 0 0 0-1.008 0L3.29 5.494A2.5 2.5 0 0 0 1.75 7.79v9.72a2.5 2.5 0 0 0 1.54 2.296l8.206 3.458a2.5 2.5 0 0 0 1.008 0l8.206-3.458a2.5 2.5 0 0 0 1.54-2.296v-9.72a2.5 2.5 0 0 0-1.54-2.296L12.504 2.036Z',
    quizzes:
      'M12 6.036a10.04 10.04 0 0 0-7.07 2.93L3.46 7.5a.75.75 0 0 1 0-1.06l1.47-1.47A11.54 11.54 0 0 1 12 2.5a11.54 11.54 0 0 1 7.07 2.47l1.47 1.47a.75.75 0 0 1 0 1.06l-1.47 1.466A10.04 10.04 0 0 0 12 6.036Zm0 11.928a10.04 10.04 0 0 1-7.07-2.93L3.46 16.5a.75.75 0 0 1 0-1.06l1.47-1.47A11.54 11.54 0 0 1 12 16.436a11.54 11.54 0 0 1 7.07-2.466l1.47 1.47a.75.75 0 0 1 0 1.06l-1.47 1.47A10.04 10.04 0 0 1 12 17.964ZM4.93 4.93a.75.75 0 0 1 1.06 0l1.47 1.47a.75.75 0 0 1-1.06 1.06L4.93 5.99a.75.75 0 0 1 0-1.06Zm14.14 0a.75.75 0 0 1 0 1.06l-1.47 1.47a.75.75 0 0 1-1.06-1.06l1.47-1.47a.75.75 0 0 1 1.06 0ZM2.5 12a.75.75 0 0 1 .75-.75h2.08a.75.75 0 0 1 0 1.5H3.25A.75.75 0 0 1 2.5 12Zm16.25 0a.75.75 0 0 1 .75-.75h2.08a.75.75 0 0 1 0 1.5H18.75a.75.75 0 0 1-.75-.75Z',
    builder:
      'M16.85 2.224a1.55 1.55 0 0 0-2.193 0L4.22 12.66a1.55 1.55 0 0 0-.444.906l-.28 2.24a1.55 1.55 0 0 0 1.738 1.738l2.24-.28a1.55 1.55 0 0 0 .906-.444l10.436-10.436a1.55 1.55 0 0 0 0-2.193l-1.966-1.967ZM11.16 14.66a3.08 3.08 0 0 1-.906.444l-2.24.28a3.08 3.08 0 0 1-3.476-3.476l.28-2.24a3.08 3.08 0 0 1 .444-.906L15.7 3.324l3.933 3.933-8.473 7.403Z',
    groups:
      'M15.5 4.5a3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1 7 0Zm-5.396 6.055a6.5 6.5 0 0 1 5.792 0l1.176.588A3.5 3.5 0 0 1 19 14.393V15.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 15.5v-1.107a3.5 3.5 0 0 1 1.928-3.25l1.176-.588ZM15.5 8a5.5 5.5 0 0 0-3.5 1.258A5.5 5.5 0 0 0 8.5 8a5.5 5.5 0 0 0-5.5 5.5V15.5a4.5 4.5 0 0 0 4.5 4.5h9a4.5 4.5 0 0 0 4.5-4.5v-2a5.5 5.5 0 0 0-5.5-5.5Z',
    discover: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
    'create-session':
      'M12 4.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Zm-1.5 7.5h-3a.75.75 0 0 1 0-1.5h3v-3a.75.75 0 0 1 1.5 0v3h3a.75.75 0 0 1 0 1.5h-3v3a.75.75 0 0 1-1.5 0v-3Z',
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
    // Navigate to settings if route exists, otherwise show placeholder
    this.router.navigateByUrl('/dashboard/settings').catch(() => {
      // Settings route may not exist yet
    });
  }
}
