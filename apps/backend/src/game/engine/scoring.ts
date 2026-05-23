export interface ForgeClassicScoreInput {
  isCorrect: boolean;
  basePoints: number;
  timeLimitMs: number;
  elapsedMs: number;
}

export interface ForgeClassicScoreResult {
  points: number;
  multiplier: number;
  remainingMs: number;
}

/**
 * Calculates Forge Classic points using correctness and remaining time.
 * Formula: basePoints * (1 + remainingTime / timeLimit), clamped to safe bounds.
 * @param input - Score calculation input.
 * @returns Deterministic score result.
 */
export function calculateForgeClassicScore(input: ForgeClassicScoreInput): ForgeClassicScoreResult {
  const safeBasePoints = Math.max(0, Math.floor(input.basePoints || 0));
  const safeTimeLimitMs = Math.max(1, Math.floor(input.timeLimitMs || 1));
  const safeElapsedMs = Math.max(0, Math.floor(input.elapsedMs || 0));
  const remainingMs = Math.max(0, Math.min(safeTimeLimitMs, safeTimeLimitMs - safeElapsedMs));
  const multiplier = input.isCorrect ? 1 + remainingMs / safeTimeLimitMs : 0;

  return {
    points: input.isCorrect ? Math.round(safeBasePoints * multiplier) : 0,
    multiplier,
    remainingMs,
  };
}
