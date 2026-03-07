# QuizForge Product Backlog

**Story Point Scale:** 1 SP ≈ 2 hours of work  
**Target Sprint Velocity:** 20-25 Story Points per sprint

## Sprint 1 - Database & Authentication Foundation (Backend)

**Goal:** Establish Supabase database schema, Drizzle ORM integration, and Supabase Auth for secure user management.

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-00 | As a **Team**, we want a Git repository with branching and CI basics so development can start in a controlled way. | 2 | High |
| PB-01 | As a **Developer**, I want an Nx monorepo with Bun backend scaffold so backend development can begin. | 2 | High |
| PB-02 | As a **Developer**, I want research and selection of tech stack (Bun, Supabase, Drizzle, Angular Signals) documented. | 2 | High |
| PB-03 | As a **Developer**, I want an Entity-Relationship Diagram (ERD) for quizzes, users, sessions, and game events so the database structure is clear. | 2 | High |
| PB-04 | As a **Developer**, I want Supabase project setup with PostgreSQL database so data can be persisted. | 2 | High |
| PB-05 | As a **Developer**, I want Drizzle ORM configured with postgres-js driver so type-safe queries are possible. | 3 | High |
| PB-06 | As a **Developer**, I want database schema defined in Drizzle (users, quizzes, questions, sessions tables) so entities can be stored. | 3 | High |
| PB-07 | As a **Developer**, I want initial Supabase migrations created so database schema is version-controlled. | 2 | High |
| PB-08 | As a **Developer**, I want seed data scripts for test users and quizzes so development can proceed with sample data. | 2 | High |
| PB-09 | As a **Developer**, I want Supabase Auth integrated with JWT validation middleware so API endpoints are secured. | 4 | High |
| PB-10 | As a **User**, I want to sign up with email/password via Supabase Auth so I can create an account. | 2 | High |
| PB-11 | As a **User**, I want to log in with email/password so I can access my quizzes. | 2 | High |
| PB-12 | As a **Developer**, I want environment variables configured (.env.example, validation with Zod) so secrets are managed safely. | 1 | High |
| PB-13 | As a **Developer**, I want Pino logger configured for structured JSON logging so errors and requests are tracked. | 1 | High |
| PB-14 | As a **Developer**, I want global error handling middleware so all errors return consistent JSON responses. | 1 | High |

**Sprint 1 Total:** 25 SP

---

## Sprint 2 - Quiz & Session Management API (Backend)

**Goal:** Build CRUD operations for quiz management with Drizzle repositories and establish session data layer.

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-15 | As a **Developer**, I want a QuizRepository with Drizzle queries (findById, findByCreator, create, update, delete) so quizzes can be managed. | 4 | High |
| PB-16 | As a **Developer**, I want a QuestionRepository for managing quiz questions with ordering so questions are persisted correctly. | 3 | High |
| PB-17 | As a **User**, I want to create and edit quizzes with title, description, and questions so I can host and update games. *(merged PB-17 + PB-18)* | 3 | High |
| PB-19 | As a **User**, I want to delete my quizzes so I can remove outdated content. | 1 | High |
| PB-20 | As a **User**, I want to view all my created quizzes so I can select one to host. | 2 | High |
| PB-21 | As a **Developer**, I want Zod validation schemas for CreateQuizRequest and UpdateQuizRequest so input is validated. | 2 | High |
| PB-23 | As a **Developer**, I want quiz endpoints to enforce authMiddleware so only authenticated users can create quizzes. | 1 | High |
| PB-24 | As a **System**, I want quiz share code generation (8-char alphanumeric) so quizzes can be shared easily. | 2 | High |
| PB-26 | As a **Developer**, I want a SessionRepository with Drizzle queries (create, findByPin, updateStatus) so sessions are managed. | 3 | High |
| PB-27 | As a **Host**, I want to create a game session with a unique 6-digit PIN (with uniqueness validation) so participants can join. *(merged PB-27 + PB-30)* | 3 | High |

**Sprint 2 Total:** 24 SP

---

## Sprint 3 - Frontend Foundation & WebSocket Infrastructure

**Goal:** Build Angular frontend scaffold with Bubbly Minimalism styling. Complete session management backend and set up Socket.IO WebSocket communication.

### Backend (13 SP)

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-28 | As a **System**, I want session state machine (waiting, playing, paused, ended) so game flow is controlled. | 3 | High |
| PB-29 | As a **Developer**, I want session endpoints (POST /sessions, GET /sessions/:pin, PATCH /sessions/:pin/status) with Tspec docs. | 2 | High |
| PB-37 | As a **Developer**, I want Socket.IO server configured with Supabase JWT authentication so WebSocket connections are secured. | 4 | High |
| PB-38 | As a **Developer**, I want WebSocket event handlers (join-game, leave-game, player-joined, player-left) with room management mapped to session PINs so players can join and events route correctly. *(merged PB-38 + PB-41)* | 4 | High |

### Frontend (12 SP)

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-31 | As a **Developer**, I want Angular v21 frontend scaffolded with Nx, Vitest + Angular Testing Library configured, and landing page component (SSG) so development and testing can begin. *(merged PB-31 + PB-34 + PB-36)* | 3 | High |
| PB-32 | As a **Developer**, I want Tailwind CSS v4 + DaisyUI v5 + Heroicons configured with Bubbly Minimalism theme so UI is styled with rounded icons. *(merged PB-32 + PB-64)* | 3 | High |
| PB-33 | As a **Developer**, I want zoneless change detection and hybrid rendering configured (SSG/SSR/CSR) so performance is optimized. | 3 | High |
| PB-55 | As a **Developer**, I want Supabase client configured in Angular so auth and API calls are possible. | 2 | High |
| PB-45 | As a **Developer**, I want Zod validation schemas for all WebSocket messages so malformed data is rejected. | 1 | High |

**Sprint 3 Total:** 25 SP

---

## Sprint 4 - Auth UI, Dashboard & Quiz Builder

**Goal:** Build Angular authentication pages, user dashboard with quiz list, and full quiz builder with dynamic question management and edit mode.

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-56 | As a **Developer**, I want AuthService with Signals (currentUser, isAuthenticated) so auth state is managed. | 3 | High |
| PB-57 | As a **User**, I want login and signup pages (SSG) with email/password forms and validation so I can create an account and sign in. *(merged PB-57 + PB-58)* | 4 | High |
| PB-59 | As a **Developer**, I want auth guard so protected routes require authentication. | 2 | High |
| PB-60 | As a **Developer**, I want ApiService with resource() for data fetching so API calls are managed. | 3 | High |
| PB-61 | As a **User**, I want dashboard component (SSR) with quiz list and Bubbly card styling using rxResource() so I can see and manage my quizzes. *(merged PB-61 + PB-62)* | 4 | High |
| PB-65 | As a **User**, I want quiz builder page (CSR) with dynamic question management, form state with Signals, save (POST) and edit mode (PATCH) so I can create and update quizzes. *(merged PB-65 + PB-66 + PB-67 + PB-71 + PB-72)* | 5 | High |
| PB-68 | As a **Developer**, I want question component with type selection (multiple-choice, true-false), answer options with correct marking, and form validation (min 1 question, all fields required) so questions are complete and valid. *(merged PB-68 + PB-69 + PB-70)* | 4 | High |

**Sprint 4 Total:** 25 SP

---

## Sprint 5 - Forge Classic Game Engine & Real-Time Scoring

**Goal:** Implement Forge Classic mode with question broadcast, answer submission, speed-based scoring, game event logging, and frontend game services.

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-46 | As a **Host**, I want to start a game session so questions are broadcast to all players. | 3 | High |
| PB-47 | As a **System**, I want questions broadcast via WebSocket (question event) with timer so all players receive simultaneously. | 3 | High |
| PB-48 | As a **Participant**, I want to submit answers within time limit so my response is recorded. | 3 | High |
| PB-49 | As a **System**, I want server-side answer validation (correctness + timestamp) so cheating is prevented. | 4 | High |
| PB-50 | As a **System**, I want Forge Classic scoring algorithm (Points = Correctness × Speed Factor) so scores are calculated. | 3 | High |
| PB-51 | As a **System**, I want real-time score updates broadcast (score-update event) so leaderboard is updated. | 2 | High |
| PB-53 | As a **Host**, I want to advance to next question manually (host controls flow) so pacing is controlled. | 2 | High |
| PB-52 | As a **Developer**, I want game_events table to log all answer submissions for analytics so games can be replayed. | 2 | High |
| PB-74 | As a **Developer**, I want WebSocketService and GameStateService with Signals (players, currentQuestion, leaderboard) so game state is managed on the frontend. *(merged PB-74 + PB-75)* | 3 | High |

**Sprint 5 Total:** 25 SP

---

## Sprint 6 - Game Lobby, Question UI & End-to-End Flow

**Goal:** Build game lobby with player management, question display component, live leaderboard, and shared UI components to complete the end-to-end Forge Classic gameplay flow.

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-39 | As a **Participant**, I want to join a session using PIN and username so I can play without an account. | 3 | High |
| PB-40 | As a **System**, I want username uniqueness validation per session so duplicate usernames are prevented. | 2 | High |
| PB-44 | As a **Host**, I want to see real-time player list in lobby so I know who joined. | 3 | High |
| PB-76 | As a **Participant**, I want join game page with PIN input, lobby component (CSR) with real-time player updates, and start game button so I can enter and begin a session. *(merged PB-76 + PB-77 + PB-78)* | 5 | High |
| PB-79 | As a **Participant**, I want question component with timer, answer bubbles, and submit button so I can answer. | 4 | High |
| PB-80 | As a **Developer**, I want answer submission via WebSocket (submit-answer event) with visual feedback (button disable, loading state) so answers are sent and acknowledged. *(merged PB-80 + PB-81)* | 3 | High |
| PB-54 | As a **Participant**, I want to see live leaderboard after each question so I know my rank. | 3 | High |
| PB-63 | As a **Developer**, I want shared UI components (button, card) with Bubbly animations so the interface is polished and consistent. | 2 | High |

**Sprint 6 Total:** 25 SP

---

## Future Sprints (Backlog)

### Game Modes - Treasure Forge

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-82 | As a **Developer**, I want weighted random chest generation algorithm so chest contents are randomized. | 3 | High |
| PB-83 | As a **System**, I want chest_picks table to store selections so game history is preserved. | 2 | High |
| PB-84 | As a **Participant**, I want to see 3 Bubbly Chests after correct answer so I can pick one. | 3 | High |
| PB-85 | As a **System**, I want chest contents reveal (gold, multiplier, steal, swap) with animations so rewards are shown. | 4 | High |
| PB-86 | As a **System**, I want server-side gold calculation and validation so cheating is prevented. | 4 | High |
| PB-87 | As a **System**, I want steal mechanic (10% from leader) with broadcast so all players are notified. | 3 | High |
| PB-88 | As a **System**, I want swap mechanic (random player) with broadcast so gold exchanges are tracked. | 3 | High |
| PB-89 | As a **Participant**, I want to see gold counter with animations so my gold is visible. | 2 | High |
| PB-90 | As a **Developer**, I want chest wobble/shiver hover animations with CSS so chests feel interactive. | 1 | High |

### Game Modes - Bubbly Royale

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-91 | As a **System**, I want matchmaking algorithm (random or ELO-based) so players are paired fairly. | 4 | High |
| PB-92 | As a **System**, I want duel state tracking (player1, player2, answers, startTime) so 1v1 matches are managed. | 3 | High |
| PB-93 | As a **System**, I want win condition logic (correct + faster) so duel winners are determined. | 3 | High |
| PB-94 | As a **Participant**, I want to lose life bubble on incorrect/slower answer so elimination progresses. | 3 | High |
| PB-95 | As a **Participant**, I want life bubble pop animation with haptic feedback so loss is satisfying. | 3 | High |
| PB-96 | As a **System**, I want elimination logic (3 lives lost = spectator mode) so players are removed. | 2 | High |
| PB-97 | As a **Participant**, I want split-screen duel UI (blue vs red) so opponents are visible. | 4 | High |
| PB-98 | As a **System**, I want edge case handling (both wrong, tie, disconnect) so all scenarios are covered. | 2 | High |
| PB-99 | As a **Participant**, I want spectator UI for eliminated players so they can watch. | 1 | High |

### Testing & Quality

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-35 | As a **Developer**, I want Playwright E2E testing configured (single worker for 2GB RAM) so E2E tests are possible. | 2 | Medium |

### API Documentation & Polish

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-22 | As a **Developer**, I want Tspec annotations on quiz endpoints so API documentation is auto-generated. | 2 | Medium |
| PB-25 | As a **User**, I want to retrieve a quiz by share code so I can preview it before hosting. | 2 | Medium |
| PB-73 | As a **Developer**, I want @defer blocks for quiz preview so performance is optimized. | 2 | Medium |

### Stability & Optimization

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-42 | As a **Developer**, I want player disconnect/reconnect handling so sessions remain stable. | 3 | Medium |
| PB-43 | As a **Developer**, I want WebSocket rate limiting (100ms throttle) so server isn't overloaded. | 2 | Medium |

### Performance & Optimization

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-100 | As a **System**, I want Lighthouse performance score >90 so app is optimized. | 5 | Medium |
| PB-101 | As a **System**, I want bundle size analysis with targets (<200KB main) so performance is tracked. | 3 | Medium |
| PB-102 | As a **System**, I want session cleanup job (2-hour timeout) so memory is managed. | 2 | Medium |
| PB-103 | As a **System**, I want WebSocket binary frames for large payloads so bandwidth is optimized. | 3 | Medium |

### Analytics & Monitoring

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-104 | As a **Host**, I want post-game analytics dashboard so I can review performance. | 5 | Medium |
| PB-105 | As a **Developer**, I want Sentry error tracking so production errors are monitored. | 3 | Medium |
| PB-106 | As a **System**, I want game replay system from game_events table so sessions can be reviewed. | 8 | Low |

### Advanced Features

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-107 | As a **User**, I want image-based questions (Supabase Storage) so quizzes are richer. | 8 | Low |
| PB-108 | As a **System**, I want i18n support (Angular i18n or Transloco) so app is multilingual. | 13 | Low |
| PB-109 | As a **User**, I want PWA features (offline support, install prompt) so app feels native. | 8 | Low |
| PB-110 | As a **Administrator**, I want Docker deployment configuration so app is self-hosted. | 5 | Low |

### Additional Game Modes (Future)

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-111 | As a **System**, I want additional competitive game modes so variety increases. | 13 | Low |
| PB-112 | As a **System**, I want game mode selection UI so hosts can choose modes. | 3 | Low |

### Mobile & Multi-Platform

| ID | User Story | Story Points | Priority |
|----|-----------|--------------|----------|
| PB-113 | As a **User**, I want mobile app (Capacitor/Ionic) so I can play on iOS/Android. | 21 | Low |
| PB-114 | As a **System**, I want shared backend API for web and mobile so code is reused. | 0 | Low |

---

## Backlog Summary

**Planned Sprint Story Points:** 149 SP (Sprints 1-6)
**Future Backlog Story Points:** ~161 SP
**Total Estimated Story Points:** ~310 SP

### Sprint Velocity Overview

| Sprint | Theme | Story Points |
|--------|-------|-------------|
| Sprint 1 (Done) | Database & Authentication Foundation | 25 SP |
| Sprint 2 | Quiz & Session Management API | 24 SP |
| Sprint 3 | Frontend Foundation & WebSocket Infrastructure | 25 SP |
| Sprint 4 | Auth UI, Dashboard & Quiz Builder | 25 SP |
| Sprint 5 | Forge Classic Game Engine & Real-Time Scoring | 25 SP |
| Sprint 6 | Game Lobby, Question UI & End-to-End Flow | 25 SP |

### Consolidation Notes
- **Reduced from 10 sprints to 6** by merging related stories and combining backend/frontend work
- **Forge Classic** is the MVP game mode delivered end-to-end by Sprint 6
- **Treasure Forge** and **Bubbly Royale** game modes moved to Future Sprints (50 SP) as high-priority post-MVP work
- **Merged stories** reduce overhead by combining related work that shares infrastructure (noted with *(merged)* tags)
- Frontend development starts Sprint 3 (unchanged)
- Complete playable game flow (auth → create quiz → host session → players join → play → leaderboard) achieved by Sprint 6
- GDPR compliance handled via Supabase RLS policies and self-hosting option
