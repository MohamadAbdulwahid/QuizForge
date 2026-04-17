import { InvalidStateTransitionError } from '../../shared/errors';

export type SessionState = 'waiting' | 'playing' | 'paused' | 'ended';
export type SessionAction = 'start' | 'pause' | 'resume' | 'finish';

const VALID_TRANSITIONS: Record<SessionState, Partial<Record<SessionAction, SessionState>>> = {
  waiting: {
    start: 'playing',
  },
  playing: {
    pause: 'paused',
    finish: 'ended',
  },
  paused: {
    resume: 'playing',
  },
  ended: {},
};

/**
 * Transitions a session state using a constrained action map.
 * @param currentState - Current session state.
 * @param action - Requested transition action.
 * @returns Next state when transition is valid.
 * @throws InvalidStateTransitionError when transition is invalid.
 */
export function transitionState(currentState: SessionState, action: SessionAction): SessionState {
  const nextState = VALID_TRANSITIONS[currentState]?.[action];

  if (!nextState) {
    throw new InvalidStateTransitionError(
      `Cannot ${action} when session is ${currentState}`,
      'INVALID_STATE_TRANSITION'
    );
  }

  return nextState;
}
