import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { resolveAuthError } from '../../shared/utils/auth-errors';
import { BubblyAlertComponent } from '../../shared/ui/bubbly-alert.component';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';
import { BubblyInputComponent } from '../../shared/ui/bubbly-input.component';

type AuthMode = 'login' | 'signup';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BubblyAlertComponent,
    BubblyButtonComponent,
    BubblyCardComponent,
    BubblyInputComponent,
  ],
  templateUrl: './auth-page.component.html',
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
    void this.authService.whenReady().then(() => {
      if (this.authService.isAuthenticated()) {
        void this.router.navigateByUrl('/dashboard');
      }
    });
  }

  protected setAuthMode(mode: AuthMode): void {
    this.authMode.set(mode);
    this.errorMessage.set(null);
  }

  protected submitAuthForm(): void {
    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    const request =
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

    request
      .then(() => {
        if (this.authService.isAuthenticated()) {
          void this.router.navigateByUrl('/dashboard');
          return;
        }

        this.errorMessage.set('Check your email to confirm your account before signing in.');
      })
      .catch((error: unknown) => {
        this.errorMessage.set(
          resolveAuthError(error, 'Authentication failed. Please verify credentials and try again.')
        );
      })
      .finally(() => {
        this.isSubmitting.set(false);
      });
  }
}
