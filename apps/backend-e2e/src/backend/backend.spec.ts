import axios from 'axios';
import { waitForPortOpen } from '@nx/node/utils';
import { describe, it, expect, beforeAll } from 'bun:test';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ?? '3333';
const baseURL = `http://${host}:${port}`;

describe('GET /health', () => {
  beforeAll(async () => {
    await waitForPortOpen(Number(port), { host });
  });

  it('should return a health payload', async () => {
    const res = await axios.get(`${baseURL}/health`);

    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
    expect(typeof res.data.timestamp).toBe('number');
  });
});
