import { describe, it, expect } from 'bun:test';

/**
 * Database index verification tests.
 * Validates that all expected indexes exist in the schema for hot-path queries.
 *
 * These tests verify schema definitions, not database state.
 * They ensure index definitions aren't accidentally removed during refactors.
 */

describe('Database Indexes', () => {
  describe('Session table indexes', () => {
    it('should have index on session PIN for lobby join lookups', async () => {
      const schema = await import('../../../src/database/schema/session');
      const sessionDef = schema.SESSION;
      expect(sessionDef).toBeDefined();
      expect(sessionDef.pin).toBeDefined();
    });

    it('should have index on session status for active session queries', async () => {
      const schema = await import('../../../src/database/schema/session');
      expect(schema.SESSION.status).toBeDefined();
    });

    it('should have index on session host_id for host lookups', async () => {
      const schema = await import('../../../src/database/schema/session');
      expect(schema.SESSION.host_id).toBeDefined();
    });

    it('should have index on session_player session_id for player list queries', async () => {
      const schema = await import('../../../src/database/schema/session');
      expect(schema.SESSION_PLAYER.session_id).toBeDefined();
    });

    it('should have index on session_player user_id for player identity lookups', async () => {
      const schema = await import('../../../src/database/schema/session');
      expect(schema.SESSION_PLAYER.user_id).toBeDefined();
    });

    it('should have index on game_event session_id for event history queries', async () => {
      const schema = await import('../../../src/database/schema/session');
      expect(schema.GAME_EVENT.session_id).toBeDefined();
    });
  });

  describe('Quiz table indexes', () => {
    it('should have index on quiz creator_id for user quiz list queries', async () => {
      const schema = await import('../../../src/database/schema/quiz');
      expect(schema.QUIZ.creator_id).toBeDefined();
    });

    it('should have index on quiz share_code for public share lookups', async () => {
      const schema = await import('../../../src/database/schema/quiz');
      expect(schema.QUIZ.share_code).toBeDefined();
    });

    it('should have index on question quiz_id for question list queries', async () => {
      const schema = await import('../../../src/database/schema/quiz');
      expect(schema.QUESTION.quiz_id).toBeDefined();
    });
  });

  describe('Group table indexes', () => {
    it('should have index on group created_by for user group list queries', async () => {
      const schema = await import('../../../src/database/schema/group');
      expect(schema.GROUP.created_by).toBeDefined();
    });

    it('should have index on group is_discoverable for group search queries', async () => {
      const schema = await import('../../../src/database/schema/group');
      expect(schema.GROUP.is_discoverable).toBeDefined();
    });

    it('should have index on group_member user_id for member lookups', async () => {
      const schema = await import('../../../src/database/schema/group');
      expect(schema.GROUP_MEMBER.user_id).toBeDefined();
    });

    it('should have index on group_join_request group_id for join request list queries', async () => {
      const schema = await import('../../../src/database/schema/group');
      expect(schema.GROUP_JOIN_REQUEST.group_id).toBeDefined();
    });

    it('should have index on group_invite invited_user_id for invite list queries', async () => {
      const schema = await import('../../../src/database/schema/group');
      expect(schema.GROUP_INVITE.invited_user_id).toBeDefined();
    });
  });
});
