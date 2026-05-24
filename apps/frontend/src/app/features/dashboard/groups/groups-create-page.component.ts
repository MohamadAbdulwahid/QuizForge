import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import {
  CreateGroupPayload,
  GroupApiService,
  GroupJoinPolicy,
} from '../../../core/services/group-api.service';
import { BubblyButtonComponent } from '../../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../../shared/ui/bubbly-card.component';
import { BubblyInputComponent } from '../../../shared/ui/bubbly-input.component';
import {
  BubblySelectComponent,
  BubblySelectOption,
} from '../../../shared/ui/bubbly-select.component';
import { PageHeadingComponent } from '../../../shared/ui/page-heading.component';

const JOIN_POLICY_OPTIONS: BubblySelectOption[] = [
  { value: 'admin-controlled', label: 'Admin controlled — only admins can add members' },
  { value: 'request-approval', label: 'Request approval — members must be approved by an admin' },
  { value: 'open', label: 'Open — anyone can join without approval' },
];

@Component({
  selector: 'app-groups-create-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BubblyButtonComponent,
    BubblyCardComponent,
    BubblyInputComponent,
    BubblySelectComponent,
    PageHeadingComponent,
  ],
  templateUrl: './groups-create-page.component.html',
})
export class GroupsCreatePageComponent {
  private readonly groupApiService = inject(GroupApiService);
  private readonly router = inject(Router);

  protected readonly groupName = signal('');
  protected readonly description = signal('');
  protected readonly isDiscoverable = signal(false);
  protected readonly joinPolicy = signal<GroupJoinPolicy>('admin-controlled');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly joinPolicyOptions = JOIN_POLICY_OPTIONS;

  protected readonly nameError = signal('');

  /** Validate form fields and return whether the form is valid. */
  protected validateForm(): boolean {
    let valid = true;

    if (!this.groupName().trim()) {
      this.nameError.set('Group name is required.');
      valid = false;
    } else if (this.groupName().trim().length < 2) {
      this.nameError.set('Group name must be at least 2 characters.');
      valid = false;
    } else {
      this.nameError.set('');
    }

    return valid;
  }

  protected createGroup(): void {
    if (!this.validateForm()) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.submitting.set(true);

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
          this.submitting.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.successMessage.set('Group created successfully!');
          void this.router.navigate(['/dashboard/groups']);
        },
        error: () => {
          this.errorMessage.set('Could not create group. Please try again.');
        },
      });
  }

  protected cancel(): void {
    void this.router.navigate(['/dashboard/groups']);
  }
}
