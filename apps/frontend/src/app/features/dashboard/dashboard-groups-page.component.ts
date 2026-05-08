import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import {
  DiscoverableGroupSummary,
  GroupActiveSessionSummary,
  GroupApiService,
  GroupDetail,
  GroupInviteSummary,
  GroupJoinPolicy,
  GroupJoinRequestSummary,
  GroupMemberRole,
  MyGroupSummary,
} from '../../core/services/group-api.service';

@Component({
  selector: 'app-dashboard-groups-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-groups-page.component.html',
  styleUrl: './dashboard-groups-page.component.css',
})
export class DashboardGroupsPageComponent {
  private readonly groupApiService = inject(GroupApiService);
  private readonly router = inject(Router);

  protected readonly groups = signal<MyGroupSummary[]>([]);
  protected readonly invites = signal<GroupInviteSummary[]>([]);
  protected readonly searchQuery = signal('');
  protected readonly searchResults = signal<DiscoverableGroupSummary[]>([]);
  protected readonly selectedGroupId = signal<number | null>(null);
  protected readonly selectedGroup = signal<GroupDetail | null>(null);
  protected readonly joinRequests = signal<GroupJoinRequestSummary[]>([]);
  protected readonly activeSessions = signal<GroupActiveSessionSummary[]>([]);
  protected readonly loadingGroups = signal(false);
  protected readonly loadingDetail = signal(false);
  protected readonly loadingSearch = signal(false);
  protected readonly creatingGroup = signal(false);
  protected readonly inviteUsername = signal('');
  protected readonly createName = signal('');
  protected readonly createDescription = signal('');
  protected readonly createDiscoverable = signal(true);
  protected readonly createJoinPolicy = signal<GroupJoinPolicy>('request-approval');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly selectedGroupMembership = computed(() => {
    const selectedGroupId = this.selectedGroupId();

    if (selectedGroupId === null) {
      return null;
    }

    return this.groups().find((group) => group.id === selectedGroupId) ?? null;
  });

  protected readonly selectedGroupIsAdmin = computed(
    () => this.selectedGroupMembership()?.role === 'admin'
  );

  constructor() {
    this.loadGroups();
    this.loadInvites();
  }

  protected selectGroup(groupId: number): void {
    this.selectedGroupId.set(groupId);
    this.loadGroupDetail(groupId);
  }

  protected createGroup(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (!this.createName().trim()) {
      this.errorMessage.set('Group name is required.');
      return;
    }

    this.creatingGroup.set(true);

    this.groupApiService
      .createGroup({
        name: this.createName().trim(),
        description: this.createDescription().trim() || undefined,
        is_discoverable: this.createDiscoverable(),
        join_policy: this.createDiscoverable() ? this.createJoinPolicy() : 'admin-controlled',
      })
      .pipe(
        finalize(() => {
          this.creatingGroup.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.createName.set('');
          this.createDescription.set('');
          this.createDiscoverable.set(true);
          this.createJoinPolicy.set('request-approval');
          this.successMessage.set('Group created successfully.');
          this.loadGroups();
        },
        error: () => {
          this.errorMessage.set('Could not create group.');
        },
      });
  }

  protected searchGroups(): void {
    const query = this.searchQuery().trim();

    if (!query) {
      this.searchResults.set([]);
      return;
    }

    this.loadingSearch.set(true);

    this.groupApiService
      .searchGroups(query)
      .pipe(
        finalize(() => {
          this.loadingSearch.set(false);
        })
      )
      .subscribe({
        next: (results) => {
          this.searchResults.set(results);
        },
        error: () => {
          this.errorMessage.set('Could not search groups right now.');
        },
      });
  }

  protected requestJoin(groupId: number): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.groupApiService.requestJoin(groupId).subscribe({
      next: (result: unknown) => {
        const typedResult = result as { joined?: boolean; status?: string };
        this.successMessage.set(
          typedResult.joined
            ? 'You joined the group.'
            : typedResult.status === 'pending'
              ? 'Join request sent.'
              : 'Request processed.'
        );
        this.loadGroups();
      },
      error: () => {
        this.errorMessage.set('Could not join or request this group.');
      },
    });
  }

  protected inviteMember(): void {
    const groupId = this.selectedGroupId();
    const username = this.inviteUsername().trim();

    if (!groupId || !username) {
      this.errorMessage.set('Enter a username to invite.');
      return;
    }

    this.groupApiService.inviteMember(groupId, username).subscribe({
      next: () => {
        this.inviteUsername.set('');
        this.successMessage.set('Invite sent.');
      },
      error: () => {
        this.errorMessage.set('Could not send invite.');
      },
    });
  }

  protected respondToJoinRequest(requestId: number, action: 'approve' | 'reject'): void {
    const groupId = this.selectedGroupId();

    if (!groupId) {
      return;
    }

    this.groupApiService.respondToJoinRequest(groupId, requestId, action).subscribe({
      next: () => {
        this.successMessage.set(action === 'approve' ? 'Request approved.' : 'Request rejected.');
        this.loadGroupDetail(groupId);
        this.loadGroups();
      },
      error: () => {
        this.errorMessage.set('Could not update join request.');
      },
    });
  }

  protected respondToInvite(inviteId: number, action: 'accept' | 'decline'): void {
    this.groupApiService.respondToInvite(inviteId, action).subscribe({
      next: () => {
        this.successMessage.set(action === 'accept' ? 'Invite accepted.' : 'Invite declined.');
        this.loadInvites();
        this.loadGroups();
      },
      error: () => {
        this.errorMessage.set('Could not respond to invite.');
      },
    });
  }

  protected updateMemberRole(userId: string, role: GroupMemberRole): void {
    const groupId = this.selectedGroupId();

    if (!groupId) {
      return;
    }

    this.groupApiService.updateMemberRole(groupId, userId, role).subscribe({
      next: () => {
        this.successMessage.set('Member role updated.');
        this.loadGroupDetail(groupId);
        this.loadGroups();
      },
      error: () => {
        this.errorMessage.set('Could not update member role.');
      },
    });
  }

  protected removeMember(userId: string): void {
    const groupId = this.selectedGroupId();

    if (!groupId) {
      return;
    }

    this.groupApiService.removeMember(groupId, userId).subscribe({
      next: () => {
        this.successMessage.set('Member removed from group.');
        this.loadGroupDetail(groupId);
        this.loadGroups();
      },
      error: () => {
        this.errorMessage.set('Could not remove member.');
      },
    });
  }

  protected joinSession(pin: string): void {
    void this.router.navigate(['/game-lobby', pin]);
  }

  protected groupJoinPolicyLabel(policy: GroupJoinPolicy): string {
    if (policy === 'open') {
      return 'Open Join';
    }

    if (policy === 'request-approval') {
      return 'Approval Required';
    }

    return 'Admin Controlled';
  }

  private loadGroups(): void {
    this.loadingGroups.set(true);

    this.groupApiService
      .getMyGroups()
      .pipe(
        finalize(() => {
          this.loadingGroups.set(false);
        })
      )
      .subscribe({
        next: (groups) => {
          this.groups.set(groups);

          if (groups.length === 0) {
            this.selectedGroupId.set(null);
            this.selectedGroup.set(null);
            this.joinRequests.set([]);
            this.activeSessions.set([]);
            return;
          }

          const selectedGroupId = this.selectedGroupId();
          const nextGroupId =
            selectedGroupId !== null && groups.some((group) => group.id === selectedGroupId)
              ? selectedGroupId
              : groups[0].id;

          this.selectedGroupId.set(nextGroupId);
          this.loadGroupDetail(nextGroupId);
        },
        error: () => {
          this.errorMessage.set('Could not load your groups.');
        },
      });
  }

  private loadInvites(): void {
    this.groupApiService.getMyInvites().subscribe({
      next: (invites) => {
        this.invites.set(invites);
      },
      error: () => {
        this.errorMessage.set('Could not load your invites.');
      },
    });
  }

  private loadGroupDetail(groupId: number): void {
    this.loadingDetail.set(true);

    this.groupApiService
      .getGroupDetails(groupId)
      .pipe(
        finalize(() => {
          this.loadingDetail.set(false);
        })
      )
      .subscribe({
        next: (group) => {
          this.selectedGroup.set(group);
        },
        error: () => {
          this.errorMessage.set('Could not load the selected group.');
        },
      });

    this.groupApiService.getActiveSessions(groupId).subscribe({
      next: (sessions) => {
        this.activeSessions.set(sessions);
      },
      error: () => {
        this.errorMessage.set('Could not load active group sessions.');
      },
    });

    if (this.selectedGroupMembership()?.role === 'admin') {
      this.groupApiService.getJoinRequests(groupId).subscribe({
        next: (requests) => {
          this.joinRequests.set(requests);
        },
        error: () => {
          this.errorMessage.set('Could not load join requests.');
        },
      });
    } else {
      this.joinRequests.set([]);
    }
  }
}
