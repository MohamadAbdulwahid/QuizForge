import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { InsertSession, Session, SessionStatus, SESSION } from '../schema/session';

const ACTIVE_STATUSES: SessionStatus[] = ['waiting', 'in-progress'];

/**
 * Creates a new session row.
 * @param data - Session payload.
 * @param data.quizId - Quiz id.
 * @param data.pin - Session pin.
 * @param data.hostId - Host user id.
 * @param data.status - Optional session status.
 * @returns Created session row.
 */
export async function createSession(data: {
  quizId: number;
  pin: string;
  hostId: string;
  status?: SessionStatus;
}): Promise<Session> {
  const payload: InsertSession = {
    quiz_id: data.quizId,
    pin: data.pin,
    host_id: data.hostId,
    status: data.status ?? 'waiting',
  };

  const result = await db.insert(SESSION).values(payload).returning();
  return result[0];
}

/**
 * Finds a session by pin for active sessions only.
 * @param pin - Session pin.
 * @returns Active session or null.
 */
export async function findByPin(pin: string): Promise<Session | null> {
  const result = await db
    .select()
    .from(SESSION)
    .where(and(eq(SESSION.pin, pin), inArray(SESSION.status, ACTIVE_STATUSES)))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Finds an active session for a quiz.
 * @param quizId - Quiz id.
 * @returns Session or null.
 */
export async function findActiveByQuiz(quizId: number): Promise<Session | null> {
  const result = await db
    .select()
    .from(SESSION)
    .where(and(eq(SESSION.quiz_id, quizId), inArray(SESSION.status, ACTIVE_STATUSES)))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Updates session status.
 * @param sessionId - Session id.
 * @param status - Next status.
 * @returns Updated session or null.
 */
export async function updateStatus(
  sessionId: number,
  status: SessionStatus
): Promise<Session | null> {
  const result = await db
    .update(SESSION)
    .set({ status })
    .where(eq(SESSION.id, sessionId))
    .returning();

  return result[0] ?? null;
}

/**
 * Checks if pin exists among active sessions.
 * @param pin - Session pin.
 * @returns True when pin is already in use.
 */
export async function pinExists(pin: string): Promise<boolean> {
  const result = await db
    .select({ id: SESSION.id })
    .from(SESSION)
    .where(and(eq(SESSION.pin, pin), inArray(SESSION.status, ACTIVE_STATUSES)))
    .limit(1);

  return result.length > 0;
}
