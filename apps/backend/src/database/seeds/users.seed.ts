import { authAdminClient } from '../../config/supabase';
import { createChildLogger } from '../../config/logger';

const seedLogger = createChildLogger('seed-users');

/**
 * Test users to seed
 */
const TEST_USERS = [
  { email: 'test1@example.com', password: 'Password123!', username: 'test_user_1' },
  { email: 'test2@example.com', password: 'Password123!', username: 'test_user_2' },
  { email: 'test3@example.com', password: 'Password123!', username: 'test_user_3' },
];

/**
 * Seeds test users into Supabase Auth
 * Idempotent: skips users that already exist
 *
 * @returns Array of seeded user IDs
 */
export async function seedUsers(): Promise<string[]> {
  const userIds: string[] = [];

  for (const testUser of TEST_USERS) {
    // Check if user already exists
    const { data: existingUsers } = await authAdminClient.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u: { email?: string }) => u.email === testUser.email
    );

    if (existing) {
      seedLogger.info({ email: testUser.email }, 'User already exists, skipping');
      userIds.push(existing.id);
      continue;
    }

    const { data, error } = await authAdminClient.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      user_metadata: { username: testUser.username },
      email_confirm: true,
    });

    if (error) {
      seedLogger.error({ err: error, email: testUser.email }, 'Failed to seed user');
      continue;
    }

    seedLogger.info({ email: testUser.email, userId: data.user.id }, 'User seeded');
    userIds.push(data.user.id);
  }

  seedLogger.info({ count: userIds.length }, 'User seeding complete');
  return userIds;
}
