import axios from 'axios';
import { waitForPortOpen } from '@nx/node/utils';
import { describe, it, expect, beforeAll } from 'bun:test';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ?? '3333';
const baseURL = `http://${host}:${port}`;

describe('GET /api', () => {
  beforeAll(async () => {
    await waitForPortOpen(Number(port), { host });
  });

  it('should return a welcome message', async () => {
    const res = await axios.get(`${baseURL}/api`);

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ message: 'Welcome to backend!' });
  });
});
