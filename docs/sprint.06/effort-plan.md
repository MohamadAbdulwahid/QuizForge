# Sprint 6 Effort Plan

**Sprint Duration:** 2 weeks (10 working days)  
**Target Velocity:** 40 Story Points  
**Team Size:** 4 developers

---

## Team Members & Roles

| Name | Role | Primary Focus | Hour worked |
|------|------|---------------|--------------|
| **Mohamad** | Product Owner, Developer | Session join flow, lobby orchestration, host controls | 20h |
| **David** | Scrum Master, Developer | Question UI, answer submission, leaderboard sync | 20h |
| **Nishan** | Stakeholder, Developer | Stability hardening, performance, database optimization | 20h |
| **Behrang** | Stakeholder, Developer | Owner dashboard, analytics, monitoring, UI polish | 20h |

---

## Effort Distribution by Developer

### Mohamad - 10 SP

- **PB-39 + PB-40 + PB-44 + PB-76**: Session join flow, username validation, real-time lobby, and host start control (10 SP) - Days 1-5

**Responsibilities:**
- Build the player entry flow from PIN + username to a live session lobby.
- Enforce session-scoped username uniqueness and active-session validation.
- Keep the lobby state synchronized while players join, leave, or reconnect before the match starts.
- Ensure the host-only start control is visible only to the authenticated host.
- Wire the flow into the existing shared Bubbly input/button/card primitives.

---

### David - 10 SP

- **PB-79 + PB-80 + PB-54**: Question screen, answer submission, and live leaderboard updates (10 SP) - Days 1-7

**Responsibilities:**
- Build the gameplay screen that presents the current question, timer, and answer options.
- Keep answer submission state deterministic and prevent duplicate taps or stale retries.
- Update the leaderboard view immediately after score updates land from the backend.
- Support end-of-round transitions and final-session handoff states.
- Make the gameplay UI responsive and easy to follow during fast rounds.

---

### Nishan - 10 SP

- **PB-42 + PB-43 + PB-100 + PB-101 + PB-102**: Reconnect recovery, rate limiting, performance budgets, and database cleanup (10 SP) - Days 3-10

**Responsibilities:**
- Implement reconnect behavior that restores the active game state without duplicating players.
- Throttle noisy broadcasts while preserving critical gameplay events.
- Add optimization work for the backend hot paths and document the performance targets.
- Build and verify session cleanup behavior for stale or abandoned sessions.
- Reduce database pressure by improving query shape and adding the right indexes.

---

### Behrang - 10 SP

- **PB-104 + PB-105 + PB-63**: Owner dashboard, analytics, monitoring, and shared UI polish (10 SP) - Days 4-10

**Responsibilities:**
- Build the owner-facing dashboard surface for reviewing gameplay and session health.
- Add analytics summaries for recent sessions, completion rate, and average round performance.
- Integrate monitoring/error tracking with clear environment-based behavior.
- Keep the dashboard visually consistent by reusing shared primitives instead of custom one-offs.
- Handle empty, loading, and error states so the owner view stays usable in all conditions.

---

## Sprint Timeline (Simplified)

### Week 1 (Days 1-5): Player Flow, Gameplay Screen, and Foundations

**Days 1-2: Join Flow and Game UI Start**
- Mohamad: implement the session join form, username validation, and lobby entry flow.
- David: start the question screen layout, timer, and answer option state.
- Nishan: start reconnect and throttling work, verify hot-path assumptions for the backend.
- Behrang: sketch the owner dashboard data model and shared dashboard layout.

**Days 3-5: Real-Time Sync and Feature Completion**
- Mohamad: finish lobby roster updates and host-only start control.
- David: finish answer submission states and leaderboard refresh behavior.
- Nishan: finish reconnect recovery and begin DB cleanup/index work.
- Behrang: wire monitoring configuration and begin the analytics cards.

**Milestone (End of Week 1):**
- ✅ Players can join a session and see a live lobby.
- ✅ Questions render with timer and answer controls.
- ✅ Reconnect and throttling foundation is underway.
- ✅ Owner dashboard scaffolding is in place.

---

### Week 2 (Days 6-10): Hardening, Analytics, Optimization, and Final Polish

**Days 6-7: Stability and Monitoring**
- Nishan: complete reconnect, rate limiting, and cleanup jobs.
- Behrang: finish owner dashboard and monitoring integration.
- David: lock down leaderboard edge cases and round transition states.
- Mohamad: fix lobby edge cases and host start/rejoin flows.

**Days 8-9: Performance and Database Tuning**
- Nishan: finalize database indexes and query tuning.
- Behrang: finish analytics cards and summary tables.
- David: run UI regression on question/leaderboard timing behavior.
- Mohamad: verify lobby re-entry and duplicate-username handling.

**Day 10: Integration, Testing, and Finalization**
- All: full end-to-end validation from join to owner dashboard review.
- All: fix bugs found during regression and finalize test coverage.
- Team: sprint demo preparation and handoff.

**Milestone (End of Week 2):**
- ✅ Complete playable flow from join to final leaderboard.
- ✅ Reconnect, rate limiting, cleanup, and optimization in place.
- ✅ Owner dashboard and monitoring available.
- ✅ All tests passing and demo-ready.

---

## Daily Effort Breakdown

| Day | Total SP | Focus Area | Deliverables |
|-----|----------|------------|--------------|
| 1 | 4 | Join flow + gameplay start | Join form, timer shell, dashboard layout |
| 2 | 4 | Lobby sync + question UI | Lobby roster, question render, analytics scaffolding |
| 3 | 4 | Submit flow + reconnect start | Answer submission, reconnect recovery, monitoring setup |
| 4 | 4 | Leaderboard + DB tuning | Leaderboard updates, query analysis, dashboard cards |
| 5 | 4 | Host control + cleanup | Start control, cleanup job start, error tracking |
| 6 | 4 | Stability + regression | Reconnect polish, rate limiting, analytics polish |
| 7 | 4 | Performance + validation | Lighthouse/bundle checks, leaderboard edge cases |
| 8 | 4 | Database optimization | Indexes, query updates, cleanup verification |
| 9 | 4 | Final integration | Full flow validation, owner dashboard review |
| 10 | 4 | Finalization | Tests, fixes, demo prep |

**Total: 40 SP**

---

## Risk Mitigation

### Identified Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Duplicate or stale lobby entries after refresh/reconnect | Medium | High | Enforce session-scoped identity and add reconnect-focused tests early. |
| Leaderboard desync after fast scoring updates | Medium | High | Keep scoreboard authoritative on the server and verify tie ordering. |
| Performance regression from extra dashboard/analytics queries | Medium | Medium | Add indexes, reuse cached summaries, and verify the hot-path queries. |
| Monitoring noise or sensitive data leakage | Low | High | Tag errors carefully and strip PII from logs and dashboard payloads. |
| Scope creep from analytics polish | Medium | Medium | Keep the owner dashboard focused on the MVP visibility required for launch. |

### Contingency Plan

- If behind by more than 5 SP by Day 7, defer non-critical analytics charts and keep the session flow, reconnect, and dashboard cards.
- If database tuning is slower than expected, keep the cleanup job and key indexes, then defer lower-priority reporting fields.
- If leaderboard sync has timing issues, freeze the UI on server-confirmed updates only and skip speculative animations.
- If monitoring integration blocks progress, ship the dashboard with a simplified error summary and finish Sentry wiring after the demo.

---

## Definition of Done (Sprint Level)

- [ ] All 4 grouped user-story blocks completed with individual DoD met.
- [ ] Full playable flow works end to end: join → lobby → question → answer → leaderboard → owner review.
- [ ] Reconnect, duplicate-name, stale-session, and timeout edge cases are handled.
- [ ] Code coverage is high enough for all new game flow, stability, and dashboard work.
- [ ] All unit, integration, and E2E tests passing.
- [ ] No critical/high severity ESLint errors.
- [ ] Code formatted with Prettier.
- [ ] All PRs reviewed and merged to `main`.
- [ ] Sprint demo conducted and retrospective completed.

---

## Notes

- **Focus:** Sprint 6 is the MVP completion sprint, not a feature-exploration sprint.
- **Reused UI:** Prefer the existing shared primitives and patterns already used across the app.
- **Edge cases:** Reconnect, duplicate usernames, stale sessions, and late submissions are first-class requirements.
- **Monitoring:** Owner visibility and error tracking are included so the product can be operated after launch.
- **Optimization:** Database cleanup and query tuning are required because the current data layer is intentionally minimal.
