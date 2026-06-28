import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, Injector, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { User } from '@supabase/supabase-js';
import { AuthService } from '../../core/services/auth.service';
import {
  DiscoverQuizCreator,
  DiscoverQuizSummary,
  DiscoverQuizzesResponse,
  QuizApiService,
  QuizSort,
  QuizVisibility,
} from '../../core/services/quiz-api.service';
import { BubblyButtonComponent } from '../../shared/ui/bubbly-button.component';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';
import { BubblyInputComponent } from '../../shared/ui/bubbly-input.component';
import { BubblySelectComponent, BubblySelectOption } from '../../shared/ui/bubbly-select.component';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { buildDisplayName } from '../../shared/utils/display-name';

/**
 * Public quiz discovery page. Browseable while logged out.
 *
 * Layout: sticky top-bar navbar + hero heading + search/sort card + responsive
 * card grid (3 cols at xl) with skeleton loader, empty state, and Prev/Next
 * pagination. Search input is debounced 300ms via an effect that owns its own
 * setTimeout and cleans it up via `onCleanup` so we never leave a dangling
 * timer when the user keeps typing or the component is destroyed.
 *
 * The page is reachable from two routes:
 *   - /quizzes/discover                  (public, anonymous-friendly)
 *   - /dashboard/quizzes/discover        (inside the dashboard shell)
 *
 * Both routes render this component. The auth-aware bits (top-bar nav links,
 * "Host Session" vs. "Login to host" CTA) are driven by the same component
 * — `isLoggedIn` reads AuthService defensively (Injector + try/catch) so a
 * missing auth subsystem (e.g. in tests, or pre-bootstrap) does not crash
 * the page; it just falls back to the anonymous variant.
 */
@Component({
  selector: 'app-discover-quizzes-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageHeadingComponent,
    BubblyCardComponent,
    BubblyButtonComponent,
    BubblySelectComponent,
    BubblyInputComponent,
    StatusPillComponent,
  ],
  templateUrl: './discover-quizzes-page.component.html',
})
export class DiscoverQuizzesPageComponent {
  private readonly quizApi = inject(QuizApiService);
  // Used to lazily resolve AuthService on first read. We don't use
  // `inject(AuthService)` at field level because AuthService's constructor
  // throws synchronously when SupabaseService.client is null (which happens
  // in test envs before ConfigService.load() runs). Reading via the Injector
  // with `optional: true` and a try/catch keeps the public page renderable
  // in that scenario — the cost is one extra `injector.get` per recompute.
  private readonly injector = inject(Injector);

  protected readonly query = signal<string>('');
  protected readonly sort = signal<QuizSort>('newest');
  protected readonly limit = 24;
  protected readonly offset = signal<number>(0);

  /** Debounced search query — drives the fetch effect. */
  private readonly debouncedQuery = signal<string>('');

  protected readonly response = signal<DiscoverQuizzesResponse | null>(null);
  protected readonly loading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly total = computed(() => this.response()?.total ?? 0);
  protected readonly items = computed(() => this.response()?.items ?? []);
  protected readonly canPrev = computed(() => this.offset() > 0);
  protected readonly canNext = computed(() => this.offset() + this.limit < this.total());

  /**
   * True when the visitor is signed in. Re-evaluates automatically when
   * AuthService.isAuthenticated changes. Returns false if AuthService
   * is not available (SSR before bootstrap, tests without Supabase mock).
   */
  protected readonly isLoggedIn = computed<boolean>(() => {
    try {
      const auth = this.injector.get(AuthService, null, { optional: true });
      return auth?.isAuthenticated() ?? false;
    } catch {
      return false;
    }
  });

  protected readonly sortOptions: BubblySelectOption[] = [
    { value: 'newest', label: 'Newest first' },
    { value: 'popular', label: 'Most played' },
    { value: 'alpha', label: 'Alphabetical (A–Z)' },
  ];

  constructor() {
    // Debounce the search query by 300ms before triggering a re-fetch.
    // Using onCleanup ensures the pending timer is cancelled on signal
    // re-emission AND on component destroy.
    effect((onCleanup) => {
      const next = this.query();
      const timer = setTimeout(() => {
        this.debouncedQuery.set(next);
      }, 300);
      onCleanup(() => clearTimeout(timer));
    });

    // Re-fetch whenever the debounced query, sort, or offset changes.
    effect(() => {
      const q = this.debouncedQuery();
      const s = this.sort();
      const o = this.offset();
      this.fetch(q, s, o);
    });
  }

  protected onSearchChange(value: string): void {
    this.query.set(value);
    // New search → reset to first page.
    this.offset.set(0);
  }

  protected onSortChange(value: string): void {
    this.sort.set(this.coerceSort(value));
    this.offset.set(0);
  }

  protected onPrev(): void {
    if (!this.canPrev()) {
      return;
    }
    this.offset.update((o) => Math.max(0, o - this.limit));
  }

  protected onNext(): void {
    if (!this.canNext()) {
      return;
    }
    this.offset.update((o) => o + this.limit);
  }

  /**
   * Build a creator display name from the snake_case creator object returned
   * by the discover endpoint. We construct a minimal Supabase `User` shape so
   * the shared `buildDisplayName()` util can apply its username-then-email
   * fallback policy consistently with the rest of the app.
   */
  protected creatorDisplayName(creator: DiscoverQuizCreator | null | undefined): string {
    if (!creator) {
      return 'Anonymous';
    }

    const fallbackName = (creator.display_name ?? creator.username ?? '').trim();
    const syntheticUser = {
      id: creator.user_id,
      app_metadata: {},
      user_metadata: {
        username: fallbackName,
      },
      aud: 'authenticated',
      created_at: '',
      email: fallbackName.includes('@') ? fallbackName : undefined,
    } as unknown as User;

    const resolved = buildDisplayName(syntheticUser, 'Anonymous').trim();
    return resolved.length > 0 ? resolved : 'Anonymous';
  }

  /**
   * RouterLink + queryParams for the host CTA. Logged-in users get a
   * direct link to the create-session page with the quiz pre-selected;
   * logged-out users get the login page with a `next` param so they
   * land back on discover after signing in.
   *
   * NOTE: `RouterLink` does NOT parse `?key=value` out of a string. A
   * `[routerLink]="'/path?x=1'"` treats the whole thing as the literal
   * path (URL-encoded), no route matches, and the catch-all redirects
   * to home. We therefore return path + queryParams as two separate
   * values and bind them to `[routerLink]` and `[queryParams]`.
   */
  protected hostLinkFor(quiz: DiscoverQuizSummary): string[] {
    return this.isLoggedIn() ? ['/dashboard/create-session'] : ['/login'];
  }

  protected hostQueryParamsFor(
    quiz: DiscoverQuizSummary
  ): Record<string, string | number> {
    if (this.isLoggedIn()) {
      return { quizId: quiz.id };
    }
    return { next: '/quizzes/discover' };
  }

  protected visibilityTone(visibility: QuizVisibility | undefined): 'success' | 'info' | 'neutral' {
    if (visibility === 'public') {
      return 'success';
    }
    if (visibility === 'unlisted') {
      return 'info';
    }
    return 'neutral';
  }

  protected visibilityLabel(visibility: QuizVisibility | undefined): string {
    if (visibility === 'public') {
      return 'Public';
    }
    if (visibility === 'unlisted') {
      return 'Unlisted';
    }
    if (visibility === 'private') {
      return 'Private';
    }
    return 'Public';
  }

  /** Defensive coercion for the BubblySelect ngModel binding. */
  private coerceSort(value: string): QuizSort {
    if (value === 'newest' || value === 'popular' || value === 'alpha') {
      return value;
    }
    return 'newest';
  }

  private fetch(q: string, s: QuizSort, o: number): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.quizApi.searchPublicQuizzes(q, s, this.limit, o).subscribe({
      next: (res) => {
        this.response.set(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load quizzes.';
        this.errorMessage.set(message);
        this.loading.set(false);
      },
    });
  }
}
