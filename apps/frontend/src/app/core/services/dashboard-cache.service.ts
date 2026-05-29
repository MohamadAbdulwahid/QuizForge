import { computed, inject, Injectable, signal } from '@angular/core';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { GroupActiveSessionSummary, GroupApiService, MyGroupSummary } from './group-api.service';
import { QuizApiService } from './quiz-api.service';
import { SessionEventBus } from './session-event-bus.service';

interface JoinableSession extends GroupActiveSessionSummary {
  groupName: string;
}

interface DashboardData {
  groups: MyGroupSummary[];
  joinableSessions: JoinableSession[];
  quizCount: number;
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
 * Joinable sessions are refreshed reactively via SessionEventBus — no polling needed.
 */
@Injectable({ providedIn: 'root' })
export class DashboardCacheService {
  private readonly groupApiService = inject(GroupApiService);
  private readonly quizApiService = inject(QuizApiService);
  private readonly sessionEventBus = inject(SessionEventBus);

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
  readonly quizCount = computed(() => this.data()?.quizCount ?? 0);
  readonly groupCount = computed(() => this.data()?.groupCount ?? 0);

  readonly hasJoinableSessions = computed(() => this.joinableSessions().length > 0);
  readonly hasGroups = computed(() => this.groups().length > 0);

  constructor() {
    // Re-fetch joinable sessions whenever a session is created or ended.
    // This keeps the dashboard signal-driven without polling or WebSocket.
    this.sessionEventBus.sessionChanges$
      .pipe(
        switchMap(() => {
          const currentGroups = this.groups();
          if (currentGroups.length === 0) return of(null);

          const sessionRequests: Observable<JoinableSession[]>[] = currentGroups.map((group) =>
            this.groupApiService.getActiveSessions(group.id).pipe(
              map((sessions) => sessions.map((s) => ({ ...s, groupName: group.name }))),
              catchError(() => of<JoinableSession[]>([]))
            )
          );

          return forkJoin(sessionRequests).pipe(
            map((allSessions) => this.deduplicateBySessionId(allSessions.flat())),
            catchError(() => of<JoinableSession[] | null>(null))
          );
        })
      )
      .subscribe((sessions) => {
        if (sessions !== null) {
          const current = this.data();
          if (current) {
            this.data.set({ ...current, joinableSessions: sessions });
          }
        }
      });
  }

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
          map((allSessions) => ({
            groups,
            sessions: this.deduplicateBySessionId(allSessions.flat()),
          }))
        );
      }),
      catchError(() => of<GroupsAndSessions>({ groups: [], sessions: [] }))
    );
  }

  private fetchRemainingData(
    groups: MyGroupSummary[],
    sessions: JoinableSession[]
  ): Observable<DashboardData> {
    return this.quizApiService.getMyQuizzes().pipe(
      map((quizzes) => ({
        groups,
        joinableSessions: sessions,
        quizCount: quizzes.length,
        groupCount: groups.length,
      })),
      catchError(() =>
        of({
          groups,
          joinableSessions: sessions,
          quizCount: 0,
          groupCount: groups.length,
        })
      )
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

  /**
   * Removes duplicate sessions caused by the same session being broadcast
   * to multiple groups that the user belongs to.
   */
  private deduplicateBySessionId(sessions: JoinableSession[]): JoinableSession[] {
    const seen = new Map<number, JoinableSession>();
    for (const s of sessions) {
      if (!seen.has(s.session_id)) {
        seen.set(s.session_id, s);
      }
    }
    return Array.from(seen.values());
  }
}
