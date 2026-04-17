import { Injectable } from '@angular/core';
import {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  createClient,
} from '@supabase/supabase-js';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AuthChangePayload = {
  event: AuthChangeEvent;
  session: Session | null;
};

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly supabaseClient: SupabaseClient;

  constructor() {
    this.supabaseClient = createClient(
      environment.supabaseUrl,
      environment.supabasePublishableKey
    );
  }

  get client(): SupabaseClient {
    return this.supabaseClient;
  }

  authChanges(): Observable<AuthChangePayload> {
    return new Observable<AuthChangePayload>((subscriber) => {
      const { data } = this.supabaseClient.auth.onAuthStateChange((event, session) => {
        subscriber.next({ event, session });
      });

      return () => {
        data.subscription.unsubscribe();
      };
    });
  }
}
