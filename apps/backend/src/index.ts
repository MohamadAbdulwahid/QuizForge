import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from './config/config';

let connectionString = config.POSTGRES_URL;
if (!connectionString || connectionString.trim() === '') {
  throw new Error('Missing DATABASE_URL / POSTGRES_URL environment variable');
}
if (connectionString.includes('postgres:postgres@supabase_db_')) {
  const url = new URL(connectionString);
  url.hostname = url.hostname.split('_')[1];
  connectionString = url.href;
}

// Disable prefetch as it is not supported for "Transaction" pool mode
export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client);
