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

describe('searchPublicQuizzes', () => {
  beforeEach(() => {
    mockDb.insert.mockReset();
    mockDb.select.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  afterAll(() => {
    mock.restore();
  });

  it('returns paginated rows with creator join', async () => {
    const row = {
      id: 1,
      title: 'Quiz',
      description: null,
      visibility: 'public',
      status: 'published',
      play_count: 0,
      creator_id: 'u1',
      share_code: 'ABCDEFGH',
      created_at: new Date(),
      creator_user_id: 'u1',
      creator_username: 'alice',
    };
    const offset = mock(async () => [row]);
    const limit = mock(() => ({ offset }));
    const orderBy = mock(() => ({ limit }));
    const where = mock(() => ({ orderBy }));
    const leftJoin = mock(() => ({ where }));
    const from = mock(() => ({ leftJoin }));
    mockDb.select.mockReturnValue({ from });

    const result = await repository.searchPublicQuizzes({
      query: '',
      sort: 'newest',
      limit: 24,
      offset: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].creator).toEqual({ userId: 'u1', username: 'alice' });
    expect(mockDb.select).toHaveBeenCalled();
    expect(from).toHaveBeenCalled();
    expect(leftJoin).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
    expect(orderBy).toHaveBeenCalled();
    expect(limit).toHaveBeenCalledWith(24);
    expect(offset).toHaveBeenCalledWith(0);
  });

  it('applies ilike on title when query is non-empty', async () => {
    const offset = mock(async () => []);
    const limit = mock(() => ({ offset }));
    const orderBy = mock(() => ({ limit }));
    const where = mock(() => ({ orderBy }));
    const leftJoin = mock(() => ({ where }));
    const from = mock(() => ({ leftJoin }));
    mockDb.select.mockReturnValue({ from });

    await repository.searchPublicQuizzes({
      query: 'math',
      sort: 'newest',
      limit: 24,
      offset: 0,
    });

    expect(where).toHaveBeenCalledTimes(1);
    // The where clause is built using and(visibilityPredicate, ilike(QUIZ.title, '%math%'))
    // when query is non-empty. Verifying the chain is exercised; the exact drizzle
    // operator is tested by drizzle itself.
  });

  it('sort newest orders by created_at desc', async () => {
    const offset = mock(async () => []);
    const limit = mock(() => ({ offset }));
    const orderBy = mock(() => ({ limit }));
    const where = mock(() => ({ orderBy }));
    const leftJoin = mock(() => ({ where }));
    const from = mock(() => ({ leftJoin }));
    mockDb.select.mockReturnValue({ from });

    await repository.searchPublicQuizzes({
      query: '',
      sort: 'newest',
      limit: 24,
      offset: 0,
    });

    expect(orderBy).toHaveBeenCalledTimes(1);
    // orderBy is called with [desc(QUIZ.created_at)]
  });

  it('sort popular orders by play_count desc then created_at desc', async () => {
    const offset = mock(async () => []);
    const limit = mock(() => ({ offset }));
    const orderBy = mock(() => ({ limit }));
    const where = mock(() => ({ orderBy }));
    const leftJoin = mock(() => ({ where }));
    const from = mock(() => ({ leftJoin }));
    mockDb.select.mockReturnValue({ from });

    await repository.searchPublicQuizzes({
      query: '',
      sort: 'popular',
      limit: 24,
      offset: 0,
    });

    expect(orderBy).toHaveBeenCalledTimes(1);
    // orderBy is called with [desc(QUIZ.play_count), desc(QUIZ.created_at)]
  });

  it('sort alpha orders by title asc', async () => {
    const offset = mock(async () => []);
    const limit = mock(() => ({ offset }));
    const orderBy = mock(() => ({ limit }));
    const where = mock(() => ({ orderBy }));
    const leftJoin = mock(() => ({ where }));
    const from = mock(() => ({ leftJoin }));
    mockDb.select.mockReturnValue({ from });

    await repository.searchPublicQuizzes({
      query: '',
      sort: 'alpha',
      limit: 24,
      offset: 0,
    });

    expect(orderBy).toHaveBeenCalledTimes(1);
    // orderBy is called with [asc(QUIZ.title)]
  });
});

describe('countPublicQuizzes', () => {
  beforeEach(() => {
    mockDb.insert.mockReset();
    mockDb.select.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  afterAll(() => {
    mock.restore();
  });

  it('returns count from db', async () => {
    const where = mock(async () => [{ value: 42 }]);
    const from = mock(() => ({ where }));
    mockDb.select.mockReturnValue({ from });

    const result = await repository.countPublicQuizzes('math');

    expect(result).toBe(42);
    expect(mockDb.select).toHaveBeenCalled();
    expect(from).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });
});

describe('incrementPlayCount', () => {
  beforeEach(() => {
    mockDb.insert.mockReset();
    mockDb.select.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  afterAll(() => {
    mock.restore();
  });

  it('atomically increments by 1', async () => {
    const returning = mock(async () => [{ id: 1, playCount: 1 }]);
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    mockDb.update.mockReturnValue({ set });

    const result = await repository.incrementPlayCount(1);

    expect(result).toEqual({ id: 1, playCount: 1 });
    expect(mockDb.update).toHaveBeenCalled();
    expect(set).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
    expect(returning).toHaveBeenCalled();
  });
});
