/**
 * Read-only reference to Supabase's built-in `auth.users` table.
 * This directory is excluded from drizzle-kit migrations via glob pattern in drizzle.config.ts.
 * Supabase manages auth.users itself — username is stored in user_metadata, not as a column.
 */
import { pgSchema, uuid, text, timestamp } from 'drizzle-orm/pg-core';

const authSchema = pgSchema('auth');

export const USER = authSchema.table('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof USER.$inferSelect;
