import * as groupRepository from '../../database/repositories/group.repository';
import * as profileRepository from '../../database/repositories/profile.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import type {
  CreateGroupRequest,
  InviteActionRequest,
  InviteMemberRequest,
  JoinRequestActionRequest,
  UpdateGroupRequest,
  UpdateMemberRoleRequest,
} from '../dtos/group.dto';

export async function createGroup(userId: string, data: CreateGroupRequest) {
  const group = await groupRepository.createGroup({
    name: data.name,
    description: data.description,
    created_by: userId,
    is_discoverable: data.is_discoverable,
    join_policy: data.is_discoverable ? data.join_policy : 'admin-controlled',
  });

  await groupRepository.addGroupMember({
    group_id: group.id,
    user_id: userId,
    role: 'admin',
  });

  return group;
}

export async function listMyGroups(userId: string) {
  return groupRepository.listGroupsByMember(userId);
}

export async function searchGroups(query: string) {
  return groupRepository.searchDiscoverableGroups(query);
}

export async function getGroupDetails(groupId: number, userId: string) {
  await ensureGroupMember(groupId, userId);

  const group = await groupRepository.findGroupById(groupId);

  if (!group) {
    throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
  }

  const members = await groupRepository.listGroupMembers(groupId);

  return {
    ...group,
    members,
  };
}

export async function updateGroup(groupId: number, userId: string, data: UpdateGroupRequest) {
  await ensureGroupAdmin(groupId, userId);

  const nextDiscoverable = data.is_discoverable ?? (await requireGroup(groupId)).is_discoverable;
  const nextJoinPolicy = nextDiscoverable
    ? (data.join_policy ?? (await requireGroup(groupId)).join_policy)
    : 'admin-controlled';

  const updated = await groupRepository.updateGroup(groupId, {
    name: data.name,
    description: data.description,
    is_discoverable: nextDiscoverable,
    join_policy: nextJoinPolicy,
  });

  if (!updated) {
    throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
  }

  return updated;
}

export async function requestJoin(groupId: number, userId: string) {
  const group = await requireGroup(groupId);
  const existingMember = await groupRepository.findGroupMember(groupId, userId);

  if (existingMember) {
    throw new ConflictError('You are already a member of this group', 'GROUP_MEMBER_EXISTS');
  }

  if (!group.is_discoverable || group.join_policy === 'admin-controlled') {
    throw new ForbiddenError('This group does not allow self-join', 'GROUP_SELF_JOIN_FORBIDDEN');
  }

  if (group.join_policy === 'open') {
    await groupRepository.addGroupMember({
      group_id: groupId,
      user_id: userId,
      role: 'member',
    });

    return { joined: true };
  }

  const pendingRequest = await groupRepository.findPendingJoinRequest(groupId, userId);

  if (pendingRequest) {
    throw new ConflictError('You already have a pending join request', 'GROUP_JOIN_REQUEST_EXISTS');
  }

  await groupRepository.createJoinRequest({
    group_id: groupId,
    requester_user_id: userId,
    status: 'pending',
  });

  return { joined: false, status: 'pending' };
}

export async function listJoinRequests(groupId: number, userId: string) {
  await ensureGroupAdmin(groupId, userId);
  return groupRepository.listJoinRequests(groupId);
}

export async function respondToJoinRequest(
  groupId: number,
  requestId: number,
  userId: string,
  data: JoinRequestActionRequest
) {
  await ensureGroupAdmin(groupId, userId);

  const request = await groupRepository.findJoinRequestById(requestId);

  if (!request || request.group_id !== groupId) {
    throw new NotFoundError('Join request not found', 'GROUP_JOIN_REQUEST_NOT_FOUND');
  }

  if (request.status !== 'pending') {
    throw new ConflictError('Join request has already been handled', 'GROUP_JOIN_REQUEST_HANDLED');
  }

  const nextStatus = data.action === 'approve' ? 'approved' : 'rejected';

  const updated = await groupRepository.updateJoinRequestStatus(requestId, nextStatus, userId);

  if (data.action === 'approve') {
    await groupRepository.addGroupMember({
      group_id: request.group_id,
      user_id: request.requester_user_id,
      role: 'member',
    });
  }

  return updated;
}

export async function inviteMemberByUsername(
  groupId: number,
  userId: string,
  data: InviteMemberRequest
) {
  await ensureGroupAdmin(groupId, userId);

  const profile = await profileRepository.findByUsername(data.username);

  if (!profile) {
    throw new NotFoundError('User not found', 'GROUP_INVITE_USER_NOT_FOUND');
  }

  const existingMember = await groupRepository.findGroupMember(groupId, profile.user_id);

  if (existingMember) {
    throw new ConflictError('User is already a member of this group', 'GROUP_MEMBER_EXISTS');
  }

  const pendingInvite = await groupRepository.findPendingInvite(groupId, profile.user_id);

  if (pendingInvite) {
    throw new ConflictError('User already has a pending invite', 'GROUP_INVITE_EXISTS');
  }

  return groupRepository.createInvite({
    group_id: groupId,
    invited_user_id: profile.user_id,
    invited_by_user_id: userId,
    status: 'pending',
  });
}

export async function listMyInvites(userId: string) {
  return groupRepository.listInvitesForUser(userId);
}

export async function respondToInvite(inviteId: number, userId: string, data: InviteActionRequest) {
  const invite = await groupRepository.findInviteById(inviteId);

  if (!invite || invite.invited_user_id !== userId) {
    throw new NotFoundError('Invite not found', 'GROUP_INVITE_NOT_FOUND');
  }

  if (invite.status !== 'pending') {
    throw new ConflictError('Invite has already been handled', 'GROUP_INVITE_HANDLED');
  }

  const nextStatus = data.action === 'accept' ? 'accepted' : 'declined';
  const updated = await groupRepository.updateInviteStatus(inviteId, nextStatus);

  if (data.action === 'accept') {
    await groupRepository.addGroupMember({
      group_id: invite.group_id,
      user_id: invite.invited_user_id,
      role: 'member',
    });
  }

  return updated;
}

export async function updateMemberRole(
  groupId: number,
  userId: string,
  targetUserId: string,
  data: UpdateMemberRoleRequest
) {
  await ensureGroupAdmin(groupId, userId);

  const targetMember = await ensureGroupMember(groupId, targetUserId);

  if (targetMember.role === 'admin' && data.role === 'member') {
    const adminCount = await groupRepository.countGroupAdmins(groupId);

    if (adminCount <= 1) {
      throw new ConflictError('A group must always have at least one admin', 'GROUP_LAST_ADMIN');
    }
  }

  return groupRepository.updateGroupMemberRole(groupId, targetUserId, data.role);
}

export async function removeMember(groupId: number, userId: string, targetUserId: string) {
  await ensureGroupAdmin(groupId, userId);

  const targetMember = await ensureGroupMember(groupId, targetUserId);

  if (targetMember.role === 'admin') {
    const adminCount = await groupRepository.countGroupAdmins(groupId);

    if (adminCount <= 1) {
      throw new ConflictError('A group must always have at least one admin', 'GROUP_LAST_ADMIN');
    }
  }

  return groupRepository.removeGroupMember(groupId, targetUserId);
}

export async function listActiveSessions(groupId: number, userId: string) {
  await ensureGroupMember(groupId, userId);
  return groupRepository.listActiveSessionsForGroup(groupId);
}

async function requireGroup(groupId: number) {
  const group = await groupRepository.findGroupById(groupId);

  if (!group) {
    throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
  }

  return group;
}

async function ensureGroupMember(groupId: number, userId: string) {
  await requireGroup(groupId);
  const member = await groupRepository.findGroupMember(groupId, userId);

  if (!member) {
    throw new ForbiddenError('You are not a member of this group', 'GROUP_MEMBER_FORBIDDEN');
  }

  return member;
}

async function ensureGroupAdmin(groupId: number, userId: string) {
  const member = await ensureGroupMember(groupId, userId);

  if (member.role !== 'admin') {
    throw new ForbiddenError('Only group admins can perform this action', 'GROUP_ADMIN_FORBIDDEN');
  }

  return member;
}
