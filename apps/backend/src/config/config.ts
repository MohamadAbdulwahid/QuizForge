import { z } from 'zod';

/**
 * Zod schema for all environment variables
 * Validates and transforms env vars on startup
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
  SENTRY_DSN: z.string().optional(),

  // AI Quiz Generation (vendor-neutral, OpenAI-compatible API)
  // Optional — when missing the AI generate endpoint returns a descriptive error.
  AI_API_URL: z.string().url().optional(),
  AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).default('gpt-4o'),
});

type Config = z.infer<typeof envSchema>;

/**
 * Validate and parse environment variables
 * Process exits with error if validation fails
 */
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const config: Config = parsedEnv.data;
