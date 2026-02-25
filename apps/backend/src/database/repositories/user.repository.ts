import { USER, User } from '../schema/user';
import { db } from '../client';
import { eq } from 'drizzle-orm';

/**
 * Retrieves a user from the database by their unique identifier.
 * @param userUUID - The unique identifier of the user to retrieve
 * @returns A promise that resolves to the user object if found
 * @throws May throw an error if the database query fails
 */
export async function getUserById(userUUID: string): Promise<User | 'not found'> {
  const result = await db.select().from(USER).where(eq(USER.id, userUUID)).limit(1);

  if (!result[0]) {
    return 'not found';
  }
  return result[0];
}
/**
 * Finds a user by their email address.
 * @param {string} email - The email address of the user to find.
 * @returns {Promise<User>} A promise that resolves to an array of users matching the email.
 * @throws May throw an error if the database query fails
 */
export async function getUserByEmail(email: string): Promise<User | 'not found'> {
  const result = await db.select().from(USER).where(eq(USER.email, email)).limit(1);

  if (!result[0]) {
    return 'not found';
  }
  return result[0];
}

/**
 * Creates a new user in the database.
 * @param email - The email address of the user
 * @param username - The username for the user account
 * @param password - The password for the user account
 * @returns A query that inserts the user and returns the created user record
 */
// TODO: Implement once auth is set up
