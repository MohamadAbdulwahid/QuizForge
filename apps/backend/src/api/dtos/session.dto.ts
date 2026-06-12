import { z } from 'zod';

const createSessionRequestSchema = z.object({
  quiz_id: z.coerce.number().int().positive(),
  broadcast_mode: z
    .enum(['private', 'selected-groups', 'all-my-groups'])
    .optional()
    .default('private'),
  group_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
  game_mode: z.enum(['forge-classic', 'treasure-forge']).optional().default('forge-classic'),
  /** Treasure Forge: end condition mode */
  tf_end_mode: z.enum(['timer', 'gold_goal']).optional(),
  /** Treasure Forge: timer duration in minutes (default 7, max 30) */
  tf_timer_minutes: z.coerce.number().int().min(1).max(30).optional().default(7),
  /** Treasure Forge: gold goal target */
  tf_gold_goal: z.coerce.number().int().positive().optional(),
});

const pinParamSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
});

const updateSessionStatusSchema = z.object({
  action: z.enum(['start', 'pause', 'resume', 'finish']),
});

export { createSessionRequestSchema as CreateSessionRequestSchema };
export { pinParamSchema as PinParamSchema };
export { updateSessionStatusSchema as UpdateSessionStatusSchema };

export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type PinParam = z.infer<typeof PinParamSchema>;
export type UpdateSessionStatusRequest = z.infer<typeof UpdateSessionStatusSchema>;
