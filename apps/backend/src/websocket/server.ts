import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from '../config/config';
import { createChildLogger } from '../config/logger';
import { socketAuthMiddleware } from './middleware/socket-auth';
import { registerGameNamespace } from './namespaces/game.namespace';

const websocketLogger = createChildLogger('websocket');

/**
 * Configures and attaches the Socket.IO server to an HTTP server.
 * @param httpServer - Running HTTP server instance.
 * @returns Socket.IO server instance.
 */
export function setupWebsocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.FRONTEND_URL,
      credentials: true,
    },
  });

  const gameNamespace = io.of('/game');
  gameNamespace.use(socketAuthMiddleware);
  registerGameNamespace(gameNamespace);

  websocketLogger.info({ namespace: '/game' }, 'WebSocket server configured');
  return io;
}
