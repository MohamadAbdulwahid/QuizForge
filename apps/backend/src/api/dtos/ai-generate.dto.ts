import { z } from 'zod';

// ---------------------------------------------------------------------------
// AI Quiz Generation Request DTO
// ---------------------------------------------------------------------------
const aiGenerateRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  notes: z.string().min(10, 'Notes must be at least 10 characters').max(50000),
  instructions: z.string().max(1000).optional(),
});

export { aiGenerateRequestSchema as AiGenerateRequestSchema };
export type AiGenerateRequest = z.infer<typeof aiGenerateRequestSchema>;
