import { config } from '../config/config';
import { drizzle } from 'drizzle-orm/bun-sql';
import { SQL } from 'bun';

const CONNECTION_STRING = config.POSTGRES_URL;

if (!CONNECTION_STRING) {
  throw new Error('POSTGRES_URL is not defined in the environment variables');
}

// Bun SQL client instance with prepared statements disabled (supabase pooling)
const client = new SQL(CONNECTION_STRING, {
  prepare: false,
  onconnect(err) {
    // TODO: Replace logs with pino logger once it's set up
    if (err) {
      throw err;
    } else {
      console.log('Database connection established successfully');
    }
  },
  onclose(err) {
    // TODO: Replace logs with pino logger once it's set up
    if (err) {
      console.error('Database connection closed with error:', err);
    } else {
      console.log('Database connection closed gracefully');
    }
  },
});

// Export the Drizzle ORM instance
export const db = drizzle({ client });

// Handle graceful shutdown on SIGTERM
process.on('SIGTERM', async () => {
  try {
    // TODO: Replace logs with pino logger once it's set up
    console.log('Closing database client on SIGTERM...');
    await client.end();
  } catch (err) {
    console.error('Error closing database client on SIGTERM:', err);
  } finally {
    process.exit(0);
  }
});
