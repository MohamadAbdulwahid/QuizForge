import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { USER } from './auth/user';

export const PROFILE = pgTable('profile', {
  user_id: uuid('user_id')
    .primaryKey()
    .references(() => USER.id, { onDelete: 'cascade' }),
  username: text('username').notNull().unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PROFILE = typeof PROFILE.$inferSelect;
export type InsertProfile = typeof PROFILE.$inferInsert;
