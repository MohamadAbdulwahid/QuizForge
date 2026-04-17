import { z } from 'zod';

const createSessionRequestSchema = z.object({
  quiz_id: z.coerce.number().int().positive(),
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
