import { describe, expect, it } from 'bun:test';
import { validateAnswerSubmission } from '../../../src/game/engine/answer-validation';

describe('answer validation', () => {
  const activeQuestion = {
    sessionId: 1,
    questionId: 10,
    startTimeMs: 1000,
    timeLimitMs: 30000,
    optionIds: ['a', 'b'],
    submittedUserIds: new Set<string>(),
  };

  it('accepts a valid answer inside the allowed time window', () => {
    const result = validateAnswerSubmission({
      sessionId: 1,
      questionId: 10,
      userId: 'player-1',
      selectedAnswer: 'b',
      nowMs: 2000,
      activeQuestion,
    });

    expect(result.ok).toBe(true);
  });

  it('rejects a late answer even if the option is valid', () => {
    const result = validateAnswerSubmission({
      sessionId: 1,
      questionId: 10,
      userId: 'player-1',
      selectedAnswer: 'b',
      nowMs: 32000,
      activeQuestion,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('ROUND_TIMEOUT');
    }
  });

  it('rejects duplicate answers for the same question', () => {
    const result = validateAnswerSubmission({
      sessionId: 1,
      questionId: 10,
      userId: 'player-1',
      selectedAnswer: 'b',
      nowMs: 2000,
      activeQuestion: { ...activeQuestion, submittedUserIds: new Set(['player-1']) },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('DUPLICATE_ANSWER');
    }
  });
});
