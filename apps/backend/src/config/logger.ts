/**
 * Pino Logger Configuration
 * Development: Pretty-printed colored logs with timestamps
 * Production: Raw JSON logs for log aggregation tools
 */

import pino from 'pino';
import { config } from './config.js';

/**
 * Create Pino logger with environment-specific configuration
 * - Development: Uses pino-pretty transport for human-readable output
 * - Production: Emits raw JSON logs
 */
const logger = pino({
  level: config.LOG_LEVEL,
  base: {
    service: 'quizforge-backend',
    env: config.NODE_ENV,
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // Use pino-pretty transport in development for better readability
  transport:
    config.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            levelFirst: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        }
      : undefined,
});

/**
 * Create a child logger with a specific component context
 * Useful for adding structured context to logs
 *
 * @example
 * const authLogger = createChildLogger('auth');
 * authLogger.info({ userId: '123' }, 'User authenticated');
 *
 * @param component - Name of the component (e.g., 'auth', 'database', 'websocket')
 * @returns Child logger instance
 */
export const createChildLogger = (component: string): pino.Logger => {
  return logger.child({ component });
};

/**
 * Export the main logger instance
 * Use createChildLogger() for component-specific logging
 */
export { logger };
