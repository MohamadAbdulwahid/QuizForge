type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  API_BASE_URL?: string;
  WEBSOCKET_URL?: string;
};

const runtimeEnv = (globalThis as typeof globalThis & { __quizforgeEnv?: RuntimeEnv })
  .__quizforgeEnv;

export const environment = {
  production: false,
  supabaseUrl: runtimeEnv?.SUPABASE_URL ?? 'https://example.supabase.co',
  supabasePublishableKey: runtimeEnv?.SUPABASE_PUBLISHABLE_KEY ?? 'public-anon-key',
  apiBaseUrl: runtimeEnv?.API_BASE_URL ?? 'http://localhost:3333',
  websocketUrl: runtimeEnv?.WEBSOCKET_URL ?? 'http://localhost:3333',
};
