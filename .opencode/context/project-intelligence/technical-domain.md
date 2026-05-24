<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.0 | Updated: 2026-05-24 -->

# Technical Domain

**Purpose**: Tech stack, architecture, code patterns for QuizForge — a realtime quiz game platform.
**Last Updated**: 2026-05-24

## Primary Stack

| Layer | Technology | Key Config |
|-------|-----------|------------|
| Runtime | Bun 1.x | `apps/backend/src/main.ts` entry |
| Backend | Express + Socket.IO v4 | `prepare: false` for Supavisor pool |
| Database | Supabase Postgres + Drizzle ORM | `postgres-js` driver, `src/database/schema/*.ts` |
| Auth | Supabase Auth (stateless JWT) | `authMiddleware` in middleware/auth.ts |
| Frontend | Angular v21 (zoneless) | Signals, standalone components |
| Styling | Tailwind CSS v4 + DaisyUI v5 | `tailwind.config.mjs` + `styles.css` |
| Monorepo | Nx (pnpm) | `nx.json`, `project.json` per app/lib |
| Fonts | DynaPuff (headings), Nunito (body) | Imported in `styles.css` |
| API Docs | Tspec (code-first) | `bun run generate:api-docs` → `swagger.json` |

## Architecture Pattern

```
Type: Monorepo with separate frontend/backend apps
Pattern: REST API (HTTP) + WebSocket (Socket.IO) realtime game engine
```

### Key Design Decisions
- **Zoneless Angular**: No `zone.js`, all reactivity via `signal()`, `computed()`, `resource()`
- **Stateless Auth**: Supabase JWT validated per-request, no server sessions
- **Hybrid Rendering**: SSG for marketing/auth, SSR for public pages, CSR for game engine
- **API Versioning**: Header-based (`API-Version: 1.0`), never path-based
- **Supavisor Transaction Mode**: Requires `prepare: false` in Drizzle connection

## Code Patterns

### API Route (Backend)
```typescript
// apps/backend/src/api/routes/*.routes.ts
import { Router } from 'express';
import { validateBody } from '../middleware/validation';
import { authMiddleware, sendUnauthorized } from '../middleware/auth';
import { QuizDto } from '../dtos/quiz.dto';

const router = Router();

router.post('/', authMiddleware, validateBody(QuizDto.createSchema), async (req, res, next) => {
  try {
    const result = await quizService.create(req.user!.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err); // → global error handler
  }
});
```

### Component (Frontend)
```typescript
// *.component.ts — standalone, signal-based
import { Component, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-bubbly-button',
  standalone: true,
  imports: [NgClass],
  template: `
    <button class="qf-tactile rounded-2xl font-bold" [ngClass]="classes()">
      <ng-content />
    </button>
  `,
})
export class BubblyButtonComponent {
  readonly tone = input<'primary' | 'accent' | 'ghost'>('primary');
  readonly disabled = input(false);
  // ...computed classes based on inputs
}
```

### Validation (Backend - Zod DTOs)
```typescript
// apps/backend/src/api/dtos/*.dto.ts
import { z } from 'zod';

export const createQuizSchema = z.object({
  title: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
});
export type CreateQuizDto = z.infer<typeof createQuizSchema>;
```

### Validation (Frontend - ReactiveForms)
```typescript
// Uses Angular ReactiveForms Validators (no Zod on frontend)
protected readonly form = this.formBuilder.group({
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(8)]],
});
```

### Shared Form Primitives (Frontend)
```typescript
// BubblyInput — implements ControlValueAccessor for formControlName binding
@Component({ /* ... NG_VALUE_ACCESSOR provider */ })
export class BubblyInputComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly type = input('text');
  readonly placeholder = input('');
  readonly error = input<string | null>(null);
  // ...CVA boilerplate (writeValue, registerOnChange, registerOnTouched)
}
```

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | `kebab-case` | `quiz-builder.component.ts`, `auth.routes.ts` |
| Components | PascalCase | `BubblyButtonComponent`, `GamePlayPageComponent` |
| Functions/Vars | `camelCase` | `buildDisplayName()`, `isFieldInvalid()` |
| Database | `snake_case` | `quiz_sessions`, `question_options` |
| DTO Schemas | PascalCase suffix | `CreateQuizRequestSchema`, `SignInRequestSchema` |
| Selectors | `kebab-case` prefixed | `app-bubbly-card`, `app-player-bubble` |

## Code Standards

1. **No barrel files** — Import directly from file paths to avoid circular deps
2. **CSS custom properties** — Use `var(--bubbly-*)` for all colors; never `bg-[#xxx]` or `text-[#xxx]`
3. **DaisyUI semantic classes** — Prefer `bg-primary`, `text-base-content`, `border-base-300` over custom
4. **Shared utilities** — Extract duplicated logic (auth errors, display name) to `shared/utils/`
5. **Standalone components** — All components are `standalone: true` with explicit imports
6. **Signals over RxJS** — Use `signal()`, `computed()`, `resource()` for state; RxJS only for streams (WebSocket, timers)
7. **Zod middleware** — All backend routes use `validateBody()`/`validateParams()` middleware
8. **authMiddleware + sendUnauthorized** — Protected routes always use `authMiddleware` + `req.user!.id` type assertion
9. **No `any` types** — Use `unknown` + type guards for error handling
10. **Bubbly Minimalism** — `rounded-2xl`/`rounded-3xl`, tactile shadows (`qf-tactile`), 60-30-10 color split, no blur/gradients
11. **`styleUrl` omitted** when CSS file is empty/deleted (components use inline or global styles only)

## Security Requirements

- **Auth**: All protected routes use `authMiddleware` that validates Supabase JWT via `req.user` injection
- **Input Validation**: Zod DTO schemas validate all request bodies/params via middleware (except auth routes use manual `safeParse`)
- **CORS**: Configured in Express for `FRONTEND_URL` only
- **SQL Injection**: Prevented by Drizzle ORM parameterized queries
- **API Versioning**: Header-based (`API-Version`) — never expose version in URL paths
- **AuthServiceError**: Centralized error class with `statusCode` + `code` for consistent API error responses
- **No Credentials in Code**: All secrets (Supabase keys, DB URL) in `.env` files, never committed

## 📂 Codebase References

| Pattern | Location |
|---------|----------|
| Route pattern | `apps/backend/src/api/routes/quiz.routes.ts` |
| Zod DTO pattern | `apps/backend/src/api/dtos/quiz.dto.ts` |
| Auth middleware | `apps/backend/src/api/middleware/auth.ts` |
| Validation middleware | `apps/backend/src/api/middleware/validation.ts` |
| Error handler | `apps/backend/src/api/middleware/error-handler.ts` |
| Component pattern | `apps/frontend/src/app/shared/ui/bubbly-button.component.ts` |
| CVA form primitive | `apps/frontend/src/app/shared/ui/bubbly-input.component.ts` |
| CSS tokens | `apps/frontend/src/styles.css` |
| Tailwind config | `apps/frontend/tailwind.config.mjs` |
| Auth service | `apps/frontend/src/app/core/services/auth.service.ts` |
| WebSocket service | `apps/frontend/src/app/core/services/websocket.service.ts` |
| Shared utils | `apps/frontend/src/app/shared/utils/auth-errors.ts` |

## Related Files

- `../../.github/copilot-instructions.md` — Architecture decisions, game modes, security checklist, commit conventions
- `../../.github/instructions/frontend.instructions.md` — Angular-specific guidelines
- `../../.github/instructions/backend.instructions.md` — Bun/Express/Drizzle patterns
- `navigation.md` — This context's navigation overview
