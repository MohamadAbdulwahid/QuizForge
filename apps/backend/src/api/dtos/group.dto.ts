import { z } from 'zod';

const groupJoinPolicySchema = z.enum(['admin-controlled', 'request-approval', 'open']);
const groupMemberRoleSchema = z.enum(['admin', 'member']);

const createGroupRequestSchema = z
  .object({
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    is_discoverable: z.boolean().default(false),
    join_policy: groupJoinPolicySchema.default('admin-controlled'),
  })
  .transform((value) => ({
    ...value,
    join_policy: value.is_discoverable ? value.join_policy : 'admin-controlled',
  }))
  .refine(
    (value) => value.is_discoverable || value.join_policy === 'admin-controlled',
    'Hidden groups must be admin-controlled'
  );

const updateGroupRequestSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
    is_discoverable: z.boolean().optional(),
    join_policy: groupJoinPolicySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

const groupIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const requestIdParamSchema = z.object({
  requestId: z.coerce.number().int().positive(),
});

const inviteIdParamSchema = z.object({
  inviteId: z.coerce.number().int().positive(),
});

const memberUserIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  userId: z.string().uuid(),
});

const inviteMemberRequestSchema = z.object({
  username: z.string().min(3).max(30),
});

const joinRequestActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

const inviteActionSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

const updateMemberRoleSchema = z.object({
  role: groupMemberRoleSchema,
});

const searchGroupsQuerySchema = z.object({
  query: z.string().trim().min(1).max(120),
});

export {
  createGroupRequestSchema as CreateGroupRequestSchema,
  updateGroupRequestSchema as UpdateGroupRequestSchema,
  groupIdParamSchema as GroupIdParamSchema,
  requestIdParamSchema as RequestIdParamSchema,
  inviteIdParamSchema as InviteIdParamSchema,
  memberUserIdParamSchema as MemberUserIdParamSchema,
  inviteMemberRequestSchema as InviteMemberRequestSchema,
  joinRequestActionSchema as JoinRequestActionSchema,
  inviteActionSchema as InviteActionSchema,
  updateMemberRoleSchema as UpdateMemberRoleSchema,
  searchGroupsQuerySchema as SearchGroupsQuerySchema,
};

export type CreateGroupRequest = z.infer<typeof createGroupRequestSchema>;
export type UpdateGroupRequest = z.infer<typeof updateGroupRequestSchema>;
export type InviteMemberRequest = z.infer<typeof inviteMemberRequestSchema>;
export type JoinRequestActionRequest = z.infer<typeof joinRequestActionSchema>;
export type InviteActionRequest = z.infer<typeof inviteActionSchema>;
export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleSchema>;
export type SearchGroupsQuery = z.infer<typeof searchGroupsQuerySchema>;
