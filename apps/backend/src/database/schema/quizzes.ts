import { integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './users';

export const questionTypeEnum = pgEnum('question_type', ['multiple-choice', 'true-false', 'open']);

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
