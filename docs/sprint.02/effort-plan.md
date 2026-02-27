# Sprint 2 Effort Plan

**Sprint Duration:** 2 weeks (10 working days)  
**Target Velocity:** 27 Story Points  
**Team Size:** 4 developers

---

## Team Members & Roles

| Name | Role | Primary Focus | Availability |
|------|------|---------------|--------------|
| **Mohamad** | Product Owner, Developer | Service layer, share code, auth wiring, API docs | Full-time |
| **David** | Scrum Master, Developer | Repository layer (Quiz + Question) | Part-time |
| **Nishan** | Stakeholder, Developer | API endpoints (create, update, delete) | Part-time |
| **Behrang** | Stakeholder, Developer | Zod DTOs, list/share-code endpoints, testing | Part-time |

---

## Sprint 1 Carryover Assessment

Before Sprint 2 work begins, the following Sprint 1 items must be verified as **complete**. These are hard dependencies for Sprint 2:

| Sprint 1 Item | Status | Blocking Sprint 2 Items | Contingency |
|---------------|--------|------------------------|-------------|
| **PB-09** Auth middleware | Required | PB-23 (all quiz routes need auth) | Mohamad resolves Day 1–2 |
| **PB-12** Env config with Zod | Required | All backend code uses `config` | David resolves Day 1 |
| **PB-13** Pino logger | Required | Service layer logging | Behrang resolves Day 1 |
| **PB-14** Error handler | Required | Custom errors (NotFound, Forbidden) | Behrang resolves Day 1 |
| **PB-06.5** Auth service layer | Nice-to-have | Not blocking (Sprint 2 has its own service) | Defer to later |
| **PB-08** Seed data | Nice-to-have | Helpful for testing but not blocking | Can seed manually |

> **Decision:** Allocate Days 1–2 as a "Sprint 1 stabilization window" to finish any incomplete prerequisites. This is budgeted in the timeline below.

---

## Effort Distribution by Developer

### Mohamad — 8 SP
- **PB-15.5**: QuizService Layer (3 SP) — Days 4–6
- **PB-24**: Share Code Generation (2 SP) — Day 3
- **PB-23**: Auth Middleware on Quiz Routes (1 SP) — Day 3
- **PB-22**: Tspec Annotations & API Docs (2 SP) — Days 8–9

**Responsibilities:**
- Finish any Sprint 1 carryover (auth middleware, route wiring) in Days 1–2
- Design and implement the QuizService layer (business logic between controllers and repositories)
- Build the share code generation utility with uniqueness checking
- Wire `authMiddleware` onto the quiz router
- Add Tspec annotations to all quiz endpoints and configure Swagger UI at `/api-docs`
- Define custom error classes (`NotFoundError`, `ForbiddenError`) for the global error handler
- Code reviews for all PRs
- Unblock team members and architectural decisions
- Sprint demo preparation

---

### David — 7 SP
- **PB-15**: QuizRepository with Drizzle Queries (4 SP) — Days 2–4
- **PB-16**: QuestionRepository with Ordering (3 SP) — Days 4–5

**Responsibilities:**
- Implement QuizRepository with all CRUD operations using Drizzle's type-safe query builder
- Implement QuestionRepository with bulk insert, ordering by `order_index`, and cascading deletes
- Write JSDoc for all repository functions
- Write unit tests for repository functions
- Verify all Drizzle queries work against the existing schema (quiz.ts, session.ts)
- Pair with Mohamad on transaction patterns (quiz + question atomic create)
- Verify Sprint 1's env config (PB-12) is complete by Day 1

---

### Nishan — 6 SP
- **PB-17**: Create Quiz Endpoint (3 SP) — Days 5–6
- **PB-18**: Edit Quiz Endpoint (2 SP) — Days 7–8
- **PB-19**: Delete Quiz Endpoint (1 SP) — Day 8

**Responsibilities:**
- Implement quiz controller handlers (create, update, delete)
- Wire routes to controllers in `quiz.routes.ts`
- Register quiz router in the Express app entry point
- Validate request bodies using Zod schemas (from PB-21)
- Use the QuizService (from PB-15.5) in all handlers — no direct repository calls
- Write integration tests for create, update, delete flows
- Test all endpoints with curl/Postman
- Add `API-Version: 1.0` header handling to all endpoints

---

### Behrang — 6 SP
- **PB-21**: Zod Validation Schemas (2 SP) — Days 2–3
- **PB-20**: View My Quizzes Endpoint (2 SP) — Days 6–7
- **PB-25**: Retrieve Quiz by Share Code (2 SP) — Days 7–8

**Responsibilities:**
- Design and implement Zod validation schemas for all quiz DTOs with refinements (e.g., multiple-choice requires ≥2 options)
- Write comprehensive unit tests for schema validation (valid, invalid, edge cases)
- Implement the list quizzes and get-by-share-code controller handlers
- Implement share code preview sanitization (strip `correctAnswer` from response)
- Finish Sprint 1's Pino logger (PB-13) and error handler (PB-14) by Day 1–2 if not already complete
- QA and manual testing of all endpoints
- Documentation updates

---

## Sprint Timeline (Simplified)

### Week 1 (Days 1–5)

**Days 1–2: Sprint 1 Stabilization & Foundation**
- **All:** Verify Sprint 1 prerequisites are working (auth middleware, env config, logger, error handler)
- **Mohamad:** Finish any Sprint 1 auth carryover; plan QuizService architecture; define custom error classes
- **David:** Begin QuizRepository implementation (PB-15); verify Drizzle client + schema
- **Behrang:** Begin Zod validation schemas (PB-21); finish PB-13/PB-14 if needed
- **Nishan:** Review Sprint 2 backlog; set up controller/route file scaffolding; prepare test fixtures

**Days 3–5: Repository & Service Layer**
- **David:** Complete QuizRepository (PB-15); begin QuestionRepository (PB-16)
- **Mohamad:** Share code utility (PB-24); auth middleware wiring (PB-23); begin QuizService (PB-15.5)
- **Behrang:** Complete Zod DTOs (PB-21); write DTO unit tests
- **Nishan:** Begin create quiz endpoint (PB-17) once service layer is ready (Day 5)

**Milestone (End of Week 1):**
- ✅ QuizRepository and QuestionRepository implemented and tested
- ✅ Zod validation schemas complete with tests
- ✅ Share code utility implemented with tests
- ✅ QuizService layer started (core methods: createQuiz, getMyQuizzes)
- ✅ Auth middleware wired to quiz routes

---

### Week 2 (Days 6–10)

**Days 6–8: Endpoints & Integration**
- **Mohamad:** Complete QuizService layer (PB-15.5) — all business logic methods
- **Nishan:** Complete create endpoint (PB-17); implement update endpoint (PB-18); implement delete endpoint (PB-19)
- **Behrang:** Implement list quizzes endpoint (PB-20); implement share code endpoint (PB-25)
- **David:** Support Nishan/Behrang with repository questions; write integration tests

**Days 9–10: API Docs, Testing & Finalization**
- **Mohamad:** Tspec annotations (PB-22); configure Swagger UI; final code reviews
- **All:** Integration tests, manual testing checklist, bug fixes
- **Team:** Sprint demo preparation, retrospective

**Milestone (End of Week 2):**
- ✅ All 6 quiz endpoints functional and tested
- ✅ Swagger UI accessible at `/api-docs`
- ✅ All unit + integration tests passing
- ✅ Manual testing checklist completed
- ✅ Sprint demo ready

---

## Daily Effort Breakdown

| Day | Total SP | Focus Area | Deliverables |
|-----|----------|------------|--------------|
| 1 | 1 | Sprint 1 stabilization | Auth/logger/error handler verified, custom errors defined |
| 2 | 3 | Repository foundation | QuizRepo started, Zod DTOs started, env verified |
| 3 | 4 | Repository + utilities | QuizRepo complete, share code utility, auth wired |
| 4 | 4 | Question repo + service | QuestionRepo, QuizService started, Zod DTOs complete |
| 5 | 3 | Service + first endpoint | QuizService core, create endpoint started |
| 6 | 3 | Service + endpoints | QuizService complete, create endpoint done, list started |
| 7 | 3 | Remaining endpoints | Update endpoint, list done, share code endpoint |
| 8 | 3 | Endpoint completion | Delete endpoint, share code done, integration tests |
| 9 | 2 | API docs + testing | Tspec annotations, Swagger UI, test fixes |
| 10 | 1 | Finalization | Demo prep, final tests, bug fixes |

**Total: 27 SP**

---

## Dependency Graph

Understanding the dependency chain is critical for Sprint 2's success. Work must flow in this order:

```
Sprint 1 Carryover (Days 1-2)
│
├── PB-12 (Env Config) ──────────────┐
├── PB-13 (Logger) ──────────────────┤
├── PB-14 (Error Handler) ───────────┤
└── PB-09 (Auth Middleware) ─────────┤
                                     ▼
         ┌──────────── Foundation Layer (Days 2–5) ────────────┐
         │                                                      │
    PB-21 (Zod DTOs)          PB-15 (QuizRepo)                 │
         │                    PB-16 (QuestionRepo)              │
         │                         │                            │
         │               PB-24 (Share Code Util)                │
         │                         │                            │
         └─────────┬───────────────┘                            │
                   ▼                                            │
         PB-15.5 (QuizService) ◄────── PB-23 (Auth Wiring)     │
                   │                                            │
                   ▼                                            │
         ┌──── Endpoint Layer (Days 5–8) ──────────────┐        │
         │                                              │        │
    PB-17 (Create)    PB-20 (List)    PB-25 (Share)    │        │
    PB-18 (Update)                                      │        │
    PB-19 (Delete)                                      │        │
         │                                              │        │
         └──────────────────┬───────────────────────────┘        │
                            ▼                                    │
                   PB-22 (Tspec/Swagger) ────────────────────────┘
```

**Key Insight:** Behrang's Zod DTOs (PB-21) and David's repositories (PB-15, PB-16) can start in **parallel** from Day 2. The QuizService (PB-15.5) is the convergence point — it needs both DTOs and repositories before it can be fully implemented. Endpoints depend on the service layer.

---

## Risk Mitigation

### Identified Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Sprint 1 carryover delays Sprint 2 start | Medium | High | Budget Days 1–2 for stabilization; parallelize DTO + repo work |
| Drizzle transaction complexity (atomic create) | Medium | Medium | Mohamad + David pair program on transaction patterns; test thoroughly |
| QuizService becomes a bottleneck (all endpoints depend on it) | Medium | High | Mohamad prioritizes core methods (create, getMyQuizzes) first; stub remaining methods |
| Zod refinement edge cases (option validation) | Low | Low | Behrang writes comprehensive test cases for each question type |
| Tspec integration issues with Express v5 | Low | Medium | Mohamad investigates early (Day 1); fall back to manual Swagger YAML if needed |
| Auth middleware not ready (Sprint 1 PB-09 incomplete) | Medium | High | Mohamad finishes auth in Days 1–2; endpoints can be tested without auth initially |
| Share code collision in production | Very Low | Low | Retry logic (5 attempts); 33^8 = 1.4 trillion possible codes |

### Contingency Plan
- If behind by >5 SP by Day 7: Defer PB-22 (Tspec/Swagger docs) to Sprint 3
- If QuizService (PB-15.5) is delayed: Nishan can wire controllers directly to repositories temporarily (refactor to service later)
- If auth middleware is not ready: Test endpoints without auth first, add auth middleware as final step
- If repository tests need a live database: Use Supabase local (`supabase start`) for integration tests
- Buffer: Days 9–10 have lighter load for catching up on delays

---

## Definition of Done (Sprint Level)

- [ ] All 12 user stories completed with individual DoD met (PB-15 through PB-25, including PB-15.5)
- [ ] Code coverage ≥80% for repositories, services, controllers, and DTOs
- [ ] All unit and integration tests passing
- [ ] No critical/high severity ESLint errors
- [ ] Code formatted with Prettier
- [ ] All PRs reviewed and merged to `main`
- [ ] Swagger UI accessible at `/api-docs` with all endpoints documented
- [ ] Sprint demo conducted
- [ ] Sprint retrospective completed with action items

---

## Notes

- **Service Layer Pattern (from Sprint 1):** Route → Controller → Service → Repository → Database. Controllers handle HTTP concerns (req/res, status codes). Services handle business logic (ownership, transactions, validation). Repositories handle data access (Drizzle queries). This separation was established in Sprint 1 with PB-06.5 and continues here.
- **Dependency Chain:** PB-17, PB-18, PB-19 depend on PB-15.5 completion — coordinate closely between Mohamad and Nishan. Mohamad should prioritize `createQuiz()` and `getMyQuizzes()` service methods first so Nishan can start endpoint work by Day 5.
- **Pair Programming:** Encouraged for:
  - Drizzle transactions (Mohamad + David)
  - Controller patterns (Mohamad + Nishan)
  - Zod refinements (Behrang + David)
- **Code Reviews:** Mandatory for all PRs, max 24h turnaround. Repository PRs should be reviewed by Mohamad. Service PRs by David. Endpoint PRs by Mohamad.
- **Testing Strategy:** Write tests alongside feature code, not at the end. Repository tests may need a test database — use Supabase local or a dedicated test schema.
- **Focus:** Backend only — frontend starts Sprint 3.
- **Carry-forward risk:** If Sprint 1 items drag into Week 1, the "stabilization window" should absorb most of the impact. If it does not, escalate at daily standup.

---

## Success Criteria

✅ **Sprint is successful if:**
- All 12 PB items completed (27 SP) and DoD met
- Full quiz CRUD API working end-to-end (create, read, update, delete)
- Share code generation and lookup functional
- Ownership enforcement verified (403 on unauthorized access)
- Transaction safety confirmed (no partial creates)
- API docs accessible at `/api-docs`
- All tests passing (≥80% coverage)
- Team confident and ready for Sprint 3 (Session API + Frontend scaffold)

✅ **Bonus achievements:**
- >85% code coverage
- Seed data script creates sample quizzes (PB-08 carryover)
- Zero regressions in Sprint 1 functionality
- Reusable patterns documented (service layer, custom errors, DTO validation)
- Team velocity stable compared to Sprint 1
