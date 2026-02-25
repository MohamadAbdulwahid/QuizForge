import { bigint, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { USER } from './auth/user';
import { QUIZ } from './quiz';

// Enums for session and player status
export const SESSION_STATUS = pgEnum('SESSION_STATUS', [
  'pending',
  'waiting',
  'in-progress',
  'ended',
]);
export const PLAYER_STATUS = pgEnum('PLAYER_STATUS', ['active', 'disconnected', 'eliminated']);
// Type exports from enum values
export type SessionStatus = 'pending' | 'waiting' | 'in-progress' | 'ended';
export type PlayerStatus = 'active' | 'disconnected' | 'eliminated';

// Session and related tables
export const SESSION = pgTable('session', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  quiz_id: bigint('quiz_id', { mode: 'number' })
    .notNull()
    .references(() => QUIZ.id, { onDelete: 'cascade' }),
  pin: text('pin').notNull(),
  status: text('status').notNull().default('pending'),
  host_id: uuid('host_id')
    .notNull()
    .references(() => USER.id, { onDelete: 'cascade' }),
  started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
});

export const SESSION_PLAYER = pgTable('session_player', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  session_id: bigint('session_id', { mode: 'number' })
    .notNull()
    .references(() => SESSION.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id')
    .notNull()
    .references(() => USER.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),
  score: bigint('score', { mode: 'number' }).notNull().default(0),
  lives: bigint('lives', { mode: 'number' }),
  status: text('status').notNull().default('active'),
});

export const GAME_EVENT = pgTable('game_event', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  session_id: bigint('session_id', { mode: 'number' })
    .notNull()
    .references(() => SESSION.id, { onDelete: 'cascade' }),
  session_player_id: bigint('session_player_id', { mode: 'number' }).references(
    () => SESSION_PLAYER.id,
    { onDelete: 'set null' }
  ),
  event_type: text('event_type').notNull(),
  data: jsonb('data'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Type exports for tables
export type Session = typeof SESSION.$inferSelect;
export type InsertSession = typeof SESSION.$inferInsert;

export type SessionPlayer = typeof SESSION_PLAYER.$inferSelect;
export type InsertSessionPlayer = typeof SESSION_PLAYER.$inferInsert;

export type GameEvent = typeof GAME_EVENT.$inferSelect;
export type InsertGameEvent = typeof GAME_EVENT.$inferInsert;
