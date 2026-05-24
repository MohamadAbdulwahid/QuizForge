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

**ALWAYS** read and follow the guidelines in `.github/copilot-instructions.md` before working on any task. It contains architecture decisions, game mode specs, design language ("Bubbly Minimalism"), API versioning strategy, security checklist, and commit conventions.

When working on specific parts of the codebase, also consult:

- **Backend** (`apps/backend/**`): `.github/instructions/backend.instructions.md` — Bun/Express patterns, Drizzle ORM, Supabase Auth, WebSocket protocol, Tspec API docs.
- **Frontend** (`apps/frontend/**`): `.github/instructions/frontend.instructions.md` — Angular v21 zoneless, Signals, Tailwind/DaisyUI, Vitest + Angular Testing Library, hybrid rendering (SSG/SSR/CSR).

## Package Manager & Commands

All commands use **`bun`**. Never use `npm` or `npx` — use `bun` and `bunx`.

| Task | Command |
|------|---------|
| Lint all | `bun run lint` |
| Lint affected | `bun run lint:affected` |
| Test all | `bun run test` |
| Test affected | `bun run test:affected` |
| Format write | `bun run format` |
| Format check | `bun run format:check` |
| Dev backend | `bun run dev:backend` |
| Dev frontend | `bun run dev:frontend` |
| Build frontend | `bun run build:frontend` |
| E2E frontend | `bun run e2e:frontend` |
| E2E backend | `bun run e2e:backend` |
| Generate Swagger | `bun run generate:api-docs` |

## Project Structure

```
apps/
  backend/          # Bun + Express + Socket.IO + Drizzle ORM
  backend-e2e/      # Backend E2E tests
  frontend/         # Angular v21 (zoneless) + Tailwind + DaisyUI
  frontend-e2e/     # Playwright E2E tests
libs/
  shared/           # Shared TypeScript types/models
```

## Backend Key Facts

- **Runtime**: Bun — entry point is `apps/backend/src/main.ts`
- **Test runner**: Bun built-in (`bun test` in `apps/backend/`)
- **Database**: Supabase Postgres via Drizzle ORM (`postgres-js` driver)
- **Connection pool**: Supavisor Transaction mode — **must** use `prepare: false`
- **Migrations**: Supabase CLI primary (`bunx supabase db reset`, `bunx supabase db push`), Drizzle Kit secondary (`bunx drizzle-kit generate`, `bunx drizzle-kit push`)
- **Schema glob**: `src/database/schema/*.ts` — `schema/auth/user.ts` is excluded (Supabase-managed)
- **Auth**: Stateless JWT via Supabase — validate with `authMiddleware`, never store sessions
- **API versioning**: Header-based (`API-Version: 1.0`), NOT path-based
- **API docs**: Tspec code-first — `bun run generate:api-docs` outputs to `src/assets/swagger.json`

### Database Commands

| Task | Command |
|------|---------|
| Init Supabase | `bun run db:init` |
| Reset local DB | `bun run db:reset` |
| Push Drizzle schema | `bun run db:push` |
| Pull from remote | `bun run db:pull` |
| Link Supabase project | `bun run db:link` |
| Generate Drizzle migration | `bun run db:generate` |
| Seed database | `bun run seed` |

### Backend Env (`apps/backend/.env`)

Required: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `PORT` (default 3333), `FRONTEND_URL`, `NODE_ENV`, `LOG_LEVEL`. Copy from `.env.example`.

## Frontend Key Facts

- **Framework**: Angular v21, **zoneless** — no `zone.js`, use Signals everywhere
- **State**: `signal()`, `computed()`, `resource()`, `rxResource()` — RxJS only for streams (WebSocket, timers)
- **Testing**: Vitest + Angular Testing Library (`nx test frontend`)
- **E2E**: Playwright, single worker (2GB RAM constraint)
- **Rendering**: Hybrid — SSG for marketing/auth, SSR for public pages, CSR for game engine
- **Styling**: Tailwind CSS v4 + DaisyUI v5 — no custom CSS unless for animations
- **Components**: Standonly only, signal-based `input()`/`output()`, `@if`/`@for`/`@defer` control flow

### Frontend Env (`apps/frontend/.env`)

Required: Supabase URL and anon key, API URL, WebSocket URL. Copy from `.env.example` if present.

## Code Conventions

- **File naming**: `kebab-case` for all files
- **No barrel files** — import directly from file paths to avoid circular deps
- **Commit format**: `<type>(<scope>): <description>` — scopes: `frontend`, `backend`, `shared`, `ui-components`, `root`
- **Git flow**: GitHub Flow — feature branches from `main`, merged via PR (1 reviewer required)

## Pre-commit / Pre-push Hooks

- **Pre-commit**: `bun lint:affected` + `bun format:check` (tests commented out)
- **Pre-push**: `bunx nx affected -t build --uncommitted`

## Prettier

Config at root `.prettierrc`: 100 char width, single quotes, semicolons, `prettier-plugin-tailwindcss`, Angular parser for HTML.

## Design: Bubbly Minimalism

- Containers: `rounded-2xl` or `rounded-3xl` — no sharp corners
- Buttons: `px-6 py-3 rounded-2xl shadow-sm hover:shadow-md`
- 60-30-10 colors: background `#f9fafb`, primary `#00a5e0`, accent `#cd2750`
- Fonts: DynaPuff (headings), Nunito (body)
- No blur/gradients — solid colors or opacity only
- Respect `prefers-reduced-motion`
