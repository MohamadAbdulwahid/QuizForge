# QuizForge Backend

Bun + Express backend for the QuizForge real-time quiz platform.

## Setup

```bash
# Install dependencies (from project root)
bun install

# Copy environment variables
cp apps/backend/.env.example apps/backend/.env
# Fill in your Supabase credentials in .env
```

## Environment Variables

| Variable | Description | Required |
| --- | --- | --- |
| `PORT` | Server port (default: 3333) | Yes |
| `FRONTEND_URL` | CORS origin URL | Yes |
| `DATABASE_URL` | Supabase connection pooler URL (Transaction mode, port 6543) | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase public anon key | Yes |
| `SUPABASE_SECRET_KEY` | Supabase service role key (server-only) | Yes |
| `NODE_ENV` | `development`, `production`, or `test` (default: `development`) | No |
| `LOG_LEVEL` | `trace`, `debug`, `info`, `warn`, `error`, `fatal` (default: `info`) | No |

## Scripts

```bash
# Development (watch mode)
bun run dev:backend

# Production
bun run start:backend

# Lint
bun run lint:backend

# Tests
bun run test:backend

# Database
bun run db:generate    # Generate Drizzle migrations
bun run db:push        # Push migrations to Supabase
bun run seed           # Seed test data
```

## Seeding

```bash
bun run seed
```

Seeds 3 test users and 2 quizzes per user (5 questions each). The seed script is **idempotent** — running it multiple times won't create duplicate data. Users are checked by email, quizzes by creator ID.

## Logging

Uses [Pino](https://getpino.io/) for structured logging:

- **Development**: Pretty-printed colored logs via `pino-pretty` (programmatic transport, no piping needed)
- **Production**: Raw JSON logs for log aggregation tools

```typescript
import { logger, createChildLogger } from './config/logger';

// Main logger
logger.info({ port: 3333 }, 'Server listening');

// Component-specific child logger
const dbLogger = createChildLogger('database');
dbLogger.error({ err }, 'Query failed');
```

`pino-pretty` is a dev dependency only and should **not** be enabled in production.

## Auth

Uses Supabase Auth with stateless JWT validation:

- `supabaseClient` (publishable key) — validates JWTs via `auth.getUser(token)`
- `authAdminClient` (secret key) — server-side user management (bypasses RLS)

### Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | No | Create account |
| `POST` | `/api/auth/login` | No | Sign in |
| `GET` | `/health` | No | Health check |

All `/api` routes require `API-Version: 1.0` header (defaults to `1.0` if omitted).

### Protected Routes

Use the `authMiddleware` to protect routes:

```typescript
import { authMiddleware } from './api/middleware/auth';
router.get('/protected', authMiddleware, handler);
```
