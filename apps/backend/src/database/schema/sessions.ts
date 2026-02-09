import { integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './users';
import { quiz } from './quizzes';

export const sessionStatusEnum = pgEnum('session_status', ['waiting', 'in-progress', 'ended']);
export const playerStatusEnum = pgEnum('player_status', ['active', 'disconnected', 'eliminated']);

export const session = pgTable('session', {
  id: serial('id').primaryKey(),
  quiz_id: integer('quiz_id')
    .notNull()
    .references(() => quiz.id, { onDelete: 'cascade' }),
  pin: text('pin').notNull(),
  status: sessionStatusEnum('status').notNull().default('waiting'),
  host_id: integer('host_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  started_at: timestamp('started_at'),
});

export const playerSession = pgTable('player_session', {
  id: serial('id').primaryKey(),
  session_id: integer('session_id')
    .notNull()
    .references(() => session.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),
  score: integer('score').notNull().default(0),
  lives: integer('lives').notNull().default(3),
  status: playerStatusEnum('status').notNull().default('active'),
});

export const gameEvent = pgTable('game_event', {
  id: serial('id').primaryKey(),
  session_id: integer('session_id')
    .notNull()
    .references(() => session.id, { onDelete: 'cascade' }),
  player_id: integer('player_id')
    .notNull()
    .references(() => playerSession.id, { onDelete: 'cascade' }),
  event_type: text('event_type').notNull(),
  data: jsonb('data'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});
