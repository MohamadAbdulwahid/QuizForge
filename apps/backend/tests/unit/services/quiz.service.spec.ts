import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { NotFoundError } from '../../../src/shared/errors';

const mocks = {
  findById: mock(),
  findByIdWithQuestions: mock(),
  findByCreator: mock(),
  findByShareCode: mock(),
  create: mock(),
  update: mock(),
  deleteQuiz: mock(),
  createMany: mock(),
  deleteByQuizId: mock(),
  findByQuizId: mock(),
  searchPublicQuizzes: mock(),
  countPublicQuizzes: mock(),
  incrementPlayCount: mock(),
  generateUniqueShareCode: mock(),
};

mock.module('../../../src/database/repositories/quiz.repository', () => ({
  findById: mocks.findById,
  findByIdWithQuestions: mocks.findByIdWithQuestions,
  findByCreator: mocks.findByCreator,
  findByShareCode: mocks.findByShareCode,
  create: mocks.create,
  update: mocks.update,
  deleteQuiz: mocks.deleteQuiz,
  searchPublicQuizzes: mocks.searchPublicQuizzes,
  countPublicQuizzes: mocks.countPublicQuizzes,
  incrementPlayCount: mocks.incrementPlayCount,
}));

mock.module('../../../src/database/repositories/question.repository', () => ({
  createMany: mocks.createMany,
  deleteByQuizId: mocks.deleteByQuizId,
  findByQuizId: mocks.findByQuizId,
}));

mock.module('../../../src/shared/utils/share-code', () => ({
  generateUniqueShareCode: mocks.generateUniqueShareCode,
}));

mock.module('../../../src/config/logger', () => ({
  createChildLogger: () => ({ info: mock(), warn: mock(), error: mock(), debug: mock() }),
  logger: { info: mock(), warn: mock(), error: mock(), debug: mock() },
}));

const quizService = await import('../../../src/api/services/quiz.service');

describe('quiz service', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  afterAll(() => {
    mock.restore();
  });

  it('createQuiz generates share code and persists quiz/questions', async () => {
    mocks.generateUniqueShareCode.mockResolvedValueOnce('ABCDEFGH');
    mocks.create.mockResolvedValueOnce({ id: 1, creator_id: 'u1' });
    mocks.createMany.mockResolvedValueOnce([]);

    const result = await quizService.createQuiz('u1', {
      title: 'Demo',
      description: 'Desc',
      questions: [
        {
          text: 'Q1',
          type: 'open',
          options: undefined,
          correct_answer: 'A',
          time_limit: 30,
          points: 100,
        },
      ],
    });

    expect(result.shareCode).toBe('ABCDEFGH');
    expect(mocks.create).toHaveBeenCalled();
    expect(mocks.createMany).toHaveBeenCalled();
  });

  it('updateQuiz throws when quiz does not exist', async () => {
    mocks.findById.mockResolvedValueOnce(null);

    await expect(quizService.updateQuiz(1, 'u1', { title: 'X' })).rejects.toThrow('Quiz not found');
  });

  it('updateQuiz throws when user does not own quiz', async () => {
    mocks.findById.mockResolvedValueOnce({ id: 1, creator_id: 'other' });

    await expect(quizService.updateQuiz(1, 'u1', { title: 'X' })).rejects.toThrow(
      'You do not own this quiz'
    );
  });

  it('deleteQuiz throws when user does not own quiz', async () => {
    mocks.findById.mockResolvedValueOnce({ id: 1, creator_id: 'other' });

    await expect(quizService.deleteQuiz(1, 'u1')).rejects.toThrow('You do not own this quiz');
  });

  it('getQuizByShareCode strips correct_answer from response', async () => {
    mocks.findByShareCode.mockResolvedValueOnce({
      id: 1,
      title: 'Q',
      description: null,
      share_code: 'ABCDEFGH',
      created_at: new Date(),
      questions: [
        {
          id: 10,
          quiz_id: 1,
          text: 'Question',
          type: 'multiple-choice',
          options: [{ id: 'A', text: 'A' }],
          correct_answer: 'A',
          time_limit: 30,
          points: 100,
          order_index: 0,
        },
      ],
    });

    const result = await quizService.getQuizByShareCode('ABCDEFGH');

    expect(result.questions[0]).not.toHaveProperty('correct_answer');
  });
});

describe('getQuizByShareCode visibility gating', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it('throws NotFoundError when quiz is draft', async () => {
    mocks.findByShareCode.mockResolvedValueOnce({
      id: 1,
      title: 'T',
      description: null,
      share_code: 'X',
      created_at: new Date(),
      status: 'draft',
      visibility: 'public',
      creator_id: 'u1',
      play_count: 0,
      questions: [],
    });

    await expect(quizService.getQuizByShareCode('X')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when quiz is private', async () => {
    mocks.findByShareCode.mockResolvedValueOnce({
      id: 1,
      title: 'T',
      description: null,
      share_code: 'X',
      created_at: new Date(),
      status: 'published',
      visibility: 'private',
      creator_id: 'u1',
      play_count: 0,
      questions: [],
    });

    await expect(quizService.getQuizByShareCode('X')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns quiz when published + unlisted', async () => {
    mocks.findByShareCode.mockResolvedValueOnce({
      id: 1,
      title: 'T',
      description: null,
      share_code: 'X',
      created_at: new Date(),
      status: 'published',
      visibility: 'unlisted',
      creator_id: 'u1',
      play_count: 0,
      questions: [
        {
          id: 10,
          quiz_id: 1,
          text: 'Q1',
          type: 'multiple-choice',
          options: [],
          correct_answer: 'A',
          time_limit: 30,
          points: 100,
          order_index: 0,
        },
      ],
    });

    const result = await quizService.getQuizByShareCode('X');

    expect(result.status).toBe('published');
    expect(result.visibility).toBe('unlisted');
    expect(result.play_count).toBe(0);
    expect(result.questions[0]).not.toHaveProperty('correct_answer');
  });

  it('returns quiz when published + public', async () => {
    mocks.findByShareCode.mockResolvedValueOnce({
      id: 1,
      title: 'T',
      description: null,
      share_code: 'X',
      created_at: new Date(),
      status: 'published',
      visibility: 'public',
      creator_id: 'u1',
      play_count: 0,
      questions: [
        {
          id: 10,
          quiz_id: 1,
          text: 'Q1',
          type: 'multiple-choice',
          options: [],
          correct_answer: 'A',
          time_limit: 30,
          points: 100,
          order_index: 0,
        },
      ],
    });

    const result = await quizService.getQuizByShareCode('X');

    expect(result.status).toBe('published');
    expect(result.visibility).toBe('public');
    expect(result.play_count).toBe(0);
    expect(result.questions[0]).not.toHaveProperty('correct_answer');
  });
});

describe('createQuizWithCollisionGuard defaults', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it('defaults visibility to unlisted and status to published when not provided', async () => {
    mocks.generateUniqueShareCode.mockResolvedValueOnce('ABCDEFGH');
    mocks.create.mockResolvedValueOnce({ id: 1, creator_id: 'u' });
    mocks.createMany.mockResolvedValueOnce([]);

    await quizService.createQuizWithCollisionGuard('u', {
      title: 'T',
      description: null,
      questions: [],
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: 'unlisted',
        status: 'published',
      })
    );
  });
});

describe('searchPublicQuizzes service', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it('returns paginated result with items + total', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    mocks.searchPublicQuizzes.mockResolvedValueOnce([
      {
        id: 1,
        title: 'Quiz 1',
        description: 'Desc',
        visibility: 'public',
        status: 'published',
        play_count: 5,
        creator_id: 'u1',
        share_code: 'ABCDEFGH',
        created_at: createdAt,
        creator: { userId: 'u1', username: 'alice' },
      },
    ]);
    mocks.countPublicQuizzes.mockResolvedValueOnce(1);
    mocks.findByQuizId.mockResolvedValueOnce([
      { id: 100, text: 'Q1' },
      { id: 101, text: 'Q2' },
    ]);

    const result = await quizService.searchPublicQuizzes({
      query: '',
      sort: 'newest',
      limit: 24,
      offset: 0,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(1);
    expect(result.items[0].title).toBe('Quiz 1');
    expect(result.items[0].question_count).toBe(2);
    expect(result.items[0].creator).toEqual({
      user_id: 'u1',
      username: 'alice',
      display_name: 'alice',
    });
    expect(result.items[0].play_count).toBe(5);
    expect(result.total).toBe(1);
    expect(result.limit).toBe(24);
    expect(result.offset).toBe(0);
  });

  it('returns empty result when no matches', async () => {
    mocks.searchPublicQuizzes.mockResolvedValueOnce([]);
    mocks.countPublicQuizzes.mockResolvedValueOnce(0);

    const result = await quizService.searchPublicQuizzes({
      query: '',
      sort: 'newest',
      limit: 24,
      offset: 0,
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.limit).toBe(24);
    expect(result.offset).toBe(0);
  });
});

describe('incrementQuizPlayCount', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it('forwards quiz id to repository increment', async () => {
    mocks.incrementPlayCount.mockResolvedValueOnce(undefined);

    await quizService.incrementQuizPlayCount(1);

    expect(mocks.incrementPlayCount).toHaveBeenCalledWith(1);
  });
});

describe('updateQuiz with visibility and status', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it('forwards visibility and status to repository update', async () => {
    mocks.findById.mockResolvedValueOnce({ id: 1, creator_id: 'u1' });
    mocks.update.mockResolvedValueOnce({ id: 1 });
    mocks.findById.mockResolvedValueOnce({
      id: 1,
      creator_id: 'u1',
      title: 'X',
      visibility: 'public',
      status: 'draft',
    });

    await quizService.updateQuiz(1, 'u1', { visibility: 'public', status: 'draft' });

    expect(mocks.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        visibility: 'public',
        status: 'draft',
      })
    );
  });
});
