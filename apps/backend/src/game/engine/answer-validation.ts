export interface ActiveQuestionAnswerState {
  sessionId: number;
  questionId: number;
  startTimeMs: number;
  timeLimitMs: number;
  optionIds: string[];
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

  if (!activeQuestion.optionIds.includes(input.selectedAnswer)) {
    return {
      ok: false,
      code: 'INVALID_ANSWER',
      error: 'Selected answer is not valid for this question',
    };
  }

  const elapsedMs = Math.max(0, input.nowMs - activeQuestion.startTimeMs);

  if (elapsedMs > activeQuestion.timeLimitMs) {
    return { ok: false, code: 'ROUND_TIMEOUT', error: 'This round has already closed' };
  }

  return { ok: true, elapsedMs };
}
