# Sprint 6 Backlog - End-to-End Gameplay, Stability & Admin Polish

**Sprint Goal:** Complete the Forge Classic MVP end-to-end with session join flow, live lobby, question/answer UI, leaderboard updates, stability hardening, owner analytics, monitoring, and database cleanup so the product is functional and shippable.

**Duration:** 2 weeks  
**Total Story Points:** 40 SP (≈80 hours)  
**Team:** Mohamad, Nishan, David, Behrang

---

## Prerequisites from Sprint 5

Sprint 6 assumes the following Sprint 5 deliverables are complete and usable:
- **Game start flow**: hosts can start a session and broadcast the first question.
- **Question broadcast**: all players receive the same WebSocket question payload with synchronized timing.
- **Answer validation and scoring**: late, duplicate, and malformed answers are rejected server-side and scored correctly.
- **Real-time score updates**: score-update events reach the whole room with authoritative totals.
- **Game event logging**: gameplay events are persisted for future replay/analytics.
- **Frontend game services**: websocket and game-state services are already in place on the Angular app.
- **Dashboard/auth foundation**: authenticated dashboard routes, quiz builder, and websocket room management already work.

Sprint 6 turns that engine into a complete playable product with proper player entry, stability, operational insight, and owner-facing control.

---

## Sprint Backlog Items

### PB-39 + PB-40 + PB-44 + PB-76: Session Join Flow, Username Validation, and Live Lobby (Mohamad)

**User Story:** As a **Participant**, I want to join a session using a PIN and unique username, and as a **Host**, I want to see a live lobby with the player roster and start control, so that the game can begin cleanly.

**Story Points:** 10

**Prerequisites:** PB-38, PB-46, PB-47, PB-74

**Definition of Done (DoD):**
- [ ] Build the join-game screen with PIN and username inputs using the existing shared form primitives.
- [ ] Validate that the PIN belongs to an active session before allowing a player to join.
- [ ] Enforce per-session username uniqueness and return a clear error when a duplicate name is submitted.
- [ ] Persist the player entry and room membership without creating duplicate roster rows on refresh or retry.
- [ ] Render a live lobby that shows current players, connection state, and session status in real time.
- [ ] Show the start-game control only to the authenticated host, and keep it hidden for participants.
- [ ] Handle invalid PIN, ended session, duplicate username, empty lobby, and host reconnect edge cases with stable UI states.
- [ ] Reuse existing shared UI components (`BubblyButton`, `BubblyCard`, `StatusPill`) instead of creating one-off controls.
- [ ] Ensure a brief disconnect before game start does not duplicate the player or lose the lobby state.
- [ ] **Test Files:** `apps/backend/tests/integration/session-join.spec.ts`, `apps/frontend/src/app/features/join-game/join-game.component.spec.ts`, `apps/frontend/src/app/features/lobby/lobby.component.spec.ts`
  - [ ] Test: participant can join a waiting session with a unique username.
  - [ ] Test: duplicate username in the same session is rejected.
  - [ ] Test: joining an ended session returns the expected failure state.
  - [ ] Test: lobby roster updates when a player joins or leaves.
  - [ ] Test: start-game control is hidden from non-host users.

---

### PB-79 + PB-80 + PB-54: Question Screen, Answer Submission, and Live Leaderboard (David)

**User Story:** As a **Participant**, I want to see the current question, submit an answer before time expires, and immediately see the leaderboard update, so that the match feels fast and fair.

**Story Points:** 10

**Prerequisites:** PB-47, PB-49, PB-50, PB-51, PB-74

**Definition of Done (DoD):**
- [ ] Render the active question, answer bubbles, timer, and round progress from the current game-state service.
- [ ] Sync the countdown to the server-side question start timestamp so every client sees the same remaining time.
- [ ] Disable answer controls after the first submission or when the timer expires, and show pending/sent/locked states clearly.
- [ ] Prevent duplicate submissions caused by double taps, browser refresh, or reconnect replay.
- [ ] Update the leaderboard after scoring completes and show rank movement, score deltas, and tie handling.
- [ ] Rehydrate the active question and leaderboard snapshot if a player joins late or reloads mid-round.
- [ ] Show a concise end-of-round summary before the next question or final session end.
- [ ] Keep the screen mobile-friendly and visually consistent with the rest of the Bubbly UI.
- [ ] **Test Files:** `apps/frontend/src/app/features/game/components/question-screen/question-screen.component.spec.ts`, `apps/frontend/src/app/features/game/services/game-state.service.spec.ts`, `apps/backend/tests/integration/leaderboard-sync.spec.ts`
  - [ ] Test: timer renders from the server start time and counts down correctly.
  - [ ] Test: submitting an answer disables controls and records pending state.
  - [ ] Test: late submission shows a timeout state instead of overwriting the round.
  - [ ] Test: leaderboard updates when score-update events arrive.
  - [ ] Test: leaderboard ordering stays deterministic on ties.

---

### PB-42 + PB-43 + PB-100 + PB-101 + PB-102: Stability, Performance, and Database Optimization (Nishan)

**User Story:** As a **System**, I want reconnect recovery, broadcast throttling, performance budgets, and database cleanup, so that the game stays stable and fast in real usage.

**Story Points:** 10

**Prerequisites:** PB-38, PB-47, PB-51, PB-74

**Definition of Done (DoD):**
- [ ] Preserve player identity through a short reconnect window and rehydrate the current room, question, and leaderboard on reconnect.
- [ ] Prevent reconnects from creating ghost players, duplicate usernames, or stale lobby rows.
- [ ] Throttle high-frequency non-critical WebSocket broadcasts while keeping validation, start, and end events immediate.
- [ ] Add a documented performance target for the frontend bundle and a Lighthouse target for the shipped build.
- [ ] Add database indexes and query improvements for the hot paths used by session lookup, leaderboard reads, and event history.
- [ ] Add a session cleanup job that closes stale sessions after timeout and clears transient state safely.
- [ ] Ensure cleanup logic skips active games and logs failures without interrupting gameplay.
- [ ] Document the tuning decisions so later optimization work does not accidentally undo them.
- [ ] **Test Files:** `apps/backend/tests/unit/websocket/rate-limit.spec.ts`, `apps/frontend-e2e/src/e2e/game-reconnect.spec.ts`, `apps/backend/tests/unit/database/optimization.spec.ts`, `apps/backend/tests/unit/maintenance/session-cleanup.spec.ts`
  - [ ] Test: non-critical broadcasts are throttled to the expected cadence.
  - [ ] Test: reconnect restores the current active round state.
  - [ ] Test: reconnect does not duplicate the player in the roster.
  - [ ] Test: query helpers use the optimized hot-path access pattern.
  - [ ] Test: session cleanup skips active sessions and removes stale ones.

---

### PB-104 + PB-105 + PB-63: Owner Admin Dashboard, Analytics, and Monitoring (Behrang)

**User Story:** As an **Owner**, I want an admin dashboard with analytics and monitoring so that I can understand live activity, inspect completed sessions, and react to issues quickly.

**Story Points:** 10

**Prerequisites:** PB-61, PB-52, PB-74

**Definition of Done (DoD):**
- [ ] Build an owner-only dashboard surface with session cards, player counts, completion rate, and recent-game summaries.
- [ ] Add a session-health area that shows stale or abandoned sessions and provides quick inspection or termination actions.
- [ ] Include analytics cards and simple tables for average answer time, round completion, and active-session totals.
- [ ] Integrate error monitoring (Sentry or equivalent) with environment-based configuration and clear component tagging.
- [ ] Capture backend and frontend operational errors without exposing sensitive details in the UI.
- [ ] Provide loading, empty, and error states for analytics and monitoring data.
- [ ] Reuse shared Bubbly components so the dashboard stays consistent with the rest of the app.
- [ ] Keep the dashboard responsive enough for desktop and tablet usage.
- [ ] **Test Files:** `apps/frontend/src/app/features/admin-dashboard/admin-dashboard.component.spec.ts`, `apps/backend/tests/integration/admin-dashboard.spec.ts`, `apps/backend/tests/unit/monitoring/sentry.spec.ts`
  - [ ] Test: owner dashboard renders analytics cards and empty states.
  - [ ] Test: non-owner access is rejected by the data endpoint.
  - [ ] Test: monitoring adapter tags and forwards errors correctly.
  - [ ] Test: quick actions are not shown to non-owner users.

---

## Sprint 6 Test Plan

### Unit Tests

- `apps/frontend/src/app/features/join-game/join-game.component.spec.ts`: validate join form states and duplicate username messaging.
- `apps/frontend/src/app/features/lobby/lobby.component.spec.ts`: verify roster rendering and host-only actions.
- `apps/frontend/src/app/features/game/components/question-screen/question-screen.component.spec.ts`: verify countdown, answer locking, and timeout states.
- `apps/frontend/src/app/features/game/services/game-state.service.spec.ts`: verify question, leaderboard, and reconnect state updates.
- `apps/backend/tests/unit/websocket/rate-limit.spec.ts`: verify non-critical broadcasts are throttled.
- `apps/backend/tests/unit/database/optimization.spec.ts`: verify optimized query paths and index-aware access.
- `apps/backend/tests/unit/maintenance/session-cleanup.spec.ts`: verify stale-session cleanup behavior.
- `apps/backend/tests/unit/monitoring/sentry.spec.ts`: verify monitoring tags and error forwarding.

### Integration Tests

- `apps/backend/tests/integration/session-join.spec.ts`: verify session join, username uniqueness, and invalid PIN handling.
- `apps/backend/tests/integration/leaderboard-sync.spec.ts`: verify leaderboard updates after scoring events.
- `apps/backend/tests/integration/admin-dashboard.spec.ts`: verify owner-only analytics access.

### E2E Tests

- `apps/frontend-e2e/src/e2e/game-reconnect.spec.ts`: verify disconnect/reconnect recovery and no ghost players.
- `apps/frontend-e2e/src/e2e/forge-classic.spec.ts`: verify the full join → lobby → question → answer → leaderboard flow.
- `apps/frontend-e2e/src/e2e/admin-dashboard.spec.ts`: verify owners can review sessions and analytics after a match.
