import { bigint, index, pgEnum, pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { USER } from './auth/user';

export const questionType = pgEnum('question_type', [
  'multiple-choice',
  'true-false',
  'open',
  'ordering',
  'matching',
  'fill-in-blank',
]);
// Type exports from enum values
export type questionType =
  | 'multiple-choice'
  | 'true-false'
  | 'open'
  | 'ordering'
  | 'matching'
  | 'fill-in-blank';

export const quizVisibility = pgEnum('quiz_visibility', ['private', 'unlisted', 'public']);
export type quizVisibility = 'private' | 'unlisted' | 'public';

export const quizStatus = pgEnum('quiz_status', ['draft', 'published']);
export type quizStatus = 'draft' | 'published';

/**
 * AI-driven quiz transformations (remix, translate). A quiz with a non-null
 * `transformation_type` was created by AI from another quiz — the
 * `parent_quiz_id` points to the source. Original (human-authored) quizzes
 * have `transformation_type = null`.
 */
export const quizTransformationType = pgEnum('quiz_transformation_type', ['remix', 'translate']);
export type quizTransformationType = 'remix' | 'translate';

export const QUIZ = pgTable(
  'quiz',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    title: text('title').notNull(),
    description: text('description'),
    visibility: quizVisibility('visibility').notNull().default('unlisted'),
    status: quizStatus('status').notNull().default('published'),
    play_count: bigint('play_count', { mode: 'number' }).notNull().default(0),
    creator_id: uuid('creator_id')
      .references(() => USER.id, { onDelete: 'cascade' })
      .notNull(),
    share_code: text('share_code'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    // ── AI transformation lineage ───────────────────────────────────────
    // Set on AI-generated remixes/translations. `onDelete: 'set null'` keeps
    // a remix alive if the source quiz is deleted (lineage becomes orphaned).
    parent_quiz_id: bigint('parent_quiz_id', { mode: 'number' }).references(() => QUIZ.id, {
      onDelete: 'set null',
    }),
    transformation_type: quizTransformationType('transformation_type'),
    // BCP-47 language tag of the quiz content (e.g. 'en', 'es', 'fr', 'zh-CN').
    // Defaults to English; translations set this to the target language.
    language: text('language').notNull().default('en'),
  },
  (table) => [
    index('quiz_creator_idx').on(table.creator_id),
    index('quiz_share_code_idx').on(table.share_code),
    index('quiz_discover_feed_idx').on(table.status, table.visibility, table.created_at.desc()),
    // Speeds up the dedup lookup "does an owner already have a translation
    // of this source quiz to language X?" used by the AI translate endpoint.
    index('quiz_parent_idx').on(table.parent_quiz_id),
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
