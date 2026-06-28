import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { USER } from './auth/user';
import { QUIZ } from './quiz';

// Enum for edge relationship types
export const KNOWLEDGE_RELATIONSHIP_TYPE = pgEnum('knowledge_relationship_type', [
  'prerequisite',
  'related',
  'part-of',
  'contradicts',
]);

export type KnowledgeRelationshipType =
  | 'prerequisite'
  | 'related'
  | 'part-of'
  | 'contradicts';

/**
 * Knowledge node represents a concept extracted from quiz performance.
 * Each node tracks mastery score and attempt statistics per user per quiz.
 */
export const KNOWLEDGE_NODE = pgTable(
  'knowledge_node',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => USER.id, { onDelete: 'cascade' }),
    quiz_id: bigint('quiz_id', { mode: 'number' })
      .notNull()
      .references(() => QUIZ.id, { onDelete: 'cascade' }),
    concept_label: text('concept_label').notNull(),
    mastery_score: integer('mastery_score').notNull().default(0),
    total_attempts: integer('total_attempts').notNull().default(0),
    correct_attempts: integer('correct_attempts').notNull().default(0),
    last_analyzed_at: timestamp('last_analyzed_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('knowledge_node_user_idx').on(table.user_id),
    index('knowledge_node_quiz_idx').on(table.quiz_id),
  ]
);

/**
 * Knowledge edge represents a relationship between two knowledge nodes.
 * Edges are directional: source_node_id → target_node_id.
 */
export const KNOWLEDGE_EDGE = pgTable(
  'knowledge_edge',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => USER.id, { onDelete: 'cascade' }),
    source_node_id: bigint('source_node_id', { mode: 'number' })
      .notNull()
      .references(() => KNOWLEDGE_NODE.id, { onDelete: 'cascade' }),
    target_node_id: bigint('target_node_id', { mode: 'number' })
      .notNull()
      .references(() => KNOWLEDGE_NODE.id, { onDelete: 'cascade' }),
    relationship_type: KNOWLEDGE_RELATIONSHIP_TYPE('relationship_type').notNull(),
    strength: real('strength').notNull().default(0),
    ai_explanation: text('ai_explanation'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('knowledge_edge_user_idx').on(table.user_id),
    index('knowledge_edge_source_idx').on(table.source_node_id),
    index('knowledge_edge_target_idx').on(table.target_node_id),
  ]
);

// Type exports for tables
export type KnowledgeNode = typeof KNOWLEDGE_NODE.$inferSelect;
export type InsertKnowledgeNode = typeof KNOWLEDGE_NODE.$inferInsert;

export type KnowledgeEdge = typeof KNOWLEDGE_EDGE.$inferSelect;
export type InsertKnowledgeEdge = typeof KNOWLEDGE_EDGE.$inferInsert;
