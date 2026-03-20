import { shareCodeExists } from '../../database/repositories/quiz.repository';

const SHARE_CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generates an uppercase share code without ambiguous characters.
 * @param length - Desired code length. Defaults to 8.
 * @returns Randomly generated share code.
 */
export function generateShareCode(length = 8): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(randomBytes)
    .map((byte) => SHARE_CODE_CHARSET[byte % SHARE_CODE_CHARSET.length])
    .join('');
}

/**
 * Generates a share code that does not already exist in DB.
 * @param maxRetries - Maximum attempts before failing.
 * @returns Unique share code.
 * @throws Error when uniqueness cannot be achieved in retry budget.
 */
export async function generateUniqueShareCode(maxRetries = 5): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const code = generateShareCode();
    const exists = await shareCodeExists(code);

    if (!exists) {
      return code;
    }
  }

  throw new Error('Failed to generate a unique share code');
}
