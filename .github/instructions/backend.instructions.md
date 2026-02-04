---
applyTo: "apps/backend/**/*.ts"
---

# QuizForge Backend Instructions (Bun + Express + PostgreSQL)

## Technology Stack
- **Runtime**: Bun v1.3.8+ (latest stable)
- **Framework**: Express v5.2.1+
- **Database**: PostgreSQL v14+ (via Supabase)
- **ORM/Query Builder**: Drizzle ORM (latest) with `postgres-js` driver
- **Connection Pooling**: Supabase Supavisor (Transaction mode)
- **Authentication**: Supabase Auth (built-in JWT, session management, RLS)
- **WebSockets**: Socket.IO v4.7+
- **Testing**: Bun Test Runner (built-in, no config needed)
- **API Documentation**: Tspec v1.0+ (code-first Swagger)
- **Validation**: Zod v3.23+ for runtime type safety
- **Logging**: Pino (high-performance JSON logger)
- **Migrations**: Supabase CLI (`supabase migration`, `supabase db push`)
- **Environment**: `.env` file with Supabase credentials and app config

## Project Structure
```
apps/backend/
├── src/
│   ├── api/
│   │   ├── middleware/     # Auth, error handling, validation, rate limiting
│   │   │   ├── auth.ts
│   │   │   ├── error-handler.ts
│   │   │   ├── rate-limiter.ts
│   │   │   └── validation.ts
│   │   ├── controllers/    # Route handlers (1 file per resource)
│   │   │   ├── quiz.controller.ts
│   │   │   ├── session.controller.ts
│   │   │   └── user.controller.ts
│   │   ├── routes/         # Route definitions
│   │   │   ├── index.ts
│   │   │   ├── quiz.routes.ts
│   │   │   └── session.routes.ts
│   │   ├── services/       # Business logic (pure functions)
│   │   │   ├── scoring.service.ts
│   │   │   └── game-mode.service.ts
│   │   └── dtos/           # Zod validation schemas
│   │       ├── quiz.dto.ts
│   │       └── session.dto.ts
│   ├── game/
│   │   ├── modes/          # Competitive mode implementations
│   │   │   ├── hot-potato.engine.ts
│   │   │   ├── double-agent.engine.ts
│   │   │   └── king-of-hill.engine.ts
│   │   ├── engine/         # Core game loop logic
│   │   │   ├── game-session.ts
│   │   │   └── game-state.ts
│   │   └── utils/          # Game-specific helpers
│   │       └── leaderboard.ts
│   ├── database/
│   │   ├── schema/         # Drizzle schema definitions
│   │   │   ├── quizzes.ts
│   │   │   ├── sessions.ts
│   │   │   └── users.ts
│   │   ├── repositories/   # Type-safe data access (1 per entity)
│   │   │   ├── quiz.repository.ts
│   │   │   ├── session.repository.ts
│   │   │   └── user.repository.ts
│   │   ├── client.ts       # Drizzle database client
│   │   └── migrations/     # Drizzle Kit generated migrations
│   ├── websocket/
│   │   ├── handlers/       # Socket.IO event handlers
│   │   │   ├── game.handler.ts
│   │   │   ├── lobby.handler.ts
│   │   │   └── player.handler.ts
│   │   ├── rooms.ts        # Room management logic
│   │   └── validation.ts   # Socket message validation (Zod)
│   ├── config/
│   │   ├── environment.ts  # Environment validation
│   │   ├── logger.ts       # Structured logging
│   │   └── database.ts     # Database connection pool
│   ├── shared/
│   │   ├── types.ts        # Shared type definitions
│   │   └── constants.ts    # Backend constants
│   ├── app.ts              # Express app factory
│   └── server.ts           # Server entry point
├── tests/
│   ├── unit/               # Unit tests (mirror src structure)
│   ├── integration/        # Integration tests
│   └── fixtures/           # Test data fixtures
├── .env.example
├── package.json
├── tsconfig.json
├── biome.json              # Bun formatter/linter config
└── supabase/
    ├── migrations/         # SQL migration files
    └── seed.sql            # Initial test data
```

## Database Layer

### Drizzle ORM Setup

**Dependencies** (add to `apps/backend/package.json`):
- `drizzle-orm` - ORM core
- `postgres` - PostgreSQL driver (postgres-js)
- `drizzle-kit` - Migration toolkit (dev dependency)

### Database Client Configuration
```typescript
// apps/backend/src/database/client.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { logger } from '../config/logger';

// Disable prefetch as it's not supported for "Transaction" pool mode (Supavisor)
const queryClient = postgres(process.env.DATABASE_URL!, { 
  prepare: false,
  max: 10, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, {
  logger: process.env.NODE_ENV === 'development',
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing database connections');
  await queryClient.end();
  process.exit(0);
});
```

### Drizzle Schema Definitions
```typescript
// apps/backend/src/database/schema/quizzes.ts
import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';

export const questionTypeEnum = pgEnum('question_type', [
  'multiple-choice',
  'true-false',
  'open',
]);

export const quizzes = pgTable('quizzes', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  shareCode: text('share_code').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const questions = pgTable('questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  quizId: uuid('quiz_id')
    .notNull()
    .references(() => quizzes.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  type: questionTypeEnum('type').notNull(),
  options: jsonb('options'),
  correctAnswer: text('correct_answer').notNull(),
  timeLimit: integer('time_limit').default(30), // seconds
  points: integer('points').default(100),
  order: integer('order').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Drizzle Transactions
```typescript
// apps/backend/src/database/client.ts (continued)

/**
 * Execute operations in a transaction
 * Automatically commits on success, rolls back on error
 * 
 * Usage:
 * const result = await db.transaction(async (tx) => {
 *   const user = await tx.insert(users).values({...}).returning();
 *   await tx.insert(quizzes).values({ creatorId: user.id });
 *   return user;
 * });
 */
export type Transaction = typeof db.$inferSelect;
```

### Repository Pattern with Drizzle
```typescript
// apps/backend/src/database/repositories/quiz.repository.ts
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../client';
import { quizzes, questions } from '../schema/quizzes';
import type { IQuiz, IQuestion } from '@quizforge/shared/models';

export class QuizRepository {
  /**
   * Find quiz by ID with all questions
   */
  async findById(id: string): Promise<IQuiz | null> {
    const quiz = await db.query.quizzes.findFirst({
      where: eq(quizzes.id, id),
      with: {
        questions: {
          orderBy: [desc(questions.order)],
        },
      },
    });

    return quiz || null;
  }

  /**
   * Find quiz by share code
   */
  async findByShareCode(shareCode: string): Promise<IQuiz | null> {
    return await db.query.quizzes.findFirst({
      where: eq(quizzes.shareCode, shareCode),
      with: {
        questions: true,
      },
    });
  }

  /**
   * Create quiz with questions in a transaction
   */
  async create(quiz: {
    title: string;
    description?: string;
    creatorId: string;
    questions: Array<Omit<IQuestion, 'id' | 'quizId'>>;
  }): Promise<{ quizId: string; shareCode: string }> {
    return await db.transaction(async (tx) => {
      // Generate unique share code
      const shareCode = this.generateShareCode();

      // Insert quiz
      const [newQuiz] = await tx
        .insert(quizzes)
        .values({
          title: quiz.title,
          description: quiz.description,
          creatorId: quiz.creatorId,
          shareCode,
        })
        .returning();

      // Insert questions
      if (quiz.questions.length > 0) {
        await tx.insert(questions).values(
          quiz.questions.map((q, index) => ({
            quizId: newQuiz.id,
            text: q.text,
            type: q.type,
            options: q.options,
            correctAnswer: q.correctAnswer,
            timeLimit: q.timeLimit || 30,
            points: q.points || 100,
            order: index,
          }))
        );
      }

      return { quizId: newQuiz.id, shareCode: newQuiz.shareCode };
    });
  }

  /**
   * Get all quizzes by creator
   */
  async findByCreator(creatorId: string): Promise<IQuiz[]> {
    return await db.query.quizzes.findMany({
      where: eq(quizzes.creatorId, creatorId),
      orderBy: [desc(quizzes.createdAt)],
      with: {
        questions: true,
      },
    });
  }

  /**
   * Generate random 8-character share code
   */
  private generateShareCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
}
```

## Supabase Auth Integration

### Stateless JWT Authentication Pattern

**Philosophy**: The server is stateless. Supabase Auth handles user identity and issues JWTs. Your Bun backend only validates the JWT signature—it doesn't store sessions in memory or database.

**The Token IS the Session**: When a user logs in via Supabase Auth, they receive a JWT. The browser sends this token in every request's `Authorization` header.

### Setup Supabase Client
```typescript
// apps/backend/src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false, // Server-side doesn't need auto-refresh
      persistSession: false,   // No session persistence on server
      detectSessionInUrl: false,
    },
  }
);

// Admin client for server-side operations (user management, etc.)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

logger.info('Supabase clients initialized');
```

### Auth Middleware
```typescript
// apps/backend/src/api/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../config/logger';
import type { User } from '@supabase/supabase-js';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Validates JWT token from Authorization header
 * Extracts user info from Supabase Auth
 * 
 * Server is STATELESS - just validates the token signature
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ 
      error: 'Missing or invalid authorization header', 
      code: 'UNAUTHORIZED' 
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Invalid token', { error: error?.message, ip: req.ip });
      res.status(401).json({ 
        error: 'Invalid or expired token', 
        code: 'INVALID_TOKEN' 
      });
      return;
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth middleware error', { error, ip: req.ip });
    res.status(500).json({ 
      error: 'Authentication failed', 
      code: 'AUTH_ERROR' 
    });
  }
}

/**
 * Optional middleware for admin-only routes
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    return;
  }

  // Check user metadata for admin role
  const isAdmin = req.user.user_metadata?.role === 'admin';
  
  if (!isAdmin) {
    res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
    return;
  }

  next();
}
```

### WebSocket Authentication
```typescript
// apps/backend/src/websocket/middleware/auth.ts
import { Socket } from 'socket.io';
import { supabase } from '../../config/supabase';
import { logger } from '../../config/logger';

/**
 * Authenticate WebSocket connections using Supabase JWT
 * Token should be passed in socket.handshake.auth.token
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('WebSocket auth failed', { 
        error: error?.message, 
        socketId: socket.id 
      });
      return next(new Error('Authentication error: Invalid token'));
    }

    // Attach user to socket data
    socket.data.user = user;
    next();
  } catch (error) {
    logger.error('WebSocket auth error', { error, socketId: socket.id });
    next(new Error('Authentication error'));
  }
}
```

### Example: Protected Route
```typescript
// apps/backend/src/api/controllers/quiz.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { QuizRepository } from '../../database/repositories/quiz.repository';
import { logger } from '../../config/logger';

export class QuizController {
  /**
   * @tag quiz
   * @summary Create a new quiz
   * @post /api/quizzes
   * @security BearerAuth
   * @header API-Version 1.0
   */
  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id; // Guaranteed by authMiddleware

    try {
      const repo = new QuizRepository();
      const { quizId, shareCode } = await repo.create({
        title: req.body.title,
        description: req.body.description,
        creatorId: userId,
        questions: req.body.questions,
      });

      logger.info('Quiz created', { quizId, userId });
      res.status(201).json({ quizId, shareCode });
    } catch (error) {
      logger.error('Failed to create quiz', { error, userId });
      res.status(500).json({ 
        error: 'Failed to create quiz', 
        code: 'CREATE_FAILED' 
      });
    }
  }
}
```

### Client-Side Integration Example
```typescript
// Frontend example: How to use the token
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Login
const { data: { session } } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// Use session token for API calls
const response = await fetch('/api/quizzes', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'API-Version': '1.0',
    'Content-Type': 'application/json',
  },
  method: 'POST',
  body: JSON.stringify({ title: 'My Quiz', questions: [...] }),
});

// For WebSocket
const socket = io('http://localhost:3000', {
  auth: { token: session.access_token },
});
```

## API Versioning Strategy

**QuizForge uses HEADER-BASED versioning, NOT path-based versioning.**

### Version Middleware
```typescript
// apps/backend/src/api/middleware/api-version.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';

const SUPPORTED_VERSIONS = ['1.0'];
const DEFAULT_VERSION = '1.0';

export function apiVersionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestedVersion = req.headers['api-version'] as string || DEFAULT_VERSION;

  if (!SUPPORTED_VERSIONS.includes(requestedVersion)) {
    logger.warn('Unsupported API version requested', { requestedVersion });
    res.status(400).json({
      error: 'Unsupported API version',
      code: 'INVALID_API_VERSION',
      supportedVersions: SUPPORTED_VERSIONS,
    });
    return;
  }

  // Attach version to request for downstream use
  (req as any).apiVersion = requestedVersion;
  
  // Set response header to indicate version used
  res.setHeader('API-Version', requestedVersion);
  
  next();
}
```

## Express App Configuration

### Application Factory Pattern
```typescript
// apps/backend/src/app.ts
import express, { Application, json, urlencoded } from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import { config } from './config/environment';
import { errorHandler } from './api/middleware/error-handler';
import { requestLogger } from './api/middleware/request-logger';
import { rateLimiter } from './api/middleware/rate-limiter';
import { apiVersionMiddleware } from './api/middleware/api-version';
import { authMiddleware } from './api/middleware/auth';
import { registerRoutes } from './api/routes';
import { registerSocketHandlers } from './websocket/handlers';
import { logger } from './config/logger';

export function createApp(): { app: Application; server: Server; io: Server } {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: config.frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    allowEIO3: true,
    pingTimeout: 60000, // 60s ping timeout
    pingInterval: 25000, // 25s ping interval
  });

  // Global middleware
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use(rateLimiter);
  app.use(cors({ origin: config.frontendUrl, credentials: true }));

  // Health check
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));
  
  // API routes with versioning and authentication
  app.use('/api', apiVersionMiddleware, authMiddleware, registerRoutes());

  // Global error handling (MUST be last)
  app.use(errorHandler);

  // WebSocket handlers
  registerSocketHandlers(io);

  return { app, server, io };
}
```

## Tspec API Documentation (Code-First)

### Define DTOs with Zod
```typescript
// apps/backend/src/api/dtos/quiz.dto.ts
import { z } from 'zod';

export const QuestionSchema = z.object({
  text: z.string().min(1).max(500),
  type: z.enum(['multiple-choice', 'true-false', 'open']),
  options: z.array(z.object({
    id: z.string(),
    text: z.string(),
  })).optional(),
  correctAnswer: z.string(),
});

export const CreateQuizRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  questions: z.array(QuestionSchema).min(1).max(100),
});

export type CreateQuizRequest = z.infer<typeof CreateQuizRequestSchema>;

export const CreateQuizResponseSchema = z.object({
  quizId: z.string().uuid(),
  shareCode: z.string().length(8),
});

export type CreateQuizResponse = z.infer<typeof CreateQuizResponseSchema>;
```

### Controller with Tspec and Drizzle
```typescript
// apps/backend/src/api/controllers/quiz.controller.ts
import { Response } from 'express';
import type { Tspec } from 'tspec';
import { AuthenticatedRequest } from '../middleware/auth';
import { CreateQuizRequestSchema, CreateQuizResponseSchema } from '../dtos/quiz.dto';
import { QuizRepository } from '../../database/repositories/quiz.repository';
import { logger } from '../../config/logger';

export class QuizController {
  /**
   * @tag quiz
   * @summary Create a new quiz
   * @post /api/quizzes
   * @security BearerAuth
   * @header API-Version 1.0
   * @example body {
   *   "title": "Science Quiz",
   *   "description": "Basic science questions",
   *   "questions": [...]
   * }
   */
  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    // Validate input
    const parseResult = CreateQuizRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.errors,
      });
      return;
    }

    const userId = req.user!.id;

    try {
      const repo = new QuizRepository();
      const { quizId, shareCode } = await repo.create({
        title: parseResult.data.title,
        description: parseResult.data.description,
        creatorId: userId,
        questions: parseResult.data.questions,
      });

      logger.info('Quiz created', { quizId, userId });
      
      res.status(201).json({ quizId, shareCode });
    } catch (error) {
      logger.error('Failed to create quiz', { error, userId });
      res.status(500).json({
        error: 'Failed to create quiz',
        code: 'CREATE_FAILED',
      });
    }
  }
}
```

### Generate Swagger
```bash
# Add to package.json scripts
"generate:api-docs": "tspec-to-swagger src/api/controllers/*.ts > dist/swagger.json"
```

## WebSocket Protocol

### Event Standards
```typescript
// apps/backend/src/shared/socket-events.ts
export interface ServerToClientEvents {
  'question': (question: IQuestion) => void;
  'score-update': (update: ScoreUpdate) => void;
  'player-joined': (player: PlayerInfo) => void;
  'player-left': (playerId: string) => void;
  'game-state': (state: GameState) => void;
  'error': (error: { message: string; code: string }) => void;
  'game-ended': (results: GameResults) => void;
}

export interface ClientToServerEvents {
  'join-game': (data: { pin: string; username: string }) => void;
  'submit-answer': (data: { answer: string; questionId: string }) => void;
  'leave-game': () => void;
  'request-hint': (data: { questionId: string }) => void;
}

// Validation schemas
import { z } from 'zod';

export const JoinGameSchema = z.object({
  pin: z.string().length(6).regex(/^[A-Z0-9]+$/),
  username: z.string().min(1).max(20).regex(/^[a-zA-Z0-9_-]+$/),
});

export const SubmitAnswerSchema = z.object({
  answer: z.string(),
  questionId: z.string().uuid(),
});
```

### Socket.IO Handlers
```typescript
// apps/backend/src/websocket/handlers/game.handler.ts
import { Server, Socket } from 'socket.io';
import { eq, and } from 'drizzle-orm';
import { validateMessage } from '../validation';
import { JoinGameSchema, SubmitAnswerSchema } from '../../shared/socket-events';
import { db } from '../../database/client';
import { sessions, sessionPlayers, questions } from '../../database/schema';
import { logger } from '../../config/logger';

export function registerGameHandlers(io: Server, socket: Socket): void {
  socket.on('join-game', async (data) => {
    try {
      // Validate message format
      const validated = validateMessage(JoinGameSchema, data);
      
      // Check if session exists and is waiting for players
      const session = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.pin, validated.pin),
          eq(sessions.status, 'waiting')
        ),
      });

      if (!session) {
        socket.emit('error', { 
          message: 'Session not found or already started', 
          code: 'SESSION_NOT_FOUND' 
        });
        return;
      }

      // Check username uniqueness
      const existingPlayer = await db.query.sessionPlayers.findFirst({
        where: and(
          eq(sessionPlayers.sessionId, session.id),
          eq(sessionPlayers.username, validated.username)
        ),
      });

      if (existingPlayer) {
        socket.emit('error', { 
          message: 'Username already taken', 
          code: 'USERNAME_TAKEN' 
        });
        return;
      }

      // Add player to session
      await db.transaction(async (tx) => {
        await tx.insert(sessionPlayers).values({
          sessionId: session.id,
          username: validated.username,
          socketId: socket.id,
          score: 0,
        });
      });

      // Join Socket.IO room
      await socket.join(validated.pin);
      
      // Notify other players
      socket.to(validated.pin).emit('player-joined', {
        id: socket.id,
        username: validated.username,
        score: 0,
      });

      // Send current state to new player
      const players = await db.query.sessionPlayers.findMany({
        where: eq(sessionPlayers.sessionId, session.id),
      });

      socket.emit('game-state', {
        status: session.status,
        players: players.map(p => ({
          id: p.socketId,
          username: p.username,
          score: p.score,
        })),
      });

      logger.info('Player joined game', { 
        pin: validated.pin, 
        username: validated.username,
        socketId: socket.id,
      });
    } catch (error) {
      logger.error('Join game error', { error, socketId: socket.id });
      socket.emit('error', { 
        message: 'Failed to join game', 
        code: 'JOIN_ERROR' 
      });
    }
  });

  socket.on('submit-answer', async (data) => {
    try {
      const validated = validateMessage(SubmitAnswerSchema, data);
      const userId = socket.data.user?.id;

      if (!userId) {
        socket.emit('error', { 
          message: 'Not authenticated', 
          code: 'UNAUTHORIZED' 
        });
        return;
      }

      // Get question details for scoring
      const question = await db.query.questions.findFirst({
        where: eq(questions.id, validated.questionId),
      });

      if (!question) {
        socket.emit('error', { 
          message: 'Question not found', 
          code: 'QUESTION_NOT_FOUND' 
        });
        return;
      }

      // Calculate score based on correctness and time
      const isCorrect = validated.answer === question.correctAnswer;
      const basePoints = question.points || 100;
      const earnedPoints = isCorrect ? basePoints : 0;

      // Update player score
      await db.transaction(async (tx) => {
        const player = await tx.query.sessionPlayers.findFirst({
          where: eq(sessionPlayers.socketId, socket.id),
        });

        if (player) {
          await tx
            .update(sessionPlayers)
            .set({ score: player.score + earnedPoints })
            .where(eq(sessionPlayers.id, player.id));
        }
      });

      // Emit score update
      socket.emit('score-update', {
        questionId: validated.questionId,
        correct: isCorrect,
        points: earnedPoints,
      });

      logger.info('Answer submitted', { 
        socketId: socket.id, 
        questionId: validated.questionId,
        correct: isCorrect,
        points: earnedPoints,
      });
    } catch (error) {
      logger.error('Submit answer error', { error, socketId: socket.id });
      socket.emit('error', { 
        message: 'Failed to submit answer', 
        code: 'SUBMIT_ERROR' 
      });
    }
  });
}
```

## Testing Standards

### Bun Test Runner Setup
```typescript
// apps/backend/src/tests/setup.ts
import { sql } from 'drizzle-orm';
import { db } from '../database/client';
import { quizzes, questions, sessions, sessionPlayers } from '../database/schema';

/**
 * Cleanup test database
 * Truncates all tables in correct order (respects foreign keys)
 */
export async function cleanupDatabase(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE session_players, sessions, questions, quizzes CASCADE
  `);
}

/**
 * Seed test data
 */
export async function seedTestData() {
  const [testUser] = await db.insert(users).values({
    email: 'test@example.com',
    username: 'testuser',
  }).returning();

  const [testQuiz] = await db.insert(quizzes).values({
    title: 'Test Quiz',
    description: 'A quiz for testing',
    creatorId: testUser.id,
    shareCode: 'TEST1234',
  }).returning();

  return { testUser, testQuiz };
}
```

### Unit Tests
```typescript
// apps/backend/src/tests/unit/repositories/quiz.repository.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { QuizRepository } from '../../../src/database/repositories/quiz.repository';
import { db } from '../../../src/database/client';
import { quizzes, questions } from '../../../src/database/schema/quizzes';
import { cleanupDatabase } from '../setup';

describe('QuizRepository', () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it('should create and retrieve a quiz', async () => {
    const repo = new QuizRepository();
    
    const { quizId, shareCode } = await repo.create({
      title: 'Test Quiz',
      description: 'Test description',
      creatorId: 'user-123',
      questions: [
        {
          text: 'What is 2+2?',
          type: 'multiple-choice',
          options: [{ id: 'a', text: '3' }, { id: 'b', text: '4' }],
          correctAnswer: 'b',
          timeLimit: 30,
          points: 100,
        },
      ],
    });

    expect(quizId).toBeDefined();
    expect(shareCode).toHaveLength(8);

    const quiz = await repo.findById(quizId);
    expect(quiz).not.toBeNull();
    expect(quiz!.title).toBe('Test Quiz');
    expect(quiz!.questions).toHaveLength(1);
  });

  it('should return null for non-existent quiz', async () => {
    const repo = new QuizRepository();
    const result = await repo.findById('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('should handle transaction rollback on error', async () => {
    const repo = new QuizRepository();
    
    await expect(async () => {
      await db.transaction(async (tx) => {
        await tx.insert(quizzes).values({
          title: 'Test',
          creatorId: 'user-123',
          shareCode: 'TEST1234',
        });
        throw new Error('Simulated error');
      });
    }).toThrow();

    // Verify no quiz was created
    const allQuizzes = await db.select().from(quizzes);
    expect(allQuizzes).toHaveLength(0);
  });
});
```

### Integration Tests
```typescript
// apps/backend/src/tests/integration/game-flow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApp } from '../../../src/app';
import { Server } from 'http';
import { io as Client } from 'socket.io-client';

describe('Game Flow Integration', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { server: srv, app } = createApp();
    server = srv;
    baseUrl = 'http://localhost:3001';
    server.listen(3001);
  });

  afterAll(async () => {
    server.close();
  });

  it('should complete full game session', async () => {
    // 1. Host creates quiz
    const createResponse = await fetch(`${baseUrl}/api/v1/quizzes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Integration Test Quiz',
        questions: [
          {
            text: 'What is 2+2?',
            type: 'multiple-choice',
            options: [{ id: 'a', text: '3' }, { id: 'b', text: '4' }],
            correctAnswer: 'b',
          },
        ],
      }),
    });

    expect(createResponse.ok).toBe(true);
    const { quizId } = await createResponse.json();

    // 2. Host creates session
    const sessionResponse = await fetch(`${baseUrl}/api/v1/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quizId }),
    });

    expect(sessionResponse.ok).toBe(true);
    const { pin } = await sessionResponse.json();
    expect(pin).toHaveLength(6);

    // 3. Player joins via WebSocket
    const playerSocket = Client(baseUrl, { transports: ['websocket'] });
    
    const joinPromise = new Promise<void>((resolve) => {
      playerSocket.emit('join-game', { pin, username: 'TestPlayer' }, (response: any) => {
        expect(response.success).toBe(true);
        resolve();
      });
    });

    await joinPromise;

    // 4. Host starts game
    const hostSocket = Client(baseUrl, { transports: ['websocket'] });
    hostSocket.emit('start-game', { pin });

    // 5. Player receives question
    const questionPromise = new Promise<void>((resolve) => {
      playerSocket.once('question', (question: any) => {
        expect(question.text).toBe('What is 2+2?');
        resolve();
      });
    });

    await questionPromise;

    // Cleanup
    playerSocket.disconnect();
    hostSocket.disconnect();
  });
});
```

## Performance & Scalability

### Supabase Connection Pooling (Supavisor)
```typescript
// apps/backend/src/config/database.ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

/**
 * Supabase uses Supavisor for connection pooling
 * 
 * Two modes:
 * - Transaction mode (recommended for serverless): Port 6543
 * - Session mode (for long-lived connections): Port 5432
 * 
 * We use Transaction mode with `prepare: false`
 */
const connectionString = process.env.DATABASE_URL!;

// Connection pool configuration
const queryClient = postgres(connectionString, {
  prepare: false,      // Required for Transaction mode
  max: 10,             // Max connections in pool
  idle_timeout: 20,    // Close idle connections after 20s
  connect_timeout: 10, // Connection timeout in seconds
});

export const db = drizzle(queryClient);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connections');
  await queryClient.end();
  process.exit(0);
});
```

**Key Points:**
- Use **Transaction mode** (port 6543) for API workloads
- Set `prepare: false` to disable prepared statements (required for pooler)
- Supavisor handles connection multiplexing automatically
- No need for manual connection pool management

### Rate Limiting
```typescript
// apps/backend/src/api/middleware/rate-limiter.ts
import { rateLimit } from 'express-rate-limit';
import { logger } from '../../config/logger';

/**
 * ARCHITECTURAL DECISION: Rate Limit Store
 * 
 * Options:
 * 1. Memory store (current): Simple, works for single-server deployments
 * 2. Redis store: Required for multi-server/load-balanced deployments
 * 
 * Current: Using memory store for MVP
 * Future: Switch to Redis when scaling horizontally
 */
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ 
      error: 'Too many requests', 
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
    });
  },
});

/**
 * WebSocket Rate Limiter
 * 
 * ARCHITECTURAL DECISION: Per-client event rate limiting
 * 
 * Options:
 * 1. Simple throttle: Limit events per second (current)
 * 2. Token bucket: More sophisticated rate limiting
 * 3. Redis-based: Distributed rate limiting
 * 
 * Current: Simple in-memory throttle for MVP
 * Implementation: Track last event time per socket ID
 */
const socketEventTimes = new Map<string, number>();
const EVENT_THROTTLE_MS = 100; // Max 10 events/second

export function wsRateLimiter(socket: any, next: Function): void {
  const socketId = socket.id;
  const now = Date.now();
  const lastEvent = socketEventTimes.get(socketId) || 0;

  if (now - lastEvent < EVENT_THROTTLE_MS) {
    socket.emit('error', {
      message: 'Too many events, please slow down',
      code: 'RATE_LIMIT',
    });
    return; // Don't call next(), event is dropped
  }

  socketEventTimes.set(socketId, now);
  next();

  // Cleanup old entries periodically
  if (socketEventTimes.size > 10000) {
    const cutoff = now - 60000;
    for (const [id, time] of socketEventTimes.entries()) {
      if (time < cutoff) socketEventTimes.delete(id);
    }
  }
}
```

### Memory Management for Game Sessions
```typescript
// apps/backend/src/game/engine/session-manager.ts
export class SessionManager {
  private static sessions = new Map<string, GameSession>();
  private static readonly MAX_SESSION_AGE = 1000 * 60 * 60 * 2; // 2 hours
  private static readonly MAX_SESSIONS = 1000; // Memory limit
  
  /**
   * Get or create session
   */
  static getOrCreate(pin: string): GameSession {
    let session = this.sessions.get(pin);
    
    if (!session) {
      if (this.sessions.size >= this.MAX_SESSIONS) {
        this.cleanupOldestSession();
      }
      
      session = new GameSession(pin);
      this.sessions.set(pin, session);
    }
    
    return session;
  }
  
  /**
   * Cleanup expired sessions every 5 minutes
   */
  static startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [pin, session] of this.sessions.entries()) {
        if (now - session.lastActivity > this.MAX_SESSION_AGE) {
          this.sessions.delete(pin);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        logger.info('Cleaned up expired sessions', { cleaned, remaining: this.sessions.size });
      }
    }, 5 * 60 * 1000);
  }
  
  private static cleanupOldestSession(): void {
    let oldest: { pin: string; time: number } | null = null;
    
    for (const [pin, session] of this.sessions.entries()) {
      if (!oldest || session.lastActivity < oldest.time) {
        oldest = { pin, time: session.lastActivity };
      }
    }
    
    if (oldest) {
      this.sessions.delete(oldest.pin);
    }
  }
}
```

## Supabase & Migrations

### Drizzle Kit Configuration

Create `apps/backend/drizzle.config.ts`:
- **schema**: `./src/database/schema/*`
- **out**: `./src/database/migrations`
- **driver**: `pg` (PostgreSQL)
- **dbCredentials**: Use `DATABASE_URL` from environment

### Migration Workflow

**Primary Approach: Supabase CLI (Recommended)**
```bash
# Initialize Supabase in your project (first time only)
bunx supabase init

# Start local Supabase (includes Postgres, Auth, Storage, etc.)
bunx supabase start

# Create new migration
bunx supabase migration new create_quizzes_table

# Write your SQL in supabase/migrations/XXXXXX_create_quizzes_table.sql
# Then apply migrations
bunx supabase db reset  # Resets local DB and applies all migrations

# Generate TypeScript types from database schema
bunx supabase gen types typescript --local > libs/shared/models/src/database.types.ts

# Push migrations to remote (production)
bunx supabase db push
```

**Alternative: Drizzle Kit (For ORM-first workflow)**
```bash
# Generate migration from Drizzle schema
bunx drizzle-kit generate:pg

# Apply migrations
bunx drizzle-kit push:pg

# Open Drizzle Studio (database GUI)
bunx drizzle-kit studio
```

**Recommendation**: Use Supabase CLI for migrations to leverage RLS policies, functions, and triggers. Use Drizzle for queries and transactions.

### Example Migration
```sql
-- apps/supabase/migrations/20240115120000_create_quizzes_table.sql
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 200),
  description TEXT CHECK (length(description) <= 1000),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_quizzes_creator_id ON quizzes(creator_id);
CREATE INDEX idx_quizzes_created_at ON quizzes(created_at DESC);

-- Row Level Security (RLS) - Enable
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own quizzes and public ones
CREATE POLICY "Users can view own quizzes"
  ON quizzes FOR SELECT
  USING (creator_id = auth.uid());

-- Policy: Users can create quizzes
CREATE POLICY "Users can create quizzes"
  ON quizzes FOR INSERT
  WITH CHECK (creator_id = auth.uid());

-- Policy: Users can update own quizzes
CREATE POLICY "Users can update own quizzes"
  ON quizzes FOR UPDATE
  USING (creator_id = auth.uid());

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON quizzes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Logging Standards

### Structured Logging with Pino
```typescript
// apps/backend/src/config/logger.ts
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  
  // Pretty print in development
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Production formatting
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },

  // Base context
  base: {
    env: process.env.NODE_ENV,
  },
});

// Usage examples:
// logger.info({ quizId: '123', userId: '456' }, 'Quiz created successfully');
// logger.warn({ pin: 'ABC123' }, 'Max players reached');
// logger.error({ err: error }, 'Failed to process answer');
// logger.child({ component: 'websocket' }).info('Player connected');
```

**Dependencies**: `pino` (production), `pino-pretty` (dev - for readable logs)

## Performance Monitoring & Metrics

### Key Metrics to Track
```typescript
// apps/backend/src/config/metrics.ts
export const metrics = {
  // TODO: Replace with proper metrics solution (Prometheus, Datadog)
  connections: 0,
  activeGames: 0,
  totalAnswers: 0,
  
  incrementConnections(): void {
    this.connections++;
  },
  
  decrementConnections(): void {
    this.connections--;
  },
  
  recordAnswer(): void {
    this.totalAnswers++;
  },
  
  getStats() {
    return {
      connections: this.connections,
      activeGames: this.activeGames,
      totalAnswers: this.totalAnswers,
      memory: process.memoryUsage(),
    };
  }
};

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.json(metrics.getStats());
});
```

## Error Handling & Edge Cases

### Game Session Edge Cases
```typescript
// apps/backend/src/game/engine/edge-cases.ts

/**
 * Handle late join (player joins mid-game)
 */
export async function handleLateJoin(session: GameSession, player: Player): Promise<void> {
  // Send current question immediately if game is in progress
  if (session.status === 'playing' && session.currentQuestion) {
    player.socket.emit('question', session.currentQuestion);
  }
  
  // Send current leaderboard
  player.socket.emit('game-state', {
    players: session.getLeaderboard(),
    currentQuestionIndex: session.currentQuestionIndex,
  });
  
  // Mark as late joiner for scoring adjustments
  player.isLateJoiner = true;
  
  logger.game('Player late-joined', { pin: session.pin, username: player.username });
}

/**
 * Handle player disconnect (graceful vs timeout)
 */
export function handleDisconnect(socket: Socket, reason: string): void {
  const session = SessionManager.findBySocketId(socket.id);
  if (!session) return;

  const player = session.getPlayer(socket.id);
  if (!player) return;

  // Set disconnected state
  player.status = 'disconnected';
  player.disconnectedAt = Date.now();

  // Notify other players
  socket.to(session.pin).emit('player-left', { playerId: socket.id });

  // If host disconnects, end session
  if (player.isHost) {
    session.end('Host disconnected');
    logger.game('Session ended: host disconnected', { pin: session.pin });
  }

  // Auto-remove after 5 minutes
  setTimeout(() => {
    if (player.status === 'disconnected') {
      session.removePlayer(player.id);
    }
  }, 5 * 60 * 1000);
}

/**
 * Prevent duplicate username
 */
export async function isUsernameAvailable(pin: string, username: string): Promise<boolean> {
  const result = await withUnit(true, async (unit) => {
    return await unit.prepare<{ count: number }>(`
      SELECT COUNT(*) as count FROM session_players sp
      JOIN sessions s ON sp.session_id = s.id
      WHERE s.pin = $pin AND sp.username = $username
    `).get({ pin, username });
  });

  return result!.count === 0;
}
```

## Deployment & Environment

### Environment Validation
```typescript
// apps/backend/src/config/environment.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  
  // Database (Supabase connection string)
  DATABASE_URL: z.string().url(),
  
  // App config
  FRONTEND_URL: z.string().url(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
```

### .env.example
```bash
# apps/backend/.env.example

# Node Environment
NODE_ENV=development
PORT=3000

# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # KEEP SECRET!

# Database (use Connection Pooler - Transaction mode)
# Get from Supabase Dashboard > Project Settings > Database > Connection Pooler
DATABASE_URL=postgres://postgres.xxxxx:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Application
FRONTEND_URL=http://localhost:4200
LOG_LEVEL=info
```

## Common Pitfalls to Avoid

### Database & Transactions
- ❌ **Don't** forget to wrap multi-step operations in `db.transaction()`
- ❌ **Don't** use string interpolation in SQL (use Drizzle's query builders)
- ❌ **Don't** set `prepare: true` when using Supabase Supavisor (Transaction mode)
- ✅ **Do** use Drizzle's type-safe query builders for all database operations
- ✅ **Do** let transactions auto-commit/rollback (don't manually manage)
- ✅ **Do** use Drizzle's `returning()` to get inserted row data

### Authentication & Security
- ❌ **Don't** store sessions in server memory (stateless JWT only)
- ❌ **Don't** trust client-provided user IDs (always use `req.user.id` from JWT)
- ❌ **Don't** expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- ✅ **Do** validate JWTs on every protected route using `authMiddleware`
- ✅ **Do** use Supabase RLS policies for database-level authorization
- ✅ **Do** validate all WebSocket messages with Zod schemas

### WebSocket Best Practices
- ❌ **Don't** store sensitive data in Socket.IO handshake
- ❌ **Don't** trust client-side timestamps (use server time)
- ❌ **Don't** emit to entire `io` when `socket.to(room)` is sufficient
- ❌ **Don't** perform long-running operations in WebSocket handlers (blocks event loop)
- ✅ **Do** authenticate WebSocket connections before accepting data
- ✅ **Do** implement rate limiting per socket ID
- ✅ **Do** handle disconnections gracefully
- ✅ **Do** use rooms for game session isolation

### Logging & Debugging
- ❌ **Don't** use `console.log` in production (use Pino logger)
- ❌ **Don't** log sensitive data (passwords, tokens, full user objects)
- ✅ **Do** use structured logging with context objects
- ✅ **Do** log errors with stack traces using `logger.error({ err }, 'message')`
- ✅ **Do** use child loggers for component-specific logging

### Performance & Scalability
- ❌ **Don't** perform N+1 queries (use Drizzle's `with` for eager loading)
- ❌ **Don't** fetch entire result sets without pagination
- ✅ **Do** use Supabase connection pooler (Supavisor) for efficient connections
- ✅ **Do** implement idempotency keys for answer submissions
- ✅ **Do** clean up expired game sessions periodically
- ✅ **Do** use indexes on frequently queried columns

## Architectural Decision Notes

**These are areas requiring decisions based on scale/requirements:**

### State Management & Caching
- **Decision Needed**: When to introduce Redis
  - Use case: Distributed rate limiting across multiple servers
  - Use case: Session state for game rooms (if scaling beyond single server)
  - Use case: Real-time leaderboard caching
  - **Current**: In-memory for MVP, revisit at 1000+ concurrent users

### Background Jobs & Queue Processing
- **Decision Needed**: Task queue system
  - Options: BullMQ (Redis), pg-boss (Postgres), Supabase Edge Functions
  - Use cases: Analytics processing, session cleanup, email notifications
  - **Current**: Deferred - handle synchronously for MVP

### File Uploads (Image-based Questions)
- **Decision Needed**: File storage strategy
  - Options: Supabase Storage (recommended), S3, Cloudinary
  - Validation: File type, size limits, virus scanning
  - **Current**: Not implemented - text-only questions for MVP

### API Response Caching
- **Decision Needed**: Cache layer for read-heavy endpoints
  - Options: Redis, Supabase PostgREST caching, HTTP cache headers
  - Endpoints: Public quiz lists, leaderboards
  - **Current**: No caching - database queries are fast enough for MVP

### Monitoring & Observability
- **Decision Needed**: Production monitoring stack
  - Options: Sentry (errors), Datadog (metrics), Supabase Analytics
  - Metrics to track: Response times, error rates, WebSocket connections
  - **Current**: Pino structured logs only

### WebSocket Horizontal Scaling
- **Decision Needed**: Multi-server WebSocket synchronization
  - Options: Socket.IO Redis adapter, Supabase Realtime
  - Requirement: Only needed when scaling beyond 1 server
  - **Current**: Single server - no adapter needed for MVP

### Database Backups & DR
- **Decision Needed**: Backup automation strategy
  - Options: Supabase automatic backups (included), manual pg_dump
  - RPO/RTO targets: Define acceptable data loss window
  - **Current**: Rely on Supabase automatic backups

---

**MVP Philosophy**: Start simple, add complexity when metrics justify it. Supabase handles auth, database, and scaling primitives - leverage built-in features before building custom solutions.
