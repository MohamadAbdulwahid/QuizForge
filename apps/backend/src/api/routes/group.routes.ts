import { Router } from 'express';
import { groupController } from '../controllers/group.controller';
import {
  CreateGroupRequestSchema,
  GroupIdParamSchema,
  InviteActionSchema,
  InviteIdParamSchema,
  InviteMemberRequestSchema,
  JoinRequestActionSchema,
  MemberUserIdParamSchema,
  RequestIdParamSchema,
  SearchGroupsQuerySchema,
  UpdateGroupRequestSchema,
  UpdateMemberRoleSchema,
} from '../dtos/group.dto';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';

export const groupRouter = Router();

groupRouter.use(authMiddleware);
groupRouter.get('/', groupController.listMyGroups);
groupRouter.get(
  '/search',
  (req, res, next) => {
    const parsed = SearchGroupsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.issues,
      });
      return;
    }

    next();
  },
  groupController.searchGroups
);
groupRouter.get('/invitations/mine', groupController.listMyInvites);
groupRouter.patch(
  '/invitations/:inviteId',
  validateParams(InviteIdParamSchema),
  validateBody(InviteActionSchema),
  groupController.respondToInvite
);
groupRouter.post('/', validateBody(CreateGroupRequestSchema), groupController.createGroup);
groupRouter.get('/:id', validateParams(GroupIdParamSchema), groupController.getGroupDetails);
groupRouter.patch(
  '/:id',
  validateParams(GroupIdParamSchema),
  validateBody(UpdateGroupRequestSchema),
  groupController.updateGroup
);
groupRouter.post('/:id/join', validateParams(GroupIdParamSchema), groupController.requestJoin);
groupRouter.get(
  '/:id/join-requests',
  validateParams(GroupIdParamSchema),
  groupController.listJoinRequests
);
groupRouter.patch(
  '/:id/join-requests/:requestId',
  validateParams(RequestIdParamSchema.and(GroupIdParamSchema)),
  validateBody(JoinRequestActionSchema),
  groupController.respondToJoinRequest
);
groupRouter.post(
  '/:id/invitations',
  validateParams(GroupIdParamSchema),
  validateBody(InviteMemberRequestSchema),
  groupController.inviteMember
);
groupRouter.patch(
  '/:id/members/:userId/role',
  validateParams(MemberUserIdParamSchema),
  validateBody(UpdateMemberRoleSchema),
  groupController.updateMemberRole
);
groupRouter.delete(
  '/:id/members/:userId',
  validateParams(MemberUserIdParamSchema),
  groupController.removeMember
);
groupRouter.get(
  '/:id/active-sessions',
  validateParams(GroupIdParamSchema),
  groupController.listActiveSessions
);
