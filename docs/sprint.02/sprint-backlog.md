# Sprint 2 Backlog - Quiz Management API

**Sprint Goal:** Build CRUD operations for quiz creation, editing, and retrieval with Drizzle repositories, Zod validation, and a service layer that enforces ownership and generates share codes.

**Duration:** 2 weeks  
**Total Story Points:** 27 SP (≈54 hours)  
**Team:** Mohamad, Nishan, David, Behrang

---

## Prerequisites from Sprint 1

Sprint 2 assumes the following Sprint 1 items are **completed**:

- **PB-05** — Drizzle ORM configured with `db` client (`apps/backend/src/database/client.ts`) ✅
- **PB-06** — Database schema defined (`quiz.ts`, `session.ts`, `auth/user.ts`) ✅
- **PB-07** — Initial migrations applied ✅
- **PB-09** — Auth middleware (`authMiddleware`) functional and exported
- **PB-12** — Environment config with Zod validation (`config.ts`)
- **PB-13** — Pino logger configured (`logger.ts`)
- **PB-14** — Global error handling middleware (`error-handler.ts`)

> ⚠️ If PB-09, PB-12, PB-13, or PB-14 are not yet complete, they must be finished in **Week 1 Day 1–2** before dependent Sprint 2 work begins. See the effort plan for details.

---

## Sprint Backlog Items

### PB-15: QuizRepository with Drizzle Queries (David)
**User Story:** As a **Developer**, I want a QuizRepository with Drizzle queries (findById, findByCreator, create, update, delete) so quizzes can be managed.

**Story Points:** 4

**Priority:** High

**Prerequisites:** PB-05 (Drizzle client), PB-06 (schema)

**Definition of Done (DoD):**
- [ ] Create `apps/backend/src/database/repositories/quiz.repository.ts` with the following exported functions (following the functional pattern from `user.repository.ts`):
  - `getQuizById(id: number): Promise<QUIZ | null>` — select quiz by primary key; return `null` if not found
  - `getQuizzesByCreatorId(creatorId: string): Promise<QUIZ[]>` — select all quizzes where `creator_id` matches; ordered by `created_at` descending
  - `getQuizByShareCode(shareCode: string): Promise<QUIZ | null>` — select quiz by `share_code`; return `null` if not found
  - `createQuiz(data: insertQuiz): Promise<QUIZ>` — insert quiz and return the created record using `.returning()`
  - `updateQuiz(id: number, data: Partial<Omit<insertQuiz, 'id' | 'creator_id' | 'created_at'>>): Promise<QUIZ | null>` — update quiz by ID, only allow updating `title`, `description`, `share_code`; return updated record or `null` if not found
  - `deleteQuiz(id: number): Promise<boolean>` — delete quiz by ID; return `true` if a row was deleted, `false` otherwise
  - `shareCodeExists(shareCode: string): Promise<boolean>` — check if a quiz with the given share code already exists (for uniqueness validation)
- [ ] All functions use the `db` client from `../client.ts` and Drizzle query builder (`eq`, `desc` from `drizzle-orm`)
- [ ] All functions have JSDoc comments documenting parameters, return types, and behavior
- [ ] Type-safe return types using the `QUIZ` and `insertQuiz` types exported from `../schema/quiz.ts`
- [ ] No compilation errors (`bunx tsc --noEmit`)
- [ ] Unit tests pass (see Test Plan below)

---

### PB-16: QuestionRepository for Managing Questions (David)
**User Story:** As a **Developer**, I want a QuestionRepository for managing quiz questions with ordering so questions are persisted correctly.

**Story Points:** 3

**Priority:** High

**Prerequisites:** PB-05, PB-06

**Definition of Done (DoD):**
- [ ] Create `apps/backend/src/database/repositories/question.repository.ts` with the following exported functions:
  - `getQuestionsByQuizId(quizId: number): Promise<QUESTION[]>` — select all questions for a quiz; ordered by `order_index` ascending
  - `getQuestionById(id: number): Promise<QUESTION | null>` — select single question by ID
  - `createQuestions(questions: insertQuestion[]): Promise<QUESTION[]>` — bulk insert questions using `.values([...]).returning()`; the `quiz_id` and `order_index` must be set by the caller
  - `updateQuestion(id: number, data: Partial<Omit<insertQuestion, 'id' | 'quiz_id'>>): Promise<QUESTION | null>` — update a single question by ID; return updated record or `null`
  - `deleteQuestionsByQuizId(quizId: number): Promise<number>` — delete all questions for a quiz; return the count of deleted rows
  - `deleteQuestion(id: number): Promise<boolean>` — delete a single question by ID; return `true` if deleted
  - `getQuestionCountByQuizId(quizId: number): Promise<number>` — return count of questions for a quiz (useful for list views)
- [ ] All functions use Drizzle query builder with proper ordering by `order_index`
- [ ] All functions have JSDoc comments
- [ ] Type-safe return types using `QUESTION` and `insertQuestion` from `../schema/quiz.ts`
- [ ] No compilation errors
- [ ] Unit tests pass (see Test Plan below)

---

### PB-15.5: QuizService Layer (Mohamad)
**User Story:** As a **Developer**, I want a quiz service layer between routes and repositories so business logic is centralized, ownership is enforced, and quiz + question creation happens atomically.

**Story Points:** 3

**Priority:** High

**Prerequisites:** PB-15 (QuizRepository), PB-16 (QuestionRepository), PB-24 (Share Code)

**Definition of Done (DoD):**
- [ ] Create `apps/backend/src/api/services/quiz.service.ts` with the following exported functions:
  - `createQuiz(creatorId: string, data: CreateQuizRequest): Promise<{ quizId: number; shareCode: string }>`
    - Generate unique share code (call `generateShareCode()` with retry on collision)
    - Use `db.transaction()` to atomically: insert quiz → bulk insert questions (with `order_index` set by array position)
    - Return the `quizId` and `shareCode`
    - Log success via Pino: `logger.info({ quizId, creatorId }, 'Quiz created')`
  - `updateQuiz(userId: string, quizId: number, data: UpdateQuizRequest): Promise<QUIZ>`
    - Verify ownership: fetch quiz by ID, compare `creator_id` to `userId`; throw `ForbiddenError` if mismatch
    - Use `db.transaction()` to atomically: update quiz record → delete old questions → insert new questions (if questions provided)
    - Return updated quiz
  - `deleteQuiz(userId: string, quizId: number): Promise<void>`
    - Verify ownership (same pattern); throw `ForbiddenError` if mismatch
    - Throw `NotFoundError` if quiz does not exist
    - Delete quiz (cascade deletes questions via FK)
  - `getMyQuizzes(userId: string): Promise<QuizWithQuestionCount[]>`
    - Fetch all quizzes by creator, include question count per quiz
    - Return ordered by `created_at` descending
  - `getQuizById(quizId: number): Promise<QuizWithQuestions>`
    - Fetch quiz + all questions (ordered by `order_index`)
    - Throw `NotFoundError` if quiz does not exist
  - `getQuizByShareCode(shareCode: string): Promise<QuizWithQuestions>`
    - Fetch quiz + all questions by share code
    - Throw `NotFoundError` if not found
- [ ] Define custom error classes in `apps/backend/src/api/errors/` (or a shared location):
  - `NotFoundError` (maps to 404)
  - `ForbiddenError` (maps to 403)
  - These errors should be caught by the global error handler from PB-14
- [ ] Define response types:
  - `QuizWithQuestions` — quiz object with embedded `questions: QUESTION[]` array
  - `QuizWithQuestionCount` — quiz object with `questionCount: number` (for list views)
- [ ] All functions use the Pino logger for info/error logging
- [ ] Service never uses `req`/`res` objects (pure business logic, not coupled to Express)
- [ ] No compilation errors
- [ ] Unit tests pass (see Test Plan below)

---

### PB-21: Zod Validation Schemas for Quiz DTOs (Behrang)
**User Story:** As a **Developer**, I want Zod validation schemas for CreateQuizRequest and UpdateQuizRequest so input is validated before reaching the service layer.

**Story Points:** 2

**Priority:** High

**Prerequisites:** None (can start immediately)

**Definition of Done (DoD):**
- [ ] Create `apps/backend/src/api/dtos/quiz.dto.ts` with the following schemas:
  - `CreateQuestionSchema` — validates a single question object:
    - `text`: `z.string().min(1).max(500)` — question text, required
    - `type`: `z.enum(['multiple-choice', 'true-false', 'open'])` — must match `questionType` enum
    - `options`: `z.array(z.object({ id: z.string(), text: z.string().min(1) })).optional()` — required for `multiple-choice`, optional for others
    - `correctAnswer`: `z.string().min(1)` — the correct answer, required
    - `timeLimit`: `z.number().int().min(5).max(120).optional().default(30)` — seconds, default 30
    - `points`: `z.number().int().min(0).max(1000).optional().default(100)` — default 100
  - `CreateQuizRequestSchema` — validates the full create request:
    - `title`: `z.string().min(1, 'Title is required').max(200, 'Title too long')`
    - `description`: `z.string().max(1000).optional()`
    - `questions`: `z.array(CreateQuestionSchema).min(1, 'At least one question required').max(100, 'Maximum 100 questions')`
  - `UpdateQuizRequestSchema` — validates the update request (all fields optional):
    - `title`: `z.string().min(1).max(200).optional()`
    - `description`: `z.string().max(1000).optional().nullable()` — allow clearing description
    - `questions`: `z.array(CreateQuestionSchema).min(1).max(100).optional()` — if provided, replaces all questions
  - Add `.refine()` on `CreateQuestionSchema` to validate:
    - If `type === 'multiple-choice'`, `options` must be defined and have at least 2 items
    - If `type === 'true-false'`, `options` is ignored (auto-set to true/false)
    - `correctAnswer` must match one of the `options[].id` values (for multiple-choice)
- [ ] Export inferred TypeScript types:
  - `export type CreateQuizRequest = z.infer<typeof CreateQuizRequestSchema>`
  - `export type UpdateQuizRequest = z.infer<typeof UpdateQuizRequestSchema>`
  - `export type CreateQuestion = z.infer<typeof CreateQuestionSchema>`
- [ ] Unit tests for schema validation (see Test Plan below)
- [ ] No compilation errors

---

### PB-24: Quiz Share Code Generation (Mohamad)
**User Story:** As a **System**, I want quiz share code generation (8-char alphanumeric) so quizzes can be shared easily via a short, human-readable code.

**Story Points:** 2

**Priority:** High

**Prerequisites:** PB-15 (QuizRepository — for `shareCodeExists()`)

**Definition of Done (DoD):**
- [ ] Create `apps/backend/src/api/utils/share-code.ts` with:
  - `generateShareCode(): string` — generates a random 8-character alphanumeric string
    - Character set: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (excludes ambiguous chars: `0`, `O`, `1`, `I`, `L`)
    - Uses `crypto.getRandomValues()` or `Math.random()` for randomness
  - `generateUniqueShareCode(existsCheck: (code: string) => Promise<boolean>): Promise<string>` — generates a share code and retries if it already exists in the database
    - Maximum 5 retries; throw error if all retries fail (extremely unlikely with 33^8 ≈ 1.4 trillion combinations)
    - Accepts a callback function `existsCheck` so it can be tested without a database
- [ ] Share code is always uppercase
- [ ] Unit tests:
  - Generated code is exactly 8 characters
  - Generated code contains only allowed characters (no `0`, `O`, `1`, `I`, `L`)
  - `generateUniqueShareCode` retries on collision (mock `existsCheck` to return `true` then `false`)
  - `generateUniqueShareCode` throws after max retries (mock `existsCheck` to always return `true`)
- [ ] No compilation errors
- [ ] JSDoc on both functions

---

### PB-17: Create Quiz Endpoint (Nishan)
**User Story:** As a **User**, I want to create a new quiz with title, description, and questions so I can host games.

**Story Points:** 3

**Priority:** High

**Prerequisites:** PB-15.5 (QuizService), PB-21 (Zod DTOs), PB-23 (Auth middleware)

**Definition of Done (DoD):**
- [ ] Create `apps/backend/src/api/routes/quiz.routes.ts` with Express Router:
  - Register `POST /` route pointing to the create handler
  - Apply `authMiddleware` to all routes in this router
  - Export the router as default
- [ ] Create `apps/backend/src/api/controllers/quiz.controller.ts` with:
  - `createQuiz(req: AuthenticatedRequest, res: Response): Promise<void>` handler:
    - Parse and validate `req.body` with `CreateQuizRequestSchema.safeParse()`
    - On validation failure: return 400 with `{ error, code: 'VALIDATION_ERROR', details: parseResult.error.errors }`
    - Extract `userId` from `req.user.id` (set by authMiddleware)
    - Call `quizService.createQuiz(userId, validatedData)`
    - Return 201 with `{ quizId, shareCode }`
    - On service error: let global error handler catch it
- [ ] Register quiz routes in app entry point:
  - In `apps/backend/src/main.ts` (or a new `apps/backend/src/api/routes/index.ts`):
    - `app.use('/api/quizzes', apiVersionMiddleware, quizRouter)`
  - Ensure `apiVersionMiddleware` (from Sprint 1's PB-09) is applied
- [ ] Accepts `API-Version: 1.0` header
- [ ] Test with curl/Postman:
  - Valid request returns 201 with `quizId` and `shareCode`
  - Missing title returns 400
  - Missing auth token returns 401
  - Empty questions array returns 400
- [ ] Tspec annotations added (see PB-22)
- [ ] No compilation errors

---

### PB-18: Edit Quiz Endpoint (Nishan)
**User Story:** As a **User**, I want to edit my existing quizzes so I can update content.

**Story Points:** 2

**Priority:** High

**Prerequisites:** PB-15.5 (QuizService), PB-21 (Zod DTOs), PB-23 (Auth middleware)

**Definition of Done (DoD):**
- [ ] Add route in `apps/backend/src/api/routes/quiz.routes.ts`:
  - `PATCH /:id` pointing to the update handler
- [ ] Add handler in `apps/backend/src/api/controllers/quiz.controller.ts`:
  - `updateQuiz(req: AuthenticatedRequest, res: Response): Promise<void>`:
    - Parse `req.params.id` as number; return 400 if not a valid number
    - Validate `req.body` with `UpdateQuizRequestSchema.safeParse()`
    - On validation failure: return 400 with details
    - Call `quizService.updateQuiz(req.user.id, quizId, validatedData)`
    - Return 200 with updated quiz object
    - `NotFoundError` → 404, `ForbiddenError` → 403 (handled by error handler)
- [ ] Test with curl/Postman:
  - Valid update returns 200 with updated quiz
  - Non-existent quiz ID returns 404
  - Attempting to update another user's quiz returns 403
  - Partial update (title only) works correctly
  - Updating questions replaces all questions
- [ ] No compilation errors

---

### PB-19: Delete Quiz Endpoint (Nishan)
**User Story:** As a **User**, I want to delete my quizzes so I can remove outdated content.

**Story Points:** 1

**Priority:** High

**Prerequisites:** PB-15.5 (QuizService), PB-23 (Auth middleware)

**Definition of Done (DoD):**
- [ ] Add route in `apps/backend/src/api/routes/quiz.routes.ts`:
  - `DELETE /:id` pointing to the delete handler
- [ ] Add handler in `apps/backend/src/api/controllers/quiz.controller.ts`:
  - `deleteQuiz(req: AuthenticatedRequest, res: Response): Promise<void>`:
    - Parse `req.params.id` as number; return 400 if invalid
    - Call `quizService.deleteQuiz(req.user.id, quizId)`
    - Return 204 No Content on success
    - `NotFoundError` → 404, `ForbiddenError` → 403 (via error handler)
- [ ] Test with curl/Postman:
  - Deleting own quiz returns 204
  - Deleting non-existent quiz returns 404
  - Deleting another user's quiz returns 403
  - Verify questions are also deleted (cascade FK)
- [ ] No compilation errors

---

### PB-20: View My Quizzes Endpoint (Behrang)
**User Story:** As a **User**, I want to view all my created quizzes so I can select one to host.

**Story Points:** 2

**Priority:** High

**Prerequisites:** PB-15.5 (QuizService), PB-23 (Auth middleware)

**Definition of Done (DoD):**
- [ ] Add route in `apps/backend/src/api/routes/quiz.routes.ts`:
  - `GET /` pointing to the list handler
- [ ] Add handler in `apps/backend/src/api/controllers/quiz.controller.ts`:
  - `getMyQuizzes(req: AuthenticatedRequest, res: Response): Promise<void>`:
    - Extract `userId` from `req.user.id`
    - Call `quizService.getMyQuizzes(userId)`
    - Return 200 with array of quizzes (each with `questionCount`, not full question objects)
    - Return empty array `[]` if user has no quizzes (not 404)
- [ ] Add route for fetching single quiz by ID:
  - `GET /:id` pointing to handler
  - `getQuizById(req: AuthenticatedRequest, res: Response): Promise<void>`:
    - Parse `req.params.id`; return 400 if invalid
    - Call `quizService.getQuizById(quizId)`
    - Return 200 with quiz + full questions array
    - `NotFoundError` → 404
- [ ] Response includes for list view:
  - `id`, `title`, `description`, `shareCode`, `questionCount`, `createdAt`
- [ ] Response includes for detail view:
  - Full quiz object + embedded `questions[]` ordered by `order_index`
- [ ] Test with curl/Postman:
  - Returns 200 with quizzes array
  - Returns empty array for user with no quizzes
  - Returns quiz with questions for GET /:id
- [ ] No compilation errors

---

### PB-23: Auth Middleware on Quiz Routes (Mohamad)
**User Story:** As a **Developer**, I want quiz endpoints to enforce authMiddleware so only authenticated users can create, edit, and delete quizzes.

**Story Points:** 1

**Priority:** High

**Prerequisites:** PB-09 (Auth middleware from Sprint 1)

**Definition of Done (DoD):**
- [ ] `authMiddleware` is applied as a router-level middleware in `quiz.routes.ts`:
  - All routes under `/api/quizzes` require a valid `Authorization: Bearer <token>` header
  - Exception: `GET /api/quizzes/share/:shareCode` may be public (decision: keep protected for MVP, can relax later)
- [ ] `AuthenticatedRequest` type is used for all controller handlers so `req.user` is type-safe
- [ ] Verify that:
  - Requests without token to any quiz endpoint return 401 `{ error, code: 'UNAUTHORIZED' }`
  - Requests with expired token return 401 `{ error, code: 'INVALID_TOKEN' }`
  - Requests with valid token have `req.user` populated
- [ ] No compilation errors

---

### PB-25: Retrieve Quiz by Share Code (Behrang)
**User Story:** As a **User**, I want to retrieve a quiz by share code so I can preview it before hosting.

**Story Points:** 2

**Priority:** High

**Prerequisites:** PB-15.5 (QuizService), PB-24 (Share code generation), PB-23 (Auth middleware)

**Definition of Done (DoD):**
- [ ] Add route in `apps/backend/src/api/routes/quiz.routes.ts`:
  - `GET /share/:shareCode` pointing to the share code handler
- [ ] Add handler in `apps/backend/src/api/controllers/quiz.controller.ts`:
  - `getQuizByShareCode(req: AuthenticatedRequest, res: Response): Promise<void>`:
    - Extract `shareCode` from `req.params.shareCode`
    - Validate format: must be exactly 8 uppercase alphanumeric characters; return 400 if invalid
    - Call `quizService.getQuizByShareCode(shareCode)`
    - Return 200 with quiz + full questions
    - `NotFoundError` → 404 with `{ error: 'Quiz not found', code: 'QUIZ_NOT_FOUND' }`
- [ ] Share code lookup is case-insensitive (convert to uppercase before querying)
- [ ] Response excludes `correctAnswer` field from questions (preview mode — players should not see answers)
  - Create a helper `sanitizeQuizForPreview(quiz)` that strips `correctAnswer` from each question
  - Or handle this in the service layer with a dedicated response type
- [ ] Test with curl/Postman:
  - Valid share code returns 200 with quiz (no correct answers)
  - Non-existent share code returns 404
  - Malformed share code (wrong length, invalid chars) returns 400
- [ ] No compilation errors

---

### PB-22: Tspec Annotations on Quiz Endpoints (Mohamad)
**User Story:** As a **Developer**, I want Tspec annotations on quiz endpoints so API documentation is auto-generated and accessible at `/api-docs`.

**Story Points:** 2

**Priority:** High

**Prerequisites:** PB-17, PB-18, PB-19, PB-20, PB-25 (all endpoint work)

**Definition of Done (DoD):**
- [ ] Install `tspec` if not already installed: `bun add tspec` (in `apps/backend`)
- [ ] Add Tspec type definitions for all quiz endpoints in `apps/backend/src/api/controllers/quiz.controller.ts` (or a companion `.tspec.ts` file):
  - `POST /api/quizzes` — Create Quiz
    - Request body: `CreateQuizRequest`
    - Response 201: `{ quizId: number, shareCode: string }`
    - Response 400: Validation error
    - Response 401: Unauthorized
    - Security: BearerAuth
    - Header: `API-Version: 1.0`
  - `GET /api/quizzes` — List My Quizzes
    - Response 200: `QuizWithQuestionCount[]`
    - Response 401: Unauthorized
  - `GET /api/quizzes/:id` — Get Quiz by ID
    - Path param: `id` (number)
    - Response 200: `QuizWithQuestions`
    - Response 404: Quiz not found
  - `PATCH /api/quizzes/:id` — Update Quiz
    - Path param: `id` (number)
    - Request body: `UpdateQuizRequest`
    - Response 200: Updated quiz
    - Response 403: Forbidden (not owner)
    - Response 404: Not found
  - `DELETE /api/quizzes/:id` — Delete Quiz
    - Path param: `id` (number)
    - Response 204: No content
    - Response 403: Forbidden
    - Response 404: Not found
  - `GET /api/quizzes/share/:shareCode` — Get Quiz by Share Code
    - Path param: `shareCode` (string, 8 chars)
    - Response 200: Quiz preview (no correct answers)
    - Response 404: Not found
- [ ] Configure Swagger UI endpoint at `/api-docs` in `main.ts` using Tspec's serve middleware
- [ ] Verify Swagger UI is accessible at `http://localhost:3333/api-docs` and all endpoints are displayed correctly
- [ ] Add script in `apps/backend/project.json`: `"generate:api-docs"` for static Swagger JSON generation
- [ ] No compilation errors

---

## Sprint 2 Test Plan

### Unit Tests (Bun Test Runner)

**Test File:** `apps/backend/tests/unit/repositories/quiz.repository.spec.ts`
- [ ] Test: `createQuiz()` inserts a quiz and returns the created record with ID
- [ ] Test: `getQuizById()` returns quiz when it exists
- [ ] Test: `getQuizById()` returns `null` for non-existent ID
- [ ] Test: `getQuizzesByCreatorId()` returns quizzes for a creator ordered by `created_at` desc
- [ ] Test: `getQuizzesByCreatorId()` returns empty array for creator with no quizzes
- [ ] Test: `getQuizByShareCode()` returns quiz when share code exists
- [ ] Test: `getQuizByShareCode()` returns `null` for non-existent share code
- [ ] Test: `updateQuiz()` updates title and returns updated record
- [ ] Test: `updateQuiz()` returns `null` for non-existent quiz
- [ ] Test: `deleteQuiz()` removes the quiz and returns `true`
- [ ] Test: `deleteQuiz()` returns `false` for non-existent quiz
- [ ] Test: `shareCodeExists()` returns `true` when code exists, `false` otherwise

**Test File:** `apps/backend/tests/unit/repositories/question.repository.spec.ts`
- [ ] Test: `createQuestions()` bulk inserts questions and returns created records
- [ ] Test: `getQuestionsByQuizId()` returns questions ordered by `order_index`
- [ ] Test: `getQuestionsByQuizId()` returns empty array for quiz with no questions
- [ ] Test: `getQuestionById()` returns question when it exists
- [ ] Test: `getQuestionById()` returns `null` for non-existent ID
- [ ] Test: `deleteQuestionsByQuizId()` removes all questions for a quiz
- [ ] Test: `deleteQuestion()` removes a single question
- [ ] Test: `getQuestionCountByQuizId()` returns correct count

**Test File:** `apps/backend/tests/unit/services/quiz.service.spec.ts`
- [ ] Test: `createQuiz()` creates quiz + questions atomically and returns quizId + shareCode
- [ ] Test: `createQuiz()` generates unique share code (mock repository)
- [ ] Test: `updateQuiz()` succeeds when called by quiz owner
- [ ] Test: `updateQuiz()` throws `ForbiddenError` when called by non-owner
- [ ] Test: `updateQuiz()` throws `NotFoundError` for non-existent quiz
- [ ] Test: `updateQuiz()` replaces questions when provided
- [ ] Test: `deleteQuiz()` succeeds when called by quiz owner
- [ ] Test: `deleteQuiz()` throws `ForbiddenError` when called by non-owner
- [ ] Test: `deleteQuiz()` throws `NotFoundError` for non-existent quiz
- [ ] Test: `getMyQuizzes()` returns quizzes with question count
- [ ] Test: `getMyQuizzes()` returns empty array for user with no quizzes
- [ ] Test: `getQuizById()` returns quiz with full questions
- [ ] Test: `getQuizByShareCode()` returns quiz with questions (without correct answers for preview)

**Test File:** `apps/backend/tests/unit/dtos/quiz.dto.spec.ts`
- [ ] Test: `CreateQuizRequestSchema` accepts valid quiz with questions
- [ ] Test: `CreateQuizRequestSchema` rejects empty title
- [ ] Test: `CreateQuizRequestSchema` rejects title longer than 200 chars
- [ ] Test: `CreateQuizRequestSchema` rejects empty questions array
- [ ] Test: `CreateQuizRequestSchema` rejects more than 100 questions
- [ ] Test: `CreateQuestionSchema` rejects multiple-choice without options
- [ ] Test: `CreateQuestionSchema` rejects multiple-choice with fewer than 2 options
- [ ] Test: `CreateQuestionSchema` rejects invalid `correctAnswer` not matching option IDs
- [ ] Test: `CreateQuestionSchema` accepts valid true-false question
- [ ] Test: `CreateQuestionSchema` defaults `timeLimit` to 30 and `points` to 100
- [ ] Test: `UpdateQuizRequestSchema` accepts partial updates (title only)
- [ ] Test: `UpdateQuizRequestSchema` accepts `description: null` (clearing description)

**Test File:** `apps/backend/tests/unit/utils/share-code.spec.ts`
- [ ] Test: `generateShareCode()` returns exactly 8 characters
- [ ] Test: `generateShareCode()` only contains allowed characters (no 0, O, 1, I, L)
- [ ] Test: `generateShareCode()` returns different values on multiple calls (non-deterministic)
- [ ] Test: `generateUniqueShareCode()` retries on collision and eventually succeeds
- [ ] Test: `generateUniqueShareCode()` throws after max retries exceeded

### Integration Tests

**Test File:** `apps/backend/tests/integration/quiz-api.spec.ts`
- [ ] Test: `POST /api/quizzes` with valid body returns 201 with `{ quizId, shareCode }`
- [ ] Test: `POST /api/quizzes` without auth token returns 401
- [ ] Test: `POST /api/quizzes` with invalid body returns 400 with validation errors
- [ ] Test: `POST /api/quizzes` with empty questions array returns 400
- [ ] Test: `GET /api/quizzes` returns 200 with array of user's quizzes
- [ ] Test: `GET /api/quizzes` returns empty array `[]` for user with no quizzes
- [ ] Test: `GET /api/quizzes/:id` returns 200 with quiz + questions
- [ ] Test: `GET /api/quizzes/:id` returns 404 for non-existent ID
- [ ] Test: `PATCH /api/quizzes/:id` updates quiz title and returns 200
- [ ] Test: `PATCH /api/quizzes/:id` returns 403 when updating another user's quiz
- [ ] Test: `PATCH /api/quizzes/:id` with new questions replaces all existing questions
- [ ] Test: `DELETE /api/quizzes/:id` returns 204 and quiz is deleted
- [ ] Test: `DELETE /api/quizzes/:id` returns 403 when deleting another user's quiz
- [ ] Test: `DELETE /api/quizzes/:id` cascades to delete associated questions
- [ ] Test: `GET /api/quizzes/share/:shareCode` returns 200 with quiz preview (no correct answers)
- [ ] Test: `GET /api/quizzes/share/:shareCode` returns 404 for non-existent code
- [ ] Test: All endpoints accept `API-Version: 1.0` header
- [ ] Test: All endpoints return proper error format `{ error, code, statusCode }`

### Manual Testing Checklist

- [ ] Create quiz via curl and verify it appears in Supabase dashboard
- [ ] Created quiz has a valid 8-character share code
- [ ] Update quiz title and verify change persists
- [ ] Update quiz questions and verify old questions are replaced
- [ ] Delete quiz and verify questions are also deleted (cascade)
- [ ] List quizzes returns correct count per quiz
- [ ] Share code lookup returns quiz without correct answers
- [ ] Swagger UI at `/api-docs` shows all quiz endpoints
- [ ] Error responses follow consistent format from PB-14
- [ ] Creating 2 quizzes generates different share codes

---

## Sprint 2 Success Metrics

- [ ] All 12 user stories completed (DoD met, including PB-15.5)
- [ ] 100% of unit tests passing
- [ ] 100% of integration tests passing
- [ ] Code coverage ≥80% for repositories, services, and controllers
- [ ] No critical ESLint errors
- [ ] All code formatted with Prettier
- [ ] API documentation accessible at `/api-docs`
- [ ] Sprint demo conducted with team
- [ ] Sprint retrospective held with action items documented

---

## Notes

- **Service Layer Pattern (mandatory):** All controllers MUST call service functions, never repositories directly. This keeps business logic (ownership checks, transactions, share code generation) in one place.
- **Ownership Verification:** Every mutating endpoint (create, update, delete) extracts `userId` from the JWT-authenticated `req.user` — never trust client-sent user IDs.
- **Transaction Safety:** Quiz + questions must always be created/updated atomically using `db.transaction()`. A partial create (quiz without questions) is a data integrity bug.
- **Error Hierarchy:** Custom errors (`NotFoundError`, `ForbiddenError`) extend a base `AppError` class and are caught by the global error handler. Controllers should not catch these — let them propagate.
- **Frontend work deferred:** Frontend development starts Sprint 3. Sprint 2 is backend-only.
- **Share Code Security:** Share codes are not secret (they're meant to be shared), but correct answers should never be returned via the share code endpoint.
- **Naming Conventions:** Follow the existing codebase patterns — functional repository exports (not class-based), `SCREAMING_SNAKE_CASE` for table constants, `camelCase` for functions.
