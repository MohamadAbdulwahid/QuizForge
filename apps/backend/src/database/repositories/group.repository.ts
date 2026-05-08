import { and, asc, desc, eq, ilike, inArray, not } from 'drizzle-orm';
import { db } from '../client';
import {
  GROUP,
  GROUP_INVITE,
  GROUP_JOIN_REQUEST,
  GROUP_MEMBER,
  GroupInviteStatus,
  GroupJoinPolicy,
  GroupJoinRequestStatus,
  GroupMemberRole,
  InsertGroup,
  InsertGroupInvite,
  InsertGroupJoinRequest,
  InsertGroupMember,
} from '../schema/group';
import { PROFILE } from '../schema/profile';
import { QUIZ } from '../schema/quiz';
import { SESSION, SESSION_BROADCAST_GROUP } from '../schema/session';

export type GroupMemberSummary = {
  user_id: string;
  username: string;
  role: GroupMemberRole;
  joined_at: Date;
};

export type GroupJoinRequestSummary = {
  id: number;
  requester_user_id: string;
  username: string;
  status: GroupJoinRequestStatus;
  created_at: Date;
};

export type GroupInviteSummary = {
  id: number;
  group_id: number;
  group_name: string;
  invited_by_user_id: string;
  invited_by_username: string;
  status: GroupInviteStatus;
  created_at: Date;
};

export type DiscoverableGroupSummary = {
  id: number;
  name: string;
  description: string | null;
  join_policy: GroupJoinPolicy;
  created_by: string;
  created_at: Date;
};

export type GroupActiveSessionSummary = {
  session_id: number;
  pin: string;
  status: string;
  quiz_id: number;
  quiz_title: string;
  host_id: string;
  host_username: string;
  started_at: Date;
};

export async function createGroup(data: InsertGroup) {
  const result = await db.insert(GROUP).values(data).returning();
  return result[0];
}

export async function updateGroup(
  groupId: number,
  data: Partial<Pick<InsertGroup, 'name' | 'description' | 'is_discoverable' | 'join_policy'>>
) {
  const result = await db.update(GROUP).set(data).where(eq(GROUP.id, groupId)).returning();
  return result[0] ?? null;
}

export async function findGroupById(groupId: number) {
  const result = await db.select().from(GROUP).where(eq(GROUP.id, groupId)).limit(1);
  return result[0] ?? null;
}

export async function listGroupsByMember(userId: string) {
  return db
    .select({
      id: GROUP.id,
      name: GROUP.name,
      description: GROUP.description,
      is_discoverable: GROUP.is_discoverable,
      join_policy: GROUP.join_policy,
      created_by: GROUP.created_by,
      created_at: GROUP.created_at,
      role: GROUP_MEMBER.role,
    })
    .from(GROUP_MEMBER)
    .innerJoin(GROUP, eq(GROUP_MEMBER.group_id, GROUP.id))
    .where(eq(GROUP_MEMBER.user_id, userId))
    .orderBy(asc(GROUP.name));
}

export async function searchDiscoverableGroups(query: string, excludedGroupIds: number[] = []) {
  const normalizedQuery = query.trim();
  const visibilityFilter =
    excludedGroupIds.length > 0
      ? and(eq(GROUP.is_discoverable, true), not(inArray(GROUP.id, excludedGroupIds)))
      : eq(GROUP.is_discoverable, true);

  if (!normalizedQuery) {
    return db
      .select({
        id: GROUP.id,
        name: GROUP.name,
        description: GROUP.description,
        join_policy: GROUP.join_policy,
        created_by: GROUP.created_by,
        created_at: GROUP.created_at,
      })
      .from(GROUP)
      .where(visibilityFilter)
      .orderBy(asc(GROUP.name));
  }

  return db
    .select({
      id: GROUP.id,
      name: GROUP.name,
      description: GROUP.description,
      join_policy: GROUP.join_policy,
      created_by: GROUP.created_by,
      created_at: GROUP.created_at,
    })
    .from(GROUP)
    .where(and(visibilityFilter, ilike(GROUP.name, `%${normalizedQuery}%`)))
    .orderBy(asc(GROUP.name));
}

export async function addGroupMember(data: InsertGroupMember) {
  const result = await db.insert(GROUP_MEMBER).values(data).returning();
  return result[0];
}

export async function findGroupMember(groupId: number, userId: string) {
  const result = await db
    .select()
    .from(GROUP_MEMBER)
    .where(and(eq(GROUP_MEMBER.group_id, groupId), eq(GROUP_MEMBER.user_id, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function listGroupMembers(groupId: number): Promise<GroupMemberSummary[]> {
  return db
    .select({
      user_id: GROUP_MEMBER.user_id,
      username: PROFILE.username,
      role: GROUP_MEMBER.role,
      joined_at: GROUP_MEMBER.joined_at,
    })
    .from(GROUP_MEMBER)
    .innerJoin(PROFILE, eq(GROUP_MEMBER.user_id, PROFILE.user_id))
    .where(eq(GROUP_MEMBER.group_id, groupId))
    .orderBy(asc(PROFILE.username));
}

export async function countGroupAdmins(groupId: number) {
  const result = await db
    .select({ id: GROUP_MEMBER.id })
    .from(GROUP_MEMBER)
    .where(and(eq(GROUP_MEMBER.group_id, groupId), eq(GROUP_MEMBER.role, 'admin')));
  return result.length;
}

export async function updateGroupMemberRole(
  groupId: number,
  userId: string,
  role: GroupMemberRole
) {
  const result = await db
    .update(GROUP_MEMBER)
    .set({ role })
    .where(and(eq(GROUP_MEMBER.group_id, groupId), eq(GROUP_MEMBER.user_id, userId)))
    .returning();
  return result[0] ?? null;
}

export async function removeGroupMember(groupId: number, userId: string) {
  const result = await db
    .delete(GROUP_MEMBER)
    .where(and(eq(GROUP_MEMBER.group_id, groupId), eq(GROUP_MEMBER.user_id, userId)))
    .returning();
  return result[0] ?? null;
}

export async function createJoinRequest(data: InsertGroupJoinRequest) {
  const result = await db.insert(GROUP_JOIN_REQUEST).values(data).returning();
  return result[0];
}

export async function findPendingJoinRequest(groupId: number, userId: string) {
  const result = await db
    .select()
    .from(GROUP_JOIN_REQUEST)
    .where(
      and(
        eq(GROUP_JOIN_REQUEST.group_id, groupId),
        eq(GROUP_JOIN_REQUEST.requester_user_id, userId),
        eq(GROUP_JOIN_REQUEST.status, 'pending')
      )
    )
    .limit(1);
  return result[0] ?? null;
}

export async function listJoinRequests(groupId: number): Promise<GroupJoinRequestSummary[]> {
  return db
    .select({
      id: GROUP_JOIN_REQUEST.id,
      requester_user_id: GROUP_JOIN_REQUEST.requester_user_id,
      username: PROFILE.username,
      status: GROUP_JOIN_REQUEST.status,
      created_at: GROUP_JOIN_REQUEST.created_at,
    })
    .from(GROUP_JOIN_REQUEST)
    .innerJoin(PROFILE, eq(GROUP_JOIN_REQUEST.requester_user_id, PROFILE.user_id))
    .where(and(eq(GROUP_JOIN_REQUEST.group_id, groupId), eq(GROUP_JOIN_REQUEST.status, 'pending')))
    .orderBy(desc(GROUP_JOIN_REQUEST.created_at));
}

export async function findJoinRequestById(requestId: number) {
  const result = await db
    .select()
    .from(GROUP_JOIN_REQUEST)
    .where(eq(GROUP_JOIN_REQUEST.id, requestId))
    .limit(1);
  return result[0] ?? null;
}

export async function updateJoinRequestStatus(
  requestId: number,
  status: GroupJoinRequestStatus,
  respondedByUserId?: string
) {
  const result = await db
    .update(GROUP_JOIN_REQUEST)
    .set({
      status,
      responded_at: new Date(),
      responded_by_user_id: respondedByUserId,
    })
    .where(eq(GROUP_JOIN_REQUEST.id, requestId))
    .returning();
  return result[0] ?? null;
}

export async function createInvite(data: InsertGroupInvite) {
  const result = await db.insert(GROUP_INVITE).values(data).returning();
  return result[0];
}

export async function findPendingInvite(groupId: number, userId: string) {
  const result = await db
    .select()
    .from(GROUP_INVITE)
    .where(
      and(
        eq(GROUP_INVITE.group_id, groupId),
        eq(GROUP_INVITE.invited_user_id, userId),
        eq(GROUP_INVITE.status, 'pending')
      )
    )
    .limit(1);
  return result[0] ?? null;
}

export async function listInvitesForUser(userId: string): Promise<GroupInviteSummary[]> {
  return db
    .select({
      id: GROUP_INVITE.id,
      group_id: GROUP_INVITE.group_id,
      group_name: GROUP.name,
      invited_by_user_id: GROUP_INVITE.invited_by_user_id,
      invited_by_username: PROFILE.username,
      status: GROUP_INVITE.status,
      created_at: GROUP_INVITE.created_at,
    })
    .from(GROUP_INVITE)
    .innerJoin(GROUP, eq(GROUP_INVITE.group_id, GROUP.id))
    .innerJoin(PROFILE, eq(GROUP_INVITE.invited_by_user_id, PROFILE.user_id))
    .where(and(eq(GROUP_INVITE.invited_user_id, userId), eq(GROUP_INVITE.status, 'pending')))
    .orderBy(desc(GROUP_INVITE.created_at));
}

export async function findInviteById(inviteId: number) {
  const result = await db.select().from(GROUP_INVITE).where(eq(GROUP_INVITE.id, inviteId)).limit(1);
  return result[0] ?? null;
}

export async function updateInviteStatus(inviteId: number, status: GroupInviteStatus) {
  const result = await db
    .update(GROUP_INVITE)
    .set({
      status,
      responded_at: new Date(),
    })
    .where(eq(GROUP_INVITE.id, inviteId))
    .returning();
  return result[0] ?? null;
}

export async function listGroupIdsByMember(userId: string): Promise<number[]> {
  const result = await db
    .select({ group_id: GROUP_MEMBER.group_id })
    .from(GROUP_MEMBER)
    .where(eq(GROUP_MEMBER.user_id, userId));
  return result.map((entry) => entry.group_id);
}

export async function listActiveSessionsForGroup(
  groupId: number
): Promise<GroupActiveSessionSummary[]> {
  return db
    .select({
      session_id: SESSION.id,
      pin: SESSION.pin,
      status: SESSION.status,
      quiz_id: SESSION.quiz_id,
      quiz_title: QUIZ.title,
      host_id: SESSION.host_id,
      host_username: PROFILE.username,
      started_at: SESSION.started_at,
    })
    .from(SESSION_BROADCAST_GROUP)
    .innerJoin(SESSION, eq(SESSION_BROADCAST_GROUP.session_id, SESSION.id))
    .innerJoin(QUIZ, eq(SESSION.quiz_id, QUIZ.id))
    .innerJoin(PROFILE, eq(SESSION.host_id, PROFILE.user_id))
    .where(
      and(
        eq(SESSION_BROADCAST_GROUP.group_id, groupId),
        inArray(SESSION.status, ['waiting', 'playing', 'paused', 'in-progress'])
      )
    )
    .orderBy(desc(SESSION.started_at));
}
