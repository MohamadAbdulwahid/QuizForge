# Sprint 3 Backlog - Frontend Foundation & WebSocket Infrastructure

**Sprint Goal:** Build Angular frontend scaffold with Bubbly Minimalism styling. Complete session management backend and set up Socket.IO WebSocket communication.

**Duration:** 3 weeks  
**Total Story Points:** 25 SP (≈50 hours)  
**Team:** Mohamad, Nishan, David, Behrang

---

## Prerequisites from Sprint 2

Sprint 3 assumes the following Sprint 2 deliverables are complete and functional:
- **Repositories**: QuizRepository, QuestionRepository, and SessionRepository fully implemented and tested.
- **Quiz API**: Endpoints for Create, Read, Update, Delete with Zod validation.
- **Share Code & PIN**: Utilities working accurately for unique 8-char codes and 6-digit PINs.


---

## Sprint Backlog Items

### PB-31: Angular v21 Frontend Scaffolded (Mohamad)

**User Story:** As a **Team**, I want Angular v21 frontend scaffolded with Nx, Vitest + Angular Testing Library configured, and landing page component (SSG) so development and testing can begin. *(merged PB-31 + PB-34 + PB-36)*

**Story Points:** 3

**Definition of Done (DoD):**
- [x] Ensure `apps/frontend` is successfully initialized using `nx g @nx/angular:application frontend`.
- [x] Update `project.json` in `apps/frontend` to correctly reflect Angular builder configuration.
- [x] Install and configure `vitest`, `@testing-library/angular`, and `@analogjs/vite-plugin-angular`.
- [x] Remove default Karma/Jasmine/Jest configurations and ensure `bun run test:frontend` triggers Vitest smoothly.
- [x] Create `apps/frontend/src/app/features/landing/landing-page.component.ts` acting as the default route `/`.
- [x] Build a basic `Bubbly Minimalism` UI placeholder for the `LandingPageComponent` with empty headers.
- [x] Run and verify that `bun run test:frontend` works perfectly without any errors or warnings.
- [x] No compilation errors and passes linting using `bun run lint:frontend`.
- [x] **Test File:** `apps/frontend/src/app/features/landing/landing-page.component.spec.ts`
  - [x] Test: `LandingPageComponent` initializes successfully.
  - [x] Test: verifies rendering containing introductory bubbly element (e.g. `expect(screen.getByText('Forge')).toBeTruthy()`).

---

### PB-33: Zoneless Change Detection and Hybrid Rendering Config (Mohamad)

**User Story:** As a **Team**, I want zoneless change detection and hybrid rendering configured (SSG/SSR/CSR) so performance is optimized.

**Story Points:** 3
**Prerequisites:** PB-31

**Definition of Done (DoD):**
- [x] Add `provideExperimentalZonelessChangeDetection()` in `apps/frontend/src/app/app.config.ts`.
- [x] Assert `zone.js` is completely removed from dependencies and polyfills (in `project.json` and `angular.json` equivalent).
- [x] Configure `app.routes.server.ts` to set SSR behavior with specific routes.
- [x] Add explicit configuration for static pre-rendering (SSG) for routes like `/` (the landing page).
- [x] Validate SSG outputs by running a production build (`bun run build:frontend`) and checking output folders for statically generated HTML.
- [x] Add testing and debugging instructions regarding Zoneless setup inside `frontend.instructions.md`.
- [x] **Test File:** `apps/frontend-e2e/src/e2e/app.spec.ts` (Playwright E2E)
  - [x] Test: loads the landing page natively and confirms completely zoneless integration checking `window.Zone` is undefined.

---

### PB-28: Session State Machine (David)

**User Story:** As a **System**, I want session state machine (waiting, playing, paused, ended) so game flow is controlled.

**Story Points:** 3

**Definition of Done (DoD):**
- [x] Create `apps/backend/src/game/engine/game-state.ts` outlining the `SessionState` transitions logic using strongly typed enums or string literals.
- [x] Supported valid states strictly defined as: `waiting`, `playing`, `paused`, `ended`.
- [x] Develop a centralized `transitionState(currentState, action)` function explicitly enforcing valid paths (e.g., `waiting` -> `playing`, `playing` -> `paused`, `paused` -> `playing`, `playing` -> `ended`) and throwing otherwise.
- [x] Create `InvalidStateTransitionError` extending custom application errors in `apps/backend/src/shared/errors.ts`.
- [x] No compilation errors, code coverage for the state functions is 100%.
- [x] **Test File:** `apps/backend/tests/unit/game/game-state.spec.ts`
  - [x] Test: `transitionState('waiting', 'start')` returns `playing`.
  - [x] Test: `transitionState('waiting', 'end')` throws `InvalidStateTransitionError`.
  - [x] Test: `transitionState('playing', 'pause')` returns `paused`.
  - [x] Test: `transitionState('paused', 'resume')` returns `playing`.
  - [x] Test: `transitionState('playing', 'finish')` returns `ended`.
  - [x] Test: `transitionState('ended', 'start')` throws `InvalidStateTransitionError`.

---

### PB-29: Session Endpoints with Tspec Docs (David)

**User Story:** As a **Host**, I want session endpoints (POST /sessions, GET /sessions/:pin, PATCH /sessions/:pin/status) with Tspec docs.

**Story Points:** 2
**Prerequisites:** PB-28

**Definition of Done (DoD):**
- [x] Incorporate session endpoints gracefully inside `apps/backend/src/api/controllers/session.controller.ts`:
  - `POST /api/sessions`: Creates session utilizing `SessionService.createSession()`, returns generated PIN.
  - `GET /api/sessions/:pin`: Looks up active session by PIN utilizing `SessionRepository.findActiveByPin()`.
  - `PATCH /api/sessions/:pin/status`: Evaluates state jump utilizing your new `SessionStateMachine` logic, verifying auth against JWT.
- [x] Use `authMiddleware` where needed; ensure `PATCH` verifies requesting user equals game host user.
- [x] Validate standard payloads and paths using matching Zod schemas (`PinParamSchema`, `UpdateSessionStatusSchema`).
- [x] Add JSDoc/Tspec annotations for `@tag`, `@summary`, `@post`, `@security` on every endpoint function.
- [x] Swagger route (`/api-docs`) reflects these changes completely.
- [x] **Test File:** `apps/backend/tests/integration/session-endpoints.spec.ts`
  - [x] Test: `POST /api/sessions` accepts valid payload and returns 201 utilizing `SessionService.createSession()`.
  - [x] Test: `GET /api/sessions/:pin` accepts matching active database session returning 200 payload.
  - [x] Test: `GET /api/sessions/:pin` using invalid string length PIN correctly returns 400 validation error.
  - [x] Test: `GET /api/sessions/:pin` using perfectly formatted but invalid PIN correctly returns 404.
  - [x] Test: `PATCH /api/sessions/:pin/status` lacking valid JWT properly bounces out throwing standard 401.
  - [x] Test: `PATCH /api/sessions/:pin/status` checking a non-host valid JWT bounces returning standard 403.
  - [x] Test: `PATCH /api/sessions/:pin/status` running an actual logical transition string properly returning 200 standard transition success response.

---

### PB-37: Socket.IO Server Config With Auth (Nishan)

**User Story:** As a **System**, I want Socket.IO server configured with Supabase JWT authentication so WebSocket connections are secured.

**Story Points:** 4

**Definition of Done (DoD):**
- [x] Use `bun add socket.io` and configure a customized singleton instance alongside Express in `apps/backend/src/main.ts` or `src/server.ts`.
- [x] Implement socket middleware `apps/backend/src/websocket/middleware/socket-auth.ts` capturing `.handshake.auth.token`.
- [x] The socket middleware properly verifies the JWT explicitly with Supabase logic, rejecting with specific Socket.IO Error for failure.
- [x] Persist context like `socket.data.userId` for valid authenticated sessions avoiding repetitive DB calls.
- [x] Attach `logger.child({ component: 'websocket' })` instances specifically evaluating and logging unauthenticated connection drops.
- [x] Create simple Node/Bun script `apps/backend/scripts/test-socket-auth.ts` practically asserting success with accurate token and immediate drop with corrupted token.
- [x] **Test File:** `apps/backend/tests/unit/websocket/socket-auth.spec.ts`
  - [x] Test: Connection missing `token` immediately drops disconnecting execution emitting specific Error trace type.
  - [x] Test: Connection supplying mocked Supabase parsing error drops properly disconnecting execution appropriately.
  - [x] Test: Extracted clean JWT maps `socket.data.userId` effectively allowing `next()` advancement smoothly.

---

### PB-38: WebSocket Event Handlers & Room Management (Nishan)

**User Story:** As a **System**, I want WebSocket event handlers (join-game, leave-game, player-joined, player-left) with room management mapped to session PINs so players can join and events route correctly. *(merged PB-38 + PB-41)*

**Story Points:** 4
**Prerequisites:** PB-37

**Definition of Done (DoD):**
- [x] Centralize handlers into logical namespaces like `apps/backend/src/websocket/namespaces/game.namespace.ts`.
- [x] Implement command `join-game`:
  - Extract PIN, verify database validity of the Session.
  - Enroll the socket to `socket.join(PIN)`.
  - Dispatch a `.to(PIN).emit('player-joined', { userId })`.
- [x] Implement command `leave-game`:
  - Disconnect specific client connection logically resolving leaving the room `socket.leave(PIN)`.
  - Dispatch an unprompted `.to(PIN).emit('player-left', { userId })`.
- [x] Configure a global `disconnect` standard handler tracking ungraceful teardowns sending similar `player-left` events when the physical connection truncates.
- [x] Assert no room leakage happens (a client in Room A shouldn't get events from Room B).
- [x] **Test File:** `apps/backend/tests/integration/websocket-rooms.spec.ts`
  - [x] Test: Handler executing `join-game` with missing PIN throws specific Zod-oriented event error trace.
  - [x] Test: Handler executing `join-game` directly correctly binds `socket.rooms` asserting `socket.rooms.has(PIN)`.
  - [x] Test: Joining room successfully routes `.to(PIN).emit('player-joined', { userId })` checking active client stub reception.
  - [x] Test: Calling standard disconnect explicitly dispatches unprompted `player-left` removing user data.
  - [x] Test: Assert connecting explicitly to Room A blocks broadcast traces when testing broadcast specifically against Room B.

---

### PB-32: Tailwind & DaisyUI Config (Bubbly Minimalism) (Behrang)

**User Story:** As a **Team**, I want Tailwind CSS v4 + DaisyUI v5 + Heroicons configured with Bubbly Minimalism theme so UI is styled with rounded icons. *(merged PB-32 + PB-64)*

**Story Points:** 3
**Prerequisites:** PB-31

**Definition of Done (DoD):**
- [x] Execute installation for correctly scoped tailwindcss, daisyui plugins.
- [x] Scaffold `tailwind.config.js` or apply styling inside standard `.css` defining Bubbly Minimalism color boundaries exactly following `.instructions.md`.
- [x] Declare theme standard 60-30-10 (`--bubbly-background`, `--bubbly-primary`, `--bubbly-accent`).
- [x] Attach `DynaPuff` (from Google Fonts or `@fontsource/dynapuff`) replacing header typography, and `Nunito` adjusting general structure.
- [x] Build testing utility widget element like `apps/frontend/src/app/shared/components/button-test.component.ts`.
- [x] Execute `bun run build:frontend` proving no warnings arise around plugin imports formatting issues.
- [x] Ensure `eslint-plugin-tailwindcss` runs automatically format checking classes structures properly matching `bun run lint:frontend`.
- [x] **Test File:** `apps/frontend/src/app/shared/components/button-test.component.spec.ts`
  - [x] Test: component compiles and asserts `bg-[#00a5e0]` base `60-30-10` validation standard.
  - [x] Test: ensures `rounded-3xl` classes effectively target Bubbly geometry logic validation output.

---

### PB-55: Supabase Client Config in Angular (Behrang)

**User Story:** As a **User**, I want Supabase client configured in Angular so auth and API calls are possible.

**Story Points:** 2

**Definition of Done (DoD):**
- [x] Install package `@supabase/supabase-js` targeting angular root application config.
- [x] Create `apps/frontend/src/app/core/services/supabase.service.ts` exposing reusable singleton instance logic handling requests natively via DI injection token.
- [x] Pass environment variables accurately capturing specific `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` gracefully preventing sensitive leak.
- [x] Add observable structures specifically capturing Authentication Session (e.g., `authChanges()`).
- [x] Ensure DI functions with zero explicit memory leaks attached to Observables.
- [x] **Test File:** `apps/frontend/src/app/core/services/supabase.service.spec.ts`
  - [x] Test: Constructor instantiates properly reading global dummy environment parameters avoiding instantiation crashes.
  - [x] Test: Calling `authChanges()` resolves generic Observable pattern cleanly mimicking user subscription structure dynamically.
  - [x] Test: Function calling basic wrapper utility runs without `Any` type errors confirming clean interface abstraction.

---

### PB-45: Zod Validation Schemas for WebSocket Messages (Behrang)

**User Story:** As a **System**, I want Zod validation schemas for all WebSocket messages so malformed data is rejected.

**Story Points:** 1

**Definition of Done (DoD):**
- [x] Bootstrap `apps/backend/src/websocket/validation/schemas.ts` defining structures matching `z.object`.
- [x] Enact standard validation implementations:
  - `JoinGameMessageSchema` validating exactly `{ pin: string, username?: string }`.
  - `LeaveGameMessageSchema` effectively validating `{ pin: string, reason?: string }`.
- [x] Wrap generic event validation system directly integrating into the `game.namespace.ts` routing, dumping and logging incoming data that doesn't respect definitions via Zod's `safeParse`.
- [x] Export corresponding Types relying heavily on `z.infer<typeof XSchema>`.
- [x] Properly intercept missing constraints dispatching a specific standardized response payload `socket.emit('error', details)`.
- [x] **Test File:** `apps/backend/tests/unit/websocket/zod-schemas.spec.ts`
  - [x] Test: `JoinGameMessageSchema` properly rejects incomplete or missing `pin`.
  - [x] Test: `JoinGameMessageSchema` effectively ignores redundant non-scoped keys resolving properly.
  - [x] Test: System handling valid JSON schema cleanly allows type injection `safeParse().success === true`.
  - [x] Test: Validation interception logically dispatches specifically `.emit('error', ...)` handling structure perfectly cleanly avoiding crashing root execution flow.

---

## Sprint 3 Test Plan

### Unit Tests (Vitest + Bun)

**Frontend:**
- [x] `docs`: Landing page base components mounting.
- [x] `supabase.service.ts`: Instantiation test and environment parsing.

**Backend:**
- [x] `game-state.spec.ts`: Enforce strict bounds testing every permitted edge connection.
- [x] `session.controller.spec.ts`: Tests behavior simulating valid/invalid request permutations.
- [x] `websocket/validation.spec.ts`: Check Zod parsing failures with intentionally malformed bodies.

### Integration / E2E
- [x] Compile Frontend Application ensuring Angular 19/21 zoneless behavior runs natively.
- [x] Connect WebSocket standalone client validating Handshake pass/fail mechanics referencing real Token values against Supabase config.
- [x] Connect multiple local WS instances joining a synthesized Room ID, broadcast an action to prove isolation holds successfully.
