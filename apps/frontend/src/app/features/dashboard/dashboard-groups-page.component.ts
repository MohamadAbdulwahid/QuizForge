import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
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
  private readonly destroyRef = inject(DestroyRef);

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
    this.groupApiService
      .respondToInvite(inviteId, action)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (groups) => {
          this.groups.set(groups);
          this.loadSubdata(groups);
        },
        error: () => {
          this.errorMessage.set('Could not load your groups.');
        },
      });
  }

  private loadInvites(): void {
    this.groupApiService
      .getMyInvites()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (invites) => {
          this.invites.set(invites);
        },
        error: () => {
          this.errorMessage.set('Could not load your invites.');
        },
      });
  }

  /**
   * Batch-load join request counts and active sessions for all groups
   * using forkJoin instead of N+1 individual subscriptions.
   */
  private loadSubdata(groups: MyGroupSummary[]): void {
    const adminGroups = groups.filter((g) => g.role === 'admin');

    // Batch join request counts
    if (adminGroups.length > 0) {
      const requests$ = adminGroups.map((group) =>
        this.groupApiService.getJoinRequests(group.id).pipe(
          map((reqs) => ({ groupId: group.id, count: reqs.length })),
          catchError(() => of({ groupId: group.id, count: 0 }))
        )
      );

      forkJoin(requests$)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((results) => {
          const counts = new Map<number, number>();
          for (const r of results) {
            counts.set(r.groupId, r.count);
          }
          this.joinRequestCounts.set(counts);
        });
    }

    // Batch active sessions
    if (groups.length === 0) {
      this.activeSessions.set([]);
      return;
    }

    const sessions$ = groups.map((group) =>
      this.groupApiService
        .getActiveSessions(group.id)
        .pipe(catchError(() => of([] as GroupActiveSessionSummary[])))
    );

    forkJoin(sessions$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((results) => {
        this.activeSessions.set(results.flat());
      });
  }
}
