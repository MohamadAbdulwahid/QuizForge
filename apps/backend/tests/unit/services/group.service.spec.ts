import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

const mocks = {
  findGroupById: mock(),
  findGroupMember: mock(),
  findJoinRequestById: mock(),
  updateJoinRequestStatus: mock(),
  addGroupMember: mock(),
  listGroupIdsByMember: mock(),
  searchDiscoverableGroups: mock(),
};

mock.module('../../../src/database/repositories/group.repository', () => ({
  findGroupById: mocks.findGroupById,
  findGroupMember: mocks.findGroupMember,
  findJoinRequestById: mocks.findJoinRequestById,
  updateJoinRequestStatus: mocks.updateJoinRequestStatus,
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
});
