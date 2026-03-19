/**
 * Logger Usage Examples
 * Run with different NODE_ENV to see output differences
 *
 * Development: NODE_ENV=development bun run src/config/logger.example.ts
 * Production:  NODE_ENV=production bun run src/config/logger.example.ts
 */

import { logger, createChildLogger } from './logger.js';

// Basic logging
logger.info('Application started');
logger.error({ err: new Error('Test error') }, 'An error occurred');

// Component-specific logging
const authLogger = createChildLogger('auth');
authLogger.info({ userId: '123', action: 'login' }, 'User authenticated');

const dbLogger = createChildLogger('database');
dbLogger.warn({ duration: 523, query: 'SELECT * FROM users' }, 'Slow query detected');

// Different log levels
logger.trace('Trace level message');
logger.debug({ data: { foo: 'bar' } }, 'Debug information');
logger.warn('Warning message');
logger.error('Error message');
logger.fatal('Fatal error');

logger.info('--- Logger Test Complete ---');
logger.info({ nodeEnv: process.env.NODE_ENV }, 'Runtime environment');
logger.info('Development mode: Pretty-printed colored logs');
logger.info('Production mode: Raw JSON logs');
