# Sprint 3 Effort Plan

**Sprint Duration:** 2 weeks (10 working days)  
**Target Velocity:** 25 Story Points  
**Team Size:** 4 developers

---

## Team Members & Roles

| Name | Role | Primary Focus | Hour worked |
|------|------|---------------|--------------|
| **Mohamad** | Product Owner, Developer | Frontend scaffold, Architecture, Rendering | 0h |
| **David** | Scrum Master, Developer | Session State Machine, Endpoints | 0h |
| **Nishan** | Stakeholder, Developer | WebSocket Infrastructure, Server-side Events | 0h |
| **Behrang** | Stakeholder, Developer | UI Styling Config, Zod Schemas, Supabase Client | 0h |

---

## Effort Distribution by Developer

### Mohamad - 6 SP

- **PB-31**: Angular v21 frontend scaffold + Vitest + Landing page (3 SP) - Days 1-3
- **PB-33**: Zoneless change detection and hybrid rendering config (3 SP) - Days 4-6

**Responsibilities:**
- Set up Angular project using Nx tooling
- Configure Vitest and Angular Testing Library
- Implement experimental zoneless change detection and hybrid rendering (SSG/SSR/CSR)
- Provide initial architecture for frontend including landing page implementation

---

### David - 5 SP

- **PB-28**: Session state machine (waiting, playing, paused, ended) (3 SP) - Days 1-4
- **PB-29**: Session endpoints + Tspec docs (POST /sessions, GET /sessions/:pin, PATCH /sessions/:pin/status) (2 SP) - Days 5-7

**Responsibilities:**
- Define logic for game session states and transitions.
- Build RESTful endpoints to manage session lifecycles.
- Generate and verify Tspec API documentation for session endpoints.
- Ensure strict error handling for invalid state transitions.

---

### Nishan - 8 SP

- **PB-37**: Socket.IO server configured with Supabase JWT authentication (4 SP) - Days 1-5
- **PB-38**: WebSocket event handlers with room management mapped to PINs (4 SP) - Days 6-10

**Responsibilities:**
- Integrate Socket.IO with the existing Bun backend.
- Validate Supabase JWT tokens specifically during the WS upgrade/handshake connection.
- Implement room logic, making sure clients join the specific game via unique PINs.
- Listeners for `join-game`, `leave-game`, and broadcasting `player-joined`/`player-left`.

---

### Behrang - 6 SP

- **PB-32**: Tailwind CSS v4 + DaisyUI v5 + Heroicons config (Bubbly Minimalism theme) (3 SP) - Days 1-4
- **PB-55**: Supabase client configured in Angular (2 SP) - Days 5-7
- **PB-45**: Zod validation schemas for all WebSocket messages (1 SP) - Days 8-9

**Responsibilities:**
- Setup the Bubbly Minimalism theme using DaisyUI and Tailwind CSS as per `frontend.instructions.md`.
- Ensure responsive configuration for mobile-first.
- Create an injectable Supabase client service for the Angular frontend.
- Provide strong type constraints for WebSockets via Zod (frontend/backend shared schema or backend).
