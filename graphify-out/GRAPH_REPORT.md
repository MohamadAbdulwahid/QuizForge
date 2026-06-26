# Graph Report - QuizForge  (2026-06-26)

## Corpus Check
- 309 files · ~280,286 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 301 nodes · 419 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9183dfc0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]

## God Nodes (most connected - your core abstractions)
1. `BrPlayerPageComponent` - 29 edges
2. `ConfigService` - 27 edges
3. `WebsocketService` - 24 edges
4. `BubblePopComponent` - 18 edges
5. `AuthService` - 18 edges
6. `BrHostPageComponent` - 14 edges
7. `BackendSelectorComponent` - 9 edges
8. `ApiService` - 8 edges
9. `DashboardShellComponent` - 8 edges
10. `Sprint Backlog Items` - 8 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (14 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (14): E2E Tests, Integration Tests, PB-104 + PB-105 + PB-63: Owner Admin Dashboard, Analytics, and Monitoring (Behrang), PB-39 + PB-40 + PB-44 + PB-76: Session Join Flow, Username Validation, and Live Lobby (Mohamad), PB-42 + PB-43 + PB-100 + PB-101 + PB-102: Stability, Performance, and Database Optimization (Nishan), PB-79 + PB-80 + PB-54: Question Screen, Answer Submission, and Live Leaderboard (David), PB-82 + PB-83 + PB-86: Chest Generation, Gold Economy & Validation (Backend), PB-84 + PB-85 + PB-89 + PB-90: Treasure Chest UI, Animations & Gold Display (Frontend) (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (39): HostDuelDisplay, OPTION_PALETTE, AnswerAckEvent, BrBubblePopRankingEvent, BrBubblePopStartEvent, BrCurseAwardedEvent, BrCurseCastEvent, BrCurseOpportunityEvent (+31 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (31): ConfigHandler, ConfigResponse, CreateGroupHandler, CreateQuizHandler, CreateSessionHandler, DeleteQuizHandler, ErrorResponse, GetGroupByIdHandler (+23 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (18): appConfig, appRoutes, environment, mockAuthService, mockConfigService, mockSupabaseService, mockWebsocketService, authInterceptor() (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (4): AppNavItem, DashboardShellComponent, ApiService, SessionSseService

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (8): Config, envSchema, parsedEnv, configRouter, registerRoutes(), app, server, stopCleanup

### Community 8 - "Community 8"
Cohesion: 0.19
Nodes (3): BackendProfile, BackendProfiles, BackendSelectorComponent

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (11): CURSE_ICONS, OPTION_BORDER_COLORS, OPTION_COLORS, POWER_UP_ICONS, mockAuthService, mockWebsocketService, AuthService, BrLivesBarComponent (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (5): BubbleData, BubblePopComponent, ChallengePhase, clickBubble(), findBubble()

### Community 12 - "Community 12"
Cohesion: 0.50
Nodes (3): createClientMock, onAuthStateChangeMock, unsubscribeMock

## Knowledge Gaps
- **106 isolated node(s):** `mockAuthService`, `mockWebsocketService`, `POWER_UP_ICONS`, `CURSE_ICONS`, `OPTION_COLORS` (+101 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WebsocketService` connect `Community 4` to `Community 9`, `Community 3`, `Community 1`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **Why does `AuthService` connect `Community 9` to `Community 1`, `Community 3`, `Community 5`?**
  _High betweenness centrality (0.187) - this node is a cross-community bridge._
- **Why does `BrPlayerPageComponent` connect `Community 6` to `Community 9`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **What connects `mockAuthService`, `mockWebsocketService`, `POWER_UP_ICONS` to the rest of the system?**
  _106 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0545876887340302 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._