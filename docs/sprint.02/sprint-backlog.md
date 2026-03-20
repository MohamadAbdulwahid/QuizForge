# Sprint 2 Backlog - Quiz & Session Management API

**Sprint Goal:** Build CRUD operations for quiz management with Drizzle repositories, Zod-validated endpoints, share code generation, and establish the session data layer with unique PIN creation.

**Duration:** 2 weeks  
**Total Story Points:** 26 SP (≈52 hours)  
**Team:** Mohamad, Nishan, David, Behrang

---

## Prerequisites from Sprint 1

Sprint 2 assumes the following Sprint 1 deliverables are complete and functional:

- **Drizzle schema**: `QUIZ`, `QUESTION`, `SESSION`, `SESSION_PLAYER`, `GAME_EVENT` tables defined and migrated
- **Database client**: `db` instance exported from `apps/backend/src/database/client.ts`
- **User repository**: `getUserById()`, `getUserByEmail()` working
- **Auth middleware**: `authMiddleware` validating Supabase JWTs, attaching `req.user`
- **API versioning**: `apiVersionMiddleware` checking `API-Version` header
- **Pino logger**: Structured logging via `logger` and `createChildLogger()`
- **Error handler**: Global error handling middleware returning consistent JSON
- **Environment config**: Zod-validated `config` object with all env vars
- **Auth service**: `authService.signUp()`, `authService.signIn()`, `authService.verifyToken()`
- **Auth routes**: `POST /api/auth/signup`, `POST /api/auth/login` functional

If any Sprint 1 item is incomplete, it becomes a carry-over with highest priority in Sprint 2's first days.

---

## Sprint Backlog Items

### PB-15: QuizRepository with Drizzle Queries (David)

**User Story:** As a **Developer**, I want a QuizRepository with Drizzle queries (findById, findByCreator, create, update, delete) so quizzes can be managed.

**Story Points:** 4

**Priority:** High

**Definition of Done (DoD):**
- [ ] `apps/backend/src/database/repositories/quiz.repository.ts` created with the following methods:
  - `findById(id: number): Promise<QUIZ | null>` — retrieves a single quiz by primary key; returns `null` if not found
  - `findByIdWithQuestions(id: number): Promise<(QUIZ & { questions: QUESTION[] }) | null>` — retrieves quiz joined with its questions ordered by `order_index` ASC; returns `null` if not found
  - `findByCreator(creatorId: string): Promise<QUIZ[]>` — returns all quizzes by a creator, ordered by `created_at` DESC
  - `findByShareCode(shareCode: string): Promise<(QUIZ & { questions: QUESTION[] }) | null>` — looks up quiz by unique share code, includes questions
  - `create(data: { title: string; description?: string; creatorId: string; shareCode: string }): Promise<QUIZ>` — inserts a new quiz row and returns the created record (uses `.returning()`)
  - `update(id: number, data: { title?: string; description?: string }): Promise<QUIZ | null>` — updates quiz fields, returns updated record or `null` if not found
  - `delete(id: number): Promise<boolean>` — deletes quiz by id (cascade removes questions); returns `true` if a row was deleted, `false` otherwise
  - `shareCodeExists(shareCode: string): Promise<boolean>` — checks if a share code is already in use
- [ ] All methods use Drizzle query builder (`db.select()`, `db.insert()`, `db.update()`, `db.delete()`) — no raw SQL
- [ ] Methods that return relations (quiz + questions) use Drizzle joins or subqueries with proper ordering
- [ ] JSDoc comments on every public method (parameter descriptions, return type, throws)
- [ ] Type-safe return types using Drizzle's `$inferSelect` types (`QUIZ`, `QUESTION` from schema)
- [ ] Exported as named functions (functional style, consistent with existing `user.repository.ts`)
- [ ] No compilation errors, passes linting

---

### PB-16: QuestionRepository for Managing Quiz Questions (David)

**User Story:** As a **Developer**, I want a QuestionRepository for managing quiz questions with ordering so questions are persisted correctly.

**Story Points:** 3

**Priority:** High

**Definition of Done (DoD):**
- [x] `apps/backend/src/database/repositories/question.repository.ts` created with the following methods:
  - `findByQuizId(quizId: number): Promise<QUESTION[]>` — returns all questions for a quiz, ordered by `order_index` ASC
  - `findById(id: number): Promise<QUESTION | null>` — retrieves a single question by id
  - `create(data: insertQuestion): Promise<QUESTION>` — inserts a single question and returns the created record
  - `createMany(quizId: number, questions: Omit<insertQuestion, 'quiz_id'>[]): Promise<QUESTION[]>` — bulk-inserts multiple questions within a **transaction**, auto-assigns `order_index` based on array position (0-based), sets `quiz_id` on each; returns all created records
  - `update(id: number, data: Partial<Pick<QUESTION, 'text' | 'type' | 'options' | 'correct_answer' | 'time_limit' | 'points'>>): Promise<QUESTION | null>` — updates question fields, returns updated record or `null`
  - `delete(id: number): Promise<boolean>` — deletes a single question; returns `true` if deleted
  - `deleteByQuizId(quizId: number): Promise<number>` — deletes all questions for a quiz; returns count of deleted rows
  - `reorder(quizId: number, orderedIds: number[]): Promise<void>` — updates `order_index` for each question id based on its position in the array; runs in a **transaction** to ensure atomicity
- [x] `createMany` and `reorder` use `db.transaction()` for atomicity
- [x] JSDoc comments on every public method
- [x] Type-safe using `QUESTION` and `insertQuestion` types from `schema/quiz.ts`
- [x] Exported as named functions (functional style)
- [x] No compilation errors, passes linting

---

### PB-21: Zod Validation Schemas for Quiz Operations (Behrang)

**User Story:** As a **Developer**, I want Zod validation schemas for CreateQuizRequest and UpdateQuizRequest so input is validated.

**Story Points:** 2

**Priority:** High

**Definition of Done (DoD):**
- [x] `apps/backend/src/api/dtos/quiz.dto.ts` created with the following Zod schemas:
  - `QuestionSchema` — validates a single question object:
    - `text`: `z.string().min(1).max(500)` (required)
    - `type`: `z.enum(['multiple-choice', 'true-false', 'open'])` (required)
    - `options`: `z.array(z.object({ id: z.string(), text: z.string().min(1) })).min(2).max(6).optional()` — required when type is `multiple-choice`, ignored otherwise (use `.refine()` or `.superRefine()` for conditional validation)
    - `correct_answer`: `z.string().min(1)` (required)
    - `time_limit`: `z.number().int().min(5).max(120).optional().default(30)` — seconds
    - `points`: `z.number().int().min(0).max(1000).optional().default(100)`
  - `CreateQuizRequestSchema` — validates quiz creation payload:
    - `title`: `z.string().min(1, 'Title is required').max(200)`
    - `description`: `z.string().max(1000).optional()`
    - `questions`: `z.array(QuestionSchema).min(1, 'At least one question is required').max(100)`
  - `UpdateQuizRequestSchema` — validates quiz update payload (all fields optional, but at least one required):
    - `title`: `z.string().min(1).max(200).optional()`
    - `description`: `z.string().max(1000).optional().nullable()` (nullable to allow clearing)
    - `questions`: `z.array(QuestionSchema).min(1).max(100).optional()` — when provided, replaces all questions (full replacement strategy)
  - `QuizIdParamSchema` — validates route params:
    - `id`: `z.coerce.number().int().positive()`
- [x] Export TypeScript types inferred from schemas:
  - `export type CreateQuizRequest = z.infer<typeof CreateQuizRequestSchema>`
  - `export type UpdateQuizRequest = z.infer<typeof UpdateQuizRequestSchema>`
  - `export type QuestionInput = z.infer<typeof QuestionSchema>`
- [x] Conditional validation: `QuestionSchema` uses `.superRefine()` to enforce that `options` array is present and has ≥2 items when `type === 'multiple-choice'`, and `correct_answer` matches one of the option ids
- [x] `apps/backend/src/api/dtos/session.dto.ts` created with:
  - `CreateSessionRequestSchema`:
    - `quiz_id`: `z.coerce.number().int().positive()`
  - `export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>`
- [x] `apps/backend/src/api/middleware/validation.ts` created with:
  - `validateBody(schema: ZodSchema)` — Express middleware factory that validates `req.body` against the given schema; on failure returns 400 with `{ error: 'Validation failed', code: 'VALIDATION_ERROR', details: zodError.errors }`; on success assigns parsed data to `req.body` and calls `next()`
  - `validateParams(schema: ZodSchema)` — same pattern for `req.params`
- [x] All schemas have descriptive Zod error messages (`.min(1, 'Title is required')`)
- [x] No compilation errors, passes linting

---

### PB-24: Quiz Share Code Generation (David)

**User Story:** As a **System**, I want quiz share code generation (8-char alphanumeric) so quizzes can be shared easily.

**Story Points:** 2

**Priority:** High

**Definition of Done (DoD):**
- [x] Share code generation utility created in `apps/backend/src/shared/utils/share-code.ts`:
  - `generateShareCode(length?: number): string` — generates an 8-character (default) uppercase alphanumeric code
  - Character set excludes ambiguous characters: no `0`, `O`, `1`, `I`, `L` — uses `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
  - Uses `crypto.getRandomValues()` for cryptographic randomness (not `Math.random()`)
- [x] `generateUniqueShareCode()` function in `apps/backend/src/shared/utils/share-code.ts`:
  - Generates a share code, checks uniqueness against the database using `shareCodeExists()` from quiz.repository
  - Retries up to 5 times on collision, throws error if all retries exhausted
  - Returns the unique share code string
- [x] Integration with `quiz.repository.ts`: the `create()` method accepts a `shareCode` parameter (generated externally by the service layer, not internally by the repo)
- [x] Unit tests in `apps/backend/tests/unit/shared/share-code.spec.ts`:
  - Test: Generated codes are 8 characters long
  - Test: Generated codes contain only allowed characters (regex check)
  - Test: Multiple generated codes are unique (generate 100, check for duplicates)
  - Test: Custom length parameter works
- [x] JSDoc on all functions
- [x] No compilation errors, passes linting

---

### PB-17.5: Quiz Service Layer (Nishan)

**User Story:** As a **Developer**, I want a quiz service layer between controllers and repositories so business logic is centralized, authorization is enforced, and the controller stays thin.

**Story Points:** 2

**Priority:** High

**Prerequisites:** PB-15 (QuizRepository), PB-16 (QuestionRepository), PB-24 (Share Code)

**Definition of Done (DoD):**
- [x] `apps/backend/src/api/services/quiz.service.ts` created with:
  - `createQuiz(creatorId: string, data: CreateQuizRequest): Promise<{ quiz: QUIZ; shareCode: string }>`:
    - Generates unique share code via `generateUniqueShareCode()`
    - Calls `quiz.repository.create()` to insert quiz
    - Calls `question.repository.createMany()` to insert questions
    - Wraps quiz + questions creation in a single transaction
    - Returns created quiz with share code
  - `updateQuiz(quizId: number, userId: string, data: UpdateQuizRequest): Promise<QUIZ>`:
    - Fetches quiz by id, verifies `creator_id === userId` (authorization)
    - If `questions` provided: deletes existing questions via `deleteByQuizId()`, inserts new ones via `createMany()` (full replacement)
    - Updates quiz fields (title, description) if provided
    - Wraps in transaction
    - Throws `ForbiddenError` if user doesn't own the quiz
    - Throws `NotFoundError` if quiz doesn't exist
  - `deleteQuiz(quizId: number, userId: string): Promise<void>`:
    - Fetches quiz, verifies ownership
    - Deletes quiz (cascade removes questions)
    - Throws `ForbiddenError` / `NotFoundError` as appropriate
  - `getQuizById(quizId: number, userId: string): Promise<QUIZ & { questions: QUESTION[] }>`:
    - Fetches quiz with questions, verifies ownership
    - Returns quiz with questions
  - `getQuizzesByCreator(creatorId: string): Promise<QUIZ[]>`:
    - Returns all quizzes by creator, ordered by date
  - `getQuizByShareCode(shareCode: string): Promise<QUIZ & { questions: QUESTION[] }>`:
    - Public method (no auth check), for share code lookups
    - Excludes `correct_answer` from question data in the response (strips answers for public view)
- [x] Custom error classes created in `apps/backend/src/shared/errors.ts`:
  - `NotFoundError` (extends Error, statusCode 404)
  - `ForbiddenError` (extends Error, statusCode 403)
  - `ConflictError` (extends Error, statusCode 409)
  - Each has `statusCode` and `code` properties for the error handler middleware to map
- [x] Error handler middleware (`error-handler.ts`) updated to handle custom error classes and map their `statusCode` and `code` to the JSON response
- [x] Service uses logger: `logger.child({ component: 'quiz-service' })` for structured logging
- [x] JSDoc on all public methods
- [x] No compilation errors, passes linting

---

### PB-17: Create and Edit Quiz Endpoints (Nishan)

**User Story:** As a **User**, I want to create and edit quizzes with title, description, and questions so I can host and update games. *(merged PB-17 + PB-18)*

**Story Points:** 3

**Priority:** High

**Prerequisites:** PB-15, PB-16, PB-17.5 (Quiz Service), PB-21 (Zod Schemas)

**Definition of Done (DoD):**
- [x] `apps/backend/src/api/controllers/quiz.controller.ts` created with:
  - `createQuiz(req: AuthenticatedRequest, res: Response)`:
    - Extracts `userId` from `req.user.sub` (JWT subject claim)
    - Calls `quizService.createQuiz(userId, req.body)`
    - Returns **201** with `{ quiz: { id, title, description, shareCode, createdAt }, questions: [...] }`
    - Returns **400** on validation error (handled by validation middleware)
    - Returns **500** on unexpected error (handled by error handler)
  - `updateQuiz(req: AuthenticatedRequest, res: Response)`:
    - Extracts `quizId` from `req.params.id` (validated by params middleware)
    - Extracts `userId` from `req.user.sub`
    - Calls `quizService.updateQuiz(quizId, userId, req.body)`
    - Returns **200** with updated quiz data
    - Returns **403** if user doesn't own the quiz
    - Returns **404** if quiz not found
  - Controllers are thin — all business logic lives in `quiz.service.ts`
- [x] `apps/backend/src/api/routes/quiz.routes.ts` created with:
  - `POST /api/quizzes` → `validateBody(CreateQuizRequestSchema)` → `quizController.createQuiz`
  - `PATCH /api/quizzes/:id` → `validateParams(QuizIdParamSchema)` → `validateBody(UpdateQuizRequestSchema)` → `quizController.updateQuiz`
  - All routes prefixed under `/api/quizzes`
  - Router exported as `quizRouter`
- [x] `apps/backend/src/api/routes/index.ts` created (or updated):
  - Central route registration: exports `registerRoutes()` function returning an Express Router
  - Mounts `quizRouter` at `/quizzes`
  - Mounts `authRouter` at `/auth` (from Sprint 1, if it exists)
  - All routes under `/api` prefix (applied in `app.ts`/`main.ts`)
- [x] Express app (`main.ts` or `app.ts`) updated to:
  - Apply `apiVersionMiddleware` and `authMiddleware` on `/api` routes (except public routes)
  - Mount `registerRoutes()` at `/api`
  - Apply `errorHandler` as the last middleware
- [x] Manual testing with curl/Postman:
  - Create quiz with valid data → 201
  - Create quiz with missing title → 400
  - Create quiz with no questions → 400
  - Update quiz title → 200
  - Update quiz questions (full replacement) → 200
  - Update quiz owned by another user → 403
  - Update non-existent quiz → 404
- [x] Tspec annotations added to controller methods (JSDoc `@tag`, `@summary`, `@post`, `@patch`, `@security`)
- [x] No compilation errors, passes linting

---

### PB-19: Delete Quiz Endpoint (Nishan)

**User Story:** As a **User**, I want to delete my quizzes so I can remove outdated content.

**Story Points:** 1

**Priority:** High

**Prerequisites:** PB-17.5 (Quiz Service)

**Definition of Done (DoD):**
- [x] `deleteQuiz` method added to `quiz.controller.ts`:
  - Extracts `quizId` from `req.params.id`, `userId` from `req.user.sub`
  - Calls `quizService.deleteQuiz(quizId, userId)`
  - Returns **204 No Content** on success
  - Returns **403** if user doesn't own the quiz
  - Returns **404** if quiz not found
- [x] Route added to `quiz.routes.ts`:
  - `DELETE /api/quizzes/:id` → `validateParams(QuizIdParamSchema)` → `quizController.deleteQuiz`
- [x] Cascade delete verified: deleting a quiz also removes all its questions (database-level via `ON DELETE CASCADE`)
- [x] Manual testing:
  - Delete own quiz → 204
  - Delete another user's quiz → 403
  - Delete non-existent quiz → 404
  - Verify questions are removed after quiz deletion (query question table)
- [x] Tspec annotation added
- [x] No compilation errors

---

### PB-20: View My Quizzes Endpoint (Mohamad)

**User Story:** As a **User**, I want to view all my created quizzes so I can select one to host.

**Story Points:** 2

**Priority:** High

**Prerequisites:** PB-17.5 (Quiz Service)

**Definition of Done (DoD):**
- [x] `getMyQuizzes` method added to `quiz.controller.ts`:
  - Extracts `userId` from `req.user.sub`
  - Calls `quizService.getQuizzesByCreator(userId)`
  - Returns **200** with `{ quizzes: [...] }` — array of quiz objects
  - Each quiz object includes: `id`, `title`, `description`, `shareCode`, `createdAt`, `questionCount` (number of questions)
- [x] `getQuizById` method added to `quiz.controller.ts`:
  - Extracts `quizId` from `req.params.id`, `userId` from `req.user.sub`
  - Calls `quizService.getQuizById(quizId, userId)`
  - Returns **200** with full quiz including questions array
  - Returns **404** if quiz not found
  - Returns **403** if user doesn't own the quiz
- [x] Routes added to `quiz.routes.ts`:
  - `GET /api/quizzes` → `quizController.getMyQuizzes`
  - `GET /api/quizzes/:id` → `validateParams(QuizIdParamSchema)` → `quizController.getQuizById`
- [x] Response includes computed `questionCount` field (derived in service layer by counting questions array length, or via a SQL `COUNT()` subquery in the repository)
- [x] Quizzes returned in descending `created_at` order (newest first)
- [x] Manual testing:
  - Authenticated user sees only their own quizzes
  - User with no quizzes gets empty array (`{ quizzes: [] }`)
  - Get single quiz by id returns full quiz with questions
- [x] Tspec annotations added
- [x] No compilation errors, passes linting

---

### PB-23: Quiz Endpoints Enforce AuthMiddleware (Mohamad)

**User Story:** As a **Developer**, I want quiz endpoints to enforce authMiddleware so only authenticated users can create quizzes.

**Story Points:** 1

**Priority:** High

**Prerequisites:** Sprint 1 PB-09 (Auth Middleware)

**Definition of Done (DoD):**
- [x] All quiz routes (`/api/quizzes/*`) require valid JWT:
  - `authMiddleware` applied globally on `/api` router (in `registerRoutes()` or `main.ts`) **before** quiz routes are mounted
  - Alternatively, applied per-route group in `quiz.routes.ts` if granular control is needed (e.g., share code lookup is public)
- [x] Public route exception defined:
  - `GET /api/quizzes/share/:shareCode` — accessible **without** authentication (for quiz preview feature in future sprints)
  - This route is mounted **before** the authMiddleware applies, or uses a separate public router
- [x] Verify `req.user` is available in all quiz controller methods (TypeScript type from Sprint 1's `AuthenticatedRequest`)
- [x] Integration tests in `apps/backend/tests/integration/quiz-auth.spec.ts`:
  - Test: `POST /api/quizzes` without token → 401
  - Test: `POST /api/quizzes` with valid token → 201 (or expected response)
  - Test: `GET /api/quizzes` without token → 401
  - Test: `DELETE /api/quizzes/:id` without token → 401
  - Test: `GET /api/quizzes/share/:shareCode` without token → 200 (public route)
  - Test: Expired token → 401
- [x] No compilation errors

---

### PB-26: SessionRepository with Drizzle Queries (Behrang)

**User Story:** As a **Developer**, I want a SessionRepository with Drizzle queries (create, findByPin, updateStatus) so sessions are managed.

**Story Points:** 3

**Priority:** High

**Definition of Done (DoD):**
- [x] `apps/backend/src/database/repositories/session.repository.ts` created with the following methods:
  - `create(data: { quizId: number; pin: string; hostId: string; status?: string }): Promise<Session>` — inserts a new session row and returns the created record
  - `findById(id: number): Promise<Session | null>` — retrieves session by primary key
  - `findByPin(pin: string): Promise<Session | null>` — retrieves session by PIN, filters for non-ended sessions only (status != 'ended')
  - `findByHost(hostId: string): Promise<Session[]>` — returns all sessions hosted by a user, ordered by `started_at` DESC
  - `updateStatus(id: number, status: SessionStatus): Promise<Session | null>` — updates session status, returns updated record or `null`
  - `pinExists(pin: string): Promise<boolean>` — checks if a PIN is currently in use by an active (non-ended) session
  - `findActiveByQuiz(quizId: number): Promise<Session | null>` — finds an active session (status = 'waiting' or 'in-progress') for a given quiz
- [x] PIN generation utility created in `apps/backend/src/shared/utils/pin.ts`:
  - `generatePin(length?: number): string` — generates a 6-digit (default) numeric PIN as a zero-padded string
  - `generateUniquePin(): Promise<string>` — generates a PIN, checks uniqueness against active sessions via `pinExists()`, retries up to 10 times on collision, throws error if exhausted
  - Character set: `0-9` only (6-digit numeric for easy verbal sharing)
- [x] Unit tests in `apps/backend/tests/unit/shared/pin.spec.ts`:
  - Test: Generated PINs are 6 digits
  - Test: Generated PINs contain only numeric characters
  - Test: PINs are zero-padded (e.g., `'004521'`)
  - Test: Multiple generated PINs are unique (generate 100)
- [x] JSDoc on all methods
- [x] Type-safe using `Session`, `InsertSession`, `SessionStatus` types from `schema/session.ts`
- [x] Exported as named functions (functional style)
- [x] No compilation errors, passes linting

---

### PB-27: Create Game Session with Unique PIN (Mohamad)

**User Story:** As a **Host**, I want to create a game session with a unique 6-digit PIN (with uniqueness validation) so participants can join. *(merged PB-27 + PB-30)*

**Story Points:** 3

**Priority:** High

**Prerequisites:** PB-26 (SessionRepository), PB-15 (QuizRepository)

**Definition of Done (DoD):**
- [x] `apps/backend/src/api/services/session.service.ts` created with:
  - `createSession(hostId: string, data: CreateSessionRequest): Promise<{ session: Session; pin: string }>`:
    - Verifies the quiz exists via `quiz.repository.findById(data.quiz_id)` — throws `NotFoundError` if not found
    - Verifies the host owns the quiz (`creator_id === hostId`) — throws `ForbiddenError` if not
    - Checks no active session already exists for this quiz via `session.repository.findActiveByQuiz()` — throws `ConflictError` if one exists (prevents duplicate sessions)
    - Generates unique 6-digit PIN via `generateUniquePin()`
    - Creates session with status `'waiting'` via `session.repository.create()`
    - Returns created session with PIN
  - Uses `logger.child({ component: 'session-service' })` for structured logging
- [x] `apps/backend/src/api/controllers/session.controller.ts` created with:
  - `createSession(req: AuthenticatedRequest, res: Response)`:
    - Extracts `hostId` from `req.user.sub`
    - Calls `sessionService.createSession(hostId, req.body)`
    - Returns **201** with `{ session: { id, pin, quizId, status, startedAt } }`
    - Returns **404** if quiz not found
    - Returns **403** if user doesn't own the quiz
    - Returns **409** if an active session already exists for the quiz
- [x] `apps/backend/src/api/routes/session.routes.ts` created with:
  - `POST /api/sessions` → `validateBody(CreateSessionRequestSchema)` → `sessionController.createSession`
  - Router exported as `sessionRouter`
- [x] Session router mounted in `routes/index.ts` at `/sessions`
- [x] Manual testing:
  - Create session for own quiz → 201, returns 6-digit PIN
  - Create session for non-existent quiz → 404
  - Create session for quiz owned by another user → 403
  - Create second session for same quiz (while first is active) → 409
  - Verify PIN is unique and 6 digits
- [x] Tspec annotations added
- [x] No compilation errors, passes linting

---

## Sprint 2 Test Plan

### Unit Tests (Bun Test Runner)

**Test File:** `apps/backend/tests/unit/repositories/quiz.repository.spec.ts`
- [x] Test: `create()` inserts a quiz and returns it with an id
- [x] Test: `findById()` returns quiz when it exists
- [x] Test: `findById()` returns `null` for non-existent id
- [x] Test: `findByIdWithQuestions()` returns quiz with questions in correct order
- [x] Test: `findByCreator()` returns only quizzes by the given creator
- [x] Test: `findByCreator()` returns empty array for creator with no quizzes
- [x] Test: `findByShareCode()` returns quiz when code matches
- [x] Test: `update()` modifies title and returns updated record
- [x] Test: `update()` returns `null` for non-existent quiz
- [x] Test: `delete()` returns `true` when quiz is deleted
- [x] Test: `delete()` returns `false` for non-existent id
- [x] Test: `shareCodeExists()` returns `true` for existing code, `false` otherwise

**Test File:** `apps/backend/tests/unit/repositories/question.repository.spec.ts`
- [x] Test: `createMany()` inserts questions with correct `order_index` values
- [x] Test: `createMany()` sets `quiz_id` on all questions
- [x] Test: `findByQuizId()` returns questions ordered by `order_index`
- [x] Test: `update()` modifies question fields
- [x] Test: `delete()` removes a single question
- [x] Test: `deleteByQuizId()` removes all questions for a quiz
- [x] Test: `reorder()` updates `order_index` correctly in a transaction

**Test File:** `apps/backend/tests/unit/repositories/session.repository.spec.ts`
- [x] Test: `create()` inserts a session and returns it
- [x] Test: `findByPin()` returns session for active PIN
- [x] Test: `findByPin()` excludes ended sessions
- [x] Test: `updateStatus()` changes session status
- [x] Test: `pinExists()` returns `true` for active sessions only

**Test File:** `apps/backend/tests/unit/shared/share-code.spec.ts`
- [x] Test: Generated share codes are 8 characters
- [x] Test: Codes use only allowed characters (no ambiguous chars)
- [x] Test: 100 generated codes are all unique
- [x] Test: Custom length parameter produces correct-length codes

**Test File:** `apps/backend/tests/unit/shared/pin.spec.ts`
- [x] Test: Generated PINs are 6 digits
- [x] Test: PINs are numeric only
- [x] Test: PINs are zero-padded
- [x] Test: 100 generated PINs are all unique

**Test File:** `apps/backend/tests/unit/services/quiz.service.spec.ts`
- [x] Test: `createQuiz()` generates share code and inserts quiz + questions
- [x] Test: `updateQuiz()` throws `ForbiddenError` if user doesn't own quiz
- [x] Test: `updateQuiz()` throws `NotFoundError` for non-existent quiz
- [x] Test: `updateQuiz()` replaces questions when `questions` array is provided
- [x] Test: `deleteQuiz()` throws `ForbiddenError` if user doesn't own quiz
- [x] Test: `getQuizByShareCode()` strips `correct_answer` from response

**Test File:** `apps/backend/tests/unit/dtos/quiz.dto.spec.ts`
- [x] Test: Valid `CreateQuizRequest` passes validation
- [x] Test: Missing title fails validation
- [x] Test: Empty questions array fails validation
- [x] Test: `multiple-choice` question without options fails validation
- [x] Test: `correct_answer` not matching any option id fails validation
- [x] Test: `time_limit` outside range (5-120) fails validation
- [x] Test: Valid `UpdateQuizRequest` with partial fields passes
- [x] Test: `QuizIdParamSchema` rejects non-numeric values

### Integration Tests

**Test File:** `apps/backend/tests/integration/quiz-endpoints.spec.ts`
- [x] Test: `POST /api/quizzes` with valid data → 201, returns quiz with share code
- [x] Test: `POST /api/quizzes` with invalid body → 400
- [x] Test: `GET /api/quizzes` returns authenticated user's quizzes
- [x] Test: `GET /api/quizzes/:id` returns quiz with questions
- [x] Test: `PATCH /api/quizzes/:id` updates quiz fields
- [x] Test: `DELETE /api/quizzes/:id` removes quiz → 204
- [x] Test: `GET /api/quizzes/share/:code` returns quiz without correct answers (public)

**Test File:** `apps/backend/tests/integration/quiz-auth.spec.ts`
- [x] Test: All quiz endpoints return 401 without token
- [x] Test: Share code endpoint is publicly accessible
- [x] Test: Users cannot modify/delete quizzes they don't own → 403

**Test File:** `apps/backend/tests/integration/session-endpoints.spec.ts`
- [x] Test: `POST /api/sessions` creates session with unique PIN → 201
- [x] Test: `POST /api/sessions` with non-existent quiz → 404
- [x] Test: `POST /api/sessions` for quiz not owned by user → 403
- [x] Test: Duplicate session for same quiz → 409

### Manual Testing Checklist

- [x] Create quiz with Postman/curl → verify in Supabase dashboard
- [x] Verify share code is 8 chars, uppercase, no ambiguous characters
- [x] Create multiple quizzes → list them → verify order is newest first
- [x] Update quiz title → verify in Supabase dashboard
- [x] Delete quiz → verify questions also deleted (cascade)
- [x] Create session → verify 6-digit PIN in response
- [x] Attempt to create session for same quiz twice → expect 409
- [x] Access quiz via share code without auth → expect public response (no answers)
- [x] Verify all error responses follow format: `{ error, code, statusCode }`
- [x] Verify structured logs appear with correct component tags

---

## Sprint 2 Success Metrics

- [x] All 11 user stories completed (DoD met), including added PB-17.5
- [x] 100% of unit tests passing
- [x] 100% of integration tests passing
- [x] Code coverage ≥80% for repository, service, and controller modules
- [x] No critical ESLint errors
- [x] All code formatted with Prettier
- [x] Sprint demo conducted with team
- [x] Sprint retrospective held with action items documented

---

## Notes

- **Full Question Replacement Strategy**: When updating a quiz with new questions (`PATCH /api/quizzes/:id` with `questions` array), the service deletes all existing questions and re-inserts the new ones. This simplifies ordering logic and avoids complex diff operations. Future sprints may optimize to patch-level question updates if performance requires it.
- **Share Code vs. PIN**: Share codes (8-char alpha) identify **quizzes** for sharing/viewing. PINs (6-digit numeric) identify **sessions** for live gameplay. These are distinct identifiers with different purposes.
- **Public Routes**: The share code lookup (`GET /api/quizzes/share/:shareCode`) is intentionally public — it enables quiz preview before login. The response strips `correct_answer` from questions to prevent cheating.
- **Frontend development**: Deferred to Sprint 3. Sprint 2 is backend-only.
- **Session endpoints**: Only the `POST /sessions` endpoint is in Sprint 2. Additional session endpoints (`GET /sessions/:pin`, `PATCH /sessions/:pin/status`) are deferred to Sprint 3 (PB-29).
