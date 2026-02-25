import { config } from './src/config/config';
import { Config, defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './supabase/migrations',
  schemaFilter: ['public'],
  // Non-recursive glob: only matches top-level files in schema/.
  // schema/auth/user.ts is intentionally excluded — auth.users is managed by Supabase.
  schema: './src/database/schema/*.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.DATABASE_URL,
  },
}) satisfies Config;
