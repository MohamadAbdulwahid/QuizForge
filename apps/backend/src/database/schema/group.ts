import {
  bigint,
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { USER } from './auth/user';

export const GROUP_JOIN_POLICY = pgEnum('group_join_policy', [
  'admin-controlled',
  'request-approval',
  'open',
]);

export const GROUP_MEMBER_ROLE = pgEnum('group_member_role', ['admin', 'member']);

export const GROUP_JOIN_REQUEST_STATUS = pgEnum('group_join_request_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

export const GROUP_INVITE_STATUS = pgEnum('group_invite_status', [
  'pending',
  'accepted',
  'declined',
  'revoked',
]);

export type GroupJoinPolicy = 'admin-controlled' | 'request-approval' | 'open';
export type GroupMemberRole = 'admin' | 'member';
export type GroupJoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type GroupInviteStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export const GROUP = pgTable('group', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  description: text('description'),
  created_by: uuid('created_by')
    .notNull()
    .references(() => USER.id, { onDelete: 'cascade' }),
  is_discoverable: boolean('is_discoverable').notNull().default(false),
  join_policy: GROUP_JOIN_POLICY('join_policy').notNull().default('admin-controlled'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const GROUP_MEMBER = pgTable(
  'group_member',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    group_id: bigint('group_id', { mode: 'number' })
      .notNull()
      .references(() => GROUP.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => USER.id, { onDelete: 'cascade' }),
    role: GROUP_MEMBER_ROLE('role').notNull().default('member'),
    joined_at: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    groupMemberUnique: uniqueIndex('group_member_group_id_user_id_unique').on(
      table.group_id,
      table.user_id
    ),
  })
);

export const GROUP_JOIN_REQUEST = pgTable('group_join_request', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  group_id: bigint('group_id', { mode: 'number' })
    .notNull()
    .references(() => GROUP.id, { onDelete: 'cascade' }),
  requester_user_id: uuid('requester_user_id')
    .notNull()
    .references(() => USER.id, { onDelete: 'cascade' }),
  status: GROUP_JOIN_REQUEST_STATUS('status').notNull().default('pending'),
  responded_by_user_id: uuid('responded_by_user_id').references(() => USER.id, {
    onDelete: 'set null',
  }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  responded_at: timestamp('responded_at', { withTimezone: true }),
});

export const GROUP_INVITE = pgTable('group_invite', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  group_id: bigint('group_id', { mode: 'number' })
    .notNull()
    .references(() => GROUP.id, { onDelete: 'cascade' }),
  invited_user_id: uuid('invited_user_id')
    .notNull()
    .references(() => USER.id, { onDelete: 'cascade' }),
  invited_by_user_id: uuid('invited_by_user_id')
    .notNull()
    .references(() => USER.id, { onDelete: 'cascade' }),
  status: GROUP_INVITE_STATUS('status').notNull().default('pending'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  responded_at: timestamp('responded_at', { withTimezone: true }),
});

export type GROUP = typeof GROUP.$inferSelect;
export type InsertGroup = typeof GROUP.$inferInsert;
export type GROUP_MEMBER = typeof GROUP_MEMBER.$inferSelect;
export type InsertGroupMember = typeof GROUP_MEMBER.$inferInsert;
export type GROUP_JOIN_REQUEST = typeof GROUP_JOIN_REQUEST.$inferSelect;
export type InsertGroupJoinRequest = typeof GROUP_JOIN_REQUEST.$inferInsert;
export type GROUP_INVITE = typeof GROUP_INVITE.$inferSelect;
export type InsertGroupInvite = typeof GROUP_INVITE.$inferInsert;
