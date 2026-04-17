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

export { joinGameMessageSchema as JoinGameMessageSchema };
export { leaveGameMessageSchema as LeaveGameMessageSchema };
export { startGameMessageSchema as StartGameMessageSchema };

export type JoinGameMessage = z.infer<typeof JoinGameMessageSchema>;
export type LeaveGameMessage = z.infer<typeof LeaveGameMessageSchema>;
export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;

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
