import { config } from '../../config/config';
import { createChildLogger } from '../../config/logger';
import { AppError } from '../../shared/errors';
import { QuestionSchema } from '../dtos/quiz.dto';
import type { QuestionInput } from '../dtos/quiz.dto';

const logger = createChildLogger('ai-quiz-generator');

const AI_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// System prompt — instructs the AI how to generate quiz questions in the exact
// JSON format expected by the QuizForge backend.
// ---------------------------------------------------------------------------
function buildSystemPrompt(): string {
  return `You are a quiz question generator for the QuizForge platform. Your task is to create educational quiz questions from the user's provided notes or study material.

## Output Format
Return a JSON object with a "questions" array. Each question object must include:
- "text" (string): The question text (1-500 chars)
- "type" (string): One of the question types listed below
- "options" (array or object, varies by type — see below)
- "correct_answer" (string): The correct answer, format varies by type
- "time_limit" (number, optional): Time in seconds (5-120, default 30)
- "points" (number, optional): Points awarded (0-1000, default 100)

## Question Types

### 1. multiple-choice
- "options": Array of { "id": string, "text": string } — exactly 2 to 6 options
- "correct_answer": The "id" of the correct option (must match one of the option ids)
- The correct answer should be plausible and not obvious

### 2. true-false
- "options": [{ "id": "true", "text": "True" }, { "id": "false", "text": "False" }]
- "correct_answer": Either "true" or "false"

### 3. ordering
- "options": Array of { "id": string, "text": string } — 2 to 8 items in SHUFFLED order
- "correct_answer": A JSON string array of option ids in the CORRECT order, e.g. '["c","a","b"]'
- Items must be presented in a randomized order; the model must know the correct sequence

### 4. matching
- "options": An object with two arrays: "left" and "right"
  - "left": [{ "id": string, "text": string, "matchId": string }] — left column items
  - "right": [{ "id": string, "text": string }] — right column items
- Both left and right arrays must have the same length (2-6 pairs)
- Each left item's "matchId" must reference a valid right item "id"
- "correct_answer": A JSON object mapping left ids to right ids, e.g. '{"l1":"r1","l2":"r2"}'

### 5. fill-in-blank
- "options": Array of { "id": string, "answer": string } — at least 1 accepted answer
- "correct_answer": The primary/canonical accepted answer text
- These are for single-blank fill questions

## Question Generation Rules
- Generate 5 to 15 questions per request
- Use "multiple-choice" for most questions (60-80% of the total)
- Use "true-false" sparingly (1-2 per set)
- Use "ordering" for questions about sequences, processes, steps, chronology, or ranking
- Use "matching" for definition-pairing, cause-effect, or item-category questions
- Use "fill-in-blank" for terminology or key concept recall
- Do NOT include an "open" type question
- All options must have unique ids within each question (use short identifiers like "a", "b", "c" or "l1", "r1", etc.)
- Questions must be derived from the provided notes — do not invent unrelated facts
- Ensure correct answers are factually accurate based on the notes
- Vary question difficulty: include both recall and application questions
- Distribute points proportionally to difficulty (easier: 50-100, harder: 150-300)

## Example Output
\`\`\`json
{
  "questions": [
    {
      "text": "What is the powerhouse of the cell?",
      "type": "multiple-choice",
      "options": [
        { "id": "a", "text": "Nucleus" },
        { "id": "b", "text": "Mitochondria" },
        { "id": "c", "text": "Ribosome" },
        { "id": "d", "text": "Golgi apparatus" }
      ],
      "correct_answer": "b",
      "time_limit": 30,
      "points": 100
    },
    {
      "text": "Arrange the phases of mitosis in order.",
      "type": "ordering",
      "options": [
        { "id": "p1", "text": "Metaphase" },
        { "id": "p2", "text": "Prophase" },
        { "id": "p3", "text": "Telophase" },
        { "id": "p4", "text": "Anaphase" }
      ],
      "correct_answer": "[\"p2\",\"p1\",\"p4\",\"p3\"]",
      "time_limit": 45,
      "points": 150
    }
  ]
}
\`\`\`

Output ONLY the JSON object — no markdown fences, no explanations, no additional text.`;
}

// ---------------------------------------------------------------------------
// Builds the user message from title, notes, and optional instructions.
// ---------------------------------------------------------------------------
function buildUserMessage(title: string, notes: string, instructions?: string): string {
  const parts = [`Generate a quiz based on the following notes.\n\nTitle: ${title}\n\nNotes:\n${notes}`];

  if (instructions && instructions.trim().length > 0) {
    parts.push(`\nAdditional Instructions:\n${instructions.trim()}`);
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Parsed AI response shape.
// ---------------------------------------------------------------------------
interface AiGenerateResponse {
  questions: unknown[];
}

// ---------------------------------------------------------------------------
// Calls the AI API with the given messages and parses the structured response.
// ---------------------------------------------------------------------------
async function callAiApi(messages: { role: string; content: string }[]): Promise<AiGenerateResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  const endpoint = `${config.AI_API_URL}/chat/completions`;

  try {
    logger.info({ endpoint, model: config.AI_MODEL }, 'Calling AI API for quiz generation');

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
        'AI API returned non-200 response'
      );

      if (response.status === 429) {
        throw new AppError('AI service rate limited — please try again later', 429, 'AI_RATE_LIMITED');
      }
      if (response.status === 401 || response.status === 403) {
        throw new AppError('AI service authentication failed — check AI_API_KEY', 500, 'AI_AUTH_FAILED');
      }

      throw new AppError(
        `AI API returned status ${response.status}`,
        502,
        'AI_SERVICE_ERROR'
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      logger.error({ data: JSON.stringify(data).slice(0, 500) }, 'AI response missing content');
      throw new AppError('AI returned an empty or unexpected response', 502, 'AI_EMPTY_RESPONSE');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      logger.error({ content: content.slice(0, 500) }, 'Failed to parse AI response as JSON');
      throw new AppError('AI returned invalid JSON', 502, 'AI_INVALID_JSON');
    }

    if (typeof parsed !== 'object' || parsed === null || !('questions' in parsed)) {
      logger.error({ parsed: JSON.stringify(parsed).slice(0, 500) }, 'AI response missing questions key');
      throw new AppError('AI response is missing the "questions" field', 502, 'AI_MISSING_QUESTIONS');
    }

    const responseObj = parsed as AiGenerateResponse;

    if (!Array.isArray(responseObj.questions) || responseObj.questions.length === 0) {
      logger.error({ questionCount: Array.isArray(responseObj.questions) ? responseObj.questions.length : 'N/A' }, 'AI generated no questions');
      throw new AppError('AI did not generate any questions', 502, 'AI_NO_QUESTIONS');
    }

    return responseObj;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.error({ timeoutMs: AI_TIMEOUT_MS }, 'AI API request timed out');
      throw new AppError('AI request timed out — please try again', 504, 'AI_TIMEOUT');
    }

    logger.error({ err: error }, 'Unexpected error calling AI API');
    throw new AppError('Failed to communicate with AI service', 502, 'AI_REQUEST_FAILED');
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Validates a single question object against the Zod discriminated union.
// ---------------------------------------------------------------------------
function validateQuestion(question: unknown, index: number): QuestionInput {
  const result = QuestionSchema.safeParse(question);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    logger.error({ index, issues }, 'AI-generated question failed Zod validation');
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
 * Generates quiz questions from user-provided notes using an AI API
 * (OpenAI-compatible /chat/completions endpoint).
 *
 * The AI is instructed to output structured JSON matching QuizForge's question
 * format. Each returned question is validated against the Zod schemas before
 * being returned.
 *
 * @param title   - Quiz title (used in the prompt for context).
 * @param notes   - Raw class notes or study material (10–50000 chars).
 * @param instructions - Optional additional instructions for the AI (max 1000 chars).
 * @returns        Array of validated QuestionInput objects.
 *
 * @throws {AppError} On API failure, timeout, invalid response, or schema mismatch.
 */
export async function generateQuizQuestions(
  title: string,
  notes: string,
  instructions?: string
): Promise<QuestionInput[]> {
  if (!config.AI_API_URL || !config.AI_API_KEY) {
    throw new AppError(
      'AI quiz generation is not configured — set AI_API_URL and AI_API_KEY environment variables',
      503,
      'AI_NOT_CONFIGURED'
    );
  }
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(title, notes, instructions);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  // Log metadata but never the full prompt (contains user notes / PII)
  logger.info(
    {
      titleLength: title.length,
      notesLength: notes.length,
      hasInstructions: !!instructions,
      model: config.AI_MODEL,
    },
    'Generating quiz questions via AI'
  );

  const response = await callAiApi(messages);

  const validated: QuestionInput[] = response.questions.map((question, index) =>
    validateQuestion(question, index)
  );

  logger.info({ questionCount: validated.length }, 'AI quiz generation complete');

  return validated;
}
