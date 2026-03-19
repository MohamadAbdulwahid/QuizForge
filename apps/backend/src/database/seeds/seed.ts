import { seedUsers } from './users.seed';
import { seedQuizzes } from './quizzes.seed';
import { createChildLogger } from '../../config/logger';

const seedLogger = createChildLogger('seed');

/**
 * Main seed aggregator
 * Runs user seeds first (dependency), then quizzes in order
 */
async function main() {
  seedLogger.info('Starting database seed...');

  try {
    // Users must be seeded first (quizzes depend on user IDs)
    const userIds = await seedUsers();

    // Seed quizzes with the created user IDs
    await seedQuizzes(userIds);

    seedLogger.info('All seeds completed successfully');
    process.exit(0);
  } catch (err) {
    seedLogger.error({ err }, 'Seed failed');
    process.exit(1);
  }
}

main();
