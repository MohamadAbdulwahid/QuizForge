import { describe, it, expect } from 'bun:test';
import { z } from 'zod';

/**
 * Unit tests for environment variable validation
 * Tests the Zod schema behavior directly
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().positive().default(3333),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

describe('Environment Configuration', () => {
  const validEnv = {
    NODE_ENV: 'development',
    PORT: '3333',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'test-key',
    SUPABASE_SECRET_KEY: 'test-secret',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    FRONTEND_URL: 'http://localhost:4200',
    LOG_LEVEL: 'info',
  };

  it('should accept valid environment variables', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('should fail when required SUPABASE_URL is missing', () => {
    const envWithoutUrl = { ...validEnv, SUPABASE_URL: undefined };
    const result = envSchema.safeParse(envWithoutUrl);
    expect(result.success).toBe(false);
  });

  it('should fail when SUPABASE_URL is not a valid URL', () => {
    const result = envSchema.safeParse({ ...validEnv, SUPABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('should default NODE_ENV to development when not set', () => {
    const envWithoutNodeEnv = { ...validEnv, NODE_ENV: undefined };
    const result = envSchema.safeParse(envWithoutNodeEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
    }
  });

  it('should default LOG_LEVEL to info when not set', () => {
    const envWithoutLogLevel = { ...validEnv, LOG_LEVEL: undefined };
    const result = envSchema.safeParse(envWithoutLogLevel);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LOG_LEVEL).toBe('info');
    }
  });

  it('should reject invalid NODE_ENV value', () => {
    const result = envSchema.safeParse({ ...validEnv, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('should coerce PORT from string to number', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3333);
    }
  });

  it('should fail when FRONTEND_URL is not a valid URL', () => {
    const result = envSchema.safeParse({ ...validEnv, FRONTEND_URL: 'bad' });
    expect(result.success).toBe(false);
  });
});
