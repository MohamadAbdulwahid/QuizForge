import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import {
  CreateGroupPayload,
  GroupActiveSessionSummary,
  GroupApiService,
  GroupInviteSummary,
  GroupJoinPolicy,
  MyGroupSummary,
} from '../../core/services/group-api.service';
import { BubblyBadgeComponent } from '../../shared/ui/bubbly-badge.component';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';
import { BubblyInputComponent } from '../../shared/ui/bubbly-input.component';
import { BubblyModalComponent } from '../../shared/ui/bubbly-modal.component';
import { BubblySelectComponent, BubblySelectOption } from '../../shared/ui/bubbly-select.component';

type GroupsTab = 'groups' | 'sessions' | 'invites';

interface GroupsTabDescriptor {
  readonly id: GroupsTab;
  readonly label: string;
  readonly count: number;
}

const JOIN_POLICY_OPTIONS: BubblySelectOption[] = [
  { value: 'admin-controlled', label: 'Admin controlled' },
  { value: 'request-approval', label: 'Request approval' },
  { value: 'open', label: 'Open' },
];

const JOIN_POLICY_CHIP_LABELS: Record<GroupJoinPolicy, string> = {
  'admin-controlled': 'Admin',
  'request-approval': 'Approval',
  open: 'Open',
};

@Component({
  selector: 'app-dashboard-groups-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BubblyBadgeComponent,
    BubblyButtonComponent,
    BubblyCardComponent,
    BubblyInputComponent,
    BubblyModalComponent,
    BubblySelectComponent,
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

  // Tab state — controls which section is visible.
  protected readonly activeTab = signal<GroupsTab>('groups');

  // Tabs descriptor (re-derives counts whenever underlying data changes).
  protected readonly tabs = computed<GroupsTabDescriptor[]>(() => [
    { id: 'groups', label: 'My Groups', count: this.groups().length },
    {
      id: 'sessions',
      label: 'Active Sessions',
      count: this.activeSessions().length,
    },
    { id: 'invites', label: 'Invites', count: this.invites().length },
  ]);

  // ── Create-group modal state ──
  protected readonly createModalOpen = signal(false);
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

  // Form fields (mirrors GroupsCreatePageComponent).
  protected readonly groupName = signal('');
  protected readonly description = signal('');
  protected readonly isDiscoverable = signal(false);
  protected readonly joinPolicy = signal<GroupJoinPolicy>('admin-controlled');
  protected readonly nameError = signal('');

  protected readonly joinPolicyOptions = JOIN_POLICY_OPTIONS;

  constructor() {
    this.loadData();
  }

  /* ── Navigation ── */

  protected navigateToGroup(groupId: number): void {
    void this.router.navigate(['/dashboard/groups', groupId]);
  }

  protected navigateToSession(pin: string): void {
    void this.router.navigate(['/game-lobby', pin]);
  }

  /* ── Invites ── */

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

  /* ── Create-group modal handlers ── */

  protected openModal(): void {
    this.resetCreateForm();
    this.createModalOpen.set(true);
  }

  protected closeModal(): void {
    // Don't allow closing while a request is in-flight.
    if (this.creating()) {
      return;
    }
    this.createModalOpen.set(false);
  }

  protected submitCreate(): void {
    if (this.creating()) {
      return;
    }
    if (!this.validateCreateForm()) {
      return;
    }

    this.createError.set(null);
    this.creating.set(true);

    const payload: CreateGroupPayload = {
      name: this.groupName().trim(),
      description: this.description().trim() || undefined,
      is_discoverable: this.isDiscoverable(),
      join_policy: this.joinPolicy(),
    };

    this.groupApiService
      .createGroup(payload)
      .pipe(
        finalize(() => {
          this.creating.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.createModalOpen.set(false);
          this.resetCreateForm();
          this.loadGroups();
        },
        error: () => {
          this.createError.set('Could not create group. Please try again.');
        },
      });
  }

  /* ── Template helpers ── */

  /** First character of a group name, uppercased — used for the round avatar. */
  protected groupInitial(name: string): string {
    const trimmed = (name ?? '').trim();
    return (trimmed.charAt(0) || '?').toUpperCase();
  }

  /** Short label for a join policy — used in group chips. */
  protected joinPolicyLabel(policy: GroupJoinPolicy): string {
    return JOIN_POLICY_CHIP_LABELS[policy];
  }

  /** Number of pending join requests for a group (0 if none / unknown). */
  protected joinRequestCount(groupId: number): number {
    return this.joinRequestCounts().get(groupId) ?? 0;
  }

  /* ── Form validation ── */

  private validateCreateForm(): boolean {
    const name = this.groupName().trim();

    if (!name) {
      this.nameError.set('Group name is required.');
      return false;
    }
    if (name.length < 2) {
      this.nameError.set('Group name must be at least 2 characters.');
      return false;
    }

    this.nameError.set('');
    return true;
  }

  private resetCreateForm(): void {
    this.groupName.set('');
    this.description.set('');
    this.isDiscoverable.set(false);
    this.joinPolicy.set('admin-controlled');
    this.nameError.set('');
    this.createError.set(null);
  }

  /* ── Data loading (unchanged) ── */

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
