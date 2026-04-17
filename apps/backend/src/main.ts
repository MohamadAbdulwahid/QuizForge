import express from 'express';
import cors from 'cors';
import { existsSync, readFileSync } from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/config';
import { logger } from './config/logger';
import { errorHandler } from './api/middleware/error-handler';
import { registerRoutes } from './api/routes';
import { apiVersionMiddleware } from './api/middleware/api-version';
import { setupWebsocketServer } from './websocket/server';

const app = express();

// Global middleware
app.use(express.json());
app.use(cors({ origin: config.FRONTEND_URL, credentials: true }));

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const swaggerPath = `${process.cwd()}/src/assets/swagger.json`;

const readSwaggerSpec = (): Record<string, unknown> | null => {
  if (!existsSync(swaggerPath)) {
    return null;
  }

  const content = readFileSync(swaggerPath, 'utf-8');
  return JSON.parse(content) as Record<string, unknown>;
};

// API docs from generated swagger file, if available.
app.get('/api-docs.json', (_req, res) => {
  const spec = readSwaggerSpec();

  if (!spec) {
    res.status(404).json({
      error: 'Swagger file not found. Run `bun run generate:api-docs` from workspace root.',
      code: 'SWAGGER_NOT_GENERATED',
      statusCode: 404,
    });
    return;
  }

  res.status(200).json(spec);
});

app.use('/api-docs', swaggerUi.serve, (req, res, next) => {
  const spec = readSwaggerSpec();

  if (!spec) {
    res.status(404).json({
      error: 'Swagger file not found. Run `bun run generate:api-docs` from workspace root.',
      code: 'SWAGGER_NOT_GENERATED',
      statusCode: 404,
    });
    return;
  }

  const middleware = swaggerUi.setup(spec, {
    explorer: true,
    swaggerOptions: {
      docExpansion: 'list',
    },
  });

  middleware(req, res, next);
});

// API routes with versioning
app.use('/api', apiVersionMiddleware, registerRoutes());

// Global error handler (must be last)
app.use(errorHandler);

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Server listening');
});
const io = setupWebsocketServer(server);

server.on('error', (err) => {
  logger.error({ err }, 'Server error');
});
server.on('close', () => {
  io.close();
});

export { app, io };
