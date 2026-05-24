import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../middleware/auth';
import {
  createGroup,
  getGroupDetails,
  inviteMemberByUsername,
  listActiveSessions,
  listJoinRequests,
  listMyGroups,
  listMyInvites,
  removeMember,
  requestJoin,
  respondToInvite,
  respondToJoinRequest,
  searchGroups,
  updateGroup,
  updateMemberRole,
} from '../services/group.service';
import type {
  CreateGroupRequest,
  InviteActionRequest,
  InviteMemberRequest,
  JoinRequestActionRequest,
  SearchGroupsQuery,
  UpdateGroupRequest,
  UpdateMemberRoleRequest,
} from '../dtos/group.dto';

/**
 * HTTP handlers for group endpoints.
 * Protected routes rely on authMiddleware to guarantee req.user exists.
 */
export class GroupController {
  async createGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const group = await createGroup(userId, req.body as CreateGroupRequest);
    res.status(StatusCodes.CREATED).json(group);
  }

  async listMyGroups(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const groups = await listMyGroups(userId);
    res.status(StatusCodes.OK).json(groups);
  }

  async searchGroups(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const query = req.query as SearchGroupsQuery;
    const groups = await searchGroups(userId, query.query);
    res.status(StatusCodes.OK).json(groups);
  }

  async getGroupDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const group = await getGroupDetails(Number(req.params.id), userId);
    res.status(StatusCodes.OK).json(group);
  }

  async updateGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const group = await updateGroup(Number(req.params.id), userId, req.body as UpdateGroupRequest);
    res.status(StatusCodes.OK).json(group);
  }

  async requestJoin(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await requestJoin(Number(req.params.id), userId);
    res.status(StatusCodes.OK).json(result);
  }

  async listJoinRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await listJoinRequests(Number(req.params.id), userId);
    res.status(StatusCodes.OK).json(result);
  }

  async respondToJoinRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await respondToJoinRequest(
      Number(req.params.id),
      Number(req.params.requestId),
      userId,
      req.body as JoinRequestActionRequest
    );
    res.status(StatusCodes.OK).json(result);
  }

  async inviteMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const invite = await inviteMemberByUsername(
      Number(req.params.id),
      userId,
      req.body as InviteMemberRequest
    );
    res.status(StatusCodes.CREATED).json(invite);
  }

  async listMyInvites(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const invites = await listMyInvites(userId);
    res.status(StatusCodes.OK).json(invites);
  }

  async respondToInvite(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const invite = await respondToInvite(
      Number(req.params.inviteId),
      userId,
      req.body as InviteActionRequest
    );
    res.status(StatusCodes.OK).json(invite);
  }

  async updateMemberRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const member = await updateMemberRole(
      Number(req.params.id),
      userId,
      req.params.userId,
      req.body as UpdateMemberRoleRequest
    );
    res.status(StatusCodes.OK).json(member);
  }

  async removeMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    await removeMember(Number(req.params.id), userId, req.params.userId);
    res.status(StatusCodes.NO_CONTENT).send();
  }

  async listActiveSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const sessions = await listActiveSessions(Number(req.params.id), userId);
    res.status(StatusCodes.OK).json(sessions);
  }
}

export const groupController = new GroupController();
