import { bigint, index, pgEnum, pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { USER } from './auth/user';

export const questionType = pgEnum('question_type', ['multiple-choice', 'true-false', 'open']);
// Type exports from enum values
export type questionType = 'multiple-choice' | 'true-false' | 'open';

export const QUIZ = pgTable(
  'quiz',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    title: text('title').notNull(),
    description: text('description'),
    creator_id: uuid('creator_id')
      .references(() => USER.id, { onDelete: 'cascade' })
      .notNull(),
    share_code: text('share_code'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('quiz_creator_idx').on(table.creator_id),
    index('quiz_share_code_idx').on(table.share_code),
  ]
);

export const QUESTION = pgTable(
  'question',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    quiz_id: bigint('quiz_id', { mode: 'number' })
      .notNull()
      .references(() => QUIZ.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    type: questionType('type').notNull(),
    options: jsonb('options').notNull(),
    correct_answer: text('correct_answer'),
    time_limit: bigint('time_limit', { mode: 'number' }),
    points: bigint('points', { mode: 'number' }).notNull().default(0),
    order_index: bigint('order_index', { mode: 'number' }).notNull(),
  },
  (table) => [index('question_quiz_idx').on(table.quiz_id)]
);

// Type exports for tables
export type QUIZ = typeof QUIZ.$inferSelect;
export type insertQuiz = typeof QUIZ.$inferInsert;

export type QUESTION = typeof QUESTION.$inferSelect;
export type insertQuestion = typeof QUESTION.$inferInsert;
