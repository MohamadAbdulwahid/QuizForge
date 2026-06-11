import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ApiService } from '../services/api.service';

/**
 * Guard that restricts access to admin users only.
 * Calls GET /api/admin/check — returns true if 200, redirects to /dashboard if 403.
 */
export const adminGuard: CanActivateFn = () => {
  const api = inject(ApiService);
  const router = inject(Router);

  return api.get<{ isAdmin: boolean }>('/api/admin/check').pipe(
    map(() => true),
    catchError(() => {
      void router.navigateByUrl('/dashboard');
      return of(false);
    })
  );
};
