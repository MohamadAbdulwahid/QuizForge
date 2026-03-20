import { pinExists } from '../../database/repositories/session.repository';

/**
 * Generates a zero-padded numeric PIN.
 * @param length - Pin length. Defaults to 6.
 * @returns Numeric PIN string.
 */
export function generatePin(length = 6): string {
  const max = 10 ** length;
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % max;
  return String(random).padStart(length, '0');
}

/**
 * Generates a PIN unique among active sessions.
 * @param maxRetries - Maximum collision retries.
 * @returns Unique PIN.
 * @throws Error when uniqueness cannot be achieved in retry budget.
 */
export async function generateUniquePin(maxRetries = 5): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const pin = generatePin();
    const exists = await pinExists(pin);

    if (!exists) {
      return pin;
    }
  }

  throw new Error('Failed to generate a unique session PIN');
}
