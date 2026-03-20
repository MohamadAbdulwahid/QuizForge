import { z } from 'zod';

const createSessionRequestSchema = z.object({
  quiz_id: z.coerce.number().int().positive(),
});

export { createSessionRequestSchema as CreateSessionRequestSchema };

export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
