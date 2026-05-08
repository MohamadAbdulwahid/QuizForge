import { fireEvent, render, screen, waitFor } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  it('form submission fails and shows errors if inputs are invalid', async () => {
    const authServiceMock = {
      signIn: vi.fn(),
    };

    await render(LoginComponent, {
      providers: [{ provide: AuthService, useValue: authServiceMock }, provideRouter([])],
    });

    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByTestId('auth-error')).toBeTruthy();
    expect(authServiceMock.signIn).not.toHaveBeenCalled();
  });

  it('successful submission calls authService.signIn and routes properly', async () => {
    const authServiceMock = {
      signIn: vi.fn().mockResolvedValue(undefined),
    };
    await render(LoginComponent, {
      providers: [{ provide: AuthService, useValue: authServiceMock }, provideRouter([])],
    });

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.input(emailInput, { target: { value: 'player@example.com' } });
    fireEvent.input(passwordInput, { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(authServiceMock.signIn).toHaveBeenCalledWith({
        email: 'player@example.com',
        password: 'password',
      });
    });
    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/dashboard');
    });
  });
});
