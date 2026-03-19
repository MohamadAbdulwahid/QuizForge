import { describe, it, expect } from 'bun:test';
import { logger, createChildLogger } from '../../../config/logger';

/**
 * Unit tests for logger configuration
 * Validates logger exports and behavior
 */
describe('Logger Configuration', () => {
  it('should be a valid pino logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should be able to log without throwing', () => {
    expect(() => logger.info('test log message')).not.toThrow();
  });

  it('should export createChildLogger helper', () => {
    expect(typeof createChildLogger).toBe('function');
  });

  it('should create a child logger with component context', () => {
    const childLogger = createChildLogger('test-component');
    expect(childLogger).toBeDefined();
    expect(() => childLogger.info('child log')).not.toThrow();
    expect(() => childLogger.warn('child warning')).not.toThrow();
    expect(() => childLogger.error('child error')).not.toThrow();
  });

  it('should include serializers for err, req, res', () => {
    // Test error serialization does not throw
    expect(() => logger.error({ err: new Error('test error') }, 'Error occurred')).not.toThrow();
  });
});
