import express from 'express';
import cors from 'cors';
import { config } from './config/config';
import { logger } from './config/logger';
import { apiVersionMiddleware } from './api/middleware/api-version';
import { errorHandler } from './api/middleware/error-handler';
import { authRoutes } from './api/routes/auth.routes';

const app = express();

// Global middleware
app.use(express.json());
app.use(cors({ origin: config.FRONTEND_URL, credentials: true }));

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// API routes with versioning
app.use('/api/auth', apiVersionMiddleware, authRoutes);

// Global error handler (must be last)
app.use(errorHandler);

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Server listening');
});
server.on('error', (err) => {
  logger.error({ err }, 'Server error');
});

export { app };
