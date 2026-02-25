import { pgSchema, uuid, text, timestamp } from 'drizzle-orm/pg-core';

const authSchema = pgSchema('auth');

export const USER = authSchema.table('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof USER.$inferSelect;
