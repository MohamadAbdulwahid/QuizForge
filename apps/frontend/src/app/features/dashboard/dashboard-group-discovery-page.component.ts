import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  DiscoverableGroupSummary,
  GroupApiService,
  GroupJoinPolicy,
} from '../../core/services/group-api.service';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';

@Component({
  selector: 'app-dashboard-group-discovery-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BubblyButtonComponent,
    BubblyCardComponent,
    PageHeadingComponent,
  ],
  templateUrl: './dashboard-group-discovery-page.component.html',
})
export class DashboardGroupDiscoveryPageComponent {
  private readonly groupApiService = inject(GroupApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly searchQuery = signal('');
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly groups = signal<DiscoverableGroupSummary[]>([]);

  protected readonly hasQuery = computed(() => this.searchQuery().trim().length > 0);

  constructor() {
    this.loadGroups();
  }

  protected searchGroups(): void {
    this.loadGroups(this.searchQuery().trim());
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
    this.loadGroups();
  }

  protected requestJoin(groupId: number): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.groupApiService
      .requestJoin(groupId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: unknown) => {
          const typedResult = result as { joined?: boolean; status?: string };
          this.successMessage.set(
            typedResult.joined
              ? 'You joined the group.'
              : typedResult.status === 'pending'
                ? 'Join request sent.'
                : 'Request processed.'
          );
        },
        error: () => {
          this.errorMessage.set('Could not join or request this group.');
        },
      });
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

  private loadGroups(query = ''): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.groupApiService
      .searchGroups(query)
      .pipe(
        finalize(() => {
          this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (groups) => {
          this.groups.set(groups);
        },
        error: () => {
          this.errorMessage.set('Could not load discoverable groups.');
        },
      });
  }
}
