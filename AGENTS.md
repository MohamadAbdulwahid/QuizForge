<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Project-Specific Instructions

## Required Reading

**ALWAYS** read `.github/copilot-instructions.md` before any task. It contains architecture decisions, game mode specs, Bubbly Minimalism design language, API versioning strategy, security checklist, and commit conventions.

When working on specific parts of the codebase:

- **Backend** (`apps/backend/**`): `.github/instructions/backend.instructions.md` — Bun/Express, Drizzle ORM, Supabase Auth, WebSocket protocol, Tspec API docs.
- **Frontend** (`apps/frontend/**`): `.github/instructions/frontend.instructions.md` — Angular v21 zoneless, Signals, Tailwind/DaisyUI, Vitest + Angular Testing Library, hybrid rendering (SSG/SSR/CSR).
- **Project-level context** (discovered automatically via `paths.json custom_dir`): `.opencode/context/project-intelligence/technical-domain.md` — in-repo patterns, standards, security.

## Entrypoints

| App | Entry File | Command |
|-----|-----------|---------|
| Frontend | `apps/frontend/src/main.ts` | `bun run dev:frontend` |
| Backend | `apps/backend/src/main.ts` | `bun run dev:backend` |
| Frontend SSR | Configured in `app.config.ts` via `provideClientHydration(withEventReplay())` | — |

**Zoneless**: Frontend uses `provideZonelessChangeDetection()` — no `zone.js`. Never import it. If UI doesn't update, check signal writes (`set`, `update`) first.

## Package Manager & Commands

All commands use **`bun`**. Never `npm` or `npx`.

### Workspace Commands

| Task | Command |
|------|---------|
| Lint all | `bun run lint` |
| Lint affected | `bun run lint:affected` |
| Test all | `bun run test` |
| Test single frontend file | `bun test apps/frontend/src/app/features/.../*.spec.ts` |
| Format write | `bun run format` |
| Format check | `bun run format:check` |
| Dev backend | `bun run dev:backend` |
| Dev frontend | `bun run dev:frontend` |
| Build frontend | `bun run build:frontend` |
| E2E frontend | `bun run e2e:frontend` |
| E2E backend | `bun run e2e:backend` |

### Database Commands

All go through Nx (not `bunx supabase` directly):

| Task | Command |
|------|---------|
| Push Drizzle schema | `bun run db:push` |
| Reset local DB | `bun run db:reset` |
| Pull from remote | `bun run db:pull` |
| Link Supabase | `bun run db:link` |
| Generate migration | `bun run db:generate` |
| Seed | `bun run seed` |

### Swagger Docs

```sh
bun run generate:api-docs   # runs `cd apps/backend && bunx tspec generate ...` → apps/backend/src/assets/swagger.json
# Then visit http://localhost:3333/api-docs (dev backend must be running)
```

### Husky (Git Hooks)

Auto-installed via `bun run prepare` (runs `husky`).

- **Pre-commit**: `bun lint:affected` + `bun format:check` (tests commented out)
- **Pre-push**: `bunx nx affected -t build --uncommitted`

## Project Structure

```
apps/
  backend/          # Bun + Express + Socket.IO + Drizzle ORM
    src/main.ts     # Entrypoint
  backend-e2e/      # Backend E2E tests
  frontend/         # Angular v21 (zoneless) + Tailwind + DaisyUI
    src/main.ts     # Entrypoint
  frontend-e2e/     # Playwright E2E tests
libs/
  shared/           # Shared TypeScript types/models
```

## Backend Key Facts

- **Runtime**: Bun — entry at `apps/backend/src/main.ts`
- **Test runner**: Bun built-in (`bun test` in `apps/backend/`)
- **ORM**: Drizzle ORM with `postgres-js` driver
- **Connection pool**: Supavisor Transaction mode — **must** use `prepare: false`
- **Schema glob**: `src/database/schema/*.ts` — `schema/auth/user.ts` excluded (Supabase-managed)
- **Auth**: Stateless JWT via Supabase — validate with `authMiddleware`, never store sessions
- **API versioning**: Header-based (`API-Version: 1.0`), NOT path-based
- **Middleware chain**: `apiVersionMiddleware → registerRoutes()` (no global `authMiddleware` — applied per-route)
- **Auth routes** skip `authMiddleware`, use `validateBody()` for Zod validation
- **Protected routes** use `authMiddleware` + `validateBody()`/`validateParams()` — `req.user!.id` type assertion is safe after middleware
- **Error pattern**: `try/catch → next(err)` → global `errorHandler`. `AuthServiceError` is caught centrally.
- **API docs**: Tspec code-first → `apps/backend/src/assets/swagger.json`, served via swagger-ui at `/api-docs`

### Backend Env (`apps/backend/.env`)

Required: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `PORT` (default 3333), `FRONTEND_URL`, `NODE_ENV`, `LOG_LEVEL`. Copy from `.env.example`.

## Frontend Key Facts

- **Framework**: Angular v21, **zoneless** — no `zone.js`, use Signals everywhere
- **State**: `signal()`, `computed()`, `resource()`, `rxResource()` — **RxJS only for streams** (WebSocket, timers)
- **Rendering**: Hybrid — SSG for marketing/auth, SSR for public pages, CSR for game engine
- **Testing**: Vitest + Angular Testing Library (`bun test apps/frontend/src/app/features/.../*.spec.ts` for a single file)
- **E2E**: Playwright, single worker (2GB RAM constraint)
- **Styling**: Tailwind CSS v4 + DaisyUI v5 — CSS custom properties (`var(--bubbly-*)`) live in `styles.css`
- **Components**: **Standalone only**, signal-based `input()`/`output()`, `@if`/`@for`/`@defer` control flow
- **Form primitives**: `BubblyInput` (CVA), `BubblySelect` (CVA), `BubblyAlert`, `BubblyButton`, `BubblyCard` in `shared/ui/`
- **Error handling**: Shared `buildErrorMessage()` util in `shared/utils/auth-errors.ts`
- **Config**: `app.config.ts` provides zoneless CD, `provideClientHydration(withEventReplay())`, `authInterceptor`, `provideBrowserGlobalErrorListeners`

### Frontend Env (`apps/frontend/.env`)

Required: Supabase URL + anon key, API URL, WebSocket URL. Copy from `.env.example` if present.

## Code Conventions

- **File naming**: `kebab-case` for ALL files (enforced by `eslint-plugin-check-file` — error-level)
- **No barrel files** — import directly from file paths to avoid circular deps
- **Commit format**: `<type>(<scope>): <description>` — scopes: `frontend`, `backend`, `shared`, `ui-components`, `root`
- **Git flow**: GitHub Flow — feature branches from `main`, merged via PR (1 reviewer required)
- **ESLint**: Enforces `no-explicit-any` (error), `no-console` (warn, allows `warn`/`error`), `no-unused-vars` (error, `_` prefix exempt), PascalCase classes/interfaces, camelCase vars/functions
- **No path aliases** — `tsconfig.base.json` has empty `paths: {}`. Import from relative paths.
- **No CSS hardcoding** — use `var(--bubbly-*)` or DaisyUI semantic classes (`bg-primary`, `text-base-content`). Never `bg-[#xxxx]` or `text-[#xxxx]`.

## Shared Components & Utils

| Module | Path | Purpose |
|--------|------|---------|
| BubblyButton | `shared/ui/bubbly-button.component.ts` | `tone: primary\|accent\|ghost`, `size`, `full`, `disabled` |
| BubblyCard | `shared/ui/bubbly-card.component.ts` | `tone: surface\|soft\|primary\|accent`, `padded`, `interactive` |
| BubblyInput | `shared/ui/bubbly-input.component.ts` | CVA form input with `label`, `type`, `placeholder`, `error` |
| BubblySelect | `shared/ui/bubbly-select.component.ts` | CVA select with `label`, `options`, `error`, `placeholder` |
| BubblyAlert | `shared/ui/bubbly-alert.component.ts` | `variant: error\|info\|success\|warning`, dismissible |
| PageHeading | `shared/ui/page-heading.component.ts` | `eyebrow`, `title`, `description`, `hasActions` |
| StatusPill | `shared/ui/status-pill.component.ts` | Status indicator pill |
| PlayerBubble | `shared/ui/player-bubble.component.ts` | Player avatar bubble for lobby |
| auth-errors | `shared/utils/auth-errors.ts` | `buildErrorMessage()` for Supabase + API errors |
| display-name | `shared/utils/display-name.ts` | `buildDisplayName()` — username → email prefix → fallback |

## Design: Bubbly Minimalism

- Containers: `rounded-2xl` or `rounded-3xl` — no sharp corners
- Buttons: `px-5 py-3 rounded-2xl shadow-sm`, tactile feedback via `qf-tactile` class
- 60-30-10: background `var(--bubbly-background)`, primary `var(--bubbly-primary)`, accent `var(--bubbly-accent)`
- Fonts: DynaPuff (headings, `font-display`), Nunito (body, `font-body`)
- No blur/gradients — solid colors or opacity only
- Respect `prefers-reduced-motion`

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
