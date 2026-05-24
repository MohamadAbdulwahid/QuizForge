import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type GroupJoinPolicy = 'admin-controlled' | 'request-approval' | 'open';
export type GroupMemberRole = 'admin' | 'member';

export interface MyGroupSummary {
  id: number;
  name: string;
  description: string | null;
  is_discoverable: boolean;
  join_policy: GroupJoinPolicy;
  created_by: string;
  created_at: string;
  role: GroupMemberRole;
  member_count: number;
}

export interface DiscoverableGroupSummary {
  id: number;
  name: string;
  description: string | null;
  join_policy: GroupJoinPolicy;
  created_by: string;
  created_at: string;
}

export interface GroupMemberSummary {
  user_id: string;
  username: string;
  role: GroupMemberRole;
  joined_at: string;
}

export interface GroupDetail extends Omit<MyGroupSummary, 'role'> {
  members: GroupMemberSummary[];
}

export interface GroupJoinRequestSummary {
  id: number;
  requester_user_id: string;
  username: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
}

export interface GroupInviteSummary {
  id: number;
  group_id: number;
  group_name: string;
  invited_by_user_id: string;
  invited_by_username: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  created_at: string;
}

export interface GroupActiveSessionSummary {
  session_id: number;
  pin: string;
  status: string;
  quiz_id: number;
  quiz_title: string;
  host_id: string;
  host_username: string;
  started_at: string;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  is_discoverable: boolean;
  join_policy: GroupJoinPolicy;
}

export interface UpdateGroupPayload {
  name?: string;
  description?: string;
  is_discoverable?: boolean;
  join_policy?: GroupJoinPolicy;
}

@Injectable({ providedIn: 'root' })
export class GroupApiService {
  private readonly apiService = inject(ApiService);

  getMyGroups(): Observable<MyGroupSummary[]> {
    return this.apiService.get<MyGroupSummary[]>('/api/groups');
  }

  searchGroups(query: string): Observable<DiscoverableGroupSummary[]> {
    return this.apiService.get<DiscoverableGroupSummary[]>(
      `/api/groups/search?query=${encodeURIComponent(query)}`
    );
  }

  createGroup(payload: CreateGroupPayload) {
    return this.apiService.post('/api/groups', payload);
  }

  updateGroup(groupId: number, payload: UpdateGroupPayload) {
    return this.apiService.patch(`/api/groups/${groupId}`, payload);
  }

  getGroupDetails(groupId: number): Observable<GroupDetail> {
    return this.apiService.get<GroupDetail>(`/api/groups/${groupId}`);
  }

  requestJoin(groupId: number) {
    return this.apiService.post(`/api/groups/${groupId}/join`, {});
  }

  getJoinRequests(groupId: number): Observable<GroupJoinRequestSummary[]> {
    return this.apiService.get<GroupJoinRequestSummary[]>(`/api/groups/${groupId}/join-requests`);
  }

  respondToJoinRequest(groupId: number, requestId: number, action: 'approve' | 'reject') {
    return this.apiService.patch(`/api/groups/${groupId}/join-requests/${requestId}`, { action });
  }

  inviteMember(groupId: number, username: string) {
    return this.apiService.post(`/api/groups/${groupId}/invitations`, { username });
  }

  getMyInvites(): Observable<GroupInviteSummary[]> {
    return this.apiService.get<GroupInviteSummary[]>('/api/groups/invitations/mine');
  }

  respondToInvite(inviteId: number, action: 'accept' | 'decline') {
    return this.apiService.patch(`/api/groups/invitations/${inviteId}`, { action });
  }

  updateMemberRole(groupId: number, userId: string, role: GroupMemberRole) {
    return this.apiService.patch(`/api/groups/${groupId}/members/${userId}/role`, { role });
  }

  removeMember(groupId: number, userId: string) {
    return this.apiService.delete(`/api/groups/${groupId}/members/${userId}`);
  }

  getActiveSessions(groupId: number): Observable<GroupActiveSessionSummary[]> {
    return this.apiService.get<GroupActiveSessionSummary[]>(
      `/api/groups/${groupId}/active-sessions`
    );
  }
}
