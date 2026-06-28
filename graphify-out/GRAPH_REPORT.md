# Graph Report - QuizForge  (2026-06-29)

## Corpus Check
- 325 files · ~304,921 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 929 nodes · 1190 edges · 58 communities (42 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `972074aa`
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
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]

## God Nodes (most connected - your core abstractions)
1. `QuizBuilderPageComponent` - 48 edges
2. `BrPlayerPageComponent` - 29 edges
3. `ConfigService` - 27 edges
4. `WebsocketService` - 24 edges
5. `AuthService` - 19 edges
6. `BubblePopComponent` - 18 edges
7. `DiscoverQuizzesPageComponent` - 16 edges
8. `QuizApiService` - 14 edges
9. `BrHostPageComponent` - 14 edges
10. `public.group` - 11 edges

## Surprising Connections (you probably didn't know these)
- `QuestionDraft` --references--> `QuestionType`  [EXTRACTED]
  apps/frontend/src/app/features/dashboard/quizzes/quiz-builder-page.component.ts → apps/frontend/src/app/core/services/quiz-api.service.ts
- `TestHarness` --references--> `DiscoverQuizzesPageComponent`  [EXTRACTED]
  apps/frontend/src/app/features/discover/discover-quizzes-page.component.spec.ts → apps/frontend/src/app/features/discover/discover-quizzes-page.component.ts
- `createSession()` --calls--> `incrementQuizPlayCount()`  [EXTRACTED]
  apps/backend/src/api/services/session.service.ts → apps/backend/src/api/services/quiz.service.ts
- `DiscoverQuizzesPageComponent` --references--> `BubblySelectOption`  [EXTRACTED]
  apps/frontend/src/app/features/discover/discover-quizzes-page.component.ts → apps/frontend/src/app/shared/ui/bubbly-select.component.ts

## Import Cycles
- None detected.

## Communities (58 total, 16 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (14): E2E Tests, Integration Tests, PB-104 + PB-105 + PB-63: Owner Admin Dashboard, Analytics, and Monitoring (Behrang), PB-39 + PB-40 + PB-44 + PB-76: Session Join Flow, Username Validation, and Live Lobby (Mohamad), PB-42 + PB-43 + PB-100 + PB-101 + PB-102: Stability, Performance, and Database Optimization (Nishan), PB-79 + PB-80 + PB-54: Question Screen, Answer Submission, and Live Leaderboard (David), PB-82 + PB-83 + PB-86: Chest Generation, Gold Economy & Validation (Backend), PB-84 + PB-85 + PB-89 + PB-90: Treasure Chest UI, Animations & Gold Display (Frontend) (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (39): HostDuelDisplay, OPTION_PALETTE, AnswerAckEvent, BrBubblePopRankingEvent, BrBubblePopStartEvent, BrCurseAwardedEvent, BrCurseCastEvent, BrCurseOpportunityEvent (+31 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (32): ConfigHandler, ConfigResponse, CreateGroupHandler, CreateQuizHandler, CreateSessionHandler, DeleteQuizHandler, DiscoverQuizzesHandler, ErrorResponse (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (12): CURSE_ICONS, OPTION_BORDER_COLORS, OPTION_COLORS, POWER_UP_ICONS, mockAuthService, mockWebsocketService, WebsocketService, io (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.16
Nodes (3): AppNavItem, DashboardShellComponent, SessionSseService

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (8): Config, envSchema, parsedEnv, configRouter, registerRoutes(), app, server, stopCleanup

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (5): BubbleData, BubblePopComponent, ChallengePhase, clickBubble(), findBubble()

### Community 12 - "Community 12"
Cohesion: 0.50
Nodes (3): createClientMock, onAuthStateChangeMock, unsubscribeMock

### Community 15 - "Community 15"
Cohesion: 0.05
Nodes (43): group_join_request_group_id_group_id_fk, group_join_request_requester_user_id_users_id_fk, group_join_request_responded_by_user_id_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate (+35 more)

### Community 16 - "Community 16"
Cohesion: 0.05
Nodes (41): group_member_group_id_group_id_fk, group_member_user_id_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate, tableFrom (+33 more)

### Community 17 - "Community 17"
Cohesion: 0.05
Nodes (40): created_at, invited_by_user_id, invited_user_id, requester_user_id, responded_at, responded_by_user_id, status, default (+32 more)

### Community 18 - "Community 18"
Cohesion: 0.06
Nodes (32): dialect, id, invite_user_idx, columns, concurrently, isUnique, method, name (+24 more)

### Community 19 - "Community 19"
Cohesion: 0.06
Nodes (33): group_created_by_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate, schemaTo, tableFrom (+25 more)

### Community 20 - "Community 20"
Cohesion: 0.07
Nodes (29): created_by, description, is_discoverable, join_policy, name, name, notNull, primaryKey (+21 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (28): name, notNull, primaryKey, type, ai_explanation, relationship_type, source_node_id, strength (+20 more)

### Community 22 - "Community 22"
Cohesion: 0.07
Nodes (27): group_invite_group_id_group_id_fk, group_invite_invited_by_user_id_users_id_fk, group_invite_invited_user_id_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate (+19 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (12): DiscoverQuizzesPageComponent, createQuizApiMock(), QuizApiMock, SAMPLE_QUIZ, SECOND_QUIZ, setupComponent(), TestHarness, DiscoverQuizCreator (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.08
Nodes (26): knowledge_edge_source_node_id_knowledge_node_id_fk, knowledge_edge_target_node_id_knowledge_node_id_fk, knowledge_edge_user_id_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate (+18 more)

### Community 25 - "Community 25"
Cohesion: 0.11
Nodes (13): DiscoverableQuizRow, findById(), findByIdWithQuestions(), incrementPlayCount(), QuizSearchSort, update(), insertQuestion, insertQuiz (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.09
Nodes (22): baseFields, discoverQuizSummarySchema, discoverQuizzesResponseSchema, fillInBlankOptionSchema, fillInBlankSchema, matchingLeftOptionSchema, matchingSchema, multipleChoiceSchema (+14 more)

### Community 27 - "Community 27"
Cohesion: 0.09
Nodes (22): knowledge_edge_source_idx, knowledge_edge_target_idx, knowledge_edge_user_idx, columns, concurrently, isUnique, method, name (+14 more)

### Community 28 - "Community 28"
Cohesion: 0.16
Nodes (7): environment, BackendProfile, BackendProfiles, ConfigResponse, mockConfig, BackendProfile, BackendProfiles

### Community 29 - "Community 29"
Cohesion: 0.21
Nodes (12): TestQuestion, AiGeneratedQuestion, AiGenerateRequest, AiGenerateResponse, DiscoverQuizzesQuery, QuizDetailDto, QuizOptionDto, QuizOptions (+4 more)

### Community 30 - "Community 30"
Cohesion: 0.14
Nodes (12): CreateQuizRequest, DiscoverQuizSummary, DiscoverQuizzesQuery, DiscoverQuizzesResponse, UpdateQuizRequest, createQuiz(), createQuizWithCollisionGuard(), PublicQuestion (+4 more)

### Community 31 - "Community 31"
Cohesion: 0.20
Nodes (12): incrementQuizPlayCount(), createSession(), fromSessionState(), getSessionByPin(), getSessionLeaderboard(), PublicLeaderboardEntry, PublicSession, PublicSessionView (+4 more)

### Community 32 - "Community 32"
Cohesion: 0.19
Nodes (8): mockAuthService, mockConfigService, mockSupabaseService, mockWebsocketService, SignInPayload, SignUpPayload, AuthChangePayload, SupabaseService

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (10): createQuizRequestSchema, discoverQuizzesQuerySchema, quizIdParamSchema, shareCodeParamSchema, updateQuizRequestSchema, quizPublicRouter, quizRouter, deleteQuiz() (+2 more)

### Community 34 - "Community 34"
Cohesion: 0.27
Nodes (9): createDefaultQuestion(), createFibOption(), createOption(), defaultOptionsForType(), FieldError, QuestionDraft, QuestionOption, QuestionType (+1 more)

### Community 36 - "Community 36"
Cohesion: 0.20
Nodes (10): identity, cache, cycle, increment, maxValue, minValue, name, schema (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (4): appConfig, appRoutes, authInterceptor(), initSentry()

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (5): QuizSortMode, QuizSummary, BubblyButtonComponent, BubblyButtonSize, BubblyButtonTone

### Community 44 - "Community 44"
Cohesion: 0.29
Nodes (7): role, default, name, notNull, primaryKey, type, typeSchema

### Community 45 - "Community 45"
Cohesion: 0.33
Nodes (6): group_id, name, notNull, primaryKey, type, columns

### Community 46 - "Community 46"
Cohesion: 0.33
Nodes (6): joined_at, default, name, notNull, primaryKey, type

### Community 47 - "Community 47"
Cohesion: 0.40
Nodes (5): concept_label, name, notNull, primaryKey, type

### Community 48 - "Community 48"
Cohesion: 0.40
Nodes (5): id, name, notNull, primaryKey, type

### Community 49 - "Community 49"
Cohesion: 0.40
Nodes (5): mastery_score, name, primaryKey, type, columns

### Community 50 - "Community 50"
Cohesion: 0.40
Nodes (5): quiz_id, name, notNull, primaryKey, type

### Community 51 - "Community 51"
Cohesion: 0.40
Nodes (5): user_id, name, notNull, primaryKey, type

## Knowledge Gaps
- **463 isolated node(s):** `questionTypeSchema`, `quizVisibilitySchema`, `quizStatusSchema`, `quizSortSchema`, `textOptionSchema` (+458 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthService` connect `Community 9` to `Community 32`, `Community 1`, `Community 4`, `Community 5`, `Community 37`, `Community 23`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `tables` connect `Community 18` to `Community 16`, `Community 19`, `Community 15`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `public.knowledge_edge` connect `Community 18` to `Community 24`, `Community 27`, `Community 21`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `questionTypeSchema`, `quizVisibilitySchema`, `quizStatusSchema` to the rest of the system?**
  _463 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0545876887340302 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._