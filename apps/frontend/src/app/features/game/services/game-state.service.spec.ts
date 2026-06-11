import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameStateService } from './game-state.service';

const baseQuestion = {
  pin: '123456',
  sessionId: 1,
  questionId: 1,
  order: 1,
  totalQuestions: 3,
  text: 'What is 2 + 2?',
  type: 'multiple-choice' as const,
  options: [
    { id: 'a', text: '3' },
    { id: 'b', text: '4' },
  ],
  points: 100,
  timeLimitMs: 30000,
  serverStartTimeMs: Date.now(),
};

describe('GameStateService', () => {
  let service: GameStateService;

  beforeEach(() => {
    service = TestBed.inject(GameStateService);
    service.reset();
  });

  afterEach(() => {
    service.reset();
  });

  // --- Existing tests ---
  it('sets pending state when an answer is submitted locally', () => {
    service.setQuestion(baseQuestion);
    service.selectAnswer('b');
    service.markPending();

    expect(service.selectedAnswer()).toBe('b');
    expect(service.submissionState()).toBe('pending');
  });

  it('does not overwrite a finalized round after timeout', () => {
    service.setQuestion({ ...baseQuestion, timeLimitMs: 1, serverStartTimeMs: Date.now() - 1000 });
    service.closeRound({ pin: '123456', sessionId: 1, questionId: 1, order: 1 });

    service.selectAnswer('b');

    expect(service.submissionState()).toBe('closed');
    expect(service.selectedAnswer()).toBeNull();
  });

  // --- Timer tests ---
  describe('timer', () => {
    it('computes timeRemainingMs based on server start time', () => {
      const now = Date.now();
      service.setQuestion({ ...baseQuestion, timeLimitMs: 30000, serverStartTimeMs: now });

      expect(service.timeRemainingMs()).toBeGreaterThanOrEqual(29900);
      expect(service.timeRemainingMs()).toBeLessThanOrEqual(30000);
    });

    it('returns 0 when timer expires', () => {
      service.setQuestion({
        ...baseQuestion,
        timeLimitMs: 1000,
        serverStartTimeMs: Date.now() - 5000,
      });

      expect(service.timeRemainingMs()).toBe(0);
    });

    it('computes progressPercent correctly', () => {
      const now = Date.now();
      service.setQuestion({ ...baseQuestion, timeLimitMs: 10000, serverStartTimeMs: now });

      expect(service.progressPercent()).toBeGreaterThanOrEqual(99);
      expect(service.progressPercent()).toBeLessThanOrEqual(100);
    });

    it('progressPercent is 0 when timer expires', () => {
      service.setQuestion({
        ...baseQuestion,
        timeLimitMs: 1000,
        serverStartTimeMs: Date.now() - 5000,
      });

      expect(service.progressPercent()).toBe(0);
    });
  });

  // --- Answer flow tests ---
  describe('answer flow', () => {
    it('selectAnswer does nothing when submission is not idle', () => {
      service.setQuestion(baseQuestion);
      service.selectAnswer('a');
      service.markPending();
      service.selectAnswer('b');

      expect(service.selectedAnswer()).toBe('a');
    });

    it('acceptAnswer transitions from pending to accepted', () => {
      service.setQuestion(baseQuestion);
      service.selectAnswer('b');
      service.markPending();

      service.acceptAnswer({
        pin: '123456',
        sessionId: 1,
        questionId: 1,
        selectedAnswer: 'b',
        correct: true,
        scoreDelta: 100,
        totalScore: 100,
      });

      expect(service.submissionState()).toBe('accepted');
    });

    it('acceptAnswer from idle does not change submission state', () => {
      service.setQuestion(baseQuestion);
      // Host skip — server sends ack to non-submitters
      service.acceptAnswer({
        pin: '123456',
        sessionId: 1,
        questionId: 1,
        selectedAnswer: 'b',
        correct: false,
        scoreDelta: 0,
        totalScore: 0,
      });

      expect(service.submissionState()).toBe('idle');
    });

    it('rejectAnswer sets rejected state and error message', () => {
      service.setQuestion(baseQuestion);
      service.selectAnswer('b');
      service.markPending();

      service.rejectAnswer({ error: 'Too late', code: 'ROUND_TIMEOUT' });

      expect(service.submissionState()).toBe('rejected');
      expect(service.errorMessage()).toBe('Too late');
    });

    it('closeRound sets closed state for idle players', () => {
      service.setQuestion(baseQuestion);
      // Player did not answer
      service.closeRound({ pin: '123456', sessionId: 1, questionId: 1, order: 1 });

      expect(service.submissionState()).toBe('closed');
    });

    it('closeRound does not change accepted state', () => {
      service.setQuestion(baseQuestion);
      service.selectAnswer('b');
      service.markPending();
      service.acceptAnswer({
        pin: '123456',
        sessionId: 1,
        questionId: 1,
        selectedAnswer: 'b',
        correct: true,
        scoreDelta: 100,
        totalScore: 100,
      });

      service.closeRound({ pin: '123456', sessionId: 1, questionId: 1, order: 1 });

      expect(service.submissionState()).toBe('accepted');
    });
  });

  // --- Round result tests ---
  describe('round result', () => {
    it('stores round result on acceptAnswer', () => {
      service.setQuestion(baseQuestion);
      service.selectAnswer('b');
      service.markPending();

      service.acceptAnswer({
        pin: '123456',
        sessionId: 1,
        questionId: 1,
        selectedAnswer: 'b',
        correct: true,
        scoreDelta: 150,
        totalScore: 150,
      });

      const result = service.lastRoundResult();
      expect(result).not.toBeNull();
      expect(result!.correct).toBe(true);
      expect(result!.scoreDelta).toBe(150);
      expect(result!.totalScore).toBe(150);
    });

    it('clears round result on new question', () => {
      service.setQuestion(baseQuestion);
      service.selectAnswer('b');
      service.markPending();
      service.acceptAnswer({
        pin: '123456',
        sessionId: 1,
        questionId: 1,
        selectedAnswer: 'b',
        correct: true,
        scoreDelta: 100,
        totalScore: 100,
      });

      expect(service.lastRoundResult()).not.toBeNull();

      service.setQuestion({ ...baseQuestion, questionId: 2, order: 2 });

      expect(service.lastRoundResult()).toBeNull();
    });

    it('clears round result for idle players on closeRound', () => {
      service.setQuestion(baseQuestion);
      service.closeRound({ pin: '123456', sessionId: 1, questionId: 1, order: 1 });

      expect(service.lastRoundResult()).toBeNull();
    });
  });

  // --- Leaderboard tests ---
  describe('leaderboard', () => {
    it('sets leaderboard via setScoreUpdate', () => {
      service.setScoreUpdate({
        pin: '123456',
        sessionId: 1,
        questionId: 1,
        playerId: 'u1',
        username: 'Alice',
        scoreDelta: 100,
        totalScore: 200,
        correct: true,
        rank: 1,
        leaderboard: [
          { userId: 'u1', username: 'Alice', score: 200, rank: 1 },
          { userId: 'u2', username: 'Bob', score: 100, rank: 2 },
        ],
      });

      expect(service.leaderboard()).toHaveLength(2);
      expect(service.leaderboard()[0].username).toBe('Alice');
    });

    it('sets leaderboard via setLeaderboard', () => {
      service.setLeaderboard({
        pin: '123456',
        sessionId: 1,
        leaderboard: [{ userId: 'u1', username: 'Alice', score: 300, rank: 1 }],
      });

      expect(service.leaderboard()).toHaveLength(1);
    });

    it('computes rank deltas between rounds', () => {
      // Round 1 leaderboard
      service.setLeaderboard({
        pin: '123456',
        sessionId: 1,
        leaderboard: [
          { userId: 'u1', username: 'Alice', score: 100, rank: 1 },
          { userId: 'u2', username: 'Bob', score: 50, rank: 2 },
        ],
      });

      // Round 2 — Bob overtakes Alice
      service.setLeaderboard({
        pin: '123456',
        sessionId: 1,
        leaderboard: [
          { userId: 'u2', username: 'Bob', score: 200, rank: 1 },
          { userId: 'u1', username: 'Alice', score: 150, rank: 2 },
        ],
      });

      const lb = service.leaderboard();
      // Bob was rank 2, now rank 1 → delta = +1
      expect(lb.find((e) => e.userId === 'u2')?.rankDelta).toBe(1);
      // Alice was rank 1, now rank 2 → delta = -1
      expect(lb.find((e) => e.userId === 'u1')?.rankDelta).toBe(-1);
    });

    it('computes score deltas between rounds', () => {
      service.setLeaderboard({
        pin: '123456',
        sessionId: 1,
        leaderboard: [{ userId: 'u1', username: 'Alice', score: 100, rank: 1 }],
      });

      service.setLeaderboard({
        pin: '123456',
        sessionId: 1,
        leaderboard: [{ userId: 'u1', username: 'Alice', score: 250, rank: 1 }],
      });

      expect(service.leaderboard()[0].scoreDelta).toBe(150);
    });

    it('rank delta is 0 for first leaderboard (no previous)', () => {
      service.setLeaderboard({
        pin: '123456',
        sessionId: 1,
        leaderboard: [{ userId: 'u1', username: 'Alice', score: 100, rank: 1 }],
      });

      expect(service.leaderboard()[0].rankDelta).toBe(0);
    });
  });

  // --- Lobby state tests ---
  describe('lobby state', () => {
    it('sets lobby state with players and host', () => {
      service.setLobbyState({
        pin: '123456',
        hostUserId: 'host-1',
        status: 'waiting',
        minPlayersToStart: 2,
        players: [
          { userId: 'host-1', username: 'Host', isHost: true },
          { userId: 'player-1', username: 'Alice', isHost: false },
        ],
      });

      expect(service.pin()).toBe('123456');
      expect(service.hostUserId()).toBe('host-1');
      expect(service.players()).toHaveLength(2);
      expect(service.players()[0].isHost).toBe(true);
    });
  });

  // --- Game end tests ---
  describe('game end', () => {
    it('sets ended state and clears question', () => {
      service.setQuestion(baseQuestion);

      service.endGame({
        pin: '123456',
        sessionId: 1,
        leaderboard: [{ userId: 'u1', username: 'Alice', score: 300, rank: 1 }],
      });

      expect(service.ended()).toBe(true);
      expect(service.currentQuestion()).toBeNull();
      expect(service.leaderboard()).toHaveLength(1);
    });
  });

  // --- Reset tests ---
  describe('reset', () => {
    it('clears all state', () => {
      service.setLobbyState({
        pin: '123456',
        hostUserId: 'host-1',
        status: 'waiting',
        minPlayersToStart: 2,
        players: [{ userId: 'u1', username: 'Alice', isHost: false }],
      });
      service.setQuestion(baseQuestion);
      service.selectAnswer('b');

      service.reset();

      expect(service.pin()).toBeNull();
      expect(service.sessionId()).toBeNull();
      expect(service.hostUserId()).toBeNull();
      expect(service.players()).toHaveLength(0);
      expect(service.currentQuestion()).toBeNull();
      expect(service.leaderboard()).toHaveLength(0);
      expect(service.selectedAnswer()).toBeNull();
      expect(service.submissionState()).toBe('idle');
      expect(service.ended()).toBe(false);
    });
  });

  // --- canSubmit computed tests ---
  describe('canSubmit', () => {
    it('is false when no question is active', () => {
      expect(service.canSubmit()).toBe(false);
    });

    it('is false when no answer is selected', () => {
      service.setQuestion(baseQuestion);
      expect(service.canSubmit()).toBe(false);
    });

    it('is true when answer selected, idle, and time remaining', () => {
      service.setQuestion(baseQuestion);
      service.selectAnswer('b');
      expect(service.canSubmit()).toBe(true);
    });

    it('is false when submission is pending', () => {
      service.setQuestion(baseQuestion);
      service.selectAnswer('b');
      service.markPending();
      expect(service.canSubmit()).toBe(false);
    });

    it('is false when timer expired', () => {
      service.setQuestion({
        ...baseQuestion,
        timeLimitMs: 1000,
        serverStartTimeMs: Date.now() - 5000,
      });
      service.selectAnswer('b');
      expect(service.canSubmit()).toBe(false);
    });
  });
});
