import { ErrorHandler, inject, PLATFORM_ID, Provider } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as Sentry from '@sentry/angular';
import { ConfigService } from './config.service';

let sentryInitialized = false;

/**
 * Initialize Sentry for Angular frontend error monitoring.
 * Defers to ConfigService for the DSN (not environment.sentryDsn).
 * Returns providers to add to app config. The ErrorHandler is created
 * lazily after ConfigService is ready, reading the DSN at that point.
 * Skips ErrorHandler provider during SSR (browser-only).
 */
export function initSentry(): Provider[] {
  return [
    {
      provide: ErrorHandler,
      useFactory: (platformId: object) => {
        if (!isPlatformBrowser(platformId)) {
          return new ErrorHandler();
        }

        if (!sentryInitialized) {
          const configService = inject(ConfigService);
          const dsn = configService.getSentryDsn();

          if (dsn) {
            Sentry.init({
              dsn,
              environment: 'production',
              tracesSampleRate: 0.2,
              integrations: [Sentry.browserTracingIntegration()],
            });
          }

          sentryInitialized = true;
        }

        return new Sentry.SentryErrorHandler();
      },
      deps: [PLATFORM_ID],
    },
  ];
}
