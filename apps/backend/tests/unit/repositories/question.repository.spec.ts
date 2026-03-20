import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

const mockDb = {
  insert: mock(),
  select: mock(),
  update: mock(),
  delete: mock(),
  transaction: mock(),
};

mock.module('../../../src/database/client', () => ({
  db: mockDb,
}));

const repository = await import('../../../src/database/repositories/question.repository');

describe('question repository', () => {
  beforeEach(() => {
    Object.values(mockDb).forEach((fn) => fn.mockReset());
  });

  afterAll(() => {
    mock.restore();
  });

  it('createMany assigns order_index and quiz_id', async () => {
    mockDb.transaction.mockImplementation(async (handler: (tx: unknown) => unknown) => {
      const tx = {
        insert: () => ({
          values: (values: Array<{ order_index: number; quiz_id: number }>) => ({
            returning: async () => values,
          }),
        }),
      };
      return handler(tx);
    });

    const result = await repository.createMany(5, [
      {
        text: 'Q1',
        type: 'open',
        options: [],
        correct_answer: 'A',
        time_limit: 30,
        points: 100,
        order_index: 99,
      },
    ]);

    expect(result[0].quiz_id).toBe(5);
    expect(result[0].order_index).toBe(0);
  });

  it('findByQuizId returns ordered questions array', async () => {
    const orderBy = mock(async () => [{ id: 1 }, { id: 2 }]);
    const where = mock(() => ({ orderBy }));
    const from = mock(() => ({ where }));
    mockDb.select.mockReturnValue({ from });

    const result = await repository.findByQuizId(1);
    expect(result.length).toBe(2);
  });

  it('update returns updated question', async () => {
    const returning = mock(async () => [{ id: 10, text: 'Updated' }]);
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    mockDb.update.mockReturnValue({ set });

    const result = await repository.update(10, { text: 'Updated' });
    expect(result?.text).toBe('Updated');
  });

  it('deleteQuestion removes one row', async () => {
    const returning = mock(async () => [{ id: 10 }]);
    const where = mock(() => ({ returning }));
    mockDb.delete.mockReturnValue({ where });

    const result = await repository.deleteQuestion(10);
    expect(result).toBe(true);
  });

  it('deleteByQuizId returns deleted count', async () => {
    const returning = mock(async () => [{ id: 1 }, { id: 2 }]);
    const where = mock(() => ({ returning }));
    mockDb.delete.mockReturnValue({ where });

    const result = await repository.deleteByQuizId(1);
    expect(result).toBe(2);
  });

  it('reorder runs in a transaction', async () => {
    const updateCalls: number[] = [];

    mockDb.transaction.mockImplementation(async (handler: (tx: unknown) => unknown) => {
      const tx = {
        update: () => ({
          set: ({ order_index }: { order_index: number }) => ({
            where: async () => {
              updateCalls.push(order_index);
            },
          }),
        }),
      };
      return handler(tx);
    });

    await repository.reorder(1, [11, 12, 13]);
    expect(updateCalls).toEqual([0, 1, 2]);
  });
});
