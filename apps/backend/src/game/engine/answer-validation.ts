/**
 * Lightweight structural validation for an incoming answer submission.
 *
 * This module checks *when* and *who* may answer a round, not whether
 * the answer is correct. Correctness is the responsibility of the
 * `gradeAnswer` engine and is computed later in the request lifecycle.
 *
 * The previous `optionIds: string[]` whitelist was removed because the
 * richer question types (Ordering, Matching, Fill-in-the-Blank) do not
 * fit a single whitelist check — the WebSocket schema already enforces
 * `selectedAnswer` is a non-empty string up to 5000 chars, which is
 * sufficient to reject obviously empty/malformed payloads.
 */

export interface ActiveQuestionAnswerState {
  sessionId: number;
  questionId: number;
  startTimeMs: number;
  timeLimitMs: number;
  submittedUserIds: Set<string>;
}

export type AnswerValidationResult =
  | { ok: true; elapsedMs: number }
  | { ok: false; code: string; error: string };

export interface AnswerValidationInput {
  sessionId: number;
  questionId: number;
  userId: string;
  selectedAnswer: string;
  nowMs: number;
  activeQuestion: ActiveQuestionAnswerState | null;
}

/**
 * Validates an answer against the authoritative active round state.
 * @param input - Answer submission and active question state.
 * @returns Validation result with elapsed server time when accepted.
 */
export function validateAnswerSubmission(input: AnswerValidationInput): AnswerValidationResult {
  const activeQuestion = input.activeQuestion;

  if (!activeQuestion) {
    return {
      ok: false,
      code: 'ROUND_NOT_ACTIVE',
      error: 'No active question is accepting answers',
    };
  }

  if (
    activeQuestion.sessionId !== input.sessionId ||
    activeQuestion.questionId !== input.questionId
  ) {
    return {
      ok: false,
      code: 'QUESTION_MISMATCH',
      error: 'Answer does not match the active round',
    };
  }

  if (activeQuestion.submittedUserIds.has(input.userId)) {
    return {
      ok: false,
      code: 'DUPLICATE_ANSWER',
      error: 'Answer already submitted for this round',
    };
  }

  // selectedAnswer is enforced non-empty by the WebSocket Zod schema.
  // We do NOT re-validate against a per-type whitelist here; type-specific
  // payload parsing lives in the grading engine.

  const elapsedMs = Math.max(0, input.nowMs - activeQuestion.startTimeMs);

  if (elapsedMs > activeQuestion.timeLimitMs) {
    return { ok: false, code: 'ROUND_TIMEOUT', error: 'This round has already closed' };
  }

  return { ok: true, elapsedMs };
}
