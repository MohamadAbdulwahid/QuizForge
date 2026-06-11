import * as Sentry from '@sentry/node';
import { config } from './config';

/**
 * Initialize Sentry for error monitoring.
 * Only enabled when SENTRY_DSN is set in environment.
 * No-op if SENTRY_DSN is undefined (development without Sentry).
 */
export function initSentry(): void {
  if (!config.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.2 : 1.0,
    enabled: config.NODE_ENV !== 'test',
  });
}

/**
 * Report an error to Sentry.
 * Safe to call even if Sentry is not initialized (no-op).
 */
export function reportError(error: Error, context?: Record<string, unknown>): void {
  if (!config.SENTRY_DSN) {
    return;
  }

  if (context) {
    Sentry.setExtras(context);
  }

  Sentry.captureException(error);
}

/**
 * Report a message to Sentry (non-error events).
 */
export function reportMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (!config.SENTRY_DSN) {
    return;
  }

  Sentry.captureMessage(message, level);
}
