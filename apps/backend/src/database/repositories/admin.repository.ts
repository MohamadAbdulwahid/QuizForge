import { and, count, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../client';
import { SESSION, SESSION_PLAYER, GAME_EVENT } from '../schema/session';
import { QUIZ, QUESTION } from '../schema/quiz';
import { USER } from '../schema/auth/user';

const ACTIVE_STATUSES = ['waiting', 'playing', 'paused', 'in-progress'] as const;
const STALE_THRESHOLD_MINUTES = 30;

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  endedSessions: number;
  totalPlayers: number;
  averagePlayersPerSession: number;
  completionRate: number;
}

export interface RecentSessionSummary {
  id: number;
  pin: string;
  status: string;
  quizTitle: string;
  hostEmail: string;
  playerCount: number;
  startedAt: Date;
}

export interface SessionAnalytics {
  sessionId: number;
  pin: string;
  quizTitle: string;
  status: string;
  playerCount: number;
  totalQuestions: number;
  answeredQuestions: number;
  averageAnswerTimeMs: number | null;
  startedAt: Date;
}

export interface StaleSession {
  id: number;
  pin: string;
  status: string;
  quizTitle: string;
  hostEmail: string;
  playerCount: number;
  startedAt: Date;
  minutesSinceStart: number;
}

/**
 * Returns aggregate session statistics.
 */
export async function getSessionStats(): Promise<SessionStats> {
  const [totalRow] = await db.select({ value: count() }).from(SESSION);

  const [activeRow] = await db
    .select({ value: count() })
    .from(SESSION)
    .where(inArray(SESSION.status, ACTIVE_STATUSES));

  const [endedRow] = await db
    .select({ value: count() })
    .from(SESSION)
    .where(eq(SESSION.status, 'ended'));

  const [playerRow] = await db.select({ value: count() }).from(SESSION_PLAYER);

  const totalSessions = totalRow?.value ?? 0;
  const activeSessions = activeRow?.value ?? 0;
  const endedSessions = endedRow?.value ?? 0;
  const totalPlayers = playerRow?.value ?? 0;

  return {
    totalSessions,
    activeSessions,
    endedSessions,
    totalPlayers,
    averagePlayersPerSession:
      totalSessions > 0 ? Math.round((totalPlayers / totalSessions) * 10) / 10 : 0,
    completionRate: totalSessions > 0 ? Math.round((endedSessions / totalSessions) * 100) : 0,
  };
}

/**
 * Returns recent sessions with player counts, newest first.
 */
export async function getRecentSessions(limit = 20): Promise<RecentSessionSummary[]> {
  const rows = await db
    .select({
      id: SESSION.id,
      pin: SESSION.pin,
      status: SESSION.status,
      quizTitle: QUIZ.title,
      hostEmail: USER.email,
      playerCount: sql<number>`cast(count(${SESSION_PLAYER.id}) as int)`,
      startedAt: SESSION.started_at,
    })
    .from(SESSION)
    .innerJoin(QUIZ, eq(SESSION.quiz_id, QUIZ.id))
    .innerJoin(USER, eq(SESSION.host_id, USER.id))
    .leftJoin(SESSION_PLAYER, eq(SESSION.id, SESSION_PLAYER.session_id))
    .groupBy(SESSION.id, QUIZ.title, USER.email)
    .orderBy(desc(SESSION.started_at))
    .limit(limit);

  return rows;
}

/**
 * Returns detailed analytics for a specific session.
 */
export async function getSessionAnalytics(sessionId: number): Promise<SessionAnalytics | null> {
  const [sessionRow] = await db
    .select({
      sessionId: SESSION.id,
      pin: SESSION.pin,
      quizTitle: QUIZ.title,
      status: SESSION.status,
      playerCount: sql<number>`cast(count(distinct ${SESSION_PLAYER.id}) as int)`,
      startedAt: SESSION.started_at,
    })
    .from(SESSION)
    .innerJoin(QUIZ, eq(SESSION.quiz_id, QUIZ.id))
    .leftJoin(SESSION_PLAYER, eq(SESSION.id, SESSION_PLAYER.session_id))
    .where(eq(SESSION.id, sessionId))
    .groupBy(SESSION.id, QUIZ.title);

  if (!sessionRow) return null;

  // Count questions from quiz
  const [{ value: totalQuestions }] = await db
    .select({ value: count() })
    .from(QUESTION)
    .where(eq(QUESTION.quiz_id, sessionRow.sessionId));

  // Count answer submissions from game events
  const [{ value: answeredQuestions }] = await db
    .select({ value: count() })
    .from(GAME_EVENT)
    .where(
      and(eq(GAME_EVENT.session_id, sessionId), eq(GAME_EVENT.event_type, 'answer-submitted'))
    );

  // Average answer time from game events
  const [avgRow] = await db
    .select({
      avgMs: sql<number | null>`avg((data->>'elapsedMs')::numeric)`,
    })
    .from(GAME_EVENT)
    .where(
      and(eq(GAME_EVENT.session_id, sessionId), eq(GAME_EVENT.event_type, 'answer-submitted'))
    );

  return {
    ...sessionRow,
    totalQuestions,
    answeredQuestions,
    averageAnswerTimeMs: avgRow?.avgMs ? Math.round(avgRow.avgMs) : null,
  };
}

/**
 * Returns stale sessions (active for >30 minutes without host connection).
 */
export async function getStaleSessions(): Promise<StaleSession[]> {
  const threshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

  const rows = await db
    .select({
      id: SESSION.id,
      pin: SESSION.pin,
      status: SESSION.status,
      quizTitle: QUIZ.title,
      hostEmail: USER.email,
      playerCount: sql<number>`cast(count(${SESSION_PLAYER.id}) as int)`,
      startedAt: SESSION.started_at,
      minutesSinceStart: sql<number>`cast(extract(epoch from (now() - ${SESSION.started_at})) / 60 as int)`,
    })
    .from(SESSION)
    .innerJoin(QUIZ, eq(SESSION.quiz_id, QUIZ.id))
    .innerJoin(USER, eq(SESSION.host_id, USER.id))
    .leftJoin(SESSION_PLAYER, eq(SESSION.id, SESSION_PLAYER.session_id))
    .where(and(inArray(SESSION.status, ACTIVE_STATUSES), lt(SESSION.started_at, threshold)))
    .groupBy(SESSION.id, QUIZ.title, USER.email)
    .orderBy(desc(SESSION.started_at));

  return rows;
}

/**
 * Terminates a stale session by setting its status to 'ended'.
 */
export async function terminateSession(sessionId: number): Promise<boolean> {
  const result = await db
    .update(SESSION)
    .set({ status: 'ended' })
    .where(and(eq(SESSION.id, sessionId), inArray(SESSION.status, ACTIVE_STATUSES)))
    .returning();

  return result.length > 0;
}
