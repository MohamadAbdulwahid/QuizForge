import { SQL } from 'bun';
import { config } from '../config/config';
import { drizzle } from 'drizzle-orm/bun-sql';

const connectionString = config.POSTGRES_URL;
if (!connectionString || connectionString.trim() === '') {
  throw new Error('Missing DATABASE_URL / POSTGRES_URL environment variable');
}
const postgresUrlRegex = /^postgresql:\/\/[^:]+:[^@]+@[^:]+:6543\/\w+/;
if (!postgresUrlRegex.test(connectionString)) {
  throw new Error(
    'Invalid POSTGRES_URL format. Expected: postgresql://user:password@host:6543/database'
  );
}

const client = new SQL(connectionString, {
  prepare: false,
  max: config.MAX_POOL_CONNECTIONS,
});

// Initialize Drizzle with Bun's SQL client
export const db = drizzle(client);
