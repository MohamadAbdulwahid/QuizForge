import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import {
  GroupApiService,
  GroupDetail,
  GroupJoinRequestSummary,
  GroupMemberRole,
} from '../../../core/services/group-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { BubblyAlertComponent } from '../../../shared/ui/bubbly-alert.component';
import { BubblyBadgeComponent } from '../../../shared/ui/bubbly-badge.component';
import { BubblyButtonComponent } from '../../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../../shared/ui/bubbly-card.component';

@Component({
  selector: 'app-groups-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    BubblyAlertComponent,
    BubblyBadgeComponent,
    BubblyButtonComponent,
    BubblyCardComponent,
  ],
  templateUrl: './groups-detail-page.component.html',
})
export class GroupsDetailPageComponent {
  private readonly groupApiService = inject(GroupApiService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly joinRequests = signal<GroupJoinRequestSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly isCurrentUserAdmin = signal(false);

  /** Group ID from the route parameter. */
  protected readonly groupId = signal<number | null>(null);

  constructor() {
    // Use paramMap observable to react to same-pattern navigation
    // (e.g., /dashboard/groups/1 → /dashboard/groups/2)
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const idParam = params.get('id');
      if (idParam) {
        const id = Number(idParam);
        this.groupId.set(id);
        this.loadData(id);
      } else {
        this.errorMessage.set('No group ID provided.');
      }
    });
  }

  /** Navigate back to the groups list. */
  protected navigateBack(): void {
    void this.router.navigate(['/dashboard/groups']);
  }

  /** Accept a join request. */
  protected acceptJoinRequest(requestId: number): void {
    const gid = this.groupId();
    if (!gid) return;

    this.groupApiService
      .respondToJoinRequest(gid, requestId, 'approve')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.successMessage.set('Join request accepted.');
          this.loadJoinRequests(gid);
          this.loadGroupDetails(gid);
        },
        error: () => {
          this.errorMessage.set('Could not accept join request.');
        },
      });
  }

  /** Reject a join request. */
  protected rejectJoinRequest(requestId: number): void {
    const gid = this.groupId();
    if (!gid) return;

    this.groupApiService
      .respondToJoinRequest(gid, requestId, 'reject')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.successMessage.set('Join request rejected.');
          this.loadJoinRequests(gid);
        },
        error: () => {
          this.errorMessage.set('Could not reject join request.');
        },
      });
  }

  /** Remove a member from the group. */
  protected removeMember(userId: string): void {
    const gid = this.groupId();
    if (!gid) return;

    this.groupApiService
      .removeMember(gid, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.successMessage.set('Member removed.');
          this.loadGroupDetails(gid);
        },
        error: () => {
          this.errorMessage.set('Could not remove member.');
        },
      });
  }

  /** Promote a member to admin. */
  protected promoteToAdmin(userId: string): void {
    const gid = this.groupId();
    if (!gid) return;

    this.groupApiService
      .updateMemberRole(gid, userId, 'admin')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.successMessage.set('Member promoted to admin.');
          this.loadGroupDetails(gid);
        },
        error: () => {
          this.errorMessage.set('Could not promote member.');
        },
      });
  }

  /** Demote an admin to member. */
  protected demoteToMember(userId: string): void {
    const gid = this.groupId();
    if (!gid) return;

    this.groupApiService
      .updateMemberRole(gid, userId, 'member')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.successMessage.set('Admin demoted to member.');
          this.loadGroupDetails(gid);
        },
        error: () => {
          this.errorMessage.set('Could not demote admin.');
        },
      });
  }

  private loadData(groupId: number): void {
    this.loadGroupDetails(groupId);
    this.loadJoinRequests(groupId);
  }

  private loadGroupDetails(groupId: number): void {
    this.loading.set(true);

    this.groupApiService
      .getGroupDetails(groupId)
      .pipe(
        finalize(() => {
          this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (detail) => {
          this.group.set(detail);
          // Check if current user is admin of this group
          const currentUser = this.authService.currentUser();
          if (currentUser) {
            const member = detail.members.find((m) => m.user_id === currentUser.id);
            this.isCurrentUserAdmin.set(member?.role === 'admin');
          }
        },
        error: () => {
          this.errorMessage.set('Could not load group details.');
        },
      });
  }

  private loadJoinRequests(groupId: number): void {
    this.groupApiService
      .getJoinRequests(groupId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (requests) => {
          this.joinRequests.set(requests);
        },
        error: () => {
          // Non-admin users may not have access — silently ignore
          this.joinRequests.set([]);
        },
      });
  }

  /** Format a role label for display. */
  protected roleLabel(role: GroupMemberRole): string {
    return role === 'admin' ? 'Admin' : 'Member';
  }
}
