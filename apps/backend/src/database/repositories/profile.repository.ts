import { eq, ilike } from 'drizzle-orm';
import { db } from '../client';
import { InsertProfile, PROFILE } from '../schema/profile';

export async function upsertProfile(data: InsertProfile): Promise<void> {
  await db
    .insert(PROFILE)
    .values(data)
    .onConflictDoUpdate({
      target: PROFILE.user_id,
      set: {
        username: data.username,
        updated_at: new Date(),
      },
    });
}

export async function findByUserId(userId: string) {
  const result = await db.select().from(PROFILE).where(eq(PROFILE.user_id, userId)).limit(1);
  return result[0] ?? null;
}

export async function findByUsername(username: string) {
  const result = await db.select().from(PROFILE).where(eq(PROFILE.username, username)).limit(1);
  return result[0] ?? null;
}

export async function searchProfiles(query: string, limit = 20) {
  return db
    .select()
    .from(PROFILE)
    .where(ilike(PROFILE.username, `%${query}%`))
    .limit(limit);
}
