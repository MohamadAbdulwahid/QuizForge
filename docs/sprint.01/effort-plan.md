# Sprint 1 Effort Plan

**Sprint Duration:** 2 weeks (10 working days)  
**Target Velocity:** 25 Story Points  
**Team Size:** 4 developers

---

## Team Members & Roles

| Name | Role | Primary Focus | Availability |
|------|------|---------------|--------------|
| **Mohamad** | Product Owner, Developer | Database, Auth, Architecture | Full-time |
| **Nishan** | Stakeholder, Developer | API Development, Testing | Part-time |
| **David** | Scrum Master, Developer | WebSocket prep, Middleware | Part-time |
| **Behrang** | Stakeholder, Developer | Documentation, Testing | Part-time |

---

## Effort Distribution by Developer

### Mohamad - 12 SP
- **PB-03**: ERD Design (2 SP) - Days 1-2
- **PB-04**: Supabase Setup (2 SP) - Day 2
- **PB-05**: Drizzle Configuration (3 SP) - Days 3-4
- **PB-06**: Database Schema (3 SP) - Days 4-5
- **PB-09**: Supabase Auth Integration (2 SP of 4 SP) - Days 6-7

**Responsibilities:**
- Lead architecture decisions
- Code reviews for all PRs
- Pair programming sessions with team
- Unblock team members
- Sprint demo preparation

---

### Nishan - 5 SP
- **PB-10**: User Signup Endpoint (2 SP) - Days 6-7
- **PB-11**: User Login Endpoint (2 SP) - Days 7-8
- **PB-13**: Pino Logger (1 SP) - Day 5

**Responsibilities:**
- API endpoint development
- Integration testing for auth endpoints
- API documentation with Tspec

---

### David - 5 SP
- **PB-07**: Supabase Migrations (2 SP) - Days 5-6
- **PB-14**: Error Handling Middleware (1 SP) - Day 8
- **PB-09**: Supabase Auth Middleware (2 SP of 4 SP) - Days 8-9

**Responsibilities:**
- Database migration scripts
- Middleware development
- Error handling patterns

---

### Behrang - 3 SP
- **PB-08**: Seed Data Scripts (2 SP) - Days 7-8
- **PB-12**: Environment Variables (1 SP) - Day 9

**Responsibilities:**
- Test data creation
- Unit test coverage
- Documentation updates
- QA and manual testing

---

## Sprint Timeline (Simplified)

### Week 1 (Days 1-5)

**Days 1-2: Foundation**
- ERD design and team review
- Supabase project setup
- Environment configuration skeleton

**Days 3-5: Database Layer**
- Drizzle ORM configuration
- Schema definition
- Initial migrations
- Logger setup

**Milestone:** Database accessible, schema deployed, can run queries

---

### Week 2 (Days 6-10)

**Days 6-7: Authentication**
- Supabase Auth integration
- Signup/Login endpoints
- Seed data creation

**Days 8-9: Middleware & Testing**
- Auth middleware completion
- Error handling
- Integration tests
- Code reviews

**Day 10: Sprint Wrap-up**
- Final testing
- Documentation updates
- Sprint demo preparation
- Sprint retrospective

**Milestone:** Full auth flow working, database seeded, all tests passing

---

## Daily Effort Breakdown

| Day | Total SP | Focus Area | Deliverables |
|-----|----------|------------|--------------|
| 1 | 2 | Planning & Design | ERD draft |
| 2 | 4 | Setup | ERD final, Supabase live |
| 3 | 3 | ORM Config | Drizzle connected |
| 4 | 3 | Schema | Tables defined |
| 5 | 4 | Migrations & Logging | Schema deployed, logger working |
| 6 | 4 | Auth Start | Middleware + Signup |
| 7 | 4 | Auth Endpoints | Login + Seed data |
| 8 | 3 | Middleware | Error handler + Tests |
| 9 | 2 | Testing | Integration tests passing |
| 10 | 1 | Finalization | Demo ready |

---

## Risk Mitigation

### Identified Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Supabase learning curve | Medium | Medium | Mohamad to lead with docs, pair programming sessions |
| Team member unavailability | Low | High | Cross-training, pair programming, async communication |
| Drizzle ORM complexity | Medium | Medium | Follow backend.instructions.md closely, use examples |
| Scope creep | Low | Medium | Strict adherence to Sprint 1 backlog, defer new features |

### Contingency Plan
- If behind by >5 SP by Day 7: Defer PB-08 (Seed Data) to Sprint 2
- If critical blocker: Daily standup to reallocate tasks
- Buffer tasks available (documentation, additional tests) if ahead

---

## Communication Plan

### Daily Standup (15 min)
- Time: 9:00 AM
- Format: Async (Discord/Slack) or Sync (Google Meet)
- Questions:
  - What did you complete yesterday?
  - What are you working on today?
  - Any blockers?

### Mid-Sprint Sync (Day 5)
- Review progress against burndown
- Adjust task assignments if needed
- Identify risks early

### Sprint Review (Day 10)
- Demo completed features
- Walkthrough of auth flow
- Database schema review

### Sprint Retrospective (Day 10)
- What went well?
- What can improve?
- Action items for Sprint 2

---

## Definition of Done (Sprint Level)

- [ ] All 14 user stories completed with individual DoD met
- [ ] Code coverage ≥80% for new code
- [ ] All unit and integration tests passing
- [ ] No critical/high severity ESLint errors
- [ ] Code formatted with Prettier
- [ ] All PRs reviewed and merged to `main`
- [ ] Sprint demo conducted
- [ ] Sprint retrospective completed with action items

---

## Notes

- **Pair Programming:** Encouraged for complex tasks (Drizzle setup, Auth middleware)
- **Code Reviews:** Mandatory for all PRs, max 24h turnaround
- **Documentation:** Update backend.instructions.md with any new patterns discovered
- **Testing:** Write tests alongside feature code, not at the end
- **Focus:** Backend only - frontend starts Sprint 3

---

## Success Criteria

✅ **Sprint is successful if:**
- 25 SP completed (100% velocity)
- Database schema deployed and seeded
- Auth endpoints functional with Supabase
- All tests passing
- Team happy and unblocked for Sprint 2

✅ **Bonus achievements:**
- >80% code coverage
- Zero production bugs in Sprint 2
- Team velocity confidence increased
