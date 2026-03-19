import { config } from '../config/config';
import { createChildLogger } from '../config/logger';
import { drizzle } from 'drizzle-orm/bun-sql';
import { SQL } from 'bun';

const dbLogger = createChildLogger('database');
const CONNECTION_STRING = config.DATABASE_URL;

if (!CONNECTION_STRING) {
  throw new Error('DATABASE_URL is not defined in the environment variables');
}

// Bun SQL client instance with prepared statements disabled (supabase pooling)
const client = new SQL(CONNECTION_STRING, {
  prepare: false,
  onconnect(err) {
    if (err) {
      throw err;
    } else {
      dbLogger.info('Database connection established successfully');
    }
  },
  onclose(err) {
    if (err) {
      dbLogger.error({ err }, 'Database connection closed with error');
    } else {
      dbLogger.info('Database connection closed gracefully');
    }
  },
});

// Export the Drizzle ORM instance
export const db = drizzle({ client });

// Handle graceful shutdown on SIGTERM
process.on('SIGTERM', async () => {
  try {
    dbLogger.info('Closing database client on SIGTERM...');
    await client.end();
  } catch (err) {
    dbLogger.error({ err }, 'Error closing database client on SIGTERM');
  } finally {
    process.exit(0);
  }
});
