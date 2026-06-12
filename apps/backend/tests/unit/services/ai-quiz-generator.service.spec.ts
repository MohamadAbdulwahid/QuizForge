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

// Replace global fetch
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
    text: 'What is 2+2?',
    type: 'multiple-choice',
    options: [
      { id: 'a', text: '3' },
      { id: 'b', text: '4' },
      { id: 'c', text: '5' },
      { id: 'd', text: '6' },
    ],
    correct_answer: 'b',
    time_limit: 30,
    points: 100,
    ...overrides,
  };
}

function buildValidTrueFalse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    text: 'The sky is blue.',
    type: 'true-false',
    options: [
      { id: 'true', text: 'True' },
      { id: 'false', text: 'False' },
    ],
    correct_answer: 'true',
    time_limit: 20,
    points: 50,
    ...overrides,
  };
}

function buildValidFillInBlank(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    text: 'The capital of France is ___.',
    type: 'fill-in-blank',
    options: [{ id: 'a', answer: 'Paris' }],
    correct_answer: 'Paris',
    time_limit: 25,
    points: 100,
    ...overrides,
  };
}

function buildValidOrdering(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    text: 'Arrange the planets in order from the Sun.',
    type: 'ordering',
    options: [
      { id: 'p1', text: 'Earth' },
      { id: 'p2', text: 'Mars' },
      { id: 'p3', text: 'Mercury' },
      { id: 'p4', text: 'Venus' },
    ],
    correct_answer: '["p3","p4","p1","p2"]',
    time_limit: 45,
    points: 150,
    ...overrides,
  };
}

function buildValidMatching(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    text: 'Match each country to its capital.',
    type: 'matching',
    options: {
      left: [
        { id: 'l1', text: 'France', matchId: 'r1' },
        { id: 'l2', text: 'Japan', matchId: 'r2' },
      ],
      right: [
        { id: 'r1', text: 'Paris' },
        { id: 'r2', text: 'Tokyo' },
      ],
    },
    correct_answer: '{"l1":"r1","l2":"r2"}',
    time_limit: 40,
    points: 150,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AI Quiz Generator Service', () => {
  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  describe('generateQuizQuestions', () => {
    it('should call the AI API with correct endpoint and headers', async () => {
      mockFetch.mockResolvedValueOnce(buildAiResponse([buildValidMultipleChoice()]));

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      const result = await generateQuizQuestions('Test Quiz', 'Some study notes.');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('multiple-choice');

      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.example.com/v1/chat/completions');

      const body = JSON.parse(options.body as string);
      expect(body.model).toBe('test-model');
      expect(body.temperature).toBe(0);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');
      expect(body.response_format).toEqual({ type: 'json_object' });

      // Authorization header
      expect(options.headers).toBeDefined();
      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-api-key');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should return validated questions for multiple question types', async () => {
      mockFetch.mockResolvedValueOnce(
        buildAiResponse([
          buildValidMultipleChoice(),
          buildValidTrueFalse(),
          buildValidFillInBlank(),
        ])
      );

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      const result = await generateQuizQuestions('Test', 'Notes here.');

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('multiple-choice');
      expect(result[1].type).toBe('true-false');
      expect(result[2].type).toBe('fill-in-blank');
    });

    it('should validate ordering questions correctly', async () => {
      mockFetch.mockResolvedValueOnce(buildAiResponse([buildValidOrdering()]));

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      const result = await generateQuizQuestions('Test', 'Notes here.');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ordering');
    });

    it('should validate matching questions correctly', async () => {
      mockFetch.mockResolvedValueOnce(buildAiResponse([buildValidMatching()]));

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      const result = await generateQuizQuestions('Test', 'Notes here.');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('matching');
    });

    it('should include optional instructions in the user message', async () => {
      mockFetch.mockResolvedValueOnce(buildAiResponse([buildValidMultipleChoice()]));

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      await generateQuizQuestions('Test', 'Notes', 'Focus on chapter 3 only.');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      const userContent = body.messages[1].content as string;
      expect(userContent).toContain('Focus on chapter 3 only.');
      expect(userContent).toContain('Additional Instructions:');
    });

    it('should throw AppError when AI returns non-200', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Rate limited', { status: 429 })
      );

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      await expect(generateQuizQuestions('Test', 'Notes')).rejects.toThrow('rate limited');
    });

    it('should throw AppError when AI returns 401', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      await expect(generateQuizQuestions('Test', 'Notes')).rejects.toThrow('authentication');
    });

    it('should throw AppError when AI returns empty content', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      await expect(generateQuizQuestions('Test', 'Notes')).rejects.toThrow('empty');
    });

    it('should throw AppError when AI returns invalid JSON', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'not valid json!!!' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      await expect(generateQuizQuestions('Test', 'Notes')).rejects.toThrow('invalid JSON');
    });

    it('should throw AppError when AI returns JSON without questions key', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ foo: 'bar' }) } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      await expect(generateQuizQuestions('Test', 'Notes')).rejects.toThrow('missing');
    });

    it('should throw AppError when AI returns empty questions array', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ questions: [] }) } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      await expect(generateQuizQuestions('Test', 'Notes')).rejects.toThrow('any questions');
    });

    it('should throw AppError when AI returns an invalid question', async () => {
      mockFetch.mockResolvedValueOnce(
        buildAiResponse([{ text: 'Missing fields', type: 'multiple-choice' }])
      );

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      await expect(generateQuizQuestions('Test', 'Notes')).rejects.toThrow('invalid');
    });

    it('should throw AppError on fetch abort (timeout)', async () => {
      mockFetch.mockRejectedValueOnce(
        new DOMException('The operation was aborted', 'AbortError')
      );

      const { generateQuizQuestions } = await import(
        '../../../src/api/services/ai-quiz-generator.service'
      );

      await expect(generateQuizQuestions('Test', 'Notes')).rejects.toThrow('timed out');
    });
  });
});
