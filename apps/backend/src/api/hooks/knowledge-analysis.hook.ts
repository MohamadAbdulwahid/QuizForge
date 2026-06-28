import { db } from '../../database/client';
import { GAME_EVENT, SESSION_PLAYER } from '../../database/schema/session';
import { eq, and } from 'drizzle-orm';
import { createChildLogger } from '../../config/logger';
import { analyzeSession } from '../services/knowledge-analysis.service';
import {
  sessionEventEmitter,
  emitKnowledgeAnalysisCompleted,
  type SessionLifecycleEvent,
} from '../services/session-event.service';

const hookLogger = createChildLogger('knowledge-analysis-hook');

/**
 * Checks if a session was successfully completed (reached leaderboard).
 * A session is considered successfully completed if it has a 'game-ended'
 * or 'session-ended' event in the game_event table.
 */
async function wasSessionSuccessfullyCompleted(sessionId: number): Promise<boolean> {
  const { or } = await import('drizzle-orm');
  
  const events = await db
    .select({ id: GAME_EVENT.id })
    .from(GAME_EVENT)
    .where(
      and(
        eq(GAME_EVENT.session_id, sessionId),
        or(
          eq(GAME_EVENT.event_type, 'game-ended'),
          eq(GAME_EVENT.event_type, 'session-ended')
        )
      )
    )
    .limit(1);

  return events.length > 0;
}

/**
 * Fetches the user IDs of all players who participated in a session.
 */
async function getSessionPlayerUserIds(sessionId: number): Promise<string[]> {
  const players = await db
    .select({ userId: SESSION_PLAYER.user_id })
    .from(SESSION_PLAYER)
    .where(eq(SESSION_PLAYER.session_id, sessionId));

  return players.map((p) => p.userId).filter((id): id is string => id !== null);
}

/**
 * Registers a listener on the session lifecycle event bus that triggers
 * knowledge analysis when a session ends successfully.
 *
 * A session is considered successfully completed only if it has a
 * 'game-ended' event in the game_event table, indicating the game
 * reached the leaderboard and was not ended early by the host.
 *
 * The analysis runs as fire-and-forget — it does not block the session-end
 * response. Errors are logged but never propagate to the caller.
 *
 * When analysis completes, emits a 'knowledge-analysis-completed' SSE event
 * so the frontend can refresh the Knowledge Map for the affected players.
 *
 * Call this once during application startup (e.g. in `main.ts`).
 */
export function registerKnowledgeAnalysisHook(): void {
  sessionEventEmitter.on('session-change', (event: SessionLifecycleEvent) => {
    if (event.type !== 'ended') return;

    const { sessionId } = event;

    hookLogger.info({ sessionId }, 'Session ended — will check if game completed successfully');

    // Add a delay to ensure game-ended event has been logged to the database
    // (logGameEvent is called with void/fire-and-forget, so we need to wait)
    setTimeout(() => {
      void (async () => {
        try {
          // Only analyze if the game reached the leaderboard
          const completed = await wasSessionSuccessfullyCompleted(sessionId);
          if (!completed) {
            hookLogger.info({ sessionId }, 'Session ended early — skipping knowledge analysis');
            return;
          }

          hookLogger.info({ sessionId }, 'Game completed successfully — triggering knowledge analysis');

          // Fetch player user IDs before analysis (for SSE notification)
          const playerUserIds = await getSessionPlayerUserIds(sessionId);

          const result = await analyzeSession(sessionId);
          hookLogger.info(
            { sessionId, nodeCount: result.nodeCount, edgeCount: result.edgeCount },
            'Knowledge analysis completed'
          );

          // Notify affected players via SSE so their Knowledge Map refreshes
          if (playerUserIds.length > 0) {
            emitKnowledgeAnalysisCompleted(
              sessionId,
              playerUserIds,
              result.nodeCount,
              result.edgeCount
            );
            hookLogger.info(
              { sessionId, playerCount: playerUserIds.length },
              'Emitted knowledge-analysis-completed SSE event'
            );
          }
        } catch (err) {
          hookLogger.error({ err, sessionId }, 'Knowledge analysis failed — non-fatal');
        }
      })();
    }, 2000); // 2 second delay to ensure game-ended event is logged
  });

  hookLogger.info('Knowledge analysis hook registered');
}
