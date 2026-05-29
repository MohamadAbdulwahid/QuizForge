# Sprint 5 Backlog - Forge Classic Game Engine & Real-Time Scoring

**Sprint Goal:** Implement Forge Classic mode with question broadcast, answer submission, speed-based scoring, game event logging, session resilience, and frontend game services.

**Duration:** 2 weeks  
**Total Story Points:** 30 SP (≈60 hours)  
**Team:** Mohamad, Nishan, David, Behrang

---

## Prerequisites from Sprint 4

Sprint 5 assumes the following Sprint 4 deliverables are complete and usable:
- **Auth and route protection**: `AuthService`, `AuthGuard`, login/register pages, and protected dashboard routes are working.
- **Quiz authoring**: Dashboard, quiz builder, and question editor are complete so hosts can prepare quizzes before play.
- **Session infrastructure**: Session create/status endpoints, Socket.IO auth, room management, and Zod validation for socket messages already exist.
- **Frontend game shell foundation**: `ApiService`, `Supabase` client wiring, and the existing Angular app configuration are ready for game-specific state services.

---

## Sprint Backlog Items

### PB-46: Start Game Session and Broadcast First Question (Mohamad)

**User Story:** As a **user**, I want to be able to start the quiz I created, so that my friends and I can begin playing together immediately.

**Story Points:** 3
**Prerequisites:** PB-29, PB-38

**Definition of Done (DoD):**
- [x] Add backend logic that transitions a session from `waiting` to `playing` only when the authenticated host starts the match.
- [x] Load the first quiz question and include the session PIN, question order, and round metadata in the start payload.
- [x] Prevent duplicate start requests from re-triggering the first question broadcast.
- [x] Emit a clear session-start or round-start event before question delivery so clients can prepare their UI state.
- [x] Ensure a failed start attempt returns a consistent error when the session is already in progress or the host is invalid.
- [x] **Test File:** `apps/backend/tests/integration/game-session-start.spec.ts`
  - [x] Test: starting a waiting session transitions it to playing and emits the first question flow.
  - [x] Test: starting an already active session returns the expected conflict or validation error.

---

### PB-47: Question Broadcast With Timer (Nishan)

**User Story:** As a **user**, I want every question to appear for all players at the exact same time with a synchronized countdown, so that the game feels fair and competitive.

**Story Points:** 3
**Prerequisites:** PB-46

**Definition of Done (DoD):**
- [x] Emit a `question` WebSocket event to the session room with question text, answer options, question id, points, and time limit.
- [x] Stamp the server-side question start time once per round so all players share the same countdown source.
- [x] Keep the payload identical for every client in the room so no player receives a different question or timer value.
- [x] Guard against late room joiners receiving a stale active question without an explicit resync path.
- [x] Make the broadcast logic resilient to missing or malformed room state so the session does not crash on delivery.
- [x] **Test File:** `apps/backend/tests/integration/question-broadcast.spec.ts`
  - [x] Test: all players in the room receive the same `question` payload.
  - [x] Test: the broadcast includes the server-derived time limit and question metadata.

---

### PB-48: Answer Submission Within Time Limit (Behrang)

**User Story:** As a **user**, I want to quickly tap my chosen answer before time runs out, so that I can earn points before the round ends.

**Story Points:** 3
**Prerequisites:** PB-47

**Definition of Done (DoD):**
- [x] Add the `submit-answer` WebSocket client flow with a stable payload shape for `sessionId`, `questionId`, and selected answer.
- [x] Disable duplicate submissions on the client once an answer has been acknowledged or the round has expired.
- [x] Show a clear pending/sent state so the player can tell that their answer reached the server.
- [x] Handle timeout responses gracefully when the player submits after the active round window has closed.
- [x] Keep the submit path compatible with the existing Angular Signals game state so UI updates stay reactive.
- [x] **Test File:** `apps/frontend/src/app/features/game/services/game-state.service.spec.ts`
  - [x] Test: submitting a valid answer updates local pending state and emits the socket payload.
  - [x] Test: submitting after timeout does not overwrite a finalized round state.

---

### PB-49: Server-Side Answer Validation (Nishan)

**User Story:** As a **user**, I want to know the game is fair and secure from hackers, so that my earned score actually reflects my skills accurately.

**Story Points:** 4
**Prerequisites:** PB-48

**Definition of Done (DoD):**
- [x] Validate that the active question still belongs to the current session round before processing an answer.
- [x] Reject late submissions by comparing the server clock against the question start time and the configured time limit.
- [x] Confirm the submitted answer belongs to the current question and matches the backend question data.
- [x] Block duplicate answers from the same player for the same question before any score is computed.
- [x] Return a stable error payload for invalid answers so the client can display a clear rejection state.
- [x] **Test File:** `apps/backend/tests/unit/game/answer-validation.spec.ts`
  - [x] Test: a correct answer inside the allowed time window is accepted.
  - [x] Test: a late answer is rejected even if the selected option is correct.
  - [x] Test: a duplicate answer submission for the same question is rejected.

---

### PB-50: Forge Classic Scoring Algorithm (Mohamad)

**User Story:** As a **user**, I want to be rewarded with more points for answering faster than others, so that quick thinking gives me a competitive edge.

**Story Points:** 3
**Prerequisites:** PB-49

**Definition of Done (DoD):**
- [x] Calculate base points for a correct answer and apply a time-based multiplier using the remaining time in the round.
- [x] Return zero points for incorrect answers while still preserving the answer attempt in the round history.
- [x] Keep the formula server-side only so clients cannot influence score values.
- [x] Make the scoring function deterministic and reusable for later leaderboard and analytics features.
- [x] Clamp edge cases such as negative remaining time or invalid question duration values.
- [x] **Test File:** `apps/backend/tests/unit/game/scoring.spec.ts`
  - [x] Test: a fast correct answer scores more than a slower correct answer.
  - [x] Test: an incorrect answer always scores zero.
  - [x] Test: invalid timing data is clamped before score calculation.

---

### PB-51: Real-Time Score Updates Broadcast (David)

**User Story:** As a **user**, I want to see the scoreboard change instantly after every question, so that I know exactly who is winning at all times.

**Story Points:** 2
**Prerequisites:** PB-50

**Definition of Done (DoD):**
- [x] Broadcast a `score-update` event after each validated answer is scored.
- [x] Include player id, new score, round delta, and rank-friendly payload fields in the broadcast.
- [x] Keep updates room-scoped so only the active session receives the score changes.
- [x] Ensure the host and all players receive the same authoritative leaderboard state.
- [x] Avoid broadcasting intermediate or speculative scores before validation completes.
- [x] **Test File:** `apps/backend/tests/integration/score-broadcast.spec.ts`
  - [x] Test: a validated answer triggers a `score-update` event to the session room.
  - [x] Test: score broadcasts contain the server-calculated total and delta.

---

### PB-52: Game Events Table Logging (David)

**User Story:** As a **user**, I want my gameplay safely recorded behind the scenes, so that I can review my historical stats and replays later.

**Story Points:** 2
**Prerequisites:** PB-48, PB-49

**Definition of Done (DoD):**
- [x] Persist answer attempts with session id, player id, question id, selected answer, correctness, score delta, and timestamp.
- [x] Add event records for the start of a round, answer submission, scoring completion, and round advance.
- [x] Keep event writes atomic with the gameplay flow where possible so partial state does not leak into analytics.
- [x] Surface logging failures clearly without crashing the entire round flow.
- [x] Preserve enough metadata for later replay and post-game analysis work.
- [x] **Test File:** `apps/backend/tests/integration/game-events.spec.ts`
  - [x] Test: a valid answer creates a game event record with the expected metadata.
  - [x] Test: a scoring event is logged after the answer is validated and processed.

---

### PB-53: Manual Next Question Control (David)

**User Story:** As a **Host**, I want to advance to the next question manually so pacing is controlled.

**Story Points:** 2
**Prerequisites:** PB-50, PB-51

**Definition of Done (DoD):**
- [x] Add a host-only command or endpoint to advance the current round to the next question.
- [x] Prevent the host from skipping forward while the current question is still actively accepting answers unless the round has timed out.
- [x] End the session cleanly after the final question and emit the appropriate finished-state update.
- [x] Keep question sequencing aligned with the underlying quiz ordering.
- [x] Ensure the control is ignored for non-host users and returns a consistent authorization failure.
- [x] **Test File:** `apps/backend/tests/unit/game/host-flow.spec.ts`
  - [x] Test: the host can advance to the next question after the round closes.
  - [x] Test: a non-host user cannot trigger next-question control.

---

### PB-74: WebSocketService and GameStateService With Signals (Behrang)

**User Story:** As a **user**, I want the game interface to feel snappy and always up to date, so that there is no lag or confusion when playing.

**Story Points:** 3
**Prerequisites:** PB-47, PB-51

**Definition of Done (DoD):**
- [x] Create a frontend WebSocket service that connects to the active game room and listens for round, score, and completion events.
- [x] Track `players`, `currentQuestion`, `leaderboard`, and connection status with Angular Signals.
- [x] Keep the game state service responsible for translating socket events into UI-friendly state updates.
- [x] Reset state cleanly when the player leaves a session or navigates away from the game route.
- [x] Make the service resilient to reconnects so the frontend can resync after brief connection loss.
- [x] **Test File:** `apps/frontend/src/app/features/game/services/websocket.service.spec.ts`
  - [x] Test: socket events update the current question and leaderboard signals.
  - [x] Test: disconnect or leave events clear the active game state.

---

### PB-42: Player Disconnect/Reconnect Handling (Behrang)

**User Story:** As a **user**, I want to seamlessly rejoin my game if my internet drops.

**Story Points:** 3
**Prerequisites:** PB-47, PB-74

**Definition of Done (DoD):**
- [x] Detect abrupt disconnects and preserve the player’s room/session identity long enough to support a short reconnect window.
- [x] Rehydrate the player’s game state on reconnect so the current question, active round, and leaderboard can resume cleanly.
- [x] Avoid dropping the player into a stale lobby state after a transient network interruption.
- [x] Make reconnect behavior consistent across host and participant sessions so the room stays synchronized.
- [x] Ensure reconnect logic does not duplicate players or create ghost entries in the session roster.
- [x] **Test File:** `apps/frontend-e2e/src/e2e/game-reconnect.spec.ts`
  - [x] Test: a player who disconnects briefly can reconnect and regain the current round state.
  - [x] Test: a reconnect does not duplicate the player in the active room list.

---

### PB-43: WebSocket Rate Limiting (David)

**User Story:** As a **user**, I want my game to remain smooth and not kick me out even if hundreds of people are playing at once, so that large groups aren't interrupted by server lag.

**Story Points:** 2
**Prerequisites:** PB-37, PB-38, PB-47

**Definition of Done (DoD):**
- [x] Throttle high-frequency room broadcasts so score and state events do not exceed the configured cadence.
- [x] Apply the rate limit only where appropriate so answer validation and critical host actions still remain responsive.
- [x] Keep the throttle window aligned with the 100ms product expectation and document the behavior clearly in code.
- [x] Ensure throttled updates still preserve the latest authoritative score or state snapshot.
- [x] Surface a safe fallback when burst traffic is detected instead of dropping the session connection.
- [x] **Test File:** `apps/backend/tests/unit/websocket/rate-limit.spec.ts`
  - [x] Test: rapid broadcast attempts are throttled to the expected cadence.
  - [x] Test: critical events are still delivered even when non-critical traffic is rate limited.

---

## Sprint 5 Test Plan

### Unit Tests

- `apps/backend/tests/unit/game/scoring.spec.ts`: validate the scoring formula and edge cases.
- `apps/backend/tests/unit/game/answer-validation.spec.ts`: ensure late, duplicate, and malformed answers are rejected.
- `apps/backend/tests/unit/game/host-flow.spec.ts`: verify host-only question control.
- `apps/frontend/src/app/features/game/services/game-state.service.spec.ts`: verify player answer state and local signals.

### Integration Tests

- `apps/backend/tests/integration/game-session-start.spec.ts`: verify session start transitions and first-question handoff.
- `apps/backend/tests/integration/question-broadcast.spec.ts`: verify `question` events and timer sync across the room.
- `apps/backend/tests/integration/score-broadcast.spec.ts`: verify `score-update` payloads reach the whole room.
- `apps/backend/tests/integration/game-events.spec.ts`: verify gameplay persistence into `game_events`.

### E2E Tests

- `apps/frontend-e2e/src/e2e/forge-classic.spec.ts`: host starts a session, players receive the question, submit answers, and see leaderboard movement.
- `apps/frontend-e2e/src/e2e/game-flow.spec.ts`: verify the happy path from start game through the final question and end-of-session state.
