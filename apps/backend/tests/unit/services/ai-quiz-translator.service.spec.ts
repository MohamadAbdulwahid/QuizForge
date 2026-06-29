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

const mockFindByIdWithQuestions = mock(async () => null);
const mockFindByParentAndType = mock(async () => null);
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
    text: '¿Cuál es la central eléctrica de la célula?',
    type: 'multiple-choice',
    options: [
      { id: 'a', text: 'Núcleo' },
      { id: 'b', text: 'Mitocondria' },
      { id: 'c', text: 'Ribosoma' },
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
describe('AI Quiz Translator Service', () => {
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
      parent_quiz_id: null,
      transformation_type: null,
      language: 'en',
    }));
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  describe('translateOwnedQuiz', () => {
  it('creates a translated quiz with transformation_type=translate and target language set', async () => {
    mockFindByIdWithQuestions.mockResolvedValueOnce(buildSourceQuiz());
    mockFindByParentAndType.mockResolvedValueOnce(null);
    mockFetch.mockResolvedValueOnce(buildAiResponse([buildValidMultipleChoice()]));

    // Explicitly set what the create mock should return.
    mockCreate.mockResolvedValueOnce({
      id: 999,
      title: '[Spanish] Biology Basics',
      description: 'Translated to Spanish from the original quiz.\n\nIntro bio',
      visibility: 'unlisted',
      status: 'published',
      play_count: 0,
      creator_id: 'user-1',
      share_code: 'NEWSHARE',
      created_at: new Date(),
      parent_quiz_id: 42,
      transformation_type: 'translate',
      language: 'es',
    } as never);

    const { translateOwnedQuiz } =
      await import('../../../src/api/services/ai-quiz-translator.service');

    const result = await translateOwnedQuiz(42, 'user-1', 'es');

    expect(result.transformationType).toBe('translate');
    expect(result.targetLanguage).toBe('es');
    expect(result.reused).toBe(false);
    expect(result.quiz.parent_quiz_id).toBe(42);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArg = mockCreate.mock.calls[0]?.[0];
    expect(createArg?.parentQuizId).toBe(42);
    expect(createArg?.transformationType).toBe('translate');
    expect(createArg?.language).toBe('es');
  });

    it('returns the existing translation when dedup hit (no AI call)', async () => {
      const existing = {
        id: 555,
        title: '[Spanish] Biology Basics',
        description: null,
        visibility: 'unlisted' as const,
        status: 'published' as const,
        play_count: 0,
        creator_id: 'user-1',
        share_code: 'EXISTING',
        created_at: new Date(),
        parent_quiz_id: 42,
        transformation_type: 'translate' as const,
        language: 'es',
      };
      mockFindByIdWithQuestions.mockResolvedValueOnce(buildSourceQuiz());
      mockFindByParentAndType.mockResolvedValueOnce(existing);

      const { translateOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-translator.service');

      const result = await translateOwnedQuiz(42, 'user-1', 'es');

      expect(result.reused).toBe(true);
      expect(result.quiz.id).toBe(555);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('throws 400 on unsupported target language', async () => {
      const { translateOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-translator.service');

      await expect(translateOwnedQuiz(42, 'user-1', 'klingon')).rejects.toThrow(
        'Unsupported target language'
      );
    });

    it('throws 400 on translating to source language (en)', async () => {
      const { translateOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-translator.service');

      await expect(translateOwnedQuiz(42, 'user-1', 'en')).rejects.toThrow('cannot be English');
    });

    it('throws AppError 503 when AI is not configured', async () => {
      mockConfig.AI_API_URL = '';
      mockConfig.AI_API_KEY = '';

      const { translateOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-translator.service');

      await expect(translateOwnedQuiz(42, 'user-1', 'es')).rejects.toThrow('not configured');
      mockConfig.AI_API_URL = 'https://api.example.com/v1';
      mockConfig.AI_API_KEY = 'test-api-key';
    });

    it('throws AppError 429 on AI rate limit', async () => {
      mockFindByIdWithQuestions.mockResolvedValueOnce(buildSourceQuiz());
      mockFindByParentAndType.mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));

      const { translateOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-translator.service');

      await expect(translateOwnedQuiz(42, 'user-1', 'es')).rejects.toThrow('rate limited');
    });

    it('throws AppError 504 on fetch abort (timeout)', async () => {
      mockFindByIdWithQuestions.mockResolvedValueOnce(buildSourceQuiz());
      mockFindByParentAndType.mockResolvedValueOnce(null);
      mockFetch.mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'));

      const { translateOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-translator.service');

      await expect(translateOwnedQuiz(42, 'user-1', 'es')).rejects.toThrow('timed out');
    });

    it('throws AppError when AI returns invalid question', async () => {
      mockFindByIdWithQuestions.mockResolvedValueOnce(buildSourceQuiz());
      mockFindByParentAndType.mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce(
        buildAiResponse([{ text: 'Missing fields', type: 'multiple-choice' }])
      );

      const { translateOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-translator.service');

      await expect(translateOwnedQuiz(42, 'user-1', 'es')).rejects.toThrow('invalid');
    });

    it('passes source + target language to the AI in the user message', async () => {
      mockFindByIdWithQuestions.mockResolvedValueOnce(buildSourceQuiz());
      mockFindByParentAndType.mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce(buildAiResponse([buildValidMultipleChoice()]));

      const { translateOwnedQuiz } =
        await import('../../../src/api/services/ai-quiz-translator.service');

      await translateOwnedQuiz(42, 'user-1', 'es');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      const userContent = body.messages[1].content as string;
      expect(userContent).toContain('Source language: English');
      expect(userContent).toContain('Target language: Spanish');
    });
  });
});
