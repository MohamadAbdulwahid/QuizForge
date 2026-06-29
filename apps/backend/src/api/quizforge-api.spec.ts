import type { Request, Response } from 'express';
import { Tspec } from 'tspec';
import type {
  CreateGroupRequest,
  InviteActionRequest,
  InviteMemberRequest,
  JoinRequestActionRequest,
  UpdateGroupRequest,
  UpdateMemberRoleRequest,
} from './dtos/group.dto';
import type {
  CreateQuizRequest,
  DiscoverQuizzesQuery,
  DiscoverQuizzesResponse,
  UpdateQuizRequest,
} from './dtos/quiz.dto';
import type { AiRemixRequest } from './dtos/ai-remix.dto';
import type { AiTranslateRequest } from './dtos/ai-translate.dto';
import type { CreateSessionRequest, UpdateSessionStatusRequest } from './dtos/session.dto';
import type { SignInDto, SignUpDto } from './dtos/auth.dto';

type HealthResponse = { status: string; timestamp: number };
type ErrorResponse = { error: string; code: string; statusCode: number };
type ConfigResponse = { supabaseUrl: string; supabasePublishableKey: string; sentryDsn: string };

type HealthHandler = (_req: Request, res: Response<HealthResponse>) => void;
type ConfigHandler = (_req: Request, res: Response<ConfigResponse>) => void;
type SignUpHandler = (_req: Request<unknown, unknown, SignUpDto>, res: Response<unknown>) => void;
type LoginHandler = (_req: Request<unknown, unknown, SignInDto>, res: Response<unknown>) => void;
type CreateQuizHandler = (
  _req: Request<unknown, unknown, CreateQuizRequest>,
  res: Response<unknown>
) => void;
type GetMyQuizzesHandler = (_req: Request, res: Response<unknown>) => void;
type GetQuizByIdHandler = (_req: Request<{ id: string }>, res: Response<unknown>) => void;
type PatchQuizHandler = (
  _req: Request<{ id: string }, unknown, UpdateQuizRequest>,
  res: Response<unknown>
) => void;
type DeleteQuizHandler = (_req: Request<{ id: string }>, res: Response<unknown>) => void;
type PublicQuizByCodeHandler = (
  _req: Request<{ shareCode: string }>,
  res: Response<unknown>
) => void;
type DiscoverQuizzesHandler = (
  _req: Request<unknown, unknown, unknown, DiscoverQuizzesQuery>,
  res: Response<DiscoverQuizzesResponse>
) => void;
type CreateGroupHandler = (
  _req: Request<unknown, unknown, CreateGroupRequest>,
  res: Response<unknown>
) => void;
type ListMyGroupsHandler = (_req: Request, res: Response<unknown>) => void;
type SearchGroupsHandler = (
  _req: Request<unknown, unknown, unknown, { query: string }>,
  res: Response<unknown>
) => void;
type GetGroupByIdHandler = (_req: Request<{ id: string }>, res: Response<unknown>) => void;
type UpdateGroupHandler = (
  _req: Request<{ id: string }, unknown, UpdateGroupRequest>,
  res: Response<unknown>
) => void;
type JoinGroupHandler = (_req: Request<{ id: string }>, res: Response<unknown>) => void;
type ListJoinRequestsHandler = (_req: Request<{ id: string }>, res: Response<unknown>) => void;
type RespondJoinRequestHandler = (
  _req: Request<{ id: string; requestId: string }, unknown, JoinRequestActionRequest>,
  res: Response<unknown>
) => void;
type InviteGroupMemberHandler = (
  _req: Request<{ id: string }, unknown, InviteMemberRequest>,
  res: Response<unknown>
) => void;
type ListMyInvitesHandler = (_req: Request, res: Response<unknown>) => void;
type RespondInviteHandler = (
  _req: Request<{ inviteId: string }, unknown, InviteActionRequest>,
  res: Response<unknown>
) => void;
type UpdateMemberRoleHandler = (
  _req: Request<{ id: string; userId: string }, unknown, UpdateMemberRoleRequest>,
  res: Response<unknown>
) => void;
type RemoveMemberHandler = (
  _req: Request<{ id: string; userId: string }>,
  res: Response<unknown>
) => void;
type GroupActiveSessionsHandler = (_req: Request<{ id: string }>, res: Response<unknown>) => void;
type CreateSessionHandler = (
  _req: Request<unknown, unknown, CreateSessionRequest>,
  res: Response<unknown>
) => void;
type AiRemixQuizHandler = (
  _req: Request<{ id: string }, unknown, AiRemixRequest>,
  res: Response<unknown>
) => void;
type AiTranslateQuizHandler = (
  _req: Request<{ id: string }, unknown, AiTranslateRequest>,
  res: Response<unknown>
) => void;
type GetSessionByPinHandler = (_req: Request<{ pin: string }>, res: Response<unknown>) => void;
type PatchSessionStatusHandler = (
  _req: Request<{ pin: string }, unknown, UpdateSessionStatusRequest>,
  res: Response<unknown>
) => void;

export type QuizForgeApiSpec = Tspec.DefineApiSpec<{
  tags: ['Auth', 'Quiz', 'Session', 'Group', 'Config'];
  paths: {
    '/health': {
      get: {
        tags: ['Auth'];
        summary: 'Health check';
        handler: HealthHandler;
        responses: {
          200: HealthResponse;
        };
      };
    };
    '/api/config': {
      get: {
        tags: ['Config'];
        summary: 'Get public backend configuration';
        handler: ConfigHandler;
        responses: {
          200: ConfigResponse;
        };
      };
    };
    '/api/auth/signup': {
      post: {
        tags: ['Auth'];
        summary: 'Create account';
        handler: SignUpHandler;
        responses: {
          201: unknown;
          400: ErrorResponse;
          409: ErrorResponse;
        };
      };
    };
    '/api/auth/login': {
      post: {
        tags: ['Auth'];
        summary: 'Login user';
        handler: LoginHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
        };
      };
    };
    '/api/quizzes': {
      post: {
        tags: ['Quiz'];
        summary: 'Create quiz';
        handler: CreateQuizHandler;
        responses: {
          201: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
        };
      };
      get: {
        tags: ['Quiz'];
        summary: 'Get my quizzes';
        handler: GetMyQuizzesHandler;
        responses: {
          200: unknown;
          401: ErrorResponse;
        };
      };
    };
    '/api/quizzes/discover': {
      get: {
        tags: ['Quiz'];
        summary: 'Discover public quizzes';
        handler: DiscoverQuizzesHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
        };
      };
    };
    '/api/quizzes/{id}': {
      get: {
        tags: ['Quiz'];
        summary: 'Get quiz by id';
        handler: GetQuizByIdHandler;
        responses: {
          200: unknown;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
        };
      };
      patch: {
        tags: ['Quiz'];
        summary: 'Update quiz';
        handler: PatchQuizHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
        };
      };
      delete: {
        tags: ['Quiz'];
        summary: 'Delete quiz';
        handler: DeleteQuizHandler;
        responses: {
          204: unknown;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
        };
      };
    };
    '/api/quizzes/share/{shareCode}': {
      get: {
        tags: ['Quiz'];
        summary: 'Get quiz by share code';
        handler: PublicQuizByCodeHandler;
        responses: {
          200: unknown;
          404: ErrorResponse;
        };
      };
    };
    '/api/groups': {
      post: {
        tags: ['Group'];
        summary: 'Create group';
        handler: CreateGroupHandler;
        responses: {
          201: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
        };
      };
      get: {
        tags: ['Group'];
        summary: 'List my groups';
        handler: ListMyGroupsHandler;
        responses: {
          200: unknown;
          401: ErrorResponse;
        };
      };
    };
    '/api/groups/search': {
      get: {
        tags: ['Group'];
        summary: 'Search discoverable groups';
        handler: SearchGroupsHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
        };
      };
    };
    '/api/groups/invitations/mine': {
      get: {
        tags: ['Group'];
        summary: 'List my pending group invites';
        handler: ListMyInvitesHandler;
        responses: {
          200: unknown;
          401: ErrorResponse;
        };
      };
    };
    '/api/groups/invitations/{inviteId}': {
      patch: {
        tags: ['Group'];
        summary: 'Accept or decline group invite';
        handler: RespondInviteHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
          404: ErrorResponse;
          409: ErrorResponse;
        };
      };
    };
    '/api/groups/{id}': {
      get: {
        tags: ['Group'];
        summary: 'Get group details';
        handler: GetGroupByIdHandler;
        responses: {
          200: unknown;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
        };
      };
      patch: {
        tags: ['Group'];
        summary: 'Update group settings';
        handler: UpdateGroupHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
        };
      };
    };
    '/api/groups/{id}/join': {
      post: {
        tags: ['Group'];
        summary: 'Join or request to join a group';
        handler: JoinGroupHandler;
        responses: {
          200: unknown;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
          409: ErrorResponse;
        };
      };
    };
    '/api/groups/{id}/join-requests': {
      get: {
        tags: ['Group'];
        summary: 'List pending join requests';
        handler: ListJoinRequestsHandler;
        responses: {
          200: unknown;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
        };
      };
    };
    '/api/groups/{id}/join-requests/{requestId}': {
      patch: {
        tags: ['Group'];
        summary: 'Approve or reject a join request';
        handler: RespondJoinRequestHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
          409: ErrorResponse;
        };
      };
    };
    '/api/groups/{id}/invitations': {
      post: {
        tags: ['Group'];
        summary: 'Invite a member by username';
        handler: InviteGroupMemberHandler;
        responses: {
          201: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
          409: ErrorResponse;
        };
      };
    };
    '/api/groups/{id}/members/{userId}/role': {
      patch: {
        tags: ['Group'];
        summary: 'Promote or demote member role';
        handler: UpdateMemberRoleHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
          409: ErrorResponse;
        };
      };
    };
    '/api/groups/{id}/members/{userId}': {
      delete: {
        tags: ['Group'];
        summary: 'Remove member from group';
        handler: RemoveMemberHandler;
        responses: {
          204: unknown;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
          409: ErrorResponse;
        };
      };
    };
    '/api/groups/{id}/active-sessions': {
      get: {
        tags: ['Group'];
        summary: 'List active sessions visible to a group';
        handler: GroupActiveSessionsHandler;
        responses: {
          200: unknown;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
        };
      };
    };
    '/api/sessions': {
      post: {
        tags: ['Session'];
        summary: 'Create session';
        handler: CreateSessionHandler;
        responses: {
          201: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
          409: ErrorResponse;
        };
      };
    };
    '/api/sessions/{pin}': {
      get: {
        tags: ['Session'];
        summary: 'Get active session by pin';
        handler: GetSessionByPinHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          404: ErrorResponse;
        };
      };
    };
    '/api/sessions/{pin}/status': {
      patch: {
        tags: ['Session'];
        summary: 'Transition session status';
        handler: PatchSessionStatusHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
        };
      };
    };
    '/api/quizzes/{id}/ai-remix': {
      post: {
        tags: ['Quiz'];
        summary: 'AI remix a quiz (creates a new owned quiz)';
        handler: AiRemixQuizHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
          429: ErrorResponse;
          502: ErrorResponse;
          503: ErrorResponse;
          504: ErrorResponse;
        };
      };
    };
    '/api/quizzes/{id}/ai-translate': {
      post: {
        tags: ['Quiz'];
        summary: 'AI translate a quiz to a target language (creates a new owned quiz)';
        handler: AiTranslateQuizHandler;
        responses: {
          200: unknown;
          400: ErrorResponse;
          401: ErrorResponse;
          403: ErrorResponse;
          404: ErrorResponse;
          429: ErrorResponse;
          502: ErrorResponse;
          503: ErrorResponse;
          504: ErrorResponse;
        };
      };
    };
  };
}>;
