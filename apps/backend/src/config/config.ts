import { z } from 'zod';

/**
 * Environment configuration loader
 * Bun automatically loads .env files, so we just need to validate and export the variables
 */

interface Config {
  DATABASE_URL: string;
  LOG_LEVEL: string;
  NODE_ENV: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
}

/**
 * Get an environment variable or throw an error if it's missing
 * @param name - The name of the environment variable
 * @returns The value of the environment variable
 */
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Initalize zod schema to test env variables
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().positive()),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  //LOG_LEVEL validation
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

/**
 * Validate and parse environment variables
 */
const parsedEnv = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: getEnvVar('PORT'),
  SUPABASE_URL: getEnvVar('SUPABASE_URL'),
  SUPABASE_PUBLISHABLE_KEY: getEnvVar('SUPABASE_PUBLISHABLE_KEY'),
  SUPABASE_SECRET_KEY: getEnvVar('SUPABASE_SECRET_KEY'),
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  FRONTEND_URL: getEnvVar('FRONTEND_URL'),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
});

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

/**
 * Zod schema for LOG_LEVEL validation
 */
const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

/**
 * Zod schema for NODE_ENV validation
 */
const nodeEnvSchema = z.enum(['development', 'production', 'test']);

export const config: Config = {
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  SUPABASE_URL: getEnvVar('SUPABASE_URL'),
  SUPABASE_PUBLISHABLE_KEY: getEnvVar('SUPABASE_PUBLISHABLE_KEY'),
  SUPABASE_SECRET_KEY: getEnvVar('SUPABASE_SECRET_KEY'),
  LOG_LEVEL: logLevelSchema.parse(getEnvVar('LOG_LEVEL')),
  NODE_ENV: nodeEnvSchema.parse(getEnvVar('NODE_ENV')),
};
