import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Use for: validating JWTs (auth.getUser(token)), standard auth flows
export const supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: false, // Server is stateless, no token refresh needed
    persistSession: false, // No session persistence on server
    detectSessionInUrl: false,
  },
});

// Use for: user management (createUser, deleteUser), bypasses RLS and email confirmation
export const authAdminClient = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
