import { createChildLogger } from '../../config/logger';
import * as groupRepository from '../../database/repositories/group.repository';
import * as quizRepository from '../../database/repositories/quiz.repository';
import * as sessionRepository from '../../database/repositories/session.repository';
import type { Session, SessionStatus } from '../../database/schema/session';
import {
  ConflictError,
  ForbiddenError,
  InvalidStateTransitionError,
  NotFoundError,
} from '../../shared/errors';
import { generateUniquePin } from '../../shared/utils/pin';
import { SessionState, transitionState } from '../../game/engine/game-state';
import type { CreateSessionRequest, UpdateSessionStatusRequest } from '../dtos/session.dto';
import { emitSessionEvent } from './session-event.service';

const sessionServiceLogger = createChildLogger('session-service');

/**
 * Creates a session for a quiz with ownership and uniqueness checks.
 * @param hostId - Authenticated host id.
 * @param data - Request payload.
 * @returns Created session and pin.
 */
export async function createSession(
  hostId: string,
  data: CreateSessionRequest
): Promise<{ session: Session; pin: string }> {
  const quiz = await quizRepository.findById(data.quiz_id);

  if (!quiz) {
    throw new NotFoundError('Quiz not found', 'QUIZ_NOT_FOUND');
  }

  if (quiz.creator_id !== hostId) {
    throw new ForbiddenError('You do not own this quiz', 'QUIZ_FORBIDDEN');
  }

  const activeSession = await sessionRepository.findActiveByQuiz(data.quiz_id);

  if (activeSession) {
    throw new ConflictError(
      'An active session already exists for this quiz',
      'SESSION_ALREADY_EXISTS'
    );
  }

  const broadcastMode = data.broadcast_mode ?? 'private';
  const broadcastGroupIds = await resolveBroadcastGroupIds(
    hostId,
    broadcastMode,
    data.group_ids ?? []
  );
  const pin = await generateUniquePin();
  const session = await sessionRepository.createSession({
    quizId: data.quiz_id,
    pin,
    hostId,
    status: 'waiting',
    broadcastMode,
    groupIds: broadcastGroupIds,
  });

  sessionServiceLogger.info(
    { sessionId: session.id, quizId: data.quiz_id, hostId },
    'Session created'
  );

  // Notify SSE subscribers so dashboards update in real-time
  if (broadcastGroupIds.length > 0) {
    emitSessionEvent('created', session.id, broadcastGroupIds);
  }

  return {
    session,
    pin,
  };
}

async function resolveBroadcastGroupIds(
  hostId: string,
  broadcastMode: CreateSessionRequest['broadcast_mode'],
  groupIds: number[]
): Promise<number[]> {
  if (broadcastMode === 'private') {
    return [];
  }

  const memberGroupIds = await groupRepository.listGroupIdsByMember(hostId);

  if (broadcastMode === 'all-my-groups') {
    return memberGroupIds;
  }

  const normalizedGroupIds = [...new Set(groupIds)];

  if (normalizedGroupIds.length === 0) {
    throw new ConflictError(
      'Select at least one group when broadcasting to selected groups',
      'GROUP_BROADCAST_REQUIRED'
    );
  }

  const invalidGroupId = normalizedGroupIds.find((groupId) => !memberGroupIds.includes(groupId));

  if (invalidGroupId) {
    throw new ForbiddenError(
      'You can only broadcast to groups you belong to',
      'GROUP_BROADCAST_FORBIDDEN'
    );
  }

  return normalizedGroupIds;
}

/**
 * Lists sessions hosted by the authenticated user.
 * @param hostId - Authenticated host id.
 * @returns Session summaries for dashboard management.
 */
export async function getSessionsByHost(
  hostId: string
): Promise<sessionRepository.HostSessionSummary[]> {
  return sessionRepository.findByHost(hostId);
}

/**
 * Gets an active session by PIN.
 * @param pin - Session pin.
 * @returns Active session.
 */
export async function getSessionByPin(pin: string): Promise<Session> {
  const session = await sessionRepository.findActiveByPin(pin);

  if (!session) {
    throw new NotFoundError('Session not found', 'SESSION_NOT_FOUND');
  }

  return session;
}

/**
 * Transitions session status for the host using state-machine rules.
 * @param pin - Session pin.
 * @param hostId - Authenticated host id.
 * @param data - Requested transition payload.
 * @returns Updated session and transition summary.
 */
export async function updateSessionStatus(
  pin: string,
  hostId: string,
  data: UpdateSessionStatusRequest
): Promise<{ session: Session; previousStatus: SessionState; nextStatus: SessionState }> {
  const session = await sessionRepository.findActiveByPin(pin);

  if (!session) {
    throw new NotFoundError('Session not found', 'SESSION_NOT_FOUND');
  }

  if (session.host_id !== hostId) {
    throw new ForbiddenError('Only the host can change session status', 'SESSION_HOST_FORBIDDEN');
  }

  const previousStatus = toSessionState(session.status);
  const nextStatus = transitionState(previousStatus, data.action);
  const updated = await sessionRepository.updateStatus(session.id, fromSessionState(nextStatus));

  if (!updated) {
    throw new NotFoundError('Session not found after status update', 'SESSION_NOT_FOUND');
  }

  sessionServiceLogger.info(
    {
      sessionId: session.id,
      pin,
      hostId,
      previousStatus,
      nextStatus,
      action: data.action,
    },
    'Session status updated'
  );

  // Notify SSE subscribers when a session ends
  if (nextStatus === 'ended') {
    const groupIds = await sessionRepository.listBroadcastGroupIds(session.id);
    if (groupIds.length > 0) {
      emitSessionEvent('ended', session.id, groupIds);
    }
  }

  return {
    session: updated,
    previousStatus,
    nextStatus,
  };
}

/**
 * Maps persisted status to domain transition state.
 * @param status - Session status from persistence.
 * @returns Transition state.
 */
function toSessionState(status: SessionStatus): SessionState {
  if (status === 'in-progress') {
    return 'playing';
  }

  if (status === 'waiting' || status === 'playing' || status === 'paused' || status === 'ended') {
    return status;
  }

  throw new InvalidStateTransitionError(
    `Unsupported session status for transitions: ${status}`,
    'INVALID_SESSION_STATUS'
  );
}

/**
 * Maps domain transition state back to persisted status.
 * @param state - Transition state.
 * @returns Session status for persistence.
 */
function fromSessionState(state: SessionState): SessionStatus {
  return state;
}
