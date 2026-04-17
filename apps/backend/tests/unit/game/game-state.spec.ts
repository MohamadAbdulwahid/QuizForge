import { describe, expect, it } from 'bun:test';
import { transitionState } from '../../../src/game/engine/game-state';
import { InvalidStateTransitionError } from '../../../src/shared/errors';

describe('game state transitions', () => {
  it("transitionState('waiting', 'start') returns 'playing'", () => {
    expect(transitionState('waiting', 'start')).toBe('playing');
  });

  it("transitionState('waiting', 'finish') throws InvalidStateTransitionError", () => {
    expect(() => transitionState('waiting', 'finish')).toThrow(InvalidStateTransitionError);
  });

  it("transitionState('playing', 'pause') returns 'paused'", () => {
    expect(transitionState('playing', 'pause')).toBe('paused');
  });

  it("transitionState('paused', 'resume') returns 'playing'", () => {
    expect(transitionState('paused', 'resume')).toBe('playing');
  });

  it("transitionState('playing', 'finish') returns 'ended'", () => {
    expect(transitionState('playing', 'finish')).toBe('ended');
  });

  it("transitionState('ended', 'start') throws InvalidStateTransitionError", () => {
    expect(() => transitionState('ended', 'start')).toThrow(InvalidStateTransitionError);
  });
});
