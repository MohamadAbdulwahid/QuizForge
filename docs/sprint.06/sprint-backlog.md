# Sprint 6 Backlog - End-to-End Gameplay, Stability & Admin Polish

**Sprint Goal:** Complete the Forge Classic MVP end-to-end with session join flow, live lobby, question/answer UI, leaderboard updates, stability hardening, owner analytics, monitoring, and database cleanup so the product is functional and shippable.

**Duration:** 2 weeks  
**Total Story Points:** 65 SP (≈130 hours)  
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

### PB-82 + PB-83 + PB-86: Chest Generation, Gold Economy & Validation (Backend)

**User Story:** As a **System**, I want a weighted random chest-generation algorithm with server-side gold calculation and a `chest_picks` table, so that chest rewards are randomized, fair, and tamper-proof.

**Story Points:** 9

**Prerequisites:** PB-47, PB-48, PB-49, PB-50, PB-51, PB-74

**Definition of Done (DoD):**
- [ ] Define the complete loot table with the following chest outcomes, amounts, and base probability weights:

  | Outcome | Effect | Base Weight |
  |---------|--------|-------------|
  | Gold +10 | Add 10 gold | 5% |
  | Gold +20 | Add 20 gold | 12.5% |
  | Gold +40 | Add 40 gold | 15% |
  | Gold +50 | Add 50 gold | 13.5% |
  | Double Gold | Double entire gold total | 9% |
  | Triple Gold | Triple entire gold total | 4% |
  | Lose 25% | Lose 25% of current gold | 3% |
  | Lose 50% | Lose 50% of current gold | 1% |
  | Steal 10% | Take 10% of a chosen opponent's gold | 4% |
  | Steal 25% | Take 25% of a chosen opponent's gold | 4% |
  | SWAP! | Swap entire gold with random opponent | 2% |
  | Nothing | No effect | 2% |

- [ ] Adjust outcome probabilities dynamically based on the player's current leaderboard position: lower-ranked players get higher weights on positive outcomes (Double, Triple, Steal) and lower weights on negative outcomes (Lose, SWAP), while top-ranked players have inverted weights to create a comeback mechanic.
- [ ] Build the server-side gold calculation engine that processes chest outcomes, applies multipliers, and updates player gold totals atomically.
- [ ] Validate all gold transactions server-side to prevent client-side manipulation.
- [ ] Create the `chest_picks` database table storing: `id`, `session_id`, `player_id`, `round_number`, `selected_outcome`, `gold_delta`, `target_player_id` (for steal/swap), `created_at`.
- [ ] Persist every chest pick to `chest_picks` for audit trail and post-game analytics.
- [ ] Reject chest picks from players who did not answer correctly or have already picked a chest for the current round.
- [ ] Ensure gold totals remain consistent with the existing Forge Classic scoring system.
- [ ] **Test Files:** `apps/backend/tests/unit/game/chest-generation.spec.ts`, `apps/backend/tests/unit/game/gold-calculation.spec.ts`, `apps/backend/tests/unit/database/chest-picks.spec.ts`, `apps/backend/tests/integration/treasure-gold-flow.spec.ts`
  - [ ] Test: weighted random outcomes match expected probability distribution within tolerance.
  - [ ] Test: leaderboard position influences outcome weights correctly.
  - [ ] Test: gold calculations are atomic and consistent after multiply/steal/swap/loss.
  - [ ] Test: chest pick is rejected for incorrect answers or duplicate picks.
  - [ ] Test: `chest_picks` records are created and queryable.

---

### PB-87 + PB-88: Steal & Swap Mechanics with WebSocket Broadcast (Backend)

**User Story:** As a **Participant**, I want to steal gold from or swap gold with another player when I open a chest, so that the game has high-stakes social dynamics.

**Story Points:** 6

**Prerequisites:** PB-82, PB-83, PB-86, PB-47, PB-51, PB-74

**Definition of Done (DoD):**
- [ ] Implement the steal mechanic: when a chest reveals "Steal X%", the player selects a target (via a UI picker) and receives X% of the target's gold, deducted from the target.
- [ ] Implement the swap mechanic (PB-88): when a chest reveals "SWAP!", the player's entire gold total is exchanged with a randomly selected opponent's total.
- [ ] Broadcast a `chest-effect` WebSocket event to the room showing: player name, effect type (steal/swap), target name, gold delta for each affected player.
- [ ] Add a 3-second reveal delay so the room can see the effect announcement before gameplay resumes.
- [ ] Handle edge cases: steal when target has 0 gold (0 stolen), swap when only 1 player remains (no-op), steal/swap targeting self (re-roll target).
- [ ] Prevent race conditions where concurrent steal/swap events could produce incorrect gold totals (use atomic DB operations or per-player locks).
- [ ] Log all steal and swap events to `game_events` table for post-game analytics.
- [ ] **Test Files:** `apps/backend/tests/unit/game/steal-mechanic.spec.ts`, `apps/backend/tests/unit/game/swap-mechanic.spec.ts`, `apps/backend/tests/integration/treasure-effect-broadcast.spec.ts`
  - [ ] Test: steal correctly deducts from target and adds to stealer.
  - [ ] Test: swap exchanges full gold totals between two players.
  - [ ] Test: concurrent steal/swap events do not produce inconsistent gold totals.
  - [ ] Test: swap with no eligible target is handled gracefully.
  - [ ] Test: `chest-effect` broadcast includes all required fields.

---

### PB-84 + PB-85 + PB-89 + PB-90: Treasure Chest UI, Animations & Gold Display (Frontend)

**User Story:** As a **Participant**, I want to see 3 Bubbly Chests after a correct answer, pick one with a hovering/wobble animation, see the contents revealed with flair, and track my gold with a live counter, so that the treasure-opening experience feels exciting and tactile.

**Story Points:** 10

**Prerequisites:** PB-79, PB-80, PB-74, PB-82, PB-83, PB-86

**Definition of Done (DoD):**
- [ ] After a correct answer, transition the player's screen from the question to a chest-picking view showing 3 uniquely styled Bubbly Chests.
- [ ] Add CSS-only wobble/shiver hover animations on each chest so they feel interactive and "alive" (use `prefers-reduced-motion` respect).
- [ ] On chest tap/click, play a reveal animation showing the chest opening with the outcome icon and text (gold gained/lost, steal, swap, multiplier).
- [ ] Display the exact gold delta in a floating "+X" / "-X" label with a brief animation pulse.
- [ ] Show a persistent gold counter (total gold) in the game HUD that animates smoothly when gold changes (use CSS transitions or Angular animations).
- [ ] For steal outcomes, show a target-player picker overlay after the chest reveal so the player can choose who to steal from.
- [ ] For swap outcomes, show a dramatic "SWAP!" announcement with both players' names and gold totals exchanging.
- [ ] Display a "waiting for others" state while other players are still picking chests, then auto-advance to the next question when all have picked or a timeout expires.
- [ ] Handle late-arriving chest-effect broadcasts gracefully (e.g., player reconnected mid-effect).
- [ ] Reuse existing Bubbly UI primitives (`BubblyCard`, `BubblyButton`, `StatusPill`) and DaisyUI theme tokens — no hardcoded styles.
- [ ] Ensure the chest UI is mobile-friendly and works in landscape and portrait.
- [ ] **Test Files:** `apps/frontend/src/app/features/game/components/chest-picker/chest-picker.component.spec.ts`, `apps/frontend/src/app/features/game/components/gold-counter/gold-counter.component.spec.ts`, `apps/frontend-e2e/src/e2e/treasure-chest.spec.ts`
  - [ ] Test: 3 chests render after a correct answer, no chests after wrong answer.
  - [ ] Test: chest animations respect `prefers-reduced-motion`.
  - [ ] Test: gold counter updates after chest outcome is received.
  - [ ] Test: steal target picker appears only for steal outcomes.
  - [ ] Test: swap announcement shows both affected player names.
  - [ ] Test: "waiting" state renders while other players are picking.

---

## Sprint 6 Test Plan

### Unit Tests

- `apps/frontend/src/app/features/join-game/join-game.component.spec.ts`: validate join form states and duplicate username messaging.
- `apps/frontend/src/app/features/lobby/lobby.component.spec.ts`: verify roster rendering and host-only actions.
- `apps/frontend/src/app/features/game/components/question-screen/question-screen.component.spec.ts`: verify countdown, answer locking, and timeout states.
- `apps/frontend/src/app/features/game/services/game-state.service.spec.ts`: verify question, leaderboard, and reconnect state updates.
- `apps/frontend/src/app/features/game/components/chest-picker/chest-picker.component.spec.ts`: verify 3 chests render after correct answer, chest animations, and outcome reveal.
- `apps/frontend/src/app/features/game/components/gold-counter/gold-counter.component.spec.ts`: verify gold counter updates and animations.
- `apps/backend/tests/unit/game/chest-generation.spec.ts`: verify weighted random outcome distribution.
- `apps/backend/tests/unit/game/gold-calculation.spec.ts`: verify atomic gold updates for all chest outcomes.
- `apps/backend/tests/unit/game/steal-mechanic.spec.ts`: verify steal deduction and addition logic.
- `apps/backend/tests/unit/game/swap-mechanic.spec.ts`: verify full gold exchange between players.
- `apps/backend/tests/unit/database/chest-picks.spec.ts`: verify chest_picks table persistence.
- `apps/backend/tests/unit/websocket/rate-limit.spec.ts`: verify non-critical broadcasts are throttled.
- `apps/backend/tests/unit/database/optimization.spec.ts`: verify optimized query paths and index-aware access.
- `apps/backend/tests/unit/maintenance/session-cleanup.spec.ts`: verify stale-session cleanup behavior.
- `apps/backend/tests/unit/monitoring/sentry.spec.ts`: verify monitoring tags and error forwarding.

### Integration Tests

- `apps/backend/tests/integration/session-join.spec.ts`: verify session join, username uniqueness, and invalid PIN handling.
- `apps/backend/tests/integration/leaderboard-sync.spec.ts`: verify leaderboard updates after scoring events.
- `apps/backend/tests/integration/admin-dashboard.spec.ts`: verify owner-only analytics access.
- `apps/backend/tests/integration/treasure-gold-flow.spec.ts`: verify full chest pick → gold update → effect broadcast flow.
- `apps/backend/tests/integration/treasure-effect-broadcast.spec.ts`: verify steal/swap `chest-effect` WebSocket events.

### E2E Tests

- `apps/frontend-e2e/src/e2e/game-reconnect.spec.ts`: verify disconnect/reconnect recovery and no ghost players.
- `apps/frontend-e2e/src/e2e/forge-classic.spec.ts`: verify the full join → lobby → question → answer → leaderboard flow.
- `apps/frontend-e2e/src/e2e/treasure-chest.spec.ts`: verify correct answer → chest pick → reveal → gold update → leaderboard flow.
- `apps/frontend-e2e/src/e2e/admin-dashboard.spec.ts`: verify owners can review sessions and analytics after a match.
