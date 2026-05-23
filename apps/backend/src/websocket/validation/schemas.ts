import { z } from 'zod';

const joinGameMessageSchema = z
  .object({
    pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
    username: z.string().min(1).max(60).optional(),
  })
  .passthrough();

const leaveGameMessageSchema = z
  .object({
    pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
    reason: z.string().max(120).optional(),
  })
  .passthrough();

const startGameMessageSchema = z
  .object({
    pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
  })
  .passthrough();

const submitAnswerMessageSchema = z
  .object({
    pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
    sessionId: z.coerce.number().int().positive(),
    questionId: z.coerce.number().int().positive(),
    selectedAnswer: z.string().min(1).max(200),
  })
  .passthrough();

const nextQuestionMessageSchema = z
  .object({
    pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit string'),
  })
  .passthrough();

export { joinGameMessageSchema as JoinGameMessageSchema };
export { leaveGameMessageSchema as LeaveGameMessageSchema };
export { startGameMessageSchema as StartGameMessageSchema };
export { submitAnswerMessageSchema as SubmitAnswerMessageSchema };
export { nextQuestionMessageSchema as NextQuestionMessageSchema };

export type JoinGameMessage = z.infer<typeof JoinGameMessageSchema>;
export type LeaveGameMessage = z.infer<typeof LeaveGameMessageSchema>;
export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;
export type SubmitAnswerMessage = z.infer<typeof SubmitAnswerMessageSchema>;
export type NextQuestionMessage = z.infer<typeof NextQuestionMessageSchema>;

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
