import { createChildLogger } from '../../config/logger';
import * as adminRepository from '../../database/repositories/admin.repository';
import { NotFoundError } from '../../shared/errors';

const adminServiceLogger = createChildLogger('admin-service');

/**
 * Returns aggregate platform statistics for the admin dashboard.
 */
export async function getPlatformStats(): Promise<adminRepository.SessionStats> {
  return adminRepository.getSessionStats();
}

/**
 * Returns recent sessions with player counts for the admin dashboard.
 */
export async function getRecentSessions(
  limit = 20
): Promise<adminRepository.RecentSessionSummary[]> {
  return adminRepository.getRecentSessions(limit);
}

/**
 * Returns detailed analytics for a specific session.
 */
export async function getSessionAnalytics(
  sessionId: number
): Promise<adminRepository.SessionAnalytics> {
  const analytics = await adminRepository.getSessionAnalytics(sessionId);

  if (!analytics) {
    throw new NotFoundError('Session not found', 'SESSION_NOT_FOUND');
  }

  return analytics;
}

/**
 * Returns stale/abandoned sessions that may need admin attention.
 */
export async function getStaleSessions(): Promise<adminRepository.StaleSession[]> {
  return adminRepository.getStaleSessions();
}

/**
 * Terminates a stale session.
 * @param sessionId - Session to terminate.
 * @param adminId - Admin user performing the action (for logging).
 */
export async function terminateSession(
  sessionId: number,
  adminId: string
): Promise<{ terminated: boolean }> {
  const terminated = await adminRepository.terminateSession(sessionId);

  if (terminated) {
    adminServiceLogger.info({ sessionId, adminId }, 'Admin terminated stale session');
  }

  return { terminated };
}
