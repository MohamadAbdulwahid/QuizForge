import { createChildLogger } from '../../config/logger';
import * as quizRepository from '../../database/repositories/quiz.repository';
import * as sessionRepository from '../../database/repositories/session.repository';
import type { Session } from '../../database/schema/session';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { generateUniquePin } from '../../shared/utils/pin';
import type { CreateSessionRequest } from '../dtos/session.dto';

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

  const pin = await generateUniquePin();
  const session = await sessionRepository.createSession({
    quizId: data.quiz_id,
    pin,
    hostId,
    status: 'waiting',
  });

  sessionServiceLogger.info(
    { sessionId: session.id, quizId: data.quiz_id, hostId },
    'Session created'
  );

  return {
    session,
    pin,
  };
}
