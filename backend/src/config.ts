/**
 * Environment configuration loader
 * Bun automatically loads .env files, so we just need to validate and export the variables
 */

interface Config {
  POSTGRES_URL: string;
}

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
