import { z } from 'zod';

const joinGameMessageSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
  username: z.string().min(1).max(60).optional(),
});

const leaveGameMessageSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
  reason: z.string().max(120).optional(),
});

const startGameMessageSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
});

const submitAnswerMessageSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
  sessionId: z.coerce.number().int().positive(),
  questionId: z.coerce.number().int().positive(),
  // Bumped from 200 to 5000 to fit JSON-encoded payloads for Ordering
  // (array of option ids) and Matching ({leftId: rightId} object).
  selectedAnswer: z.string().min(1).max(5000),
});

const nextQuestionMessageSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
});

const endSessionMessageSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
});

const skipQuestionMessageSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
});

const selectChestMessageSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
  sessionId: z.coerce.number().int().positive(),
  questionId: z.coerce.number().int().positive(),
  chestIndex: z.coerce.number().int().min(0).max(2),
});

const selectStealTargetMessageSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
  sessionId: z.coerce.number().int().positive(),
  questionId: z.coerce.number().int().positive(),
  targetUserId: z.string().uuid('Target must be a valid user ID'),
});

export { joinGameMessageSchema as JoinGameMessageSchema };
export { leaveGameMessageSchema as LeaveGameMessageSchema };
export { startGameMessageSchema as StartGameMessageSchema };
export { submitAnswerMessageSchema as SubmitAnswerMessageSchema };
export { nextQuestionMessageSchema as NextQuestionMessageSchema };
export { endSessionMessageSchema as EndSessionMessageSchema };
export { skipQuestionMessageSchema as SkipQuestionMessageSchema };
export { selectChestMessageSchema as SelectChestMessageSchema };
export { selectStealTargetMessageSchema as SelectStealTargetMessageSchema };

export type JoinGameMessage = z.infer<typeof JoinGameMessageSchema>;
export type LeaveGameMessage = z.infer<typeof LeaveGameMessageSchema>;
export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;
export type SubmitAnswerMessage = z.infer<typeof SubmitAnswerMessageSchema>;
export type NextQuestionMessage = z.infer<typeof NextQuestionMessageSchema>;
export type EndSessionMessage = z.infer<typeof EndSessionMessageSchema>;
export type SkipQuestionMessage = z.infer<typeof SkipQuestionMessageSchema>;
export type SelectChestMessage = z.infer<typeof SelectChestMessageSchema>;
export type SelectStealTargetMessage = z.infer<typeof SelectStealTargetMessageSchema>;

/**
 * Emits a standardized socket validation payload.
 * @param socket - Socket-like object.
 * @param socket.emit - Socket emit function.
 * @param error - Zod validation error.
 */
export function emitSocketValidationError(
  socket: { emit: (event: string, payload: unknown) => void },
  error: z.ZodError
): void {
  socket.emit('error', {
    code: 'VALIDATION_ERROR',
    error: 'Validation failed',
    details: error.flatten(),
  });
}
