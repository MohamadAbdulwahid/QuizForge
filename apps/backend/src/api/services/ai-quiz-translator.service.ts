import { config } from '../../config/config';
import { createChildLogger } from '../../config/logger';
import { AppError } from '../../shared/errors';
import * as quizRepository from '../../database/repositories/quiz.repository';
import {
  LANGUAGE_NAME_BY_CODE,
  SUPPORTED_LANGUAGE_CODES,
} from '../../shared/constants/supported-languages';
import { QuestionSchema } from '../dtos/quiz.dto';
import type { QuestionInput, QuizTransformationType } from '../dtos/quiz.dto';
import type { QUIZ, QUESTION } from '../../database/schema/quiz';
import {
  createTransformedQuiz,
  getOwnedQuiz,
} from './quiz.service';

const logger = createChildLogger('ai-quiz-translator');

const AI_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------
export interface AiTranslateResult {
  quiz: QUIZ;
  shareCode: string;
  /** Always 'translate' — distinguishes from remix results. */
  transformationType: QuizTransformationType;
  /** BCP-47 code of the language the new quiz is written in. */
  targetLanguage: string;
  /** True when an existing translation was returned instead of generating new. */
  reused: boolean;
}

// ---------------------------------------------------------------------------
// System prompt — instructs the AI how to translate + culturally adapt.
// ---------------------------------------------------------------------------
function buildSystemPrompt(): string {
  return `You are a quiz translator and cultural-adapter for the QuizForge platform. You receive an existing quiz in a source language and a target language. Your job is to produce a NEW version of the quiz where:
1. The question text, options, and correct answers are written in the target language.
2. Examples, references, idioms, and cultural context are adapted to feel natural in the target language and its culture (NOT a literal word-for-word translation).
3. The same number of questions, the same question type distribution, the same difficulty, and the same time/points are preserved.
4. Factual correctness is preserved — when the source quiz refers to a real historical event, scientific fact, or geographic location, use the target culture's name for it (e.g. "American Revolution" for a French audience becomes "la révolution américaine" — but you keep the underlying fact intact, do not replace the topic with a French one).

## Output Format
Return a JSON object with a "questions" array. Each question object must include:
- "text" (string): The question text in the target language (1-500 chars)
- "type" (string): One of the question types listed below
- "options" (array or object, varies by type)
- "correct_answer" (string): The correct answer, format varies by type
- "time_limit" (number, optional): Time in seconds (5-120, default 30)
- "points" (number, optional): Points awarded (0-1000, default 100)

## Question Types

### 1. multiple-choice
- "options": Array of { "id": string, "text": string } — exactly 2 to 6 options
- "correct_answer": The "id" of the correct option (must match one of the option ids)

### 2. true-false
- "options": [{ "id": "true", "text": "True" }, { "id": "false", "text": "False" }]
- "correct_answer": Either "true" or "false"

### 3. ordering
- "options": Array of { "id": string, "text": string } — 2 to 8 items in SHUFFLED order
- "correct_answer": A JSON string array of option ids in the CORRECT order

### 4. matching
- "options": An object with two arrays: "left" and "right"
  - "left": [{ "id": string, "text": string, "matchId": string }]
  - "right": [{ "id": string, "text": string }]
- "correct_answer": A JSON object mapping left ids to right ids

### 5. fill-in-blank
- "options": Array of { "id": string, "answer": string } — at least 1 accepted answer (in the target language)
- "correct_answer": The primary/canonical accepted answer text in the target language

## Translation Rules
- The OUTPUT language must be the TARGET language (not the source, not English unless the target is English).
- All option ids must remain in Latin characters ("a", "b", "c" or "l1", "r1") — they are technical ids, not translated.
- Keep the SAME total number of questions as the source.
- Keep the SAME question-type distribution.
- Preserve the source's overall difficulty — easier questions should stay easy, harder should stay hard.
- Cultural adaptation: replace idioms, pop-culture references, and region-specific examples with equivalents that the target audience would understand naturally.
- Do NOT add a translation disclaimer, a note, or any meta-commentary in the questions.
- Output ONLY the JSON object — no markdown fences, no explanations.`;
}

// ---------------------------------------------------------------------------
// Builds the user message.
// ---------------------------------------------------------------------------
function buildUserMessage(
  sourceQuiz: QUIZ & { questions: QUESTION[] },
  sourceLanguageName: string,
  targetLanguageName: string
): string {
  const lines: string[] = [];
  lines.push(`Source quiz title: ${sourceQuiz.title}`);
  if (sourceQuiz.description) {
    lines.push(`Source quiz description: ${sourceQuiz.description}`);
  }
  lines.push(`\nSource language: ${sourceLanguageName}`);
  lines.push(`Target language: ${targetLanguageName}`);
  lines.push(
    `\nTranslate every question text, option text, and correct answer into ${targetLanguageName}. Preserve the same number of questions, the same question types, and the same difficulty. Adapt cultural references naturally for a ${targetLanguageName}-speaking audience.\n`
  );
  lines.push(`Source questions (${sourceQuiz.questions.length}):`);
  for (const question of sourceQuiz.questions) {
    lines.push(`- [${question.type}] ${question.text}`);
    if (typeof question.options === 'string') {
      lines.push(`  options: ${question.options}`);
    } else {
      lines.push(`  options: ${JSON.stringify(question.options)}`);
    }
    if (question.correct_answer !== null) {
      lines.push(`  correct_answer: ${question.correct_answer}`);
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Parsed AI response shape
// ---------------------------------------------------------------------------
interface AiTranslateResponse {
  questions: unknown[];
}

// ---------------------------------------------------------------------------
// Calls the AI API (OpenAI-compatible /chat/completions).
// ---------------------------------------------------------------------------
async function callAiApi(
  messages: { role: string; content: string }[]
): Promise<AiTranslateResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  const endpoint = `${config.AI_API_URL}/chat/completions`;

  try {
    logger.info({ endpoint, model: config.AI_MODEL }, 'Calling AI API for quiz translate');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.AI_MODEL,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0,
        max_completion_tokens: 6144,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '<unreadable>');
      logger.error(
        { status: response.status, endpoint, errorBody: errorBody.slice(0, 500) },
        'AI API returned non-200 response for translate'
      );

      if (response.status === 429) {
        throw new AppError(
          'AI service rate limited — please try again later',
          429,
          'AI_RATE_LIMITED'
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          'AI service authentication failed — check AI_API_KEY',
          500,
          'AI_AUTH_FAILED'
        );
      }

      throw new AppError(`AI API returned status ${response.status}`, 502, 'AI_SERVICE_ERROR');
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new AppError('AI returned an empty or unexpected response', 502, 'AI_EMPTY_RESPONSE');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AppError('AI returned invalid JSON', 502, 'AI_INVALID_JSON');
    }

    if (typeof parsed !== 'object' || parsed === null || !('questions' in parsed)) {
      throw new AppError(
        'AI response is missing the "questions" field',
        502,
        'AI_MISSING_QUESTIONS'
      );
    }

    const responseObj = parsed as AiTranslateResponse;

    if (!Array.isArray(responseObj.questions) || responseObj.questions.length === 0) {
      throw new AppError('AI did not generate any questions', 502, 'AI_NO_QUESTIONS');
    }

    return responseObj;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError('AI request timed out — please try again', 504, 'AI_TIMEOUT');
    }

    throw new AppError('Failed to communicate with AI service', 502, 'AI_REQUEST_FAILED');
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Normalizes a question coming back from the AI before Zod validation.
//
// The system prompt asks the AI to return `correct_answer` as a *string*
// containing JSON for `ordering` and `matching` questions. Some AI models
// ignore that and return a native array/object instead, which then fails
// the schema (`expected: string, received: array`). We coerce any
// non-string value back to a JSON string so the schema's superRefine
// (which parses the string) does the right thing.
//
// This is a defensive belt-and-suspenders pass — the system prompt is
// the primary contract, but AI outputs are notoriously free-form.
// ---------------------------------------------------------------------------
function normalizeAiQuestion(question: unknown): unknown {
  if (typeof question !== 'object' || question === null) {
    return question;
  }

  const record = question as Record<string, unknown>;
  const answer = record.correct_answer;

  if (typeof answer === 'string') {
    return record; // already in the canonical string form
  }
  if (typeof answer === 'number' || typeof answer === 'boolean') {
    return { ...record, correct_answer: String(answer) };
  }
  if (Array.isArray(answer) || (typeof answer === 'object' && answer !== null)) {
    try {
      return { ...record, correct_answer: JSON.stringify(answer) };
    } catch {
      return record; // give the schema a chance to surface a clear error
    }
  }

  return record;
}

// ---------------------------------------------------------------------------
// Validates a single question.
// ---------------------------------------------------------------------------
function validateQuestion(question: unknown, index: number): QuestionInput {
  const normalized = normalizeAiQuestion(question);
  const result = QuestionSchema.safeParse(normalized);

  if (!result.success) {
    logger.error(
      { index, issues: result.error.issues },
      'AI-translated question failed Zod validation'
    );
    throw new AppError(
      `Translated question at index ${index} is invalid: ${result.error.issues[0]?.message ?? 'unknown validation error'}`,
      502,
      'AI_INVALID_QUESTION'
    );
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Translates one of the authenticated user's quizzes to a target language
 * using the OpenAI API. Creates a NEW owned quiz with
 * `transformation_type = 'translate'`, `parent_quiz_id` pointing to the
 * source, and a `[{Language}] …` title prefix.
 *
 * Dedup: if the user already has a translation of this source quiz to
 * the requested target language, that existing quiz is returned (200) —
 * no AI call is made and no duplicate quiz is created. This is the
 * "Option B lazy" behavior.
 *
 * @param sourceQuizId  - Id of the source quiz.
 * @param userId        - Authenticated user id (must own the source).
 * @param targetLanguage - BCP-47 code (e.g. 'es', 'fr').
 * @returns The new (or reused) translated quiz + share code.
 */
export async function translateOwnedQuiz(
  sourceQuizId: number,
  userId: string,
  targetLanguage: string
): Promise<AiTranslateResult> {
  // Validate the target code is in our supported set (defence in depth — the
  // DTO also validates, but this protects against direct service callers).
  if (!SUPPORTED_LANGUAGE_CODES.has(targetLanguage)) {
    throw new AppError(
      `Unsupported target language: ${targetLanguage}`,
      400,
      'UNSUPPORTED_LANGUAGE'
    );
  }

  if (targetLanguage === 'en') {
    throw new AppError(
      'Target language cannot be English — pick another supported language.',
      400,
      'TRANSLATE_TO_SOURCE'
    );
  }

  if (!config.AI_API_URL || !config.AI_API_KEY) {
    throw new AppError(
      'AI quiz translation is not configured — set AI_API_URL and AI_API_KEY environment variables',
      503,
      'AI_NOT_CONFIGURED'
    );
  }

  const sourceQuiz = await getOwnedQuiz(sourceQuizId, userId);
  const sourceLanguageName = LANGUAGE_NAME_BY_CODE[sourceQuiz.language] ?? sourceQuiz.language;
  const targetLanguageName = LANGUAGE_NAME_BY_CODE[targetLanguage] ?? targetLanguage;

  // Dedup check: does this user already have a translation of this source
  // to the same target language?
  const existing = await quizRepository.findByParentAndType({
    parentQuizId: sourceQuiz.id,
    creatorId: userId,
    transformationType: 'translate',
    language: targetLanguage,
  });

  if (existing) {
    logger.info(
      {
        sourceQuizId: sourceQuiz.id,
        userId,
        targetLanguage,
        existingQuizId: existing.id,
      },
      'Reusing existing translation (dedup hit)'
    );
    return {
      quiz: existing,
      shareCode: existing.share_code ?? '',
      transformationType: 'translate',
      targetLanguage,
      reused: true,
    };
  }

  logger.info(
    {
      sourceQuizId: sourceQuiz.id,
      userId,
      targetLanguage,
      questionCount: sourceQuiz.questions.length,
      model: config.AI_MODEL,
    },
    'Translating quiz via AI'
  );

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    {
      role: 'user',
      content: buildUserMessage(sourceQuiz, sourceLanguageName, targetLanguageName),
    },
  ];

  const response = await callAiApi(messages);

  const validated: QuestionInput[] = response.questions.map((question, index) =>
    validateQuestion(question, index)
  );

  const { quiz, shareCode } = await createTransformedQuiz({
    creatorId: userId,
    sourceQuiz,
    questions: validated.map((q) => ({
      text: q.text,
      type: q.type,
      options: q.options as unknown,
      correct_answer: q.correct_answer,
      time_limit: q.time_limit ?? null,
      points: q.points ?? 100,
    })),
    transformationType: 'translate',
    languageCode: targetLanguage,
    languageName: targetLanguageName,
  });

  logger.info(
    { newQuizId: quiz.id, sourceQuizId: sourceQuiz.id, targetLanguage },
    'AI quiz translation complete'
  );

  return {
    quiz,
    shareCode,
    transformationType: 'translate',
    targetLanguage,
    reused: false,
  };
}
