import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';

import { env } from './env';
import { logger } from './logger';
import { secureSessionStore } from './secureSessionStore';

/**
 * The Supabase client.
 *
 * Created lazily and only when the configuration is present AND the key is one
 * that is safe to ship (see `env.ts`). Everything else in the app asks
 * `getSupabaseClient()` and handles `null`, which is what lets the app run
 * fully in device-only mode before a project exists.
 *
 * NOTHING here proves the project is reachable. A client object is just
 * configuration; the first real request is what establishes connectivity.
 */

let client: SupabaseClient | null = null;
let appStateSubscription: { remove: () => void } | null = null;

/**
 * Returns the shared client, or null when Supabase is not configured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;
  if (!env.isSupabaseConfigured || !env.supabaseUrl || !env.supabaseKey) {
    return null;
  }

  client = createClient(env.supabaseUrl, env.supabaseKey, {
    auth: {
      // Tokens live in the keychain / Android Keystore, not in plain storage.
      storage: secureSessionStore,
      // Keep the user signed in across launches.
      persistSession: true,
      autoRefreshToken: true,
      // There is no URL bar on a phone: the deep-link handler processes the
      // callback itself, so the client must not try to read one.
      detectSessionInUrl: false,
      // PKCE is the correct flow for a public client, which a mobile app is.
      flowType: 'pkce',
    },
    global: {
      headers: { 'x-application-name': 'foodlens-ai' },
    },
  });

  startAutoRefreshLifecycle(client);
  return client;
}

/**
 * Ties token refresh to app foreground state.
 *
 * Supabase's timer cannot run while the app is suspended, so without this the
 * first request after a long background period fails on an expired token.
 */
function startAutoRefreshLifecycle(supabase: SupabaseClient): void {
  if (appStateSubscription) return;

  /*
    Takes the nullable form on purpose.

    `AppState.currentState` is not yet known on Android before the first
    event, and React Native 0.88 types it honestly as nullable, while the
    listener is handed a real `AppStateStatus`. Accepting both means the
    "apply it now" call below needs no cast, and nothing has to pretend an
    unknown state is a known one - anything that is not `active` stops the
    refresh timer, which is the safe side to be wrong on.
  */
  const handleChange = (state: AppStateStatus | string | null | undefined) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh().catch((cause: unknown) => {
        logger.warn('supabase: could not start token auto-refresh', {
          cause: String(cause),
        });
      });
    } else {
      supabase.auth.stopAutoRefresh().catch(() => {
        // Stopping a timer that is not running is harmless.
      });
    }
  };

  appStateSubscription = AppState.addEventListener('change', handleChange);

  // Apply the current state immediately rather than waiting for a change.
  handleChange(AppState.currentState);
}

/**
 * Tears the client down. Used by tests and by account deletion, so a later
 * call builds a fresh client rather than reusing a dead session.
 */
export function resetSupabaseClient(): void {
  appStateSubscription?.remove();
  appStateSubscription = null;
  client = null;
}

/**
 * Checks that the configured project is actually reachable and that this
 * client can talk to it.
 *
 * This is the only thing in the app entitled to say the backend "works": it
 * makes a real request. It queries `profiles` with `head: true`, which returns
 * no rows and is harmless whether or not the user is signed in - an
 * unauthenticated caller simply sees zero rows under RLS.
 */
export async function checkSupabaseConnection(): Promise<
  | { ok: true; latencyMs: number }
  | { ok: false; reason: string; detail?: string }
> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      reason: 'Supabase is not configured in this build.',
    };
  }

  const startedAt = Date.now();
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return {
        ok: false,
        reason: 'The project rejected the request. Check the URL and key.',
        detail: `${error.code ?? 'unknown'}: ${error.message}`,
      };
    }

    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (cause) {
    return {
      ok: false,
      reason: 'Could not reach the project. Check your connection and the URL.',
      detail: String(cause),
    };
  }
}
