# Graph Report - QuizForge  (2026-06-29)

## Corpus Check
- 325 files · ~304,943 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1378 nodes · 1680 edges · 111 communities (90 shown, 21 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e99ecfa0`
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
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]

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

## Communities (111 total, 21 thin omitted)

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
Cohesion: 0.18
Nodes (11): invited_by_user_id, invited_user_id, name, notNull, primaryKey, type, name, notNull (+3 more)

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (8): dialect, id, prevId, name, schema, tables, public.knowledge_node, version

### Community 19 - "Community 19"
Cohesion: 0.06
Nodes (33): group_created_by_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate, schemaTo, tableFrom (+25 more)

### Community 20 - "Community 20"
Cohesion: 0.07
Nodes (29): created_by, description, is_discoverable, join_policy, name, name, notNull, primaryKey (+21 more)

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (6): name, notNull, primaryKey, type, ai_explanation, columns

### Community 22 - "Community 22"
Cohesion: 0.05
Nodes (43): group_invite_group_id_group_id_fk, group_invite_invited_by_user_id_users_id_fk, group_invite_invited_user_id_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate (+35 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (12): DiscoverQuizzesPageComponent, createQuizApiMock(), QuizApiMock, SAMPLE_QUIZ, SECOND_QUIZ, setupComponent(), TestHarness, DiscoverQuizCreator (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.08
Nodes (26): knowledge_edge_source_node_id_knowledge_node_id_fk, knowledge_edge_target_node_id_knowledge_node_id_fk, knowledge_edge_user_id_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate (+18 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (6): DiscoverableQuizRow, findById(), findByIdWithQuestions(), incrementPlayCount(), QuizSearchSort, update()

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
Cohesion: 0.19
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
Cohesion: 0.33
Nodes (7): createDefaultQuestion(), createFibOption(), createOption(), defaultOptionsForType(), FieldError, QuestionOption, QuizQuestionDto

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
Cohesion: 0.40
Nodes (5): group_id, name, notNull, primaryKey, type

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (7): joined_at, default, name, notNull, primaryKey, type, columns

### Community 47 - "Community 47"
Cohesion: 0.20
Nodes (10): concept_label, mastery_score, name, notNull, primaryKey, type, name, primaryKey (+2 more)

### Community 48 - "Community 48"
Cohesion: 0.40
Nodes (5): id, name, notNull, primaryKey, type

### Community 49 - "Community 49"
Cohesion: 0.05
Nodes (41): group_member_group_id_group_id_fk, group_member_user_id_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate, tableFrom (+33 more)

### Community 50 - "Community 50"
Cohesion: 0.40
Nodes (5): quiz_id, name, notNull, primaryKey, type

### Community 51 - "Community 51"
Cohesion: 0.40
Nodes (5): user_id, name, notNull, primaryKey, type

### Community 52 - "Community 52"
Cohesion: 0.06
Nodes (16): KnowledgeGraphPageComponent, D3Edge, D3Node, KnowledgeEdge, KnowledgeGraphComponent, KnowledgeNode, masteryColor(), masteryFill() (+8 more)

### Community 58 - "Community 58"
Cohesion: 0.05
Nodes (37): dialect, id, invite_user_idx, join_request_group_idx, columns, concurrently, isUnique, method (+29 more)

### Community 59 - "Community 59"
Cohesion: 0.06
Nodes (33): group_created_by_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate, schemaTo, tableFrom (+25 more)

### Community 60 - "Community 60"
Cohesion: 0.07
Nodes (29): created_by, description, is_discoverable, join_policy, name, name, notNull, primaryKey (+21 more)

### Community 61 - "Community 61"
Cohesion: 0.07
Nodes (27): group_invite_group_id_group_id_fk, group_invite_invited_by_user_id_users_id_fk, group_invite_invited_user_id_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate (+19 more)

### Community 62 - "Community 62"
Cohesion: 0.07
Nodes (27): group_join_request_group_id_group_id_fk, group_join_request_requester_user_id_users_id_fk, group_join_request_responded_by_user_id_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate (+19 more)

### Community 63 - "Community 63"
Cohesion: 0.16
Nodes (11): getGraphByUserId(), knowledgeGraphRouter, logger, InsertKnowledgeEdge, InsertKnowledgeNode, KNOWLEDGE_EDGE, KNOWLEDGE_NODE, KNOWLEDGE_RELATIONSHIP_TYPE (+3 more)

### Community 64 - "Community 64"
Cohesion: 0.26
Nodes (11): AiKnowledgeResponse, analyzeSession(), AnswerEvent, buildSystemPrompt(), buildUserMessage(), callAiApi(), fetchSessionAnswerEvents(), groupByPlayer() (+3 more)

### Community 65 - "Community 65"
Cohesion: 0.18
Nodes (11): invited_by_user_id, invited_user_id, name, notNull, primaryKey, type, name, notNull (+3 more)

### Community 66 - "Community 66"
Cohesion: 0.18
Nodes (11): requester_user_id, responded_by_user_id, columns, name, notNull, primaryKey, type, name (+3 more)

### Community 67 - "Community 67"
Cohesion: 0.18
Nodes (11): requester_user_id, responded_by_user_id, columns, name, notNull, primaryKey, type, name (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.20
Nodes (10): identity, cache, cycle, increment, maxValue, minValue, name, schema (+2 more)

### Community 69 - "Community 69"
Cohesion: 0.22
Nodes (9): knowledge_edge_source_node_id_knowledge_node_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate, tableFrom, tableTo (+1 more)

### Community 70 - "Community 70"
Cohesion: 0.22
Nodes (9): knowledge_edge_user_id_users_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate, schemaTo, tableFrom (+1 more)

### Community 72 - "Community 72"
Cohesion: 0.25
Nodes (8): mastery_score, name, primaryKey, type, columns, name, schema, public.knowledge_node

### Community 73 - "Community 73"
Cohesion: 0.25
Nodes (8): knowledge_edge_target_node_id_knowledge_node_id_fk, columnsFrom, columnsTo, name, onDelete, onUpdate, tableFrom, tableTo

### Community 74 - "Community 74"
Cohesion: 0.25
Nodes (8): knowledge_edge_source_idx, columns, concurrently, isUnique, method, name, with, indexes

### Community 75 - "Community 75"
Cohesion: 0.25
Nodes (8): checkConstraints, compositePrimaryKeys, isRLSEnabled, name, policies, schema, uniqueConstraints, public.knowledge_edge

### Community 76 - "Community 76"
Cohesion: 0.25
Nodes (8): checkConstraints, compositePrimaryKeys, isRLSEnabled, name, policies, schema, uniqueConstraints, public.knowledge_edge

### Community 77 - "Community 77"
Cohesion: 0.25
Nodes (7): insertQuestion, insertQuiz, QUESTION, questionType, QUIZ, quizStatus, quizVisibility

### Community 78 - "Community 78"
Cohesion: 0.29
Nodes (7): joined_at, default, name, notNull, primaryKey, type, columns

### Community 79 - "Community 79"
Cohesion: 0.29
Nodes (7): role, default, name, notNull, primaryKey, type, typeSchema

### Community 80 - "Community 80"
Cohesion: 0.29
Nodes (7): status, default, name, notNull, primaryKey, type, typeSchema

### Community 81 - "Community 81"
Cohesion: 0.29
Nodes (7): knowledge_edge_target_idx, columns, concurrently, isUnique, method, name, with

### Community 82 - "Community 82"
Cohesion: 0.29
Nodes (7): knowledge_edge_user_idx, columns, concurrently, isUnique, method, name, with

### Community 83 - "Community 83"
Cohesion: 0.29
Nodes (7): status, default, name, notNull, primaryKey, type, typeSchema

### Community 84 - "Community 84"
Cohesion: 0.33
Nodes (6): name, notNull, primaryKey, type, ai_explanation, columns

### Community 85 - "Community 85"
Cohesion: 0.33
Nodes (6): created_at, default, name, notNull, primaryKey, type

### Community 86 - "Community 86"
Cohesion: 0.33
Nodes (6): relationship_type, name, notNull, primaryKey, type, typeSchema

### Community 87 - "Community 87"
Cohesion: 0.33
Nodes (6): strength, default, name, notNull, primaryKey, type

### Community 88 - "Community 88"
Cohesion: 0.33
Nodes (6): created_at, default, name, notNull, primaryKey, type

### Community 89 - "Community 89"
Cohesion: 0.33
Nodes (6): relationship_type, name, notNull, primaryKey, type, typeSchema

### Community 90 - "Community 90"
Cohesion: 0.33
Nodes (6): strength, default, name, notNull, primaryKey, type

### Community 93 - "Community 93"
Cohesion: 0.40
Nodes (5): concept_label, name, notNull, primaryKey, type

### Community 94 - "Community 94"
Cohesion: 0.40
Nodes (5): group_id, name, notNull, primaryKey, type

### Community 95 - "Community 95"
Cohesion: 0.40
Nodes (5): id, name, notNull, primaryKey, type

### Community 96 - "Community 96"
Cohesion: 0.40
Nodes (5): quiz_id, name, notNull, primaryKey, type

### Community 97 - "Community 97"
Cohesion: 0.40
Nodes (5): responded_at, name, notNull, primaryKey, type

### Community 98 - "Community 98"
Cohesion: 0.40
Nodes (5): source_node_id, name, notNull, primaryKey, type

### Community 99 - "Community 99"
Cohesion: 0.40
Nodes (5): target_node_id, name, notNull, primaryKey, type

### Community 100 - "Community 100"
Cohesion: 0.40
Nodes (5): user_id, name, notNull, primaryKey, type

### Community 101 - "Community 101"
Cohesion: 0.40
Nodes (5): responded_at, name, notNull, primaryKey, type

### Community 102 - "Community 102"
Cohesion: 0.40
Nodes (5): source_node_id, name, notNull, primaryKey, type

### Community 103 - "Community 103"
Cohesion: 0.40
Nodes (5): target_node_id, name, notNull, primaryKey, type

## Knowledge Gaps
- **787 isolated node(s):** `hookLogger`, `logger`, `knowledgeGraphRouter`, `logger`, `AnswerEvent` (+782 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WebsocketService` connect `Community 4` to `Community 32`, `Community 1`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `io` connect `Community 4` to `Community 7`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `Config` connect `Community 7` to `Community 64`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `hookLogger`, `logger`, `knowledgeGraphRouter` to the rest of the system?**
  _787 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0545876887340302 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._