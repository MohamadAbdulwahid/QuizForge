const env = (import.meta.env ?? {}) as Partial<ImportMetaEnv>;

export const environment = {
  production: false,
  supabaseUrl: env.VITE_SUPABASE_URL ?? 'https://your-actual-project.supabase.co',
  supabasePublishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'public-anon-key',
  apiBaseUrl: env.VITE_API_BASE_URL ?? 'http://localhost:3333',
  websocketUrl: env.VITE_WEBSOCKET_URL ?? 'http://localhost:3333',
  sentryDsn: env.VITE_SENTRY_DSN ?? '',
};
