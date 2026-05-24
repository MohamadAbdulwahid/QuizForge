import type { User } from '@supabase/supabase-js';

/**
 * Shared utility for building a human-readable display name from a Supabase User object.
 *
 * Priority: `user.user_metadata.username` > email prefix > fallback
 *
 * @param user - The Supabase User object (may be null)
 * @param fallback - Default name when nothing can be derived (default: 'Player')
 * @returns A display name string
 */
export function buildDisplayName(user: User | null, fallback = 'Player'): string {
  if (!user) {
    return fallback;
  }

  const username = String(user.user_metadata?.['username'] ?? '').trim();

  if (username.length > 0) {
    return username;
  }

  return user.email?.split('@')[0] ?? fallback;
}
