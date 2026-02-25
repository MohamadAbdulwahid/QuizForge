/**
 * Read-only reference to Supabase's built-in `auth.users` table.
 * This file lives OUTSIDE the `schema/` directory intentionally so
 * drizzle-kit does not generate a migration to create/alter this table.
 * Supabase manages auth.users itself.
 */
import { pgSchema, uuid, text, timestamp } from 'drizzle-orm/pg-core';

const authSchema = pgSchema('auth');

export const USER = authSchema.table('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof USER.$inferSelect;
