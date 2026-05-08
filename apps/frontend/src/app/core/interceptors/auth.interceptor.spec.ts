import '@angular/compiler';

import { HttpRequest, HttpResponse } from '@angular/common/http';
import { Injector, runInInjectionContext } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches the Supabase access token to backend API requests', async () => {
    const authServiceStub = {
      getAccessToken: vi.fn().mockResolvedValue('token-123'),
    };
    const next = vi.fn((request: HttpRequest<unknown>) =>
      of(new HttpResponse({ status: 200, body: request }))
    );

    const injector = Injector.create({
      providers: [{ provide: AuthService, useValue: authServiceStub }],
    });

    const request = new HttpRequest('GET', `${environment.apiBaseUrl}/api/quizzes`);
    const response = await runInInjectionContext(injector, () =>
      firstValueFrom(authInterceptor(request, next))
    );

    expect(authServiceStub.getAccessToken).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect((response as HttpResponse<unknown>).status).toBe(200);

    const forwardedRequest = next.mock.calls[0]?.[0] as HttpRequest<unknown>;
    expect(forwardedRequest.headers.get('Authorization')).toBe('Bearer token-123');
  });

  it('leaves non-backend requests unchanged', async () => {
    const authServiceStub = {
      getAccessToken: vi.fn(),
    };
    const next = vi.fn((request: HttpRequest<unknown>) =>
      of(new HttpResponse({ status: 200, body: request }))
    );

    const injector = Injector.create({
      providers: [{ provide: AuthService, useValue: authServiceStub }],
    });

    const request = new HttpRequest('GET', 'https://example.com/assets/logo.svg');
    await runInInjectionContext(injector, () => firstValueFrom(authInterceptor(request, next)));

    expect(authServiceStub.getAccessToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);

    const forwardedRequest = next.mock.calls[0]?.[0] as HttpRequest<unknown>;
    expect(forwardedRequest.headers.has('Authorization')).toBe(false);
  });
});
