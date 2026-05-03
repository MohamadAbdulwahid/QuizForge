# Sprint 4 Effort Plan

**Sprint Duration:** 2 weeks
**Target Velocity:** 25 Story Points  
**Team Size:** 4 developers

---

## Team Members & Roles

| Name | Role | Primary Focus | Hour worked |
|------|------|---------------|--------------|
| **Mohamad** | Product Owner, Developer | Core Frontend Services, Guards | 0h |
| **David** | Scrum Master, Developer | Quiz Builder State & Routing | 0h |
| **Nishan** | Stakeholder, Developer | Question Component & Validation | 0h |
| **Behrang** | Stakeholder, Developer | Auth UI & Dashboard Styling | 0h |

---

## Effort Distribution by Developer

### Mohamad - 8 SP

- **PB-56**: AuthService with Signals (`currentUser`, `isAuthenticated`) (3 SP) - Days 1-3
- **PB-60**: ApiService with `resource()` for data fetching (3 SP) - Days 4-7
- **PB-59**: Auth guard to protect routes (2 SP) - Days 8-9

**Responsibilities:**
- Establish the core injectable services for the Angular application.
- Implement `AuthService` wrapping the Supabase client with Angular Signals.
- Build the generic `ApiService` using the new experimental `resource()` and `rxResource()` APIs for optimized data fetching.
- Implement the `AuthGuard` to restrict access to the dashboard and quiz builder for unauthenticated users.

---

### David - 5 SP

- **PB-65**: Quiz builder page (CSR) with dynamic question management, form state, save (POST) and edit mode (PATCH) (5 SP) - Days 1-7

**Responsibilities:**
- Build the host layout for the Quiz Builder.
- Orchestrate the overarching Signal-based form state managing the quiz entity.
- Handle routing logic for edit mode vs. create mode.
- Dispatch API calls to the backend via `ApiService` to persist quiz changes.

---

### Nishan - 4 SP

- **PB-68**: Question component with type selection, answer options, correct marking, and validation (4 SP) - Days 1-6

**Responsibilities:**
- Create the granular UI components needed for the quiz builder's list of questions.
- Support question types (multiple-choice, true-false).
- Enforce validation within the form structure (min 1 question, required fields).
- Ensure components emit state changes correctly to David's overarching quiz form state.

---

### Behrang - 8 SP

- **PB-57**: Login and signup pages (SSG) with validation (4 SP) - Days 1-5
- **PB-61**: Dashboard component (SSR) with quiz list and Bubbly card styling (4 SP) - Days 6-10

**Responsibilities:**
- Build the auth pages (Login and Signup) using the overarching Bubbly Minimalism theme configuration.
- Add robust UI-level validation for auth forms.
- Build the SSR-enabled Dashboard component fetching the user's quizzes and displaying them in interactive Bubbly card components.
- Collaborate with Mohamad to hook up the `ApiService` and `AuthService` bindings.
