# QuizForge - Global Development Instructions

## Project Overview
QuizForge is an open-source, real-time multiplayer quiz platform built as an Nx monorepo. It combines an Angular v21 frontend with a Bun/Express backend, using PostgreSQL (Supabase) for persistence. The platform differentiates itself through unique competitive game modes that transform static quizzing into dynamic, social gameplay.

**Core Philosophy**: "Bubbly Minimalism" - Professional Playground design that feels organized for classrooms but energetic like a mobile game.

## Monorepo Architecture
```
quizforge/
├── .github/
│   ├── instructions/
│   │   ├── frontend.instructions.md
│   │   └── backend.instructions.md
│   └── copilot-instructions.md
├── apps/
│   ├── frontend/                  # Angular Frontend
│   │   ├── tests/                 # Vitest unit tests & Playwright E2E
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── core/          # Singleton services & guards
│   │   │   │   ├── features/      # Game, quiz-builder, dashboard
│   │   │   │   └── shared/        # UI pipes, directives, utils
│   │   │   ├── assets/
│   │   │   └── styles.css
│   │   └── project.json           # Angular-specific Nx config
│   └── backend/                   # Bun + Express Backend 
│       ├── tests/                 # Bun test runner tests
│       ├── src/
│       │   ├── api/
│       │   │   ├── middleware/    # Auth, rate limiting, error handling
│       │   │   ├── routes/        # Express route definitions
│       │   │   ├── services/      # Business logic helpers
│       │   │   └── dtos/          # Zod validation schemas
│       │   ├── database/
│       │   │   ├── repositories/  # Type-safe data access
│       │   │   └── schema/        # Drizzle schema definitions
│       │   ├── config/
│       │   │   ├── environment.ts # Env validation
│       │   │   └── logger.ts      # Structured logging
│       │   └── app.ts             # Express app factory
│       └── .env
├── libs/
│   ├── shared/
│   │   ├── models/              # Shared TypeScript interfaces
│   │   └── utils/               # Validation helpers
│   └── ui-components/           # Shared Bubbly UI Angular components
├── supabase/
│   ├── migrations/          # SQL migration files
│   └── seed.sql             # Initial test data
├── .eslintrc.json           # Global Linting rules
├── .prettierrc              # Global Formatting rules
├── nx.json                  # Nx workspace configuration
├── package.json             # Root package with Nx scripts
└── tsconfig.base.json       # Shared TypeScript config
```

## Code Organization Rules

### File Naming Conventions
- **All files**: `kebab-case` (e.g., `user-service.ts`, `quiz-card.component.ts`, `hot-potato.mode.ts`)
- **Classes/Interfaces**: `PascalCase` (e.g., `QuizService`, `IQuizSession`, `HotPotatoEngine`)
- **Variables/Functions**: `camelCase` (e.g., `userId`, `calculateScore()`, `transferPotato`)
- **Constants/Enums**: `SCREAMING_SNAKE_CASE` (e.g., `API_BASE_URL`, `JWT_SECRET`, `GameState`)

### Directory Structure Patterns
- **Feature-based organization**: Each feature has its own directory with components, services, and tests
- **No barrel files**: Import directly from file paths to avoid circular dependencies

## Commit Convention
Format: `<type>(<scope>): <description>`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `chore`: Updating build tasks, package dependencies

**Scopes:**
- Basically the application name, like:
- `frontend`: Angular application changes
- `backend`: Bun/Express application changes
- `shared`: Shared library changes
- `root`: Changes done outside any application (root of the project)
- `ui-components`
- etc.

**Examples:**
- `feat(frontend): add hot-potato-royale game mode UI`
- `fix(backend): resolve race condition in websocket scoring`
- `refactor(shared): extract common game state interfaces`

## Git Workflow
- **GitHub Flow**: All work happens in feature branches from `main`, merged via pull request
- **Branch naming**: `feat/hot-potato-mode` or `fix/scoring-bug`
- **Pull requests**: Require 1 reviewer, must pass CI checks (when implemented)
- **Main branch**: Always deployable, protected branch

## Development Environment
- **Node Manager**: Use `bun` for all scripts and package management
- **Database / ORM**: Use Supabase Postgres as the primary database with Drizzle ORM (`postgres-js` driver) for type-safe queries; use the Supabase CLI for managing migrations and local DB emulation.
- **Authentication**: Supabase Auth for user authentication and session management (stateless JWT pattern)
- **Logging**: Pino for high-performance structured JSON logging (both frontend and backend)
- **Connection Pooling**: Supabase Supavisor in Transaction mode (port 6543) with `prepare: false`
- **Environment Variables**: 
  - Frontend: `apps/frontend/.env` (never commit)
  - Backend: `apps/backend/.env` (never commit)
  - Template: `.env.example` in each directory with required variables
- **Required env vars (Backend)**:
  - `SUPABASE_URL`: Supabase project URL
  - `SUPABASE_ANON_KEY`: Supabase anonymous/public key
  - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server-only, keep secret!)
  - `DATABASE_URL`: Supabase connection pooler URL (Transaction mode)
  - `PORT`: Backend server port (default: 3000)
  - `FRONTEND_URL`: CORS origin (e.g., `http://localhost:4200`)

## Code Quality Standards

### Prettier Configuration (Root Level)
```json
// .prettierrc at root
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "singleAttributePerLine": true,
  "embeddedLanguageFormatting": "auto",
  "htmlWhitespaceSensitivity": "ignore",
  "quoteProps": "as-needed",
  "overrides": [
    {
      "files": "*.html",
      "options": {
        "parser": "angular"
      }
    }
  ],
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### ESLint Configuration
- Frontend: Angular ESLint rules
- Backend: TypeScript ESLint with strict rules
- Global rules:
  - No console.log in production code (use logger service)
  - No any type (use unknown with type guards)
  - No unused variables or imports
  - Mandatory error handling for async operations

```json
import nx from "@nx/eslint-plugin";
import tseslint from "typescript-eslint";

export default [
    ...nx.configs["flat/base"],
    ...nx.configs["flat/typescript"],
    ...nx.configs["flat/javascript"],
    ...tseslint.configs.recommended,
    {
        ignores: [
            "**/dist",
            "**/out-tsc",
            "**/node_modules"
        ]
    },
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
        rules: {
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    enforceBuildableLibDependency: true,
                    allow: [],
                    depConstraints: [
                        {
                            sourceTag: "*",
                            onlyDependOnLibsWithTags: ["*"]
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/naming-convention": [
                "error",
                { selector: "class", format: ["PascalCase"] },
                { selector: "interface", format: ["PascalCase"] },
                { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
                { selector: "function", format: ["camelCase"] }
            ],
            "no-console": ["warn", { allow: ["warn", "error"] }]
        }
    }
];

```

### Pre-commit Hooks (Husky)
```
// .husky/pre-commit
#!/bin/sh
echo "🔍 Running pre-commit checks on affected projects..."

# Only lint projects affected by current changes
bunx nx affected -t lint --uncommitted
bunx nx format:check

bunx nx affected -t test --uncommitted

echo "✅ Pre-commit checks passed!"

// .husky/pre-push

#!/bin/sh
echo "🚀 Running pre-push checks on affected projects..."

# Build affected projects before push
bunx nx affected -t build --uncommitted

echo "✅ Pre-push checks passed!"
```

## Testing Requirements

### Coverage Targets
- **Unit tests**: Minimum 80% coverage for:
  - Critical paths: answer submission, score calculation, state transitions
  - Drizzle repository methods and transaction handling
  - Supabase Auth middleware and JWT validation
- **E2E tests**: Cover entire user flows:
  - User signup/login → Host creates quiz → starts session → players join → complete game
  - Edge cases: late join, disconnect/reconnect, invalid answers, transaction rollback

### Test Naming
- Unit: `describe('QuizService', () => { it('should calculate streak bonus correctly', ...) })`
- E2E: `describe('Hot Potato Mode', () => { it('should transfer potato on timeout', ...) })`

## Performance Targets
- **Frontend**: 60fps on devices with 2GB RAM, Lighthouse score >90
- **Backend**: Handle 200 concurrent players per instance, <100ms response time
- **SSR**: Initial load <2s, hydration <500ms
- **WebSocket**: <50ms message latency within same region

## Security Checklist
- [ ] All API endpoints validate Supabase Auth JWTs via `authMiddleware`
- [ ] WebSocket connections authenticate using Supabase JWT before accepting data
- [ ] Database queries use Drizzle ORM query builders (type-safe, SQL injection prevention)
- [ ] Row Level Security (RLS) policies enabled on all Supabase tables
- [ ] Rate limiting on all endpoints (60 req/min IP, throttle WebSocket events)
- [ ] CORS configured to specific origins only (FRONTEND_URL env)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` never exposed to client-side code
- [ ] No sensitive data in client-side logs or WebSocket handshakes
- [ ] XSS prevention via Angular sanitization
- [ ] Zod validation for ALL WebSocket messages and API request bodies

## Documentation Standards
- **Functions**: JSDoc for all public methods
- **API**: Tspec definitions for all endpoints (see backend instructions)
- **README**: Keep root README concise, link to detailed docs in `docs/` folder
- **Swagger**: Auto-generated from Tspec at `/api-docs` endpoint

## Design Language: Bubbly Minimalism

### Visual Philosophy
The design should feel like a **"Professional Playground."** Organized and clear enough for a classroom, but energetic like a game. Avoid sharp 90-degree corners and "stiff" corporate layouts.

### Core Style Rules
- **Soft Geometry**: Every container uses `rounded-2xl` or `rounded-3xl`
- **Marshmallow Buttons**: Thick padding (`px-6 py-3`) + subtle shadow (`shadow-sm hover:shadow-md`)
- **60-30-10 Color Rule**:
  - **60% Background**: `--background` (`#f9fafb` light, `#040506` dark)
  - **30% Brand**: `--primary` (`#00a5e0` cyan-blue)
  - **10% Action**: `--accent` (`#cd2750` pink-red) for CTAs only
- **Negative Space**: Generous padding (`p-6`/`p-8`) for breathability

### Typography
- **Headings**: DynaPuff (Google Fonts), Bold/700, for titles/scores
- **Body**: Nunito (Google Fonts), Regular/400, for questions/instructions
- **Buttons/CTAs**: Nunito, Semi-Bold/600

### Technical Constraints (Mobile Performance)
- **No blur/gradients**: Use solid colors or simple opacity
- **Icons**: Heroicons (preferably) or Lucide (rounded variants)
- **Animations**: Subtle `scale-95`/`scale-105` on interactions, respect `prefers-reduced-motion`

### Implementation in Frontend
See `frontend.instructions.md` for detailed Tailwind/DaisyUI implementation.

## TODO: Global Unknowns (IF YOU'RE AN AI AGENT: IGNORE THIS LIST)
- [x] State management: Angular Signals (resource/rxResource) ✅
- [x] Frontend testing: Vitest + Playwright ✅
- [x] Rendering: Hybrid (SSG for marketing, SSR for public pages, CSR for game) ✅
- [ ] Specific competitive modes for MVP (select 3 from list)
- [ ] Internationalization strategy (Angular i18n vs Transloco)
- [ ] Docker deployment configuration (multi-stage builds for frontend/backend)
- [ ] CI/CD pipeline configuration (GitHub Actions)
- [ ] Staging/Production environment separation