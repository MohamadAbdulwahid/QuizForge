import { config } from './src/config/config';
import { Config, defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './supabase/migrations',
  schemaFilter: ["public"],
  schema: './src/database/schema',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.DATABASE_URL,
  },
}) satisfies Config;
