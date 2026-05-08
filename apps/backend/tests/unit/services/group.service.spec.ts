import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

const mocks = {
  findGroupById: mock(),
  findGroupMember: mock(),
  findPendingInvite: mock(),
  findPendingJoinRequest: mock(),
  findInviteById: mock(),
  findJoinRequestById: mock(),
  updateJoinRequestStatus: mock(),
  updateInviteStatus: mock(),
  addGroupMember: mock(),
  listGroupIdsByMember: mock(),
  searchDiscoverableGroups: mock(),
};

mock.module('../../../src/database/repositories/group.repository', () => ({
  findGroupById: mocks.findGroupById,
  findGroupMember: mocks.findGroupMember,
  findPendingInvite: mocks.findPendingInvite,
  findPendingJoinRequest: mocks.findPendingJoinRequest,
  findInviteById: mocks.findInviteById,
  findJoinRequestById: mocks.findJoinRequestById,
  updateJoinRequestStatus: mocks.updateJoinRequestStatus,
  updateInviteStatus: mocks.updateInviteStatus,
  addGroupMember: mocks.addGroupMember,
  listGroupIdsByMember: mocks.listGroupIdsByMember,
  searchDiscoverableGroups: mocks.searchDiscoverableGroups,
}));

mock.module('../../../src/database/repositories/profile.repository', () => ({}));

const groupService = await import('../../../src/api/services/group.service');

describe('group service', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  afterAll(() => {
    mock.restore();
  });

  it('searchGroups excludes groups the user already belongs to', async () => {
    mocks.listGroupIdsByMember.mockResolvedValueOnce([2, 4]);
    mocks.searchDiscoverableGroups.mockResolvedValueOnce([]);

    await groupService.searchGroups('user-123', 'math');

    expect(mocks.listGroupIdsByMember).toHaveBeenCalledWith('user-123');
    expect(mocks.searchDiscoverableGroups).toHaveBeenCalledWith('math', [2, 4]);
  });

  it('requestJoin auto-joins invited users and clears pending state', async () => {
    mocks.findGroupById.mockResolvedValueOnce({
      id: 1,
      is_discoverable: false,
      join_policy: 'admin-controlled',
    });
    mocks.findGroupMember.mockResolvedValueOnce(null);
    mocks.findPendingInvite.mockResolvedValueOnce({ id: 7, group_id: 1 });
    mocks.findPendingJoinRequest.mockResolvedValueOnce({ id: 11, group_id: 1 });
    mocks.addGroupMember.mockResolvedValueOnce({ id: 22 });
    mocks.updateInviteStatus.mockResolvedValueOnce({ id: 7, status: 'accepted' });
    mocks.updateJoinRequestStatus.mockResolvedValueOnce({ id: 11, status: 'cancelled' });

    const result = await groupService.requestJoin(1, 'user-9');

    expect(result).toEqual({ joined: true });
    expect(mocks.addGroupMember).toHaveBeenCalledWith({
      group_id: 1,
      user_id: 'user-9',
      role: 'member',
    });
    expect(mocks.updateInviteStatus).toHaveBeenCalledWith(7, 'accepted');
    expect(mocks.updateJoinRequestStatus).toHaveBeenCalledWith(11, 'cancelled', 'user-9');
  });

  it('respondToJoinRequest rejects without adding the member', async () => {
    mocks.findGroupById.mockResolvedValueOnce({ id: 1 });
    mocks.findGroupMember.mockResolvedValueOnce({ role: 'admin' });
    mocks.findJoinRequestById.mockResolvedValueOnce({
      id: 9,
      group_id: 1,
      requester_user_id: 'user-9',
      status: 'pending',
    });
    mocks.updateJoinRequestStatus.mockResolvedValueOnce({ id: 9, status: 'rejected' });

    const result = await groupService.respondToJoinRequest(1, 9, 'admin-1', {
      action: 'reject',
    });

    expect(mocks.updateJoinRequestStatus).toHaveBeenCalledWith(9, 'rejected', 'admin-1');
    expect(mocks.addGroupMember).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'rejected' });
  });

  it('respondToInvite accepts without duplicating existing membership', async () => {
    mocks.findInviteById.mockResolvedValueOnce({
      id: 3,
      group_id: 1,
      invited_user_id: 'user-9',
      status: 'pending',
    });
    mocks.findGroupMember.mockResolvedValueOnce({ role: 'member' });
    mocks.findPendingJoinRequest.mockResolvedValueOnce({ id: 15, group_id: 1 });
    mocks.updateInviteStatus.mockResolvedValueOnce({ id: 3, status: 'accepted' });
    mocks.updateJoinRequestStatus.mockResolvedValueOnce({ id: 15, status: 'cancelled' });

    const result = await groupService.respondToInvite(3, 'user-9', { action: 'accept' });

    expect(mocks.addGroupMember).not.toHaveBeenCalled();
    expect(mocks.updateJoinRequestStatus).toHaveBeenCalledWith(15, 'cancelled', 'user-9');
    expect(result).toMatchObject({ status: 'accepted' });
  });
});
