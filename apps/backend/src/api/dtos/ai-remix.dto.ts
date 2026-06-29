import { z } from 'zod';

/**
 * Request body for `POST /api/quizzes/:id/ai-remix`.
 *
 * `instructions` is the user-supplied transformation prompt (e.g.
 * "make this easier", "rewrite for ESL students", "convert all questions
 * to true/false"). Optional — when omitted the AI applies a sensible
 * default rephrasing.
 */
const aiRemixRequestSchema = z.object({
  instructions: z
    .string()
    .max(1000, 'Instructions must be at most 1000 characters')
    .optional(),
});

export { aiRemixRequestSchema as AiRemixRequestSchema };
export type AiRemixRequest = z.infer<typeof aiRemixRequestSchema>;
