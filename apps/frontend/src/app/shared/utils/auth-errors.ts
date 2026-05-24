/**
 * Shared utility for resolving authentication errors from Supabase Auth
 * and API transport layers into user-facing error messages.
 *
 * Handles two error shapes:
 * 1. `{ message: string }` — Supabase Auth errors
 * 2. `{ error: { error: string } }` — API transport errors
 *
 * @param error - The unknown error thrown by the auth service or API
 * @param fallback - Default message when the error can't be parsed
 * @returns A user-facing error string
 */
export function resolveAuthError(error: unknown, fallback = 'Authentication failed.'): string {
  if (typeof error !== 'object' || error === null) {
    return fallback;
  }

  // Supabase Auth errors: { message: string }
  const withMessage = error as { message?: string };
  if (withMessage.message) {
    return withMessage.message;
  }

  // API transport errors: { error: { error: string } }
  const withNested = error as { error?: { error?: string } };
  if (withNested.error?.error) {
    return withNested.error.error;
  }

  return fallback;
}
