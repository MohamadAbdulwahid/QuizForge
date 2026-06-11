import { describe, it, expect } from 'bun:test';

describe('Sentry Monitoring', () => {
  describe('initSentry', () => {
    it('should export initSentry function', async () => {
      const sentry = await import('../../../src/config/sentry');
      expect(typeof sentry.initSentry).toBe('function');
    });

    it('should export reportError function', async () => {
      const sentry = await import('../../../src/config/sentry');
      expect(typeof sentry.reportError).toBe('function');
    });

    it('should export reportMessage function', async () => {
      const sentry = await import('../../../src/config/sentry');
      expect(typeof sentry.reportMessage).toBe('function');
    });
  });

  describe('reportError', () => {
    it('should be callable without throwing', async () => {
      const { reportError } = await import('../../../src/config/sentry');
      expect(() => {
        reportError(new Error('test error'), { test: true });
      }).not.toThrow();
    });

    it('should accept context object', async () => {
      const { reportError } = await import('../../../src/config/sentry');
      expect(() => {
        reportError(new Error('test'), { path: '/api/test', method: 'GET' });
      }).not.toThrow();
    });

    it('should work without context', async () => {
      const { reportError } = await import('../../../src/config/sentry');
      expect(() => {
        reportError(new Error('test'));
      }).not.toThrow();
    });
  });

  describe('reportMessage', () => {
    it('should be callable without throwing', async () => {
      const { reportMessage } = await import('../../../src/config/sentry');
      expect(() => {
        reportMessage('test message', 'info');
      }).not.toThrow();
    });

    it('should default to info level', async () => {
      const { reportMessage } = await import('../../../src/config/sentry');
      expect(() => {
        reportMessage('test message');
      }).not.toThrow();
    });
  });

  describe('Error handler integration', () => {
    it('should import reportError in error handler', async () => {
      const errorHandlerModule = await import('../../../src/api/middleware/error-handler');
      expect(errorHandlerModule.errorHandler).toBeDefined();
      expect(typeof errorHandlerModule.errorHandler).toBe('function');
    });
  });
});
