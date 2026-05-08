import { fireEvent, render, screen, waitFor } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  it('form submission fails and shows errors if inputs are invalid', async () => {
    const authServiceMock = {
      signUp: vi.fn(),
      isAuthenticated: vi.fn().mockReturnValue(false),
    };

    await render(RegisterComponent, {
      providers: [{ provide: AuthService, useValue: authServiceMock }, provideRouter([])],
    });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText(/please complete all fields/i)).toBeTruthy();
    expect(authServiceMock.signUp).not.toHaveBeenCalled();
  });

  it('shows email confirmation message when signup does not authenticate', async () => {
    const authServiceMock = {
      signUp: vi.fn().mockResolvedValue(undefined),
      isAuthenticated: vi.fn().mockReturnValue(false),
    };

    await render(RegisterComponent, {
      providers: [{ provide: AuthService, useValue: authServiceMock }, provideRouter([])],
    });

    fireEvent.input(screen.getByLabelText(/email/i), {
      target: { value: 'teacher@example.com' },
    });
    fireEvent.input(screen.getByLabelText(/username/i), {
      target: { value: 'classroom_host' },
    });
    fireEvent.input(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(authServiceMock.signUp).toHaveBeenCalledWith({
        email: 'teacher@example.com',
        password: 'password123',
        username: 'classroom_host',
      });
    });

    expect(screen.getByText(/check your email to confirm your account/i)).toBeTruthy();
  });
});
