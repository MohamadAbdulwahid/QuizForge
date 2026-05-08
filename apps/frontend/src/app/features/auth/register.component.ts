import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
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
      this.errorMessage.set(this.resolveAuthError(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected isFieldInvalid(controlName: 'email' | 'username' | 'password'): boolean {
    const control = this.form.get(controlName);
    return Boolean(control && control.touched && control.invalid);
  }

  private resolveAuthError(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const candidate = error as { message?: string };
      if (candidate.message) {
        return candidate.message;
      }
    }

    return 'Signup failed. Please double-check your details and try again.';
  }
}
