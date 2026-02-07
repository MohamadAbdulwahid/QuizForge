# Sprint 1 Backlog - Database & Authentication Foundation

**Sprint Goal:** Establish Supabase database schema, Drizzle ORM integration, and Supabase Auth for secure user management.

**Duration:** 2 weeks  
**Total Story Points:** 25 SP (≈50 hours)  
**Team:** Mohamad, Nishan, David, Behrang

---

## Sprint Backlog Items

### PB-00: Git repository & CI basics (Mohamad)
**User Story:** As a **Team**, we want a Git repository with branching and CI basics so development can start in a controlled way.

**Story Points:** 2

**Priority:** High

**Definition of Done (DoD):**
- [x] Repository initialized with `README`, `LICENSE`, and `.gitignore`
- [x] Branching strategy documented (GitHub Flow) and branch naming convention added
- [x] ESLint and Prettier configured with base rules
- [x] Pre-commit hooks set up with Husky to run lint and format on
- [x] Basic CI pipeline configured to run lint and tests on push
- [x] Protected `main` branch and required checks configured

### PB-01: Nx monorepo with Bun backend scaffold (Mohamad)
**User Story:** As a **Developer**, I want an Nx monorepo with Bun backend scaffold so backend development can begin.

**Story Points:** 2

**Priority:** High

**Definition of Done (DoD):**
- [x] Nx workspace initialized
- [x] `apps/backend` scaffolded with Bun + Express (TypeScript) and basic `project.json`
- [x] Start/build scripts added (`bun` scripts) and README setup notes
- [x] Linting and formatting configured for the workspace

### PB-02: Tech stack research & selection (Mohamad)
**User Story:** As a **Developer**, I want research and selection of tech stack (Bun, Supabase, Drizzle, Angular Signals) documented.

**Story Points:** 2

**Priority:** High

**Definition of Done (DoD):**
- [x] Research document created summarizing tradeoffs and recommendations
- [x] Chosen stack (Bun, Supabase, Drizzle, Angular Signals) documented with rationale
- [x] Installation and onboarding notes added (`/docs/tech-stack.md`)
- [x] Team review and sign-off recorded


### PB-03: Entity-Relationship Diagram (ERD) Design (Behrang)
**User Story:** As a **Developer**, I want an Entity-Relationship Diagram (ERD) for quizzes, users, sessions, and game events so the database structure is clear.

**Story Points:** 2

**Definition of Done (DoD):**
- [x] ERD created using Mermaid.live showing:
  - `user` table (id, email, username, created_at)
  - `quizze` table (id, title, description, creator_id FK, share_code, created_at)
  - `question` table (id, quiz_id FK, text, type, options JSON, correct_answer, time_limit, points, order)
  - `session` table (id, quiz_id FK, pin, status enum, host_id FK, started_at)
  - `session_player` table (id, session_id FK, username, score, lives, status)
  - `game_event` table (id, session_id FK, player_id FK, event_type, data JSON, timestamp)
- [x] Relationships documented (1:many, many:many with junction tables)
- [x] ERD committed to `/docs/erd.png` and `/docs/erd.mmd` in repo
- [x] Team review and approval

---

### PB-04: Supabase Project Setup (Mohamad)
**User Story:** As a **Developer**, I want Supabase project setup with PostgreSQL database so data can be persisted.

**Story Points:** 2

**Definition of Done (DoD):**
- [x] Supabase project created at supabase.com
- [x] Database credentials noted (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
- [x] Supabase CLI installed locally (`bun add -D @supabase/supabase-js`)
- [x] Local Supabase environment initialized (`supabase init`)
- [x] `.env.example` created with required variables
- [x] `.env` added to `.gitignore`
- [x] Database accessible via Supabase dashboard

---

### PB-05: Drizzle ORM Configuration (David)
**User Story:** As a **Developer**, I want Drizzle ORM configured with postgres-js driver so type-safe queries are possible.

**Story Points:** 3

**Definition of Done (DoD):**
- [ ] Dependencies installed: `drizzle-orm`, `postgres`, `drizzle-kit` (dev)
- [ ] `apps/backend/src/database/client.ts` created with:
  - postgres-js client configuration
  - Supavisor pooler connection (Transaction mode, port 6543)
  - `prepare: false` set for pooler compatibility
  - Graceful shutdown on SIGTERM
- [ ] `apps/backend/drizzle.config.ts` created with schema path and migration output
- [ ] Database client exports `db` instance
- [ ] No compilation errors

---

### PB-06: Drizzle Database Schema Definition (David)
**User Story:** As a **Developer**, I want database schema defined in Drizzle (users, quizzes, questions, sessions tables) so entities can be stored.

**Story Points:** 3

**Definition of Done (DoD):**
- [ ] `apps/backend/src/database/schema/users.ts` created with:
  - id (uuid, primary key)
  - email (text, unique, not null)
  - username (text, not null)
  - created_at (timestamp, default now)
- [ ] `apps/backend/src/database/schema/quizzes.ts` created with:
  - quizzes table (id, title, description, creator_id FK, share_code unique, created/updated_at)
  - questions table (id, quiz_id FK, text, type enum, options jsonb, correct_answer, time_limit, points, order)
- [ ] `apps/backend/src/database/schema/sessions.ts` created with:
  - sessions table (id, quiz_id FK, pin unique, status enum, host_id FK, timestamps)
  - session_players table (id, session_id FK, username, score, lives, status)
  - game_events table (id, session_id FK, player_id FK, event_type, data jsonb, timestamp)
- [ ] All foreign keys defined with onDelete cascade
- [ ] Enums created (question_type, session_status, player_status)
- [ ] Schema files export table definitions
- [ ] `apps/backend/src/database/repositories/user.repository.ts` created with:
  - `findUserById(id)` - query user by id
  - `findUserByEmail(email)` - query user by email
  - `createUser(data)` - insert new user
  - Type-safe return types using Drizzle InferModel

---

### PB-06.5: Auth Service Layer (David)
**User Story:** As a **Developer**, I want an auth service layer between routes and database so business logic is centralized and testable.

**Story Points:** 2

**Definition of Done (DoD):**
- [ ] `apps/backend/src/api/services/auth.service.ts` created with:
  - `signUp({ email, password, username })` - creates user via Supabase Auth, syncs to DB via user repository
  - `signIn({ email, password })` - authenticates user via Supabase Auth
  - `verifyToken(token)` - validates JWT and returns user
  - Handles Supabase Auth errors and returns normalized error responses
  - Uses user.repository.ts for database operations
  - Uses Supabase client for auth operations
- [ ] Service exports typed interfaces for request/response objects
- [ ] Error cases handled (duplicate email → 409, invalid credentials → 401)
- [ ] No compilation errors
- [ ] Service ready to be consumed by route handlers

---

### PB-07: Initial Supabase Migrations (Mohamad)
**User Story:** As a **Developer**, I want initial Supabase migrations created so database schema is version-controlled.

**Story Points:** 2

**Definition of Done (DoD):**
- [ ] Migration created: `supabase migration new create_schema`
- [ ] SQL migration file includes:
  - CREATE TABLE statements for all tables
  - CREATE TYPE for enums
  - CREATE INDEX on frequently queried columns (creator_id, quiz_id, session_id)
  - Row Level Security (RLS) ENABLE on all tables
  - RLS policies for user-owned resources (users can CRUD own quizzes)
- [ ] Migration applied locally: `supabase db reset`
- [ ] Migration tested: can insert/query data
- [ ] Migration file committed to repo

---

### PB-08: Seed Data Scripts (Nishan)
**User Story:** As a **Developer**, I want seed data scripts for test users and quizzes so development can proceed with sample data.

**Story Points:** 2

**Definition of Done (DoD):**
- [ ] `apps/backend/src/database/seed.ts` created with:
  - 3 test users (test1@example.com, test2@example.com, test3@example.com)
  - 2 sample quizzes per user with 5 questions each
  - Questions with multiple-choice and true-false types
  - Realistic data (science quiz, history quiz)
- [ ] Seed script uses Drizzle insert queries
- [ ] Script can be run: `bun run apps/backend/src/database/seed.ts`
- [ ] Seed data visible in Supabase dashboard
- [ ] Script is idempotent (can run multiple times without errors)

---

### PB-09: Supabase Auth Integration (Mohamad)
**User Story:** As a **Developer**, I want Supabase Auth integrated with JWT validation middleware so API endpoints are secured.

**Story Points:** 4

**Definition of Done (DoD):**
- [ ] `apps/backend/src/config/supabase.ts` created with:
  - Supabase client initialized (anon key)
  - Supabase admin client initialized (service role key)
- [ ] `apps/backend/src/api/middleware/auth.ts` created with:
  - `authMiddleware` function that validates JWT from Authorization header
  - Uses `supabase.auth.getUser(token)` to verify token
  - Attaches `req.user` with User object on success
  - Returns 401 on invalid/missing token
  - Logs authentication failures with Pino
- [ ] Middleware tested manually with valid/invalid tokens
- [ ] No compilation errors

---

### PB-10: User Signup Endpoint (Nishan)
**User Story:** As a **User**, I want to sign up with email/password via Supabase Auth so I can create an account.

**Story Points:** 2

**Prerequisites:** PB-06.5 (Auth Service Layer) must be completed

**Definition of Done (DoD):**
- [ ] `POST /api/auth/signup` endpoint created in `apps/backend/src/api/routes/auth.routes.ts`
- [ ] Accepts `API-Version: 1.0` header (validated by apiVersionMiddleware)
- [ ] Zod validation schema for { email, password, username } in `apps/backend/src/api/dtos/auth.dto.ts`
- [ ] Route handler calls `authService.signUp({ email, password, username })` (no direct Supabase calls)
- [ ] Returns 201 with { user, session } on success
- [ ] Returns 400 on validation errors
- [ ] Returns 409 if email already exists (handled by service)
- [ ] Tested with Postman/curl
- [ ] Tspec annotations added

---

### PB-11: User Login Endpoint (Nishan)
**User Story:** As a **User**, I want to log in with email/password so I can access my quizzes.

**Story Points:** 2

**Prerequisites:** PB-06.5 (Auth Service Layer) must be completed

**Definition of Done (DoD):**
- [ ] `POST /api/auth/login` endpoint created in `apps/backend/src/api/routes/auth.routes.ts`
- [ ] Accepts `API-Version: 1.0` header (validated by apiVersionMiddleware)
- [ ] Zod validation schema for { email, password } in `apps/backend/src/api/dtos/auth.dto.ts`
- [ ] Route handler calls `authService.signIn({ email, password })` (no direct Supabase calls)
- [ ] Returns 200 with { user, session } on success
- [ ] Returns 400 on validation errors
- [ ] Returns 401 on invalid credentials (handled by service)
- [ ] Tested with Postman/curl
- [ ] Tspec annotations added

---

### PB-12: Environment Variables Setup (David)
**User Story:** As a **Developer**, I want environment variables configured (.env.example, validation with Zod) so secrets are managed safely.

**Story Points:** 1

**Definition of Done (DoD):**
- [ ] `apps/backend/.env.example` created with:
  - NODE_ENV, PORT, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, FRONTEND_URL, LOG_LEVEL
- [ ] `apps/backend/src/config/environment.ts` created with:
  - Zod schema for all env vars
  - Type-safe `config` object exported
  - Validation runs on app start
  - Process exits with error if validation fails
- [ ] `.env` added to `.gitignore`
- [ ] Team members can copy `.env.example` to `.env` and app starts

---

### PB-13: Pino Logger Configuration (Behrang)
**User Story:** As a **Developer**, I want Pino logger configured for structured JSON logging so errors and requests are tracked.

**Story Points:** 1

**Definition of Done (DoD):**
- [ ] Dependencies installed: `pino`, `pino-pretty` (dev)
- [ ] `apps/backend/src/config/logger.ts` created with:
  - Pino instance configured
  - Pretty-print enabled in development
  - JSON format in production
  - Log level from env (default: info)
  - Base context includes env and timestamp
- [ ] Logger used in at least 2 places (server start, auth middleware)
- [ ] Logs visible in terminal with correct format
- [ ] No `console.log` statements in code

---

### PB-14: Global Error Handling Middleware (Behrang)
**User Story:** As a **Developer**, I want global error handling middleware so all errors return consistent JSON responses.

**Story Points:** 1

**Definition of Done (DoD):**
- [ ] `apps/backend/src/api/middleware/error-handler.ts` created with:
  - Express error middleware (4 params)
  - Logs error with Pino logger
  - Returns JSON: { error: string, code: string, statusCode: number }
  - Maps known errors (Zod validation, Supabase auth) to appropriate status codes
  - Returns 500 for unknown errors
- [ ] Middleware registered last in Express app
- [ ] Tested by throwing error in route handler
- [ ] Error response matches format

---

## Sprint 1 Test Plan

### Unit Tests (Bun Test Runner)

**Test File:** `apps/backend/tests/unit/config/environment.spec.ts`
- [ ] Test: Valid env vars pass validation
- [ ] Test: Missing required var fails validation
- [ ] Test: Invalid URL format fails validation

**Test File:** `apps/backend/tests/unit/middleware/auth.spec.ts`
- [ ] Test: Valid JWT passes authMiddleware
- [ ] Test: Invalid JWT returns 401
- [ ] Test: Missing Authorization header returns 401
- [ ] Test: req.user is populated on success

**Test File:** `apps/backend/tests/unit/database/seed.spec.ts`
- [ ] Test: Seed script creates users without errors
- [ ] Test: Seed script creates quizzes with questions
- [ ] Test: Running seed twice doesn't cause duplicate errors

### Integration Tests

**Test File:** `apps/backend/tests/integration/auth.spec.ts`
- [ ] Test: POST /api/auth/signup creates user in Supabase (with API-Version: 1.0 header)
- [ ] Test: POST /api/auth/signup with duplicate email returns 409
- [ ] Test: POST /api/auth/login with valid credentials returns session
- [ ] Test: POST /api/auth/login with invalid credentials returns 401
- [ ] Test: Requests without API-Version header use default version
- [ ] Test: Requests with unsupported API-Version return 400
- [ ] Test: Protected route without token returns 401
- [ ] Test: Protected route with valid token returns 200

**Test File:** `apps/backend/tests/integration/database.spec.ts`
- [ ] Test: Database client connects successfully
- [ ] Test: Can insert user into users table
- [ ] Test: Can query users table
- [ ] Test: Foreign key constraints enforced (delete cascade)

### Manual Testing Checklist

- [ ] Supabase dashboard shows all tables
- [ ] Can view seed data in Supabase
- [ ] Signup creates user visible in Supabase Auth
- [ ] Login returns valid JWT token
- [ ] JWT token can be decoded at jwt.io
- [ ] Protected route rejects expired tokens
- [ ] Error responses follow consistent format
- [ ] Logs are structured JSON in production mode

---

## Sprint 1 Success Metrics

- [ ] All 14 user stories completed (DoD met)
- [ ] 100% of unit tests passing
- [ ] 100% of integration tests passing
- [ ] Code coverage ≥80% for auth and database modules
- [ ] No critical ESLint errors
- [ ] All code formatted with Prettier
- [ ] Sprint demo conducted with team
- [ ] Sprint retrospective held with action items documented

---

## Notes

- Frontend development deferred to Sprint 3
- Focus on solid backend foundation
- Use test.http file for API testing (to be created)
- Supabase local development recommended for fast iteration
