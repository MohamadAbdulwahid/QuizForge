import type { User } from '@supabase/supabase-js';
import * as profileRepository from '../../database/repositories/profile.repository';

export async function syncProfileForAuthUser(user: User): Promise<void> {
  const username = user.user_metadata?.['username'];

  if (typeof username !== 'string' || username.trim().length === 0) {
    return;
  }

  await profileRepository.upsertProfile({
    user_id: user.id,
    username,
  });
}
