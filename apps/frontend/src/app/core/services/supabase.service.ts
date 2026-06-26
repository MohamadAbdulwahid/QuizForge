import { inject, Injectable } from '@angular/core';
import { AuthChangeEvent, Session, SupabaseClient, createClient } from '@supabase/supabase-js';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export type AuthChangePayload = {
  event: AuthChangeEvent;
  session: Session | null;
};

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly configService = inject(ConfigService);
  private supabaseClient: SupabaseClient | null = null;

  get client(): SupabaseClient | null {
    const url = this.configService.getSupabaseUrl();
    const key = this.configService.getSupabasePublishableKey();
    if (!url || !key) {
      return null;
    }
    if (!this.supabaseClient) {
      this.supabaseClient = createClient(url, key);
    }
    return this.supabaseClient;
  }

  authChanges(): Observable<AuthChangePayload> {
    return new Observable<AuthChangePayload>((subscriber) => {
      const { data } = this.supabaseClient!.auth.onAuthStateChange((event, session) => {
        subscriber.next({ event, session });
      });

      return () => {
        data.subscription.unsubscribe();
      };
    });
  }
}
