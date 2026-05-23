import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import {
  InsertSession,
  InsertSessionBroadcastGroup,
  Session,
  SessionBroadcastMode,
  SessionStatus,
  SESSION,
  SESSION_BROADCAST_GROUP,
  SESSION_PLAYER,
  GAME_EVENT,
  SessionPlayer,
  GameEvent,
  InsertGameEvent,
} from '../schema/session';
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
 * @param data.broadcastMode - Session discovery mode.
 * @param data.groupIds - Broadcast group ids snapshot.
 * @returns Created session row.
 */
export async function createSession(data: {
  quizId: number;
  pin: string;
  hostId: string;
  status?: SessionStatus;
  broadcastMode?: SessionBroadcastMode;
  groupIds?: number[];
}): Promise<Session> {
  const payload: InsertSession = {
    quiz_id: data.quizId,
    pin: data.pin,
    host_id: data.hostId,
    status: data.status ?? 'waiting',
    broadcast_mode: data.broadcastMode ?? 'private',
  };

  const result = await db.insert(SESSION).values(payload).returning();
  const session = result[0];

  if (data.groupIds && data.groupIds.length > 0) {
    const broadcastRows: InsertSessionBroadcastGroup[] = data.groupIds.map((groupId) => ({
      session_id: session.id,
      group_id: groupId,
    }));

    await db.insert(SESSION_BROADCAST_GROUP).values(broadcastRows);
  }

  return session;
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
 * Finds a session player row by session and user.
 * @param sessionId - Session id.
 * @param userId - User id.
 * @returns Session player or null.
 */
export async function findPlayerBySessionAndUser(
  sessionId: number,
  userId: string
): Promise<SessionPlayer | null> {
  const result = await db
    .select()
    .from(SESSION_PLAYER)
    .where(and(eq(SESSION_PLAYER.session_id, sessionId), eq(SESSION_PLAYER.user_id, userId)))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Creates or reactivates a session player for reconnect-safe room membership.
 * @param data - Player data.
 * @param data.sessionId - Session id.
 * @param data.userId - Player user id.
 * @param data.username - Player display name.
 * @returns Persisted player row.
 */
export async function upsertSessionPlayer(data: {
  sessionId: number;
  userId: string;
  username: string;
}): Promise<SessionPlayer> {
  const existingPlayer = await findPlayerBySessionAndUser(data.sessionId, data.userId);

  if (existingPlayer) {
    const result = await db
      .update(SESSION_PLAYER)
      .set({ username: data.username, status: 'active' })
      .where(eq(SESSION_PLAYER.id, existingPlayer.id))
      .returning();

    return result[0];
  }

  const result = await db
    .insert(SESSION_PLAYER)
    .values({
      session_id: data.sessionId,
      user_id: data.userId,
      username: data.username,
      score: 0,
      status: 'active',
    })
    .returning();

  return result[0];
}

/**
 * Updates a player's score and returns the updated row.
 * @param playerId - Session player id.
 * @param score - Authoritative total score.
 * @returns Updated player row.
 */
export async function updatePlayerScore(playerId: number, score: number): Promise<SessionPlayer> {
  const result = await db
    .update(SESSION_PLAYER)
    .set({ score })
    .where(eq(SESSION_PLAYER.id, playerId))
    .returning();

  return result[0];
}

/**
 * Marks a player disconnected without removing their room identity.
 * @param sessionId - Session id.
 * @param userId - User id.
 */
export async function markPlayerDisconnected(sessionId: number, userId: string): Promise<void> {
  const player = await findPlayerBySessionAndUser(sessionId, userId);

  if (!player) {
    return;
  }

  await db
    .update(SESSION_PLAYER)
    .set({ status: 'disconnected' })
    .where(eq(SESSION_PLAYER.id, player.id));
}

/**
 * Lists players for a session in score-friendly order.
 * @param sessionId - Session id.
 * @returns Session players.
 */
export async function listPlayersBySession(sessionId: number): Promise<SessionPlayer[]> {
  return db
    .select()
    .from(SESSION_PLAYER)
    .where(eq(SESSION_PLAYER.session_id, sessionId))
    .orderBy(desc(SESSION_PLAYER.score));
}

/**
 * Persists a gameplay analytics event.
 * @param data - Event insert data.
 * @returns Created event.
 */
export async function createGameEvent(data: InsertGameEvent): Promise<GameEvent> {
  const result = await db.insert(GAME_EVENT).values(data).returning();
  return result[0];
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
