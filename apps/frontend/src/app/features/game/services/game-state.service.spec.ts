import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { GameStateService } from './game-state.service';

describe('GameStateService', () => {
  it('sets pending state when an answer is submitted locally', () => {
    const service = TestBed.inject(GameStateService);
    service.reset();
    service.setQuestion({
      pin: '123456',
      sessionId: 1,
      questionId: 1,
      order: 1,
      totalQuestions: 1,
      text: 'What is 2 + 2?',
      type: 'multiple-choice',
      options: [
        { id: 'a', text: '3' },
        { id: 'b', text: '4' },
      ],
      points: 100,
      timeLimitMs: 30000,
      serverStartTimeMs: Date.now(),
    });

    service.selectAnswer('b');
    service.markPending();

    expect(service.selectedAnswer()).toBe('b');
    expect(service.submissionState()).toBe('pending');
  });

  it('does not overwrite a finalized round after timeout', () => {
    const service = TestBed.inject(GameStateService);
    service.reset();
    service.setQuestion({
      pin: '123456',
      sessionId: 1,
      questionId: 1,
      order: 1,
      totalQuestions: 1,
      text: 'What is 2 + 2?',
      type: 'multiple-choice',
      options: [{ id: 'b', text: '4' }],
      points: 100,
      timeLimitMs: 1,
      serverStartTimeMs: Date.now() - 1000,
    });
    service.closeRound({ pin: '123456', sessionId: 1, questionId: 1, order: 1 });

    service.selectAnswer('b');

    expect(service.submissionState()).toBe('closed');
    expect(service.selectedAnswer()).toBeNull();
  });
});
