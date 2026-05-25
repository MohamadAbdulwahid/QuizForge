import { Router } from 'express';
import { createChildLogger } from '../../config/logger';
import { supabaseClient } from '../../config/supabase';
import { listGroupIdsByMember } from '../../database/repositories/group.repository';
import { sessionEventEmitter } from '../services/session-event.service';
import type { SessionLifecycleEvent } from '../services/session-event.service';

const sseLogger = createChildLogger('sse');

/**
 * SSE router for session lifecycle events.
 *
 * GET /api/sessions/events
 *
 * Streams `created` and `ended` session events relevant to the
 * authenticated user's groups. Uses `Authorization: Bearer` or
 * `?token=` query param (EventSource fallback).
 *
 * Event format (SSE data: line):
 *   {"type":"created","sessionId":123,"groupIds":[1,2],"timestamp":"..."}
 *
 * Keep-alive comments are sent every 30 s to prevent proxy timeouts.
 */
export const sessionEventsRouter = Router();

sessionEventsRouter.get('/events', async (req, res) => {
  // --- Auth --------------------------------------------------------
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : queryToken;

  if (!token) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // --- User's groups (for filtering) --------------------------------
  let groupIds: number[];
  try {
    groupIds = await listGroupIdsByMember(user.id);
  } catch (err) {
    sseLogger.error({ err, userId: user.id }, 'Failed to fetch group IDs');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  // --- SSE headers --------------------------------------------------
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send an initial comment so the client knows the connection is open
  res.write(':connected\n\n');

  sseLogger.info({ userId: user.id, groupCount: groupIds.length }, 'SSE client connected');

  // --- Subscribe to events ------------------------------------------
  const onSessionEvent = (event: SessionLifecycleEvent) => {
    const hasMatchingGroup = event.groupIds.some((gid) => groupIds.includes(gid));
    if (hasMatchingGroup) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  sessionEventEmitter.on('session-change', onSessionEvent);

  // --- Keep-alive (30 s) --------------------------------------------
  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30_000);

  // --- Cleanup on disconnect ----------------------------------------
  req.on('close', () => {
    sessionEventEmitter.off('session-change', onSessionEvent);
    clearInterval(keepAlive);
    sseLogger.debug({ userId: user.id }, 'SSE client disconnected');
  });
});
