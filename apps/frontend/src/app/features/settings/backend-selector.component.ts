import { Component, inject, signal } from '@angular/core';
import { ConfigService } from '../../core/services/config.service';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';
import { BubblyInputComponent } from '../../shared/ui/bubbly-input.component';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';

interface BackendProfile {
  url: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  sentryDsn: string;
}

interface BackendProfiles {
  backends: BackendProfile[];
}

const STORAGE_KEY = 'qf-backend-profiles';

@Component({
  selector: 'app-backend-selector',
  standalone: true,
  imports: [
    BubblyCardComponent,
    BubblyInputComponent,
    BubblyButtonComponent,
  ],
  template: `
    <div class="grid gap-6">
      <!-- Loading state -->
      @if (!configService.isReady()) {
        <app-bubbly-card tone="surface">
          <div class="flex items-center gap-3">
            <span class="loading loading-spinner loading-sm"></span>
            <p class="text-sm font-semibold text-[var(--bubbly-muted)]">
              Loading configuration...
            </p>
          </div>
        </app-bubbly-card>
      } @else {
        <!-- Current backend -->
        <app-bubbly-card tone="primary">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="text-xs font-bold uppercase tracking-wide text-white/70">
                Active Backend
              </p>
              <p
                class="mt-1 truncate text-base font-bold text-white sm:text-lg"
                [attr.title]="configService.backendUrl()"
              >
                {{ formatUrl(configService.backendUrl()) }}
              </p>
            </div>
            <span
              class="inline-flex shrink-0 items-center rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white"
            >
              Connected
            </span>
          </div>
        </app-bubbly-card>

        <!-- Saved backends -->
        <app-bubbly-card tone="surface">
          <h3 class="font-display text-lg font-bold text-[var(--bubbly-text)]">
            Saved Backends
          </h3>
          <p class="mt-1 text-sm font-semibold text-[var(--bubbly-muted)]">
            Switch between backends or add a custom one.
          </p>

          @if (profiles().length === 0) {
            <p class="mt-4 text-sm text-[var(--bubbly-muted)]">
              No saved backends. Add one below.
            </p>
          } @else {
            <ul
              class="mt-4 grid gap-3"
              role="listbox"
              aria-label="Saved backends"
            >
              @for (profile of profiles(); track profile.url) {
                <li
                  class="flex flex-col gap-3 rounded-2xl border-2 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
                  [class.border-[var(--bubbly-primary)]]="profile.url === configService.backendUrl()"
                  [class.border-transparent]="profile.url !== configService.backendUrl()"
                  [class.bg-[var(--bubbly-primary)]]="profile.url === configService.backendUrl()"
                  role="option"
                  [attr.aria-selected]="profile.url === configService.backendUrl()"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <p
                        class="truncate text-sm font-bold"
                        [class.text-white]="profile.url === configService.backendUrl()"
                        [class.text-[var(--bubbly-text)]]="profile.url !== configService.backendUrl()"
                        [attr.title]="profile.url"
                      >
                        {{ formatUrl(profile.url) }}
                      </p>
                      @if (profile.url === configService.backendUrl()) {
                        <span
                          class="inline-flex shrink-0 items-center rounded-full bg-white/25 px-2.5 py-0.5 text-[0.625rem] font-bold text-white"
                        >
                          Active
                        </span>
                      }
                      @if ($index === profiles().length - 1 && profile.url !== configService.backendUrl()) {
                        <span
                          class="inline-flex shrink-0 items-center rounded-full bg-[var(--bubbly-muted)]/15 px-2.5 py-0.5 text-[0.625rem] font-bold text-[var(--bubbly-muted)]"
                        >
                          Custom
                        </span>
                      }
                    </div>
                    <p
                      class="mt-1 truncate text-xs"
                      [class.text-white/60]="profile.url === configService.backendUrl()"
                      [class.text-[var(--bubbly-muted)]]="profile.url !== configService.backendUrl()"
                    >
                      {{ profile.supabaseUrl }}
                    </p>
                  </div>

                  <div class="flex shrink-0 gap-2">
                    @if (profile.url !== configService.backendUrl()) {
                      <app-bubbly-button
                        tone="ghost"
                        size="sm"
                        (click)="switchTo(profile.url)"
                        [disabled]="switching()"
                        [attr.aria-label]="'Switch to ' + formatUrl(profile.url)"
                      >
                        {{ switching() ? 'Switching...' : 'Switch' }}
                      </app-bubbly-button>
                      <app-bubbly-button
                        tone="ghost"
                        size="sm"
                        (click)="removeProfile(profile.url)"
                        [attr.aria-label]="'Remove ' + formatUrl(profile.url)"
                      >
                        Remove
                      </app-bubbly-button>
                    }
                  </div>
                </li>
              }
            </ul>
          }
        </app-bubbly-card>

        <!-- Error message -->
        @if (errorMessage()) {
          <div
            class="rounded-2xl border-2 border-[var(--bubbly-error-border)] bg-[var(--bubbly-error-bg)] p-4"
            role="alert"
          >
            <p class="text-sm font-bold text-[var(--bubbly-error-text)]">
              {{ errorMessage() }}
            </p>
          </div>
        }

        <!-- Add custom backend -->
        <app-bubbly-card tone="soft">
          <h3 class="font-display text-lg font-bold text-[var(--bubbly-text)]">
            Add Custom Backend
          </h3>
          <p class="mt-1 text-sm font-semibold text-[var(--bubbly-muted)]">
            Enter the URL of a self-hosted QuizForge backend.
          </p>

          <div class="mt-4 flex flex-col gap-3 sm:flex-row">
            <div class="flex-1">
              <app-bubbly-input
                label="Backend URL"
                type="url"
                placeholder="https://my-backend.example.com"
                [error]="urlError()"
                (input)="onUrlInput($event)"
              />
            </div>
            <div class="flex items-end">
              <app-bubbly-button
                tone="accent"
                [disabled]="!customUrl() || switching()"
                (click)="addCustom(customUrl())"
              >
                {{ switching() ? 'Adding...' : 'Add' }}
              </app-bubbly-button>
            </div>
          </div>
        </app-bubbly-card>
      }
    </div>
  `,
})
export class BackendSelectorComponent {
  protected readonly configService = inject(ConfigService);

  protected readonly profiles = signal<BackendProfile[]>([]);
  protected readonly switching = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly customUrl = signal('');
  protected readonly urlError = signal('');

  constructor() {
    this.loadProfiles();
  }

  switchTo(url: string): void {
    this.errorMessage.set(null);
    this.switching.set(true);

    this.configService
      .switchBackend(url)
      .then(() => {
        this.loadProfiles();
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Failed to switch backend.';
        this.errorMessage.set(message);
      })
      .finally(() => {
        this.switching.set(false);
      });
  }

  addCustom(url: string): void {
    this.urlError.set('');
    this.errorMessage.set(null);

    if (!url) {
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      this.urlError.set('Please enter a valid URL (e.g., https://example.com).');
      return;
    }

    // Normalize: strip trailing slashes
    const normalizedUrl = url.replace(/\/+$/, '');

    // Check for duplicate
    if (this.profiles().some((p) => p.url === normalizedUrl)) {
      this.urlError.set('This backend is already saved.');
      return;
    }

    this.switching.set(true);

    this.configService
      .switchBackend(normalizedUrl)
      .then(() => {
        this.loadProfiles();
        this.customUrl.set('');
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Failed to add backend.';
        this.errorMessage.set(message);
      })
      .finally(() => {
        this.switching.set(false);
      });
  }

  removeProfile(url: string): void {
    this.errorMessage.set(null);

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw) as BackendProfiles;
      data.backends = data.backends.filter((b) => b.url !== url);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      this.loadProfiles();
    } catch {
      this.errorMessage.set('Failed to remove backend profile.');
    }
  }

  onUrlInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.customUrl.set(value);
    this.urlError.set('');
  }

  formatUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.host;
    } catch {
      return url;
    }
  }

  private loadProfiles(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.profiles.set([]);
        return;
      }

      const data = JSON.parse(raw) as BackendProfiles;
      if (data && Array.isArray(data.backends)) {
        this.profiles.set([...data.backends]);
      } else {
        this.profiles.set([]);
      }
    } catch {
      this.profiles.set([]);
    }
  }
}
