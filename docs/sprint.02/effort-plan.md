# Sprint 2 Effort Plan

**Sprint Duration:** 2 weeks (10 working days)  
**Target Velocity:** 26 Story Points  
**Team Size:** 4 developers

---

## Team Members & Roles

| Name | Role | Primary Focus | Hour worked |
|------|------|---------------|--------------|
| **Mohamad** | Product Owner, Developer | Session API, Auth enforcement, Code reviews | 0h |
| **David** | Scrum Master, Developer | Repositories (Quiz, Question), Share code | 0h |
| **Nishan** | Stakeholder, Developer | Quiz Service Layer, Quiz Endpoints | 0h |
| **Behrang** | Stakeholder, Developer | Zod DTOs, Session Repository, Validation | 0h |

---

## Effort Distribution by Developer

### David - 9 SP

- **PB-15**: QuizRepository with Drizzle queries (4 SP) - Days 1-4
- **PB-16**: QuestionRepository with ordering (3 SP) - Days 4-6
- **PB-24**: Share code generation utility (2 SP) - Days 2-3

**Responsibilities:**
- Repository layer design and implementation (quiz + question CRUD)
- Drizzle query patterns: joins, transactions, returning(), bulk inserts
- Share code generation with cryptographic randomness and collision handling
- Unit tests for all repository methods
- Establish repository patterns for the team to follow (functional style, consistent with `user.repository.ts`)
- Pair programming with Nishan on service-repository integration

---

### Behrang - 5 SP

- **PB-21**: Zod validation schemas for quiz and session DTOs (2 SP) - Days 1-3
- **PB-26**: SessionRepository with Drizzle queries (3 SP) - Days 3-6

**Responsibilities:**
- Zod schema design with conditional validation (e.g., options required for multiple-choice)
- Generic validation middleware (`validateBody`, `validateParams`)
- Session repository with PIN uniqueness checking
- PIN generation utility with zero-padding and retry logic
- Unit tests for DTOs, validation middleware, and session repository
- Documentation for Zod patterns and validation error format

---

### Nishan - 6 SP

- **PB-17.5**: Quiz Service Layer (2 SP) - Days 5-6
- **PB-17**: Create and Edit Quiz Endpoints (3 SP) - Days 6-8
- **PB-19**: Delete Quiz Endpoint (1 SP) - Day 9

**Responsibilities:**
- Quiz service layer (business logic, authorization, transaction orchestration)
- Custom error classes (`NotFoundError`, `ForbiddenError`, `ConflictError`)
- Quiz controller (thin handlers calling service methods)
- Quiz routes with validation middleware chaining
- Route registration pattern (`routes/index.ts`)
- Integration with error handler middleware for custom error mapping
- Manual testing of all quiz CRUD endpoints
- Tspec annotations for API documentation

---

### Mohamad - 6 SP + reviews

- **PB-23**: Quiz endpoints enforce authMiddleware (1 SP) - Day 5
- **PB-20**: View My Quizzes endpoint (2 SP) - Days 7-8
- **PB-27**: Create Game Session with unique PIN (3 SP) - Days 7-9

**Responsibilities:**
- Auth middleware integration on the `/api` router
- Public vs. protected route architecture (share code lookup is public)
- Session service layer and session controller
- Session route registration
- Express app factory refactor (`main.ts` cleanup, middleware chain ordering)
- Code reviews for all PRs (max 24h turnaround)
- Integration testing for auth enforcement and session creation
- Sprint demo preparation
- Unblock team members, architecture guidance

---

## Sprint Timeline (Simplified)

### Week 1 (Days 1-5): Foundations — Repositories, DTOs & Utilities

**Days 1-2: Schema Validation & Repository Start**
- David: Begin QuizRepository (PB-15) — `findById`, `findByCreator`, `findByShareCode`, `create` methods
- Behrang: Zod validation schemas (PB-21) — `CreateQuizRequestSchema`, `UpdateQuizRequestSchema`, `QuestionSchema` with conditional validation; `validateBody`/`validateParams` middleware
- David: Share code generation utility (PB-24) — `generateShareCode()`, unit tests
- Team: Sprint 2 kickoff, review Sprint 1 carry-overs

**Days 3-4: Repository Completion**
- David: Finish QuizRepository (PB-15) — `update`, `delete`, `shareCodeExists`, `findByIdWithQuestions` methods; unit tests
- David: Begin QuestionRepository (PB-16) — `findByQuizId`, `create`, `createMany`
- Behrang: Finish validation schemas (PB-21), session DTO; begin SessionRepository (PB-26)
- David: Integrate share code uniqueness check with `quiz.repository.shareCodeExists()` (PB-24)

**Day 5: Repository Wrap-up & Auth Setup**
- David: Finish QuestionRepository (PB-16) — `update`, `delete`, `deleteByQuizId`, `reorder` methods; unit tests
- Behrang: Continue SessionRepository (PB-26) — `create`, `findByPin`, `updateStatus`, `pinExists`; PIN generation utility
- Mohamad: Auth middleware enforcement on quiz routes (PB-23) — route architecture for public vs. protected

**Milestone (End of Week 1):**
- ✅ QuizRepository complete with all CRUD + share code methods
- ✅ QuestionRepository complete with ordering and bulk operations
- ✅ Zod schemas + validation middleware ready
- ✅ Share code generation with uniqueness check ready
- ✅ SessionRepository in progress, PIN generation utility done
- ✅ Auth middleware architecture established

---

### Week 2 (Days 6-10): Features — Services, Endpoints & Integration

**Days 5-6: Service Layer & Session Repository**
- Nishan: Quiz Service Layer (PB-17.5) — `createQuiz`, `updateQuiz`, `deleteQuiz`, `getQuizById`, `getQuizzesByCreator`, `getQuizByShareCode`; custom error classes (`NotFoundError`, `ForbiddenError`, `ConflictError`)
- Behrang: Finish SessionRepository (PB-26) — `findByHost`, `findActiveByQuiz`; unit tests for all methods and PIN utility

**Dependencies resolved:** PB-17.5 starts only after PB-15, PB-16, and PB-24 are complete (David's work)

**Days 6-8: Quiz Endpoints**
- Nishan: Create & Edit Quiz Endpoints (PB-17) — controller, routes, route registration; manual testing
- Mohamad: View My Quizzes endpoint (PB-20) — `GET /api/quizzes`, `GET /api/quizzes/:id`
- Mohamad: Begin Session creation endpoint (PB-27) — session service, controller, route

**Days 8-9: Remaining Endpoints & Testing**
- Nishan: Delete Quiz endpoint (PB-19) — `DELETE /api/quizzes/:id`
- Mohamad: Finish Session creation endpoint (PB-27) — PIN uniqueness, conflict detection, integration tests
- Behrang: Integration tests for session endpoints

**Day 10: Integration, Testing & Finalization**
- All: Integration tests, code reviews, bug fixes
- All: Manual testing with Postman/curl (full CRUD flow)
- Team: Sprint demo preparation, retrospective

**Milestone (End of Week 2):**
- ✅ All quiz CRUD endpoints functional (POST, GET, PATCH, DELETE)
- ✅ Session creation endpoint with unique PIN
- ✅ Auth enforcement on all protected routes
- ✅ Public share code lookup working
- ✅ All unit and integration tests passing
- ✅ Sprint demo ready

---

## Daily Effort Breakdown

| Day | Total SP | Focus Area | Deliverables |
|-----|----------|------------|--------------|
| 1 | 3 | DTOs + Repo Start | Zod schemas started, QuizRepository started |
| 2 | 3 | Share Code + Repos | Share code utility done, QuizRepository progress |
| 3 | 3 | Repos + Validation | QuizRepository near-complete, validation middleware done, SessionRepo started |
| 4 | 3 | QuestionRepo | QuestionRepository started, QuizRepository done |
| 5 | 3 | Repos Done + Auth | QuestionRepository done, auth middleware, quiz service started |
| 6 | 3 | Service Layer | Quiz service layer done, SessionRepository done |
| 7 | 3 | Endpoints Start | Create/Edit quiz endpoints, session endpoint started |
| 8 | 3 | Endpoints Continue | View quizzes, session endpoint progress |
| 9 | 2 | Remaining Endpoints | Delete quiz, session endpoint done |
| 10 | 1 | Finalization | Tests, reviews, demo |

**Total: ~27 SP** (includes buffer for reviews and testing)

---

## Dependency Graph

```
Week 1 (Foundations)                      Week 2 (Features)
---

## Risk Mitigation

### Identified Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Sprint 1 carry-overs block Sprint 2 | Medium | High | Days 1-2 prioritize completing any unfinished Sprint 1 items before starting Sprint 2 work |
| Drizzle transaction complexity (bulk inserts, reorder) | Medium | Medium | David leads with Drizzle docs; `createMany` and `reorder` get extra attention and tests |
| Zod conditional validation complexity (`superRefine` for question options) | Medium | Low | Behrang starts early (Day 1); refer to Zod docs for `superRefine` patterns |
| PB-17.5 blocked by PB-15/PB-16 completion | Low | High | David prioritizes repository completion by Day 5; Nishan can start service skeleton with mocked repo methods if needed |
| Share code / PIN collision in production | Low | Medium | Both utilities have retry logic (5 retries for share codes, 10 for PINs); log collision events for monitoring |
| Auth middleware not ready from Sprint 1 | Low | High | Mohamad can stub auth middleware for Sprint 2 development; fix properly as carry-over |
| Scope creep (adding session CRUD beyond `POST`) | Low | Medium | Strict scope: only `POST /api/sessions` in Sprint 2; GET and PATCH deferred to Sprint 3 (PB-29) |

### Contingency Plan

- **If behind by >5 SP by Day 7**: Defer PB-19 (Delete Quiz, 1 SP) to Sprint 3 — delete is lower priority than create/view
- **If PB-15/PB-16 delayed**: Nishan starts PB-17.5 with repository interfaces (TypeScript types) as contracts, implements against mocks; integration once repos are done
- **If Sprint 1 carry-overs consume >2 days**: Defer PB-27 (Session creation) to Sprint 3 — session endpoints naturally fit with Sprint 3's session management scope
- **If critical blocker**: Daily standup to reallocate tasks; pair programming sessions to unblock
- **Buffer tasks** (if ahead of schedule): Additional integration tests, API documentation polish, Tspec setup, begin Sprint 3 research

---

## Definition of Done (Sprint Level)

- [ ] All 11 user stories completed with individual DoD met (including added PB-17.5)
- [ ] Code coverage ≥80% for repositories, services, DTOs, and controllers
- [ ] All unit and integration tests passing
- [ ] No critical/high severity ESLint errors
- [ ] Code formatted with Prettier
- [ ] All PRs reviewed and merged to `main`
- [ ] Sprint demo conducted
- [ ] Sprint retrospective completed with action items

---

## Notes

- **Functional Repository Style**: Follow the pattern established by `user.repository.ts` in Sprint 1 — exported named functions, not classes. Keep consistency across all repositories.
- **Service Layer Pattern**: Services sit between controllers and repositories. Controllers validate input and send responses. Services contain business logic and authorization checks. Repositories handle data access only.
- **Transaction Scope**: Transactions are initiated in the service layer (not the controller or repository). Repository methods that need transactions accept a `tx` parameter or the service wraps multiple repo calls in `db.transaction()`.
- **Error Flow**: Custom errors (`NotFoundError`, `ForbiddenError`, `ConflictError`) are thrown in the service layer and caught by the global error handler middleware, which maps the `statusCode` and `code` properties to the JSON response.
- **Pair Programming Encouraged For**:
  - Drizzle joins and transactions (David + Nishan)
  - Zod conditional validation (Behrang + Mohamad)
  - Service-controller integration (Nishan + Mohamad)
  - Auth middleware architecture (Mohamad + Behrang)
- **Code Reviews**: Mandatory for all PRs, max 24h turnaround. Reviewer checks: types, error handling, test coverage, adherence to repository/service patterns.
- **Focus**: Backend only — frontend starts Sprint 3.
- **Testing**: Write tests alongside feature code. Repository tests may need a test database connection or in-memory mocking strategy — establish the pattern early in Day 1.

---

## Success Criteria

✅ **Sprint is successful if:**
- 26 SP completed (100% velocity)
- Full quiz CRUD API functional end-to-end (create, read, update, delete)
- Session creation with unique PIN working
- Repository pattern established and consistent across all entities
- Service layer pattern established with authorization checks
- Zod validation preventing invalid data from reaching the database
- Auth middleware protecting all non-public endpoints
- All tests passing, coverage ≥80%
- Team confident to build frontend against these APIs in Sprint 3

✅ **Bonus achievements:**
- >85% code coverage
- Tspec API documentation auto-generated and accessible
- Share code lookup (public endpoint) working for future quiz preview feature
- Zero regressions from Sprint 1 functionality
- Clean separation of concerns documented in code (no business logic in controllers or repos)
