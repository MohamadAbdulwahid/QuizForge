import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

type AuthMode = 'login' | 'signup';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.css',
})
export class AuthPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly authMode = signal<AuthMode>('login');
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly formTitle = computed(() =>
    this.authMode() === 'login' ? 'Welcome Back' : 'Create Your Account'
  );

  protected readonly formModel = {
    email: '',
    password: '',
    username: '',
  };

  constructor() {
    if (this.authService.isAuthenticated()) {
      void this.router.navigateByUrl('/dashboard');
    }
  }

  protected setAuthMode(mode: AuthMode): void {
    this.authMode.set(mode);
    this.errorMessage.set(null);
  }

  protected submitAuthForm(): void {
    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    const request$ =
      this.authMode() === 'login'
        ? this.authService.signIn({
            email: this.formModel.email,
            password: this.formModel.password,
          })
        : this.authService.signUp({
            email: this.formModel.email,
            password: this.formModel.password,
            username: this.formModel.username,
          });

    request$
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
        })
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl('/dashboard');
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveAuthError(error));
        },
      });
  }

  private resolveAuthError(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const transportError = error as {
        error?: {
          error?: string;
        };
      };

      if (transportError.error?.error) {
        return transportError.error.error;
      }
    }

    return 'Authentication failed. Please verify credentials and try again.';
  }
}
