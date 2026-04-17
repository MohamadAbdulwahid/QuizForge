import { io } from 'socket.io-client';

const socketUrl = process.env['SOCKET_TEST_URL'] ?? 'http://localhost:3333/game';
const validToken = process.env['SOCKET_TEST_VALID_TOKEN'];

/**
 * Attempts a websocket connection with a token and prints whether it was accepted.
 * @param token - Optional auth token for handshake.
 * @param label - Output label for this test case.
 */
async function connectWithToken(token: string | undefined, label: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const socket = io(socketUrl, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      timeout: 4000,
      reconnection: false,
    });

    socket.on('connect', () => {
      console.warn(`${label}: connected`);
      socket.disconnect();
      resolve();
    });

    socket.on('connect_error', (error) => {
      console.warn(`${label}: rejected -> ${error.message}`);
      resolve();
    });
  });
}

await connectWithToken(validToken, 'valid-token');
await connectWithToken('corrupted-token', 'corrupted-token');
await connectWithToken(undefined, 'missing-token');
