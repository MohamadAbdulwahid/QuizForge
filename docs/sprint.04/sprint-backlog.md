# Sprint 4 Backlog - Auth UI, Dashboard & Quiz Builder

**Sprint Goal:** Build Angular authentication pages, user dashboard with quiz list, and full quiz builder with dynamic question management and edit mode.

**Duration:** 2 weeks  
**Total Story Points:** 38 SP (≈76 hours)  
**Team:** Mohamad, Nishan, David, Behrang

---

## Sprint Backlog Items

### PB-56: AuthService with Signals (Mohamad)

**User Story:** As a **User**, I want AuthService with Signals (`currentUser`, `isAuthenticated`) so auth state is managed properly and reactively.

**Story Points:** 3

**Definition of Done (DoD):**
- [x] Create `apps/frontend/src/app/core/services/auth.service.ts`.
- [x] Incorporate the pre-configured Supabase client.
- [x] Expose `currentUser` as an Angular Signal containing the Supabase User or `null`.
- [x] Expose `isAuthenticated` as a computed Signal.
- [x] Implement `signIn`, `signUp`, and `signOut` methods wrapping Supabase Auth promises.
- [x] Ensure session initialization automatically updates the Signals on app bootstrap.
- [x] **Test File:** `apps/frontend/src/app/core/services/auth.service.spec.ts`
  - [x] Test: `isAuthenticated()` becomes true when a user signs in.
  - [x] Test: `signOut()` clears the `currentUser` Signal.

---

### PB-57: Login and Signup Pages (Behrang)

**User Story:** As a **User**, I want login and signup pages (SSG) with email/password forms and validation so I can create an account and sign in. *(merged PB-57 + PB-58)*

**Story Points:** 4
**Prerequisites:** PB-56

**Definition of Done (DoD):**
- [x] Generate `login.component.ts` and `register.component.ts` in `apps/frontend/src/app/features/auth/`.
- [x] Implement email and password forms with Angular Reactive Forms.
- [x] Adhere to the Bubbly Minimalism design constraints for form inputs and marshmallow buttons.
- [x] Ensure `/login` and `/register` routes are configured as SSG in `app.routes.server.ts`.
- [x] Handle UI error states (e.g., validation rules, incorrect password messages).
- [x] Hook the submissions up to `AuthService`. Redirect to `/dashboard` upon success.
- [x] **Test File:** `apps/frontend/src/app/features/auth/login.component.spec.ts`
  - [x] Test: form submission fails and shows errors if inputs are invalid.
  - [x] Test: successful submission calls `authService.signIn()` and routes properly.

---

### PB-59: Auth Guard (Mohamad)

**User Story:** As a **User**, I want an auth guard so protected routes require authentication to be accessed.

**Story Points:** 2
**Prerequisites:** PB-56

**Definition of Done (DoD):**
- [x] Create `apps/frontend/src/app/core/guards/auth.guard.ts`.
- [x] Use functional route guards introduced in modern Angular.
- [x] Read the `isAuthenticated` state from the injected `AuthService`.
- [x] Redirect to `/login` if not authenticated.
- [x] Apply to all dashboard, builder, and future authenticated routes.
- [x] **Test File:** `apps/frontend/src/app/core/guards/auth.guard.spec.ts`
  - [x] Test: Guard blocks unauthenticated users.
  - [x] Test: Guard permits authenticated users.

---

### PB-60: ApiService with `resource()` (Mohamad)

**User Story:** As a **User**, I want ApiService with `resource()` and `rxResource()` for data fetching so API calls are optimally integrated into the Signal graph.

**Story Points:** 3

**Definition of Done (DoD):**
- [x] Create `apps/frontend/src/app/core/services/api.service.ts`.
- [x] Inject `HttpClient`.
- [x] Include an interceptor `apps/frontend/src/app/core/interceptors/auth.interceptor.ts` to attach the Supabase Auth JWT header automatically (from `AuthService`).
- [x] Establish standardized helper patterns leveraging `resource()` for fetch requests so component UI states (loading, error, loaded) map to Signal patterns seamlessly.
- [x] **Test File:** `apps/frontend/src/app/core/interceptors/auth.interceptor.spec.ts`
  - [x] Test: JWT token is injected when the user is logged in.

---

### PB-61: Dashboard Component (SSR) with Quiz List (Behrang)

**User Story:** As a **User**, I want a dashboard component (SSR) with a quiz list and Bubbly card styling using `rxResource()` so I can see and manage my quizzes. *(merged PB-61 + PB-62)*

**Story Points:** 4
**Prerequisites:** PB-59, PB-60

**Definition of Done (DoD):**
- [x] Create `apps/frontend/src/app/features/dashboard/dashboard.component.ts`.
- [x] Retrieve list of user's quizzes from `GET /api/quizzes` via `ApiService`.
- [x] Utilize `rxResource()` in the component for the request to ensure smooth SSR processing.
- [x] Map the quizzes payload to Bubbly Card components styling matching `--background`, `--primary`, `--accent` rules.
- [x] Add empty state view if the user has no quizzes ("Create your first QuizForge playground!").
- [x] Set up route config to `SSR` inside `app.routes.server.ts`.
- [x] **Test File:** `apps/frontend-e2e/src/e2e/dashboard.spec.ts`
  - [x] Test: Users can view their quizzes listed visually on the dashboard.

---

### PB-65: Quiz Builder Page (CSR) (David)

**User Story:** As a **User**, I want a quiz builder page (CSR) with dynamic question management, form state with Signals, save (POST) and edit mode (PATCH) so I can create and update quizzes. *(merged PB-65 + PB-66 + PB-67 + PB-71 + PB-72)*

**Story Points:** 8
**Prerequisites:** PB-59, PB-60

**Definition of Done (DoD):**
- [x] Create `apps/frontend/src/app/features/quiz-builder/quiz-builder.component.ts`.
- [x] Configure to act strongly as CSR (due to heavy local state interaction).
- [x] Create an independent Angular reactive `FormGroup` or custom Signals state for `Quiz` (Title, Description) and `Questions[]`.
- [x] Differentiate logic based on URL params (e.g. `/builder/new` directly creates vs `/builder/:id` performs a GET, then populates state, then PATCHes).
- [x] Implement Save mechanisms delegating through `ApiService`.
- [x] **Test File:** `apps/frontend-e2e/src/e2e/quiz-builder.spec.ts`
  - [x] Test: creating a new quiz sets routing to dashboard upon success.

---

### PB-68: Question Component and Form Validation (Nishan)

**User Story:** As a **Host**, I want a question component with type selection (multiple-choice, true-false), answer options with correct marking, and form validation (min 1 question, all fields required) so questions are complete and valid. *(merged PB-68 + PB-69 + PB-70)*

**Story Points:** 4
**Prerequisites:** PB-65

**Definition of Done (DoD):**
- [x] Create child UI components: `apps/frontend/src/app/features/quiz-builder/components/question-editor/question-editor.component.ts`.
- [x] Allow host (`quiz-builder`) to pass in individual question models.
- [x] Allow users to add Answer bubbles. Design them as thick inputs applying `rounded-2xl` shapes depending on constraints.
- [x] Implement UI toggle toggling "isCorrect" for answers.
- [x] Enforce frontend integrity rule (Validation rules matching the backend Dto: min 1 question per quiz, each question >=2 answers, strictly 1 or more correct answer, etc).
- [x] **Test File:** `apps/frontend/src/app/features/quiz-builder/components/question-editor.component.spec.ts`
  - [x] Test: Form validation detects missing "correct" answers.
  - [x] Test: Ensure toggle for multichoice/true-false swaps input templates correctly.

---

### PB-115: Groups, Discovery, Admin Management, and Session Broadcasting (Nishan)

**User Story:** As a **Teacher**, I want to create and manage groups with discoverability rules, invite or approve members, and broadcast visible sessions to one or more groups so classroom play can be organized around real group membership.

**Story Points:** 10

**Definition of Done (DoD):**
- [x] Add Drizzle schema and migrations for `profiles`, `groups`, `group_members`, `group_join_requests`, `group_invites`, and session broadcast mapping.
- [x] Ensure each authenticated user has a queryable profile username backing group invites and search.
- [x] Implement backend routes and services for creating groups, searching discoverable groups, requesting to join, approving/rejecting join requests, inviting by username, accepting/declining invites, promoting/demoting admins, and removing members.
- [x] Enforce product rules: hidden groups are always admin-controlled; discoverable groups may require approval or be open join.
- [x] Extend session creation so a host can keep a session private, broadcast it to selected groups, or broadcast it to all groups they belong to.
- [x] Add a dashboard groups surface so members can see their groups and active visible sessions hosted by group members.
- [x] Update the session creation flow so hosts can configure session broadcast visibility from the frontend.
- [x] **Test Files:** `apps/backend/tests/integration/group-endpoints.spec.ts`, `apps/frontend-e2e/src/e2e/groups.spec.ts`
  - [x] Test: user can request to join a discoverable approval-based group and an admin can approve it.
  - [x] Test: invited user can accept a pending invite and appear in group membership.
  - [x] Test: visible sessions broadcast to a group appear in that group's active sessions view.
