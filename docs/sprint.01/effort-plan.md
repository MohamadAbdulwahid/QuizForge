# Sprint 1 Effort Plan

**Sprint Duration:** 2 weeks (10 working days)  
**Target Velocity:** 33 Story Points  
**Team Size:** 4 developers

---

## Team Members & Roles

| Name | Role | Primary Focus | Availability |
|------|------|---------------|--------------|
| **Mohamad** | Product Owner, Developer | Infrastructure, Auth, Migrations | Full-time |
| **David** | Scrum Master, Developer | ORM, Schema, Service Layer | Part-time |
| **Nishan** | Stakeholder, Developer | API Endpoints, Seed Data | Part-time |
| **Behrang** | Stakeholder, Developer | ERD Design, Logging, Error Handling | Part-time |

---

## Effort Distribution by Developer

### Mohamad - 14 SP
- **PB-00**: Git repository & CI basics (2 SP) - Day 1
- **PB-01**: Nx monorepo with Bun backend scaffold (2 SP) - Day 1
- **PB-02**: Tech stack research & selection (2 SP) - Days 1-2
- **PB-04**: Supabase Project Setup (2 SP) - Day 2
- **PB-07**: Initial Supabase Migrations (2 SP) - Days 5-6
- **PB-09**: Supabase Auth Integration (4 SP) - Days 6-8

**Responsibilities:**
- Lead architecture decisions
- Infrastructure setup (Supabase, Nx, CI/CD)
- Auth middleware and JWT validation
- Database migrations and RLS policies
- Code reviews for all PRs
- Pair programming sessions with team
- Unblock team members
- Sprint demo preparation

---

### David - 9 SP
- **PB-05**: Drizzle ORM Configuration (3 SP) - Days 3-4
- **PB-06**: Drizzle Database Schema Definition (3 SP) - Days 4-5
- **PB-06.5**: Auth Service Layer (2 SP) - Days 5-6
- **PB-12**: Environment Variables Setup (1 SP) - Day 3

**Responsibilities:**
- Drizzle ORM configuration and client setup
- Database schema design and implementation
- Repository layer for type-safe queries
- Auth service layer (business logic)
- Environment variable validation with Zod
- Service patterns and architecture guidance

---

### Nishan - 6 SP
- **PB-08**: Seed Data Scripts (2 SP) - Days 7-8
- **PB-10**: User Signup Endpoint (2 SP) - Days 7-8
- **PB-11**: User Login Endpoint (2 SP) - Days 8-9

**Responsibilities:**
- API endpoint development (signup/login routes)
- Integration testing for auth endpoints
- Seed data creation with realistic test data
- Zod DTO validation schemas
- API documentation with Tspec annotations

---

### Behrang - 4 SP
- **PB-03**: Entity-Relationship Diagram (ERD) Design (2 SP) - Days 1-2
- **PB-13**: Pino Logger Configuration (1 SP) - Day 5
- **PB-14**: Global Error Handling Middleware (1 SP) - Day 9

**Responsibilities:**
- ERD design and documentation
- Structured logging setup with Pino
- Error handling middleware
- Unit test coverage
- Documentation updates
- QA and manual testing

---

## Sprint Timeline (Simplified)

### Week 1 (Days 1-5)

**Days 1-2: Foundation & Design**
- Mohamad: Git/CI setup (PB-00), Nx scaffold (PB-01), tech stack research (PB-02), Supabase setup (PB-04)
- Behrang: ERD design (PB-03)
- Team review of ERD and tech stack decisions

**Days 3-5: Database Layer**
- David: Environment config (PB-12), Drizzle ORM setup (PB-05), schema definition (PB-06), auth service start (PB-06.5)
- Mohamad: Migration scripts (PB-07), auth integration start (PB-09)
- Behrang: Pino logger setup (PB-13)

**Milestone:** Drizzle configured, schema defined, database migrations applied, service layer ready

---

### Week 2 (Days 6-10)

**Days 6-8: Authentication & Endpoints**
- Mohamad: Complete auth middleware (PB-09)
- David: Finish auth service (PB-06.5)
- Nishan: Seed data (PB-08), signup endpoint (PB-10), login endpoint (PB-11)
- Dependencies: PB-10 and PB-11 depend on PB-06.5 completion

**Days 9-10: Testing & Finalization**
- Behrang: Error handling middleware (PB-14), manual testing
- All: Integration tests, code reviews, bug fixes
- Team: Sprint demo preparation, retrospective

**Milestone:** Full auth flow working, endpoints functional, database seeded, all tests passing

---

## Daily Effort Breakdown

| Day | Total SP | Focus Area | Deliverables |
|-----|----------|------------|--------------|
| 1 | 6 | Setup & Planning | Git/CI, Nx, ERD draft, tech research |
| 2 | 4 | Infrastructure | ERD final, Supabase project live |
| 3 | 4 | ORM Foundation | Env config, Drizzle connection |
| 4 | 3 | Schema Definition | Database schema, tables defined |
| 5 | 5 | Services & Logging | Auth service, migrations, logger |
| 6 | 4 | Auth Middleware | JWT validation, service completion |
| 7 | 4 | Endpoints Start | Seed data, signup endpoint |
| 8 | 4 | Endpoints Finish | Login endpoint, auth middleware complete |
| 9 | 2 | Error Handling | Error middleware, testing |
| 10 | 1 | Finalization | Final tests, demo ready |

**Total: 37 SP** (includes buffer for reviews and testing)

---

## Risk Mitigation

### Identified Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Drizzle ORM learning curve | Medium | High | David leads with docs, Mohamad pair programs on complex queries |
| Service layer complexity | Medium | Medium | Follow backend.instructions.md, clear separation of concerns |
| PB-10/PB-11 blocked by PB-06.5 | Low | High | David prioritizes PB-06.5 completion by Day 6 |
| Supabase Auth integration issues | Medium | Medium | Mohamad allocates 4 SP, early testing with tokens |
| Team member unavailability | Low | High | Cross-training, pair programming, async communication |
| Scope creep | Low | Medium | Strict adherence to Sprint 1 backlog, defer new features |

### Contingency Plan
- If behind by >6 SP by Day 7: Defer PB-08 (Seed Data) to Sprint 2
- If PB-06.5 delayed: Nishan switches to integration tests for existing code
- If critical blocker: Daily standup to reallocate tasks
- Buffer tasks available (documentation, additional tests) if ahead

---

## Definition of Done (Sprint Level)

- [ ] All 15 user stories completed with individual DoD met (including new PB-06.5)
- [ ] Code coverage ≥80% for new code
- [ ] All unit and integration tests passing
- [ ] No critical/high severity ESLint errors
- [ ] Code formatted with Prettier
- [ ] All PRs reviewed and merged to `main`
- [ ] Sprint demo conducted
- [ ] Sprint retrospective completed with action items

---

## Notes

- **Service Layer Pattern:** All routes must use services (not direct DB/Supabase calls)
- **Dependency Chain:** PB-10 & PB-11 require PB-06.5 completion - coordinate closely
- **Pair Programming:** Encouraged for:
  - Drizzle setup (Mohamad + David)
  - Auth service (David + Nishan)
  - Repository patterns (David + Nishan)
- **Code Reviews:** Mandatory for all PRs, max 24h turnaround
- **Documentation:** Update backend.instructions.md with new patterns discovered
- **Testing:** Write tests alongside feature code, not at the end
- **Focus:** Backend only - frontend starts Sprint 3

---

## Success Criteria

✅ **Sprint is successful if:**
- 33 SP completed (100% velocity)
- Service layer architecture established and documented
- Database schema deployed with migrations and seeded
- Auth endpoints functional with Supabase (signup/login working)
- Repository pattern implemented and tested
- All tests passing
- Team happy and unblocked for Sprint 2

✅ **Bonus achievements:**
- >85% code coverage
- Zero production bugs in Sprint 2
- Team velocity confidence increased
- Reusable service/repository patterns documented
