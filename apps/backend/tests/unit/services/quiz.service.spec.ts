import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

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
