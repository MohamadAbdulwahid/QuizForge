# QuizForge Backend

Bun + Express backend for the QuizForge real-time multiplayer quiz platform.

## Tech Stack

- **Runtime**: Bun (fast JavaScript runtime)
- **Framework**: Express 5.x
- **Database**: PostgreSQL (Supabase)
- **ORM**: Drizzle ORM with postgres-js driver
- **Authentication**: Supabase Auth (JWT)
- **Logging**: Pino (high-performance structured logging)
- **Validation**: Zod
- **Testing**: Bun test runner

## Getting Started

### Prerequisites

- Bun v1.0+ installed
- Access to Supabase project (or local Supabase instance)

### Installation

```bash
# Install dependencies
cd apps/backend
bun install
```

### Environment Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Fill in your environment variables:
```env
# Database Configuration
DATABASE_URL="postgresql://user:password@host:6543/postgres"

# Environment Configuration
NODE_ENV="development"

# Logging Configuration
LOG_LEVEL="info"
```

### Available Commands

```bash
# Run development server with hot-reload
bun run dev:backend

# Run production server
bun run start:backend

# Run tests
bun run test:backend

# Run linter
bun run lint:backend
```

## Logging with Pino

QuizForge uses **Pino** for high-performance structured logging with different behavior in development vs production.

### Configuration

The logger is configured in `apps/backend/src/config/logger.ts`:
- **Development** (`NODE_ENV=development`): Pretty-printed colored logs with timestamps
- **Production** (`NODE_ENV=production`): Raw JSON logs for log aggregation tools

⚠️ **Important**: `pino-pretty` is for development only and should **NOT** be enabled in production. Production logs emit raw JSON for log aggregation tools like Datadog, CloudWatch, or ELK stack.

### Log Levels

Control verbosity via `LOG_LEVEL` environment variable:
- `trace` - Very detailed debugging
- `debug` - Detailed debugging information
- `info` - General informational messages (default)
- `warn` - Warning messages
- `error` - Error messages
- `fatal` - Critical errors (app should exit)

### Usage Examples

#### Server Start

```typescript
// apps/backend/src/main.ts
import { logger } from './config/logger.js';

const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  logger.info({ port: PORT, env: config.NODE_ENV }, 'Server listening');
});
```

#### Auth Middleware

```typescript
// apps/backend/src/api/middleware/auth.ts
import { createChildLogger } from '../../config/logger.js';

const authLogger = createChildLogger('auth');

export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    authLogger.warn({ ip: req.ip, path: req.path }, 'Authentication failed - missing token');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const decoded = verifyToken(token);
    authLogger.info({ userId: decoded.sub }, 'Authentication successful');
    req.user = decoded;
    next();
  } catch (error) {
    authLogger.error({ err: error, ip: req.ip }, 'Authentication failed - invalid token');
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

#### Database Client

```typescript
// apps/backend/src/database/client.ts
import { createChildLogger } from '../config/logger.js';

const dbLogger = createChildLogger('database');

// Log connection errors
db.on('error', (err) => {
  dbLogger.error({ err }, 'Database connection error');
});

// Log slow queries (example)
export async function executeQuery(query) {
  const start = Date.now();
  
  try {
    const result = await db.execute(query);
    const duration = Date.now() - start;
    
    if (duration > 500) {
      dbLogger.warn({ duration, query: query.sql }, 'Slow query detected');
    }
    
    return result;
  } catch (error) {
    dbLogger.error({ err: error, query: query.sql }, 'Query execution failed');
    throw error;
  }
}

// Log transaction failures
export async function withTransaction(callback) {
  try {
    const result = await db.transaction(callback);
    dbLogger.debug('Transaction completed successfully');
    return result;
  } catch (error) {
    dbLogger.error({ err: error }, 'Transaction failed');
    throw error;
  }
}
```

### Best Practices

✅ **Use child loggers** with `component` field for better traceability:
```typescript
const logger = createChildLogger('my-component');
```

✅ **Include context as first argument** (structured logging):
```typescript
logger.info({ userId, action: 'login' }, 'User logged in');
```

✅ **Use appropriate log levels** based on severity

✅ **Use `err` key for errors** to leverage Pino's error serializer:
```typescript
logger.error({ err: error }, 'Error occurred');
```

❌ **Don't use `console.log()`** - ESLint will warn you

❌ **Don't log sensitive data** (passwords, tokens, secrets, PII)

❌ **Don't log on every query in production** - use debug level or only log slow queries

### Serializers

Pino includes built-in serializers for common objects:
- `err` - Error objects (includes stack traces)
- `req` - Express request objects (sanitized)
- `res` - Express response objects (sanitized)

```typescript
logger.error({ err: new Error('Something went wrong') }, 'Error occurred');
logger.info({ req, res }, 'Request completed');
```

### Running with Pretty Logs (Development)

When running in development, pretty logs are automatically enabled via programmatic transport:

```bash
# Development server (pretty logs automatic)
bun run dev:backend
```

Output:
```
[14:32:15] INFO (backend): Server listening on port 3000
[14:32:16] INFO (auth): User authenticated { userId: "123" }
```

### Production Logs (Raw JSON)

In production, set `NODE_ENV=production` to emit raw JSON:

```bash
NODE_ENV=production bun run start:backend
```

Output:
```json
{"level":30,"time":1708985535000,"service":"quizforge-backend","env":"production","component":"auth","msg":"User authenticated","userId":"123"}
```

### Optional: Database-Backed Logging

For critical events that need persistence (audit trails, errors for admin dashboards), you can optionally log to the database. **Use sparingly** to avoid database bloat.

See `apps/backend/src/database/repositories/log.repository.ts` for implementation.

```typescript
import { logToDatabase } from '../database/repositories/log.repository.js';

// Only log critical events
await logToDatabase('error', 'Payment processing failed', {
  orderId: '123',
  error: err.message,
}, 'payment');
```

## Code Quality

- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier (run `bun run format` from root)
- **No console.log**: Use `logger` instead (enforced by ESLint)
- **No `any` type**: Use `unknown` with type guards

## Contributing

1. Create feature branch: `git checkout -b feat/my-feature`
2. Make changes and test: `bun test`
3. Lint and format: `bun run lint:backend && bun run format`
4. Commit: `git commit -m "feat(backend): add feature"`
5. Push and create PR

## License

AGPL-3.0 - See LICENSE file for details.
