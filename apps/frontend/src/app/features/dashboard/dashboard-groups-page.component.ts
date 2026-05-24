import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import {
  GroupActiveSessionSummary,
  GroupApiService,
  GroupInviteSummary,
  MyGroupSummary,
} from '../../core/services/group-api.service';
import { BubblyBadgeComponent } from '../../shared/ui/bubbly-badge.component';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';

@Component({
  selector: 'app-dashboard-groups-page',
  standalone: true,
  imports: [
    CommonModule,
    BubblyBadgeComponent,
    BubblyButtonComponent,
    BubblyCardComponent,
    PageHeadingComponent,
  ],
  templateUrl: './dashboard-groups-page.component.html',
})
export class DashboardGroupsPageComponent {
  private readonly groupApiService = inject(GroupApiService);
  private readonly router = inject(Router);

  protected readonly groups = signal<MyGroupSummary[]>([]);
  protected readonly invites = signal<GroupInviteSummary[]>([]);
  protected readonly activeSessions = signal<GroupActiveSessionSummary[]>([]);
  protected readonly joinRequestCounts = signal<Map<number, number>>(new Map());
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.loadData();
  }

  protected navigateToGroup(groupId: number): void {
    void this.router.navigate(['/dashboard/groups', groupId]);
  }

  protected navigateToCreate(): void {
    void this.router.navigate(['/dashboard/groups/new']);
  }

  protected navigateToSession(pin: string): void {
    void this.router.navigate(['/game-lobby', pin]);
  }

  protected respondToInvite(inviteId: number, action: 'accept' | 'decline'): void {
    this.groupApiService.respondToInvite(inviteId, action).subscribe({
      next: () => {
        this.loadInvites();
        this.loadGroups();
      },
      error: () => {
        this.errorMessage.set('Could not respond to invite.');
      },
    });
  }

  private loadData(): void {
    this.loadGroups();
    this.loadInvites();
  }

  private loadGroups(): void {
    this.loading.set(true);

    this.groupApiService
      .getMyGroups()
      .pipe(
        finalize(() => {
          this.loading.set(false);
        })
      )
      .subscribe({
        next: (groups) => {
          this.groups.set(groups);
          this.loadJoinRequestCounts(groups);
          this.loadAllActiveSessions(groups);
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

  /** Fetch join request counts for admin groups only. */
  private loadJoinRequestCounts(groups: MyGroupSummary[]): void {
    const counts = new Map<number, number>();
    const adminGroups = groups.filter((g) => g.role === 'admin');

    if (adminGroups.length === 0) {
      this.joinRequestCounts.set(counts);
      return;
    }

    const requests = adminGroups.map((group) =>
      this.groupApiService.getJoinRequests(group.id).subscribe({
        next: (requests) => {
          counts.set(group.id, requests.length);
          this.joinRequestCounts.set(new Map(counts));
        },
        error: () => {
          counts.set(group.id, 0);
          this.joinRequestCounts.set(new Map(counts));
        },
      })
    );

    // Cleanup subscriptions is not critical for this short-lived request,
    // but we track them in case needed later.
    void requests;
  }

  /** Aggregate active sessions across all groups. */
  private loadAllActiveSessions(groups: MyGroupSummary[]): void {
    if (groups.length === 0) {
      this.activeSessions.set([]);
      return;
    }

    const allSessions: GroupActiveSessionSummary[] = [];
    let completed = 0;

    for (const group of groups) {
      this.groupApiService.getActiveSessions(group.id).subscribe({
        next: (sessions) => {
          allSessions.push(...sessions);
          completed++;
          if (completed === groups.length) {
            this.activeSessions.set(allSessions);
          }
        },
        error: () => {
          completed++;
          if (completed === groups.length) {
            this.activeSessions.set(allSessions);
          }
        },
      });
    }
  }
}
