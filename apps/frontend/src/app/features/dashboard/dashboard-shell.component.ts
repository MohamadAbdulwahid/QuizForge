import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface AppNavItem {
  label: string;
  description: string;
  route: string;
  exact?: boolean;
}

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard-shell.component.html',
  styleUrl: './dashboard-shell.component.css',
})
export class DashboardShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly currentUser = this.authService.currentUser;
  protected readonly mobileNavOpen = signal(false);
  protected readonly navItems: AppNavItem[] = [
    { label: 'Overview', description: 'Quick Join', route: '/dashboard', exact: true },
    { label: 'My Quizzes', description: 'Library', route: '/dashboard/quizzes' },
    { label: 'Quiz Builder', description: 'Create', route: '/builder/new' },
    { label: 'Groups', description: 'Classrooms', route: '/dashboard/groups' },
    { label: 'Discover', description: 'Find groups', route: '/dashboard/groups/discover' },
    { label: 'Create Session', description: 'Host', route: '/dashboard/create-session' },
    { label: 'Sessions', description: 'Control', route: '/dashboard/sessions' },
    { label: 'Leaderboards', description: 'Results', route: '/leaderboards' },
  ];

  protected readonly displayName = () => {
    const user = this.currentUser();
    return user?.user_metadata?.['username'] || user?.email || 'QuizForger';
  };

  protected closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  protected toggleMobileNav(): void {
    this.mobileNavOpen.update((open) => !open);
  }

  protected async logout(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl('/login');
  }
}
