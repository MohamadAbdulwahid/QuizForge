import { computed, inject, Injectable, signal } from '@angular/core';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { GroupActiveSessionSummary, GroupApiService, MyGroupSummary } from './group-api.service';
import { HostSessionSummary, SessionApiService } from './session-api.service';
import { QuizApiService } from './quiz-api.service';

interface JoinableSession extends GroupActiveSessionSummary {
  groupName: string;
}

interface DashboardData {
  groups: MyGroupSummary[];
  joinableSessions: JoinableSession[];
  recentSessions: HostSessionSummary[];
  quizCount: number;
  sessionCount: number;
  groupCount: number;
}

interface GroupsAndSessions {
  groups: MyGroupSummary[];
  sessions: JoinableSession[];
}

/**
 * Service-level cache for dashboard data.
 * Persists data across route navigations so the dashboard loads instantly on revisit.
 * Only refreshes after the staleness timeout or on explicit refresh.
 */
@Injectable({ providedIn: 'root' })
export class DashboardCacheService {
  private readonly groupApiService = inject(GroupApiService);
  private readonly sessionApiService = inject(SessionApiService);
  private readonly quizApiService = inject(QuizApiService);

  private readonly STALENESS_MS = 5 * 60 * 1000; // 5 minutes

  // Cached data
  private readonly data = signal<DashboardData | null>(null);
  private readonly lastFetchedAt = signal<number>(0);
  private readonly loading = signal(false);
  private readonly error = signal<string | null>(null);

  // Public readonly signals
  readonly isLoaded = computed(() => this.data() !== null);
  readonly isLoading = computed(() => this.loading());
  readonly hasError = computed(() => this.error() !== null);
  readonly errorMessage = computed(() => this.error());

  readonly groups = computed(() => this.data()?.groups ?? []);
  readonly joinableSessions = computed(() => this.data()?.joinableSessions ?? []);
  readonly recentSessions = computed(() => this.data()?.recentSessions ?? []);
  readonly quizCount = computed(() => this.data()?.quizCount ?? 0);
  readonly sessionCount = computed(() => this.data()?.sessionCount ?? 0);
  readonly groupCount = computed(() => this.data()?.groupCount ?? 0);

  readonly hasJoinableSessions = computed(() => this.joinableSessions().length > 0);
  readonly hasRecentSessions = computed(() => this.recentSessions().length > 0);
  readonly hasGroups = computed(() => this.groups().length > 0);

  /**
   * Returns true if cached data is older than the staleness threshold.
   */
  isStale(): boolean {
    const lastFetched = this.lastFetchedAt();
    if (lastFetched === 0) return true;
    return Date.now() - lastFetched > this.STALENESS_MS;
  }

  /**
   * Loads dashboard data. If fresh cache exists, returns immediately.
   * Otherwise fetches from API and updates cache.
   */
  load(forceRefresh = false): void {
    // If we have fresh data and not forcing refresh, skip
    if (!forceRefresh && this.data() && !this.isStale()) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.fetchGroupsAndSessions()
      .pipe(
        switchMap(({ groups, sessions }) => this.fetchRemainingData(groups, sessions)),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (result) => {
          this.data.set(result);
          this.lastFetchedAt.set(Date.now());
        },
        error: () => {
          this.error.set('Failed to load some dashboard data.');
        },
      });
  }

  private fetchGroupsAndSessions(): Observable<GroupsAndSessions> {
    return this.groupApiService.getMyGroups().pipe(
      switchMap((groups) => {
        if (groups.length === 0) {
          return of({ groups, sessions: [] as JoinableSession[] });
        }

        const sessionRequests: Observable<JoinableSession[]>[] = groups.map((group) =>
          this.groupApiService.getActiveSessions(group.id).pipe(
            map((sessions) => sessions.map((s) => ({ ...s, groupName: group.name }))),
            catchError(() => of<JoinableSession[]>([]))
          )
        );

        return forkJoin(sessionRequests).pipe(
          map((allSessions) => ({ groups, sessions: allSessions.flat() }))
        );
      }),
      catchError(() => of<GroupsAndSessions>({ groups: [], sessions: [] }))
    );
  }

  private fetchRemainingData(
    groups: MyGroupSummary[],
    sessions: JoinableSession[]
  ): Observable<DashboardData> {
    return forkJoin({
      quizzes: this.quizApiService.getMyQuizzes().pipe(catchError(() => of([]))),
      hostedSessions: this.sessionApiService.getMySessions().pipe(catchError(() => of([]))),
    }).pipe(
      map(({ quizzes, hostedSessions }) => ({
        groups,
        joinableSessions: sessions,
        recentSessions: hostedSessions.slice(0, 5),
        quizCount: quizzes.length,
        sessionCount: hostedSessions.length,
        groupCount: groups.length,
      }))
    );
  }

  /**
   * Explicitly refreshes dashboard data from the API.
   */
  refresh(): void {
    this.load(true);
  }

  /**
   * Clears the cache (e.g., on logout).
   */
  clear(): void {
    this.data.set(null);
    this.lastFetchedAt.set(0);
    this.error.set(null);
  }
}
