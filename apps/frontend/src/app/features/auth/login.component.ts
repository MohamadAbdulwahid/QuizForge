import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
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
      this.errorMessage.set(this.resolveAuthError(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected isFieldInvalid(controlName: 'email' | 'password'): boolean {
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

    return 'Login failed. Please check your credentials and try again.';
  }
}
