import { and, desc, eq, inArray, notInArray } from 'drizzle-orm';
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
  CHEST_PICK,
  SessionPlayer,
  GameEvent,
  InsertGameEvent,
  ChestPick,
  InsertChestPick,
  GameMode,
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
 * @param data.gameMode - Game mode (forge-classic, treasure-forge, or bubbly-royale).
 * @param data.tfEndMode - Treasure Forge end condition mode.
 * @param data.tfTimerMinutes - Treasure Forge timer in minutes.
 * @param data.tfGoldGoal - Treasure Forge gold goal.
 * @param data.brTopN - Bubbly Royale top N players to rank.
 * @param data.brStartingLives - Bubbly Royale starting lives per player.
 * @param data.brDuelTimerS - Bubbly Royale duel timer in seconds.
 * @param data.brPowerBubbleTimerS - Bubbly Royale power bubble timer in seconds.
 * @param data.groupIds - Broadcast group ids snapshot.
 * @returns Created session row.
 */
export async function createSession(data: {
  quizId: number;
  pin: string;
  hostId: string;
  status?: SessionStatus;
  broadcastMode?: SessionBroadcastMode;
  gameMode?: GameMode;
  groupIds?: number[];
  tfEndMode?: string | null;
  tfTimerMinutes?: number | null;
  tfGoldGoal?: number | null;
  brTopN?: number | null;
  brStartingLives?: number | null;
  brDuelTimerS?: number | null;
  brPowerBubbleTimerS?: number | null;
}): Promise<Session> {
  const payload: InsertSession = {
    quiz_id: data.quizId,
    pin: data.pin,
    host_id: data.hostId,
    status: data.status ?? 'waiting',
    broadcast_mode: data.broadcastMode ?? 'private',
    game_mode: data.gameMode ?? 'forge-classic',
    tf_end_mode: data.tfEndMode ?? null,
    tf_timer_minutes: data.tfTimerMinutes ?? null,
    tf_gold_goal: data.tfGoldGoal ?? null,
    br_top_n: data.brTopN ?? undefined,
    br_starting_lives: data.brStartingLives ?? undefined,
    br_duel_timer_s: data.brDuelTimerS ?? undefined,
    br_power_bubble_timer_s: data.brPowerBubbleTimerS ?? undefined,
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
 * Updates the session's started_at timestamp to the current time.
 * Used by Treasure Forge to set the baseline for the global timer.
 * @param sessionId - Session id.
 * @returns Updated session or null.
 */
export async function updateSessionStartTime(sessionId: number): Promise<Session | null> {
  const result = await db
    .update(SESSION)
    .set({ started_at: new Date() })
    .where(eq(SESSION.id, sessionId))
    .returning();

  return result[0] ?? null;
}

/**
 * Returns the broadcast group IDs for a session.
 * Used by SSE to filter which users should receive lifecycle events.
 * @param sessionId - Session id.
 * @returns Array of group IDs the session is broadcast to.
 */
export async function listBroadcastGroupIds(sessionId: number): Promise<number[]> {
  const result = await db
    .select({ groupId: SESSION_BROADCAST_GROUP.group_id })
    .from(SESSION_BROADCAST_GROUP)
    .where(eq(SESSION_BROADCAST_GROUP.session_id, sessionId));
  return result.map((row) => row.groupId);
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
 * Finds a session player row by session and username (for uniqueness checks).
 * Excludes disconnected players so reconnecting users can reclaim their name.
 * @param sessionId - Session id.
 * @param username - Player display name.
 * @returns Session player or null.
 */
export async function findActivePlayerByUsername(
  sessionId: number,
  username: string
): Promise<SessionPlayer | null> {
  const result = await db
    .select()
    .from(SESSION_PLAYER)
    .where(
      and(
        eq(SESSION_PLAYER.session_id, sessionId),
        eq(SESSION_PLAYER.username, username),
        eq(SESSION_PLAYER.status, 'active')
      )
    )
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
 * Finds a session by pin regardless of status.
 * Unlike findByPin which filters for active sessions only, this returns
 * any session matching the pin — including ended or pending sessions.
 * Used by the host view endpoint to look up sessions before the game starts.
 * @param pin - Session pin.
 * @returns Session or null.
 */
export async function getSessionByPin(pin: string): Promise<Session | null> {
  const result = await db.select().from(SESSION).where(eq(SESSION.pin, pin)).limit(1);

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

/**
 * Deletes sessions that have reached a terminal status.
 * Removes rows where status is 'ended' or 'finished' to prevent
 * orphaned session data from accumulating in the database.
 * @returns Number of deleted session rows.
 */
export async function cleanupEndedSessions(): Promise<number> {
  const terminalStatuses: SessionStatus[] = ['ended'];

  const result = await db.delete(SESSION).where(inArray(SESSION.status, terminalStatuses));

  return result.rowCount ?? 0;
}

/**
 * Deletes active sessions whose host is no longer connected via WebSocket.
 * Prevents zombie sessions when a host closes their browser or loses
 * connectivity without explicitly ending the session.
 * @param connectedHostIds - Set of host user IDs with active WebSocket connections.
 * @returns Number of deleted orphaned session rows.
 */
export async function cleanupOrphanedSessions(connectedHostIds: Set<string>): Promise<number> {
  if (connectedHostIds.size === 0) {
    return 0;
  }

  const result = await db
    .delete(SESSION)
    .where(
      and(
        inArray(SESSION.status, ACTIVE_STATUSES),
        notInArray(SESSION.host_id, [...connectedHostIds])
      )
    );

  return result.rowCount ?? 0;
}

/**
 * Deletes a session by its primary key.
 * Cascades to session_players and game_events via DB foreign key constraints.
 * @param id - Session id.
 */
export async function deleteSession(id: number): Promise<void> {
  await db.delete(SESSION).where(eq(SESSION.id, id));
}

/**
 * Deletes all players associated with a session.
 * Useful when cleanup is needed before deleting the session row,
 * or when explicitly removing player data.
 * @param sessionId - Session id.
 */
export async function deletePlayersBySession(sessionId: number): Promise<void> {
  await db.delete(SESSION_PLAYER).where(eq(SESSION_PLAYER.session_id, sessionId));
}

/**
 * Creates a chest pick record for Treasure Forge audit trail.
 * @param data - Chest pick insert data.
 * @returns Created chest pick row.
 */
export async function createChestPick(data: InsertChestPick): Promise<ChestPick> {
  const result = await db.insert(CHEST_PICK).values(data).returning();
  return result[0];
}

/**
 * Checks whether a player has already picked a chest for a given round.
 * Prevents duplicate chest picks per round.
 * @param sessionId - Session id.
 * @param playerId - Session player id.
 * @param roundNumber - Round number (1-indexed).
 * @returns True when a pick already exists.
 */
export async function hasPlayerPickedChest(
  sessionId: number,
  playerId: number,
  roundNumber: number
): Promise<boolean> {
  const result = await db
    .select({ id: CHEST_PICK.id })
    .from(CHEST_PICK)
    .where(
      and(
        eq(CHEST_PICK.session_id, sessionId),
        eq(CHEST_PICK.session_player_id, playerId),
        eq(CHEST_PICK.round_number, roundNumber)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Lists all chest picks for a session, ordered by creation time.
 * Used for post-game analytics and replay.
 * @param sessionId - Session id.
 * @returns Chest picks for the session.
 */
export async function listChestPicksBySession(sessionId: number): Promise<ChestPick[]> {
  return db
    .select()
    .from(CHEST_PICK)
    .where(eq(CHEST_PICK.session_id, sessionId))
    .orderBy(CHEST_PICK.created_at);
}
