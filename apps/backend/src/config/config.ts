/**
 * Environment configuration loader
 * Bun automatically loads .env files, so we just need to validate and export the variables
 */

interface Config {
  POSTGRES_URL: string;
}

/**
 * Get an environment variable or throw an error if it's missing
 * @param name - The name of the environment variable
 * @returns The value of the environment variable
 */
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config: Config = {
  POSTGRES_URL: getEnvVar('POSTGRES_URL'),
};
