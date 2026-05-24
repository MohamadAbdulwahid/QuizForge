import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { resolveAuthError } from '../../shared/utils/auth-errors';
import { BubblyAlertComponent } from '../../shared/ui/bubbly-alert.component';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';
import { BubblyInputComponent } from '../../shared/ui/bubbly-input.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    BubblyAlertComponent,
    BubblyButtonComponent,
    BubblyCardComponent,
    BubblyInputComponent,
  ],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected async submit(): Promise<void> {
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please complete all fields to continue.');
      return;
    }

    const { email, password, username } = this.form.getRawValue();

    this.isSubmitting.set(true);

    try {
      await this.authService.signUp({
        email: email ?? '',
        password: password ?? '',
        username: username ?? '',
      });

      if (this.authService.isAuthenticated()) {
        await this.router.navigateByUrl('/dashboard');
        return;
      }

      this.infoMessage.set('Check your email to confirm your account, then log in.');
    } catch (error: unknown) {
      this.errorMessage.set(
        resolveAuthError(error, 'Signup failed. Please double-check your details and try again.')
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected isFieldInvalid(controlName: 'email' | 'username' | 'password'): boolean {
    const control = this.form.get(controlName);
    return Boolean(control && control.touched && control.invalid);
  }
}
