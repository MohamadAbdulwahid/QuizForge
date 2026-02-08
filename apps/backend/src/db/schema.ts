import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// Enums
export const questionTypeEnum = pgEnum('question_type', [
  'multiple-choice',
  'true-false',
  'open',
]);
export const sessionStatusEnum = pgEnum('session_status', [
  'waiting',
  'in-progress',
  'ended',
]);
export const playerStatusEnum = pgEnum('player_status', [
  'active',
  'disconnected',
  'eliminated',
]);

// USER
export const user = pgTable('user', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  username: text('username').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// QUIZ
export const quiz = pgTable('quiz', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  creator_id: integer('creator_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  share_code: text('share_code').notNull().unique(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// QUESTION
export const question = pgTable('question', {
  id: serial('id').primaryKey(),
  quiz_id: integer('quiz_id')
    .notNull()
    .references(() => quiz.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  type: questionTypeEnum('type').notNull(),
  options: jsonb('options'),
  correct_answer: text('correct_answer').notNull(),
  time_limit: integer('time_limit').default(30),
  points: integer('points').default(100),
  order: integer('order').notNull(),
});

// SESSION
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

// PLAYER_SESSION
export const player_session = pgTable('player_session', {
  id: serial('id').primaryKey(),
  session_id: integer('session_id')
    .notNull()
    .references(() => session.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),
  score: integer('score').notNull().default(0),
  lives: integer('lives').notNull().default(3),
  status: playerStatusEnum('status').notNull().default('active'),
});

// GAME_EVENT
export const game_event = pgTable('game_event', {
  id: serial('id').primaryKey(),
  session_id: integer('session_id')
    .notNull()
    .references(() => session.id, { onDelete: 'cascade' }),
  player_id: integer('player_id')
    .notNull()
    .references(() => player_session.id, { onDelete: 'cascade' }),
  event_type: text('event_type').notNull(),
  data: jsonb('data'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});
