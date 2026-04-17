import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { InsertSession, Session, SessionStatus, SESSION } from '../schema/session';
import { QUIZ } from '../schema/quiz';

const ACTIVE_STATUSES: SessionStatus[] = ['waiting', 'playing', 'paused', 'in-progress'];

export type HostSessionSummary = {
  id: number;
  pin: string;
  status: SessionStatus;
  quiz_id: number;
  quiz_title: string;
  started_at: Date;
};

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
 * Finds an active session by pin.
 * @param pin - Session pin.
 * @returns Active session or null.
 */
export async function findActiveByPin(pin: string): Promise<Session | null> {
  return findByPin(pin);
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

/**
 * Lists sessions created by a specific host with quiz title metadata.
 * @param hostId - Host user id.
 * @returns Sessions ordered by newest first.
 */
export async function findByHost(hostId: string): Promise<HostSessionSummary[]> {
  return db
    .select({
      id: SESSION.id,
      pin: SESSION.pin,
      status: SESSION.status,
      quiz_id: SESSION.quiz_id,
      quiz_title: QUIZ.title,
      started_at: SESSION.started_at,
    })
    .from(SESSION)
    .innerJoin(QUIZ, eq(SESSION.quiz_id, QUIZ.id))
    .where(eq(SESSION.host_id, hostId))
    .orderBy(desc(SESSION.started_at));
}
