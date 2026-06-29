import { config } from '../../config/config';
import { createChildLogger } from '../../config/logger';
import { AppError } from '../../shared/errors';
import { LANGUAGE_NAME_BY_CODE } from '../../shared/constants/supported-languages';
import { QuestionSchema } from '../dtos/quiz.dto';
import type { QuestionInput, QuizTransformationType } from '../dtos/quiz.dto';
import type { QUIZ, QUESTION } from '../../database/schema/quiz';
import {
  createTransformedQuiz,
  getOwnedQuiz,
} from './quiz.service';

const logger = createChildLogger('ai-quiz-remixer');

const AI_TIMEOUT_MS = 30_000;
const MAX_INSTRUCTIONS_LENGTH = 1000;

// ---------------------------------------------------------------------------
// Public result type returned to the controller.
// ---------------------------------------------------------------------------
export interface AiRemixResult {
  quiz: QUIZ;
  shareCode: string;
  /** Always 'remix' — distinguishes from translate results at the call site. */
  transformationType: QuizTransformationType;
  /** True when an existing remix was returned instead of generating new. */
  reused: boolean;
}

// ---------------------------------------------------------------------------
// System prompt — instructs the AI how to remix a quiz while preserving
// the question schema and type distribution.
// ---------------------------------------------------------------------------
function buildSystemPrompt(): string {
  return `You are a quiz remixer for the QuizForge platform. You receive an existing quiz and a set of user-supplied transformation instructions. Your job is to produce a NEW version of the quiz that applies those transformations while keeping the same number of questions, the same question type distribution, and the same overall difficulty range.

## Output Format
Return a JSON object with a "questions" array. Each question object must include:
- "text" (string): The question text (1-500 chars)
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
- "correct_answer": A JSON string array of option ids in the CORRECT order, e.g. '["c","a","b"]'

### 4. matching
- "options": An object with two arrays: "left" and "right"
  - "left": [{ "id": string, "text": string, "matchId": string }]
  - "right": [{ "id": string, "text": string }]
- Both arrays must have the same length (2-6 pairs)
- Each left item's "matchId" must reference a valid right item "id"
- "correct_answer": A JSON object mapping left ids to right ids, e.g. '{"l1":"r1","l2":"r2"}'

### 5. fill-in-blank
- "options": Array of { "id": string, "answer": string } — at least 1 accepted answer
- "correct_answer": The primary/canonical accepted answer text

## Remix Rules
- Keep the SAME total number of questions as the source
- Keep the SAME question-type distribution as the source (if the source has 6 MC, 2 T/F, 1 ordering → output the same)
- Apply the user's transformation instructions faithfully
- All option ids must be unique within each question (use short identifiers like "a", "b", "c" or "l1", "r1")
- Preserve factual correctness — if the user asks to "make it easier" or "rewrite", keep the same correct answers
- If the user asks to "change the topic" or "convert to true/false", follow that explicitly
- All questions must be derivable from the source — do not invent unrelated new topics unless explicitly asked
- Distribute points proportionally to difficulty (easier: 50-100, harder: 150-300)

## Example
Source quiz: 3 multiple-choice questions about photosynthesis.
User instructions: "Make it easier and use simpler vocabulary for grade 4."
Output: 3 multiple-choice questions about photosynthesis at a 4th-grade reading level.

Output ONLY the JSON object — no markdown fences, no explanations, no additional text.`;
}

// ---------------------------------------------------------------------------
// Builds the user message: includes the source quiz content + the user's
// remix instructions.
// ---------------------------------------------------------------------------
function buildUserMessage(
  sourceQuiz: QUIZ & { questions: QUESTION[] },
  instructions?: string
): string {
  const lines: string[] = [];
  lines.push(`Source quiz title: ${sourceQuiz.title}`);
  if (sourceQuiz.description) {
    lines.push(`Source quiz description: ${sourceQuiz.description}`);
  }
  lines.push(`\nSource questions (${sourceQuiz.questions.length}):`);
  for (const question of sourceQuiz.questions) {
    lines.push(`- [${question.type}] ${question.text}`);
    if (typeof question.options === 'string') {
      lines.push(`  options: ${question.options}`);
    } else if (Array.isArray(question.options)) {
      lines.push(`  options: ${JSON.stringify(question.options)}`);
    } else {
      lines.push(`  options: ${JSON.stringify(question.options)}`);
    }
    if (question.correct_answer !== null) {
      lines.push(`  correct_answer: ${question.correct_answer}`);
    }
  }

  if (instructions && instructions.trim().length > 0) {
    lines.push('\nUser transformation instructions:');
    lines.push(instructions.trim());
  } else {
    lines.push(
      '\nNo specific instructions — produce a fresh rewrite that preserves the source topic, facts, and difficulty.'
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Parsed AI response shape.
// ---------------------------------------------------------------------------
interface AiRemixResponse {
  questions: unknown[];
}

// ---------------------------------------------------------------------------
// Calls the AI API.
// ---------------------------------------------------------------------------
async function callAiApi(
  messages: { role: string; content: string }[]
): Promise<AiRemixResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  const endpoint = `${config.AI_API_URL}/chat/completions`;

  try {
    logger.info({ endpoint, model: config.AI_MODEL }, 'Calling AI API for quiz remix');

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
        max_completion_tokens: 4096,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '<unreadable>');
      logger.error(
        { status: response.status, endpoint, errorBody: errorBody.slice(0, 500) },
        'AI API returned non-200 response for remix'
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

    const responseObj = parsed as AiRemixResponse;

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
// Validates a single question against the Zod discriminated union.
// ---------------------------------------------------------------------------
function validateQuestion(question: unknown, index: number): QuestionInput {
  const result = QuestionSchema.safeParse(question);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    logger.error({ index, issues }, 'AI-remixed question failed Zod validation');
    throw new AppError(
      `Question at index ${index} is invalid: ${result.error.issues[0]?.message ?? 'unknown validation error'}`,
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
 * Remixes one of the authenticated user's quizzes using the OpenAI API.
 * Creates a NEW owned quiz with `transformation_type = 'remix'`,
 * `parent_quiz_id` pointing to the source, and a `[Remix] …` title prefix.
 *
 * The source quiz is never modified. The caller must own the source —
 * the `getOwnedQuiz` helper enforces that.
 *
 * @param sourceQuizId - Id of the quiz to remix.
 * @param userId       - Authenticated user id (must own the source).
 * @param instructions - Optional user-supplied transformation prompt.
 * @returns The new quiz + share code.
 *
 * @throws {AppError} 401/403/404 propagated from `getOwnedQuiz`.
 * @throws {AppError} 429/500/502/503/504 from the AI call.
 */
export async function remixOwnedQuiz(
  sourceQuizId: number,
  userId: string,
  instructions?: string
): Promise<AiRemixResult> {
  if (!config.AI_API_URL || !config.AI_API_KEY) {
    throw new AppError(
      'AI quiz remixing is not configured — set AI_API_URL and AI_API_KEY environment variables',
      503,
      'AI_NOT_CONFIGURED'
    );
  }

  // Trim & cap instructions before they hit the AI prompt.
  let safeInstructions: string | undefined;
  if (instructions !== undefined) {
    const trimmed = instructions.trim();
    if (trimmed.length > 0) {
      safeInstructions =
        trimmed.length > MAX_INSTRUCTIONS_LENGTH
          ? trimmed.slice(0, MAX_INSTRUCTIONS_LENGTH)
          : trimmed;
    }
  }

  const sourceQuiz = await getOwnedQuiz(sourceQuizId, userId);

  logger.info(
    {
      sourceQuizId: sourceQuiz.id,
      userId,
      questionCount: sourceQuiz.questions.length,
      hasInstructions: !!safeInstructions,
      model: config.AI_MODEL,
    },
    'Remixing quiz via AI'
  );

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserMessage(sourceQuiz, safeInstructions) },
  ];

  const response = await callAiApi(messages);

  const validated: QuestionInput[] = response.questions.map((question, index) =>
    validateQuestion(question, index)
  );

  // Type-narrow validated options for storage: Zod produced typed results.
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
    transformationType: 'remix',
    languageCode: sourceQuiz.language,
    languageName: LANGUAGE_NAME_BY_CODE[sourceQuiz.language] ?? sourceQuiz.language,
  });

  logger.info(
    { newQuizId: quiz.id, sourceQuizId: sourceQuiz.id },
    'AI quiz remix complete'
  );

  return { quiz, shareCode, transformationType: 'remix', reused: false };
}
