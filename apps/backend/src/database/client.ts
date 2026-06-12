import { config } from '../config/config';
import { createChildLogger } from '../config/logger';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const dbLogger = createChildLogger('database');
const CONNECTION_STRING = config.DATABASE_URL;

if (!CONNECTION_STRING) {
  throw new Error('DATABASE_URL is not defined in the environment variables');
}

// postgres-js client with connection pool settings for Supavisor Transaction mode.
// Must use port 6543 (Transaction mode pooler), NOT port 5432 (Session mode).
// Transaction mode multiplexes connections — essential for Supabase free tier
// which limits Session mode to 15 concurrent connections.
const queryClient = postgres(CONNECTION_STRING, {
  prepare: false, // Required for Supavisor Transaction mode
  max: 10, // Max connections in pool (well within free tier's 15 for session mode)
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  debug: (connection, query, parameters) => {
    if (process.env.NODE_ENV === 'development') {
      dbLogger.debug({ query, parameters }, 'Database query');
    }
  },
});

// Export the Drizzle ORM instance
export const db = drizzle(queryClient);

dbLogger.info({ max: 10, idle_timeout: 20 }, 'Database client initialized');

// Graceful shutdown: close the connection pool on termination signals.
async function gracefulShutdown(signal: string): Promise<void> {
  try {
    dbLogger.info({ signal }, 'Closing database connection pool...');
    await queryClient.end({ timeout: 5 });
    dbLogger.info('Database connection pool closed gracefully');
  } catch (err) {
    dbLogger.error({ err, signal }, 'Error closing database connection pool');
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
