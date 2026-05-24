<!-- Context: project-intelligence/nav | Priority: critical | Version: 1.0 | Updated: 2026-05-24 -->

# QuizForge Project Context

> Start here to understand QuizForge — a realtime quiz game platform built with Angular v21 + Bun/Express + Supabase.

## Structure

```
.opencode/context/
└── project-intelligence/
    ├── navigation.md              # This file — quick overview
    └── technical-domain.md        # Tech stack, patterns, conventions, security
```

## Quick Routes

| What You Need | File | Description |
|---------------|------|-------------|
| Tech stack & setup | `technical-domain.md` | Stack, architecture, API/component patterns |
| Code conventions | `technical-domain.md` | Naming, standards, security requirements |
| UI design language | `technical-domain.md` | Bubbly Minimalism, CSS tokens |

## Deep Dives

| Topic | File | Section |
|-------|------|---------|
| API Route pattern | `technical-domain.md` | Code Patterns → API Route |
| Component pattern | `technical-domain.md` | Code Patterns → Component |
| Zod DTO pattern | `technical-domain.md` | Code Patterns → Validation |
| Form primitives | `technical-domain.md` | Code Patterns → Shared Form Primitives |
| CSS token system | `apps/frontend/src/styles.css` | All `--bubbly-*` custom properties |
| Tailwind theme | `apps/frontend/tailwind.config.mjs` | Custom colors, DaisyUI bubbly theme |

## Related Documentation

| File | What It Covers |
|------|---------------|
| `.github/copilot-instructions.md` | Architecture, game modes, security checklist, commits |
| `.github/instructions/frontend.instructions.md` | Angular v21, zoneless, Signals, Testing |
| `.github/instructions/backend.instructions.md` | Bun/Express, Drizzle, Supabase Auth, Websockets |
| `AGENTS.md` | Nx workspace commands, project structure |

## Key Commands

| Task | Command |
|------|---------|
| Dev frontend | `bun run dev:frontend` |
| Dev backend | `bun run dev:backend` |
| Lint | `bun run lint` |
| Format | `bun run format` |
| Build frontend | `bun run build:frontend` |
| Generate Swagger | `bun run generate:api-docs` |
| DB push | `bun run db:push` |
| DB reset | `bun run db:reset` |

## Maintenance

- Update `technical-domain.md` when tech stack changes or new patterns emerge
- Reference actual code paths in Codebase References sections
- Keep under 200 lines per MVI compliance
