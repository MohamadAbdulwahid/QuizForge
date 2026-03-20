import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

const mockDb = {
  insert: mock(),
  select: mock(),
  update: mock(),
  delete: mock(),
};

mock.module('../../../src/database/client', () => ({
  db: mockDb,
}));

const repository = await import('../../../src/database/repositories/quiz.repository');

describe('quiz repository', () => {
  beforeEach(() => {
    mockDb.insert.mockReset();
    mockDb.select.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  afterAll(() => {
    mock.restore();
  });

  it('create inserts and returns created quiz', async () => {
    const returning = mock(async () => [{ id: 1, title: 'Quiz' }]);
    const values = mock(() => ({ returning }));
    mockDb.insert.mockReturnValue({ values });

    const result = await repository.create({
      title: 'Quiz',
      description: 'Desc',
      creatorId: 'u1',
      shareCode: 'ABCDEFGH',
    });

    expect(result.id).toBe(1);
  });

  it('findById returns null when not found', async () => {
    const limit = mock(async () => []);
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    mockDb.select.mockReturnValue({ from });

    const result = await repository.findById(999);
    expect(result).toBeNull();
  });

  it('update returns updated quiz', async () => {
    const returning = mock(async () => [{ id: 1, title: 'Updated' }]);
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    mockDb.update.mockReturnValue({ set });

    const result = await repository.update(1, { title: 'Updated' });
    expect(result?.title).toBe('Updated');
  });

  it('deleteQuiz returns true when quiz is deleted', async () => {
    const returning = mock(async () => [{ id: 1 }]);
    const where = mock(() => ({ returning }));
    mockDb.delete.mockReturnValue({ where });

    const result = await repository.deleteQuiz(1);
    expect(result).toBe(true);
  });

  it('shareCodeExists returns false when code missing', async () => {
    const limit = mock(async () => []);
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    mockDb.select.mockReturnValue({ from });

    const result = await repository.shareCodeExists('ABCDEFGH');
    expect(result).toBe(false);
  });
});
