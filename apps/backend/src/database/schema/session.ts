import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { USER } from './auth/user';
import { GROUP } from './group';
import { QUIZ } from './quiz';

// Enums for session and player status
export const SESSION_STATUS = pgEnum('SESSION_STATUS', [
  'pending',
  'waiting',
  'playing',
  'paused',
  'in-progress',
  'ended',
]);
export const PLAYER_STATUS = pgEnum('PLAYER_STATUS', ['active', 'disconnected', 'eliminated']);
export const SESSION_BROADCAST_MODE = pgEnum('session_broadcast_mode', [
  'private',
  'selected-groups',
  'all-my-groups',
]);
export const GAME_MODE = pgEnum('GAME_MODE', ['forge-classic', 'treasure-forge']);
// Type exports from enum values
export type SessionStatus = 'pending' | 'waiting' | 'playing' | 'paused' | 'in-progress' | 'ended';
export type PlayerStatus = 'active' | 'disconnected' | 'eliminated';
export type SessionBroadcastMode = 'private' | 'selected-groups' | 'all-my-groups';
export type GameMode = 'forge-classic' | 'treasure-forge';

// Session and related tables
export const SESSION = pgTable(
  'session',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    quiz_id: bigint('quiz_id', { mode: 'number' })
      .notNull()
      .references(() => QUIZ.id, { onDelete: 'cascade' }),
    pin: text('pin').notNull(),
    status: text('status').notNull().default('pending'),
    host_id: uuid('host_id')
      .notNull()
      .references(() => USER.id, { onDelete: 'cascade' }),
    broadcast_mode: SESSION_BROADCAST_MODE('broadcast_mode').notNull().default('private'),
    game_mode: GAME_MODE('game_mode').notNull().default('forge-classic'),
    started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    /** Treasure Forge: end condition mode — 'timer' or 'gold_goal' */
    tf_end_mode: text('tf_end_mode'),
    /** Treasure Forge: timer duration in minutes (1-30) */
    tf_timer_minutes: integer('tf_timer_minutes'),
    /** Treasure Forge: gold goal target */
    tf_gold_goal: integer('tf_gold_goal'),
  },
  (table) => [
    index('session_pin_idx').on(table.pin),
    index('session_status_idx').on(table.status),
    index('session_host_idx').on(table.host_id),
  ]
);

export const SESSION_BROADCAST_GROUP = pgTable('session_broadcast_group', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  session_id: bigint('session_id', { mode: 'number' })
    .notNull()
    .references(() => SESSION.id, { onDelete: 'cascade' }),
  group_id: bigint('group_id', { mode: 'number' })
    .notNull()
    .references(() => GROUP.id, { onDelete: 'cascade' }),
});

export const SESSION_PLAYER = pgTable(
  'session_player',
  {
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
  },
  (table) => [
    index('session_player_session_idx').on(table.session_id),
    index('session_player_user_idx').on(table.user_id),
  ]
);

export const GAME_EVENT = pgTable(
  'game_event',
  {
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
  },
  (table) => [index('game_event_session_idx').on(table.session_id)]
);

/** Outcome types for Treasure Forge chest picks. */
export type ChestOutcomeType = 'gold' | 'multiplier' | 'steal' | 'swap' | 'loss' | 'nothing';

export const CHEST_PICK = pgTable(
  'chest_pick',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    session_id: bigint('session_id', { mode: 'number' })
      .notNull()
      .references(() => SESSION.id, { onDelete: 'cascade' }),
    session_player_id: bigint('session_player_id', { mode: 'number' })
      .notNull()
      .references(() => SESSION_PLAYER.id, { onDelete: 'cascade' }),
    round_number: bigint('round_number', { mode: 'number' }).notNull(),
    outcome_type: text('outcome_type').notNull().$type<ChestOutcomeType>(),
    outcome_value: bigint('outcome_value', { mode: 'number' }),
    gold_delta: bigint('gold_delta', { mode: 'number' }).notNull().default(0),
    target_player_id: bigint('target_player_id', { mode: 'number' }).references(
      () => SESSION_PLAYER.id,
      { onDelete: 'set null' }
    ),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('chest_pick_session_idx').on(table.session_id),
    index('chest_pick_player_idx').on(table.session_player_id),
    index('chest_pick_round_idx').on(table.session_id, table.round_number),
  ]
);

// Type exports for tables
export type Session = typeof SESSION.$inferSelect;
export type InsertSession = typeof SESSION.$inferInsert;
export type SessionBroadcastGroup = typeof SESSION_BROADCAST_GROUP.$inferSelect;
export type InsertSessionBroadcastGroup = typeof SESSION_BROADCAST_GROUP.$inferInsert;

export type SessionPlayer = typeof SESSION_PLAYER.$inferSelect;
export type InsertSessionPlayer = typeof SESSION_PLAYER.$inferInsert;

export type GameEvent = typeof GAME_EVENT.$inferSelect;
export type InsertGameEvent = typeof GAME_EVENT.$inferInsert;

export type ChestPick = typeof CHEST_PICK.$inferSelect;
export type InsertChestPick = typeof CHEST_PICK.$inferInsert;
