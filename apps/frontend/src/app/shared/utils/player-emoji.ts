/**
 * Shared emoji pool for deterministic player emoji assignment.
 * Emojis are derived from a string (userId or username) via hash,
 * ensuring the same player always gets the same emoji within a session.
 */

export const EMOJI_POOL = [
  '🦊',
  '🐼',
  '🦁',
  '🐯',
  '🐸',
  '🐙',
  '🦄',
  '🐧',
  '🦉',
  '🐺',
  '🐱',
  '🐶',
  '🐰',
  '🐭',
  '🐹',
  '🐻',
  '🐲',
  '👽',
  '🤖',
  '👾',
  '🫅',
  '🐨',
] as const;

export type PlayerEmoji = (typeof EMOJI_POOL)[number];

/**
 * Returns a deterministic emoji for a given player identifier.
 * Uses a simple character-code hash to index into the pool.
 */
export function getPlayerEmoji(id: string): PlayerEmoji {
  const hash = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return EMOJI_POOL[hash % EMOJI_POOL.length];
}
