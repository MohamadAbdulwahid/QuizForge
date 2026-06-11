import { ErrorHandler, PLATFORM_ID, Provider } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as Sentry from '@sentry/angular';
import { environment } from '../../../environments/environment';

/**
 * Initialize Sentry for Angular frontend error monitoring.
 * Only enabled when VITE_SENTRY_DSN is set in environment.
 * Returns providers to add to app config, or empty array if Sentry is disabled.
 * Skips ErrorHandler provider during SSR (browser-only).
 */
export function initSentry(): Provider[] {
  const dsn = environment.sentryDsn;

  if (!dsn) {
    return [];
  }

  Sentry.init({
    dsn,
    environment: environment.production ? 'production' : 'development',
    tracesSampleRate: 0.2,
    integrations: [Sentry.browserTracingIntegration()],
  });

  return [
    {
      provide: ErrorHandler,
      useFactory: (platformId: object) => {
        if (isPlatformBrowser(platformId)) {
          return new Sentry.SentryErrorHandler();
        }
        return new ErrorHandler();
      },
      deps: [PLATFORM_ID],
    },
  ];
}
