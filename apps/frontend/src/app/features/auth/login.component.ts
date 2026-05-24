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
  selector: 'app-login',
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
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected async submit(): Promise<void> {
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please enter a valid email and password.');
      return;
    }

    const { email, password } = this.form.getRawValue();

    this.isSubmitting.set(true);

    try {
      await this.authService.signIn({
        email: email ?? '',
        password: password ?? '',
      });
      await this.router.navigateByUrl('/dashboard');
    } catch (error: unknown) {
      this.errorMessage.set(
        resolveAuthError(error, 'Login failed. Please check your credentials and try again.')
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected isFieldInvalid(controlName: 'email' | 'password'): boolean {
    const control = this.form.get(controlName);
    return Boolean(control && control.touched && control.invalid);
  }
}
