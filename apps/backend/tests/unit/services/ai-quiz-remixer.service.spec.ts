import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockFetch = mock(() => {
  throw new Error('fetch not mocked for this test');
});

const mockConfig = {
  AI_API_URL: 'https://api.example.com/v1',
  AI_API_KEY: 'test-api-key',
  AI_MODEL: 'test-model',
};

mock.module('../../../src/config/config', () => ({
  config: mockConfig,
}));

mock.module('../../../src/config/logger', () => ({
  createChildLogger: () => ({
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  }),
  logger: {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  },
}));

// Mock the quiz repository so the service can call into it without a real DB.
const mockFindByIdWithQuestions = mock(
  async (): Promise<{
    id: number;
    title: string;
    description: string | null;
    visibility: 'private' | 'unlisted' | 'public';
    status: 'draft' | 'published';
    play_count: number;
    creator_id: string;
    share_code: string | null;
    created_at: Date;
    parent_quiz_id: number | null;
    transformation_type: 'remix' | 'translate' | null;
    language: string;
    questions: Array<{
      id: number;
      quiz_id: number;
      text: string;
      type:
        | 'multiple-choice'
        | 'true-false'
        | 'open'
        | 'ordering'
        | 'matching'
        | 'fill-in-blank';
      options: unknown;
      correct_answer: string | null;
      time_limit: number | null;
      points: number;
      order_index: number;
    }>;
  } | null> => null
);

const mockFindByParentAndType = mock(
  async (): Promise<{
    id: number;
    title: string;
    description: string | null;
    visibility: 'private' | 'unlisted' | 'public';
    status: 'draft' | 'published';
    play_count: number;
    creator_id: string;
    share_code: string | null;
    created_at: Date;
    parent_quiz_id: number | null;
    transformation_type: 'remix' | 'translate' | null;
    language: string;
  } | null> => null
);

const mockCreate = mock(
  async (data: {
    title: string;
    creatorId: string;
    shareCode: string;
    parentQuizId?: number;
    transformationType?: 'remix' | 'translate';
    language?: string;
  }) => ({
    id: 999,
    title: data.title,
    description: null,
    visibility: 'unlisted' as const,
    status: 'published' as const,
    play_count: 0,
    creator_id: data.creatorId,
    share_code: data.shareCode,
    created_at: new Date(),
    parent_quiz_id: data.parentQuizId ?? null,
    transformation_type: data.transformationType ?? null,
    language: data.language ?? 'en',
  })
);

const mockQuestionCreateMany = mock(async () => []);

const mockShareCodeExists = mock(async () => false);

mock.module('../../../src/database/repositories/quiz.repository', () => ({
  findByIdWithQuestions: mockFindByIdWithQuestions,
  findByParentAndType: mockFindByParentAndType,
  create: mockCreate,
  shareCodeExists: mockShareCodeExists,
}));

mock.module('../../../src/database/repositories/question.repository', () => ({
  createMany: mockQuestionCreateMany,
  findByQuizId: mock(async () => []),
}));

// Replace global fetch.
const originalFetch = globalThis.fetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildAiResponse(questions: unknown[]): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ questions }) } }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function buildValidMultipleChoice(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    text: 'What is the powerhouse of the cell?',
    type: 'multiple-choice',
    options: [
      { id: 'a', text: 'Nucleus' },
      { id: 'b', text: 'Mitochondria' },
      { id: 'c', text: 'Ribosome' },
    ],
    correct_answer: 'b',
    time_limit: 30,
    points: 100,
    ...overrides,
  };
}

function buildSourceQuiz() {
  return {
    id: 42,
    title: 'Biology Basics',
    description: 'Intro bio',
    visibility: 'unlisted' as const,
    status: 'published' as const,
    play_count: 0,
    creator_id: 'user-1',
    share_code: 'SRCCODE',
    created_at: new Date('2026-01-01'),
    parent_quiz_id: null,
    transformation_type: null,
    language: 'en',
    questions: [
      {
        id: 1,
        quiz_id: 42,
        text: 'What is the powerhouse of the cell?',
        type: 'multiple-choice' as const,
        options: [
          { id: 'a', text: 'Nucleus' },
          { id: 'b', text: 'Mitochondria' },
        ],
        correct_answer: 'b',
        time_limit: 30,
        points: 100,
        order_index: 0,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AI Quiz Remixer Service', () => {
  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
    mockFindByIdWithQuestions.mockReset();
    mockFindByParentAndType.mockReset();
    mockCreate.mockReset();
    mockQuestionCreateMany.mockReset();
    mockCreate.mockImplementation(async (data) => ({
      id: 999,
      title: data.title,
      description: null,
      visibility: 'unlisted' as const,
      status: 'published' as const,
      play_count: 0,
      creator_id: data.creatorId,
      share_code: data.shareCode,
      created_at: new Date(),
      parent_quiz_id: data.parentQuizId ?? null,
      transformation_type: data.transformationType ?? null,
      language: data.language ?? 'en',
    }));
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  describe('remixOwnedQuiz', () => {
    it('creates a remixed quiz with transformation_type=remix and parent_quiz_id set', async () => {
      mockFindByIdWithQuestions.mockResolvedValueOnce(buildSourceQuiz());
      mockFetch.mockResolvedValueOnce(buildAiResponse([buildValidMultipleChoice()]));

      const { remixOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-remixer.service');

      const result = await remixOwnedQuiz(42, 'user-1', 'Make it easier for grade 4');

      expect(result.transformationType).toBe('remix');
      expect(result.reused).toBe(false);
      expect(result.quiz.id).toBe(999);
      expect(result.quiz.parent_quiz_id).toBe(42);
      expect(result.quiz.transformation_type).toBe('remix');
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const createArg = mockCreate.mock.calls[0]?.[0];
      expect(createArg?.parentQuizId).toBe(42);
      expect(createArg?.transformationType).toBe('remix');
    });

    it('prefixes the new title with [Remix]', async () => {
      mockFindByIdWithQuestions.mockResolvedValueOnce(buildSourceQuiz());
      mockFetch.mockResolvedValueOnce(buildAiResponse([buildValidMultipleChoice()]));

      const { remixOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-remixer.service');

      const result = await remixOwnedQuiz(42, 'user-1');

      expect(result.quiz.title.startsWith('[Remix]')).toBe(true);
      expect(result.quiz.title).toContain('Biology Basics');
    });

    it('throws NotFoundError when source quiz is not found', async () => {
      mockFindByIdWithQuestions.mockResolvedValueOnce(null);

      const { remixOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-remixer.service');

      // The service uses assertQuizOwnership inside getOwnedQuiz which throws
      // NotFoundError when null. Since the test imports the service after
      // the mock is set, we expect a NotFoundError.
      await expect(remixOwnedQuiz(99, 'user-1')).rejects.toThrow();
    });

    it('throws ForbiddenError when source quiz is owned by someone else', async () => {
      const otherOwner = { ...buildSourceQuiz(), creator_id: 'other-user' };
      mockFindByIdWithQuestions.mockResolvedValueOnce(otherOwner);

      const { remixOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-remixer.service');

      await expect(remixOwnedQuiz(42, 'user-1')).rejects.toThrow();
    });

    it('throws AppError 503 when AI is not configured', async () => {
      // Override the config for this test only.
      mockConfig.AI_API_URL = '';
      mockConfig.AI_API_KEY = '';

      const { remixOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-remixer.service');

      await expect(remixOwnedQuiz(42, 'user-1')).rejects.toThrow('not configured');
      mockConfig.AI_API_URL = 'https://api.example.com/v1';
      mockConfig.AI_API_KEY = 'test-api-key';
    });

    it('throws AppError 429 on AI rate limit', async () => {
      mockFindByIdWithQuestions.mockResolvedValueOnce(buildSourceQuiz());
      mockFetch.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));

      const { remixOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-remixer.service');

      await expect(remixOwnedQuiz(42, 'user-1')).rejects.toThrow('rate limited');
    });

    it('throws AppError 504 on fetch abort (timeout)', async () => {
      mockFindByIdWithQuestions.mockResolvedValueOnce(buildSourceQuiz());
      mockFetch.mockRejectedValueOnce(
        new DOMException('The operation was aborted', 'AbortError')
      );

      const { remixOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-remixer.service');

      await expect(remixOwnedQuiz(42, 'user-1')).rejects.toThrow('timed out');
    });

    it('throws AppError when AI returns invalid question', async () => {
      mockFindByIdWithQuestions.mockResolvedValueOnce(buildSourceQuiz());
      mockFetch.mockResolvedValueOnce(
        buildAiResponse([{ text: 'Missing fields', type: 'multiple-choice' }])
      );

      const { remixOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-remixer.service');

      await expect(remixOwnedQuiz(42, 'user-1')).rejects.toThrow('invalid');
    });

    it('passes the source quiz and instructions to the AI in the user message', async () => {
      mockFindByIdWithQuestions.mockResolvedValueOnce(buildSourceQuiz());
      mockFetch.mockResolvedValueOnce(buildAiResponse([buildValidMultipleChoice()]));

      const { remixOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-remixer.service');

      await remixOwnedQuiz(42, 'user-1', 'Focus on mitochondria only');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      const userContent = body.messages[1].content as string;
      expect(userContent).toContain('Biology Basics');
      expect(userContent).toContain('Focus on mitochondria only');
      expect(userContent).toContain('User transformation instructions:');
    });
  });
});
