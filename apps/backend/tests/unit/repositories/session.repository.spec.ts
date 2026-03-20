import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

const mockDb = {
  insert: mock(),
  select: mock(),
  update: mock(),
};

mock.module('../../../src/database/client', () => ({
  db: mockDb,
}));

const repository = await import('../../../src/database/repositories/session.repository');

describe('session repository', () => {
  beforeEach(() => {
    mockDb.insert.mockReset();
    mockDb.select.mockReset();
    mockDb.update.mockReset();
  });

  afterAll(() => {
    mock.restore();
  });

  it('createSession inserts and returns created row', async () => {
    const returning = mock(async () => [{ id: 1, pin: '123456' }]);
    const values = mock(() => ({ returning }));
    mockDb.insert.mockReturnValue({ values });

    const result = await repository.createSession({
      quizId: 1,
      pin: '123456',
      hostId: 'u1',
    });

    expect(result.id).toBe(1);
    expect(values).toHaveBeenCalled();
  });

  it('findByPin returns session when found', async () => {
    const limit = mock(async () => [{ id: 1, pin: '123456' }]);
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    mockDb.select.mockReturnValue({ from });

    const result = await repository.findByPin('123456');
    expect(result?.pin).toBe('123456');
  });

  it('findByPin returns null for missing pin', async () => {
    const limit = mock(async () => []);
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    mockDb.select.mockReturnValue({ from });

    const result = await repository.findByPin('000000');
    expect(result).toBeNull();
  });

  it('updateStatus updates and returns row', async () => {
    const returning = mock(async () => [{ id: 1, status: 'ended' }]);
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    mockDb.update.mockReturnValue({ set });

    const result = await repository.updateStatus(1, 'ended');
    expect(result?.status).toBe('ended');
  });

  it('pinExists returns true when row exists', async () => {
    const limit = mock(async () => [{ id: 1 }]);
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    mockDb.select.mockReturnValue({ from });

    const result = await repository.pinExists('123456');
    expect(result).toBe(true);
  });
});
