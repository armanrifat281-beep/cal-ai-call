import type { Session } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { appError, err, ok, type Result } from '@/lib/result';

import { mapAuthError } from './errors';

/**
 * Signing in with Google.
 *
 * Google hands back an identity token, and Supabase verifies it and issues a
 * session. The token never leaves the device except to Supabase, and no
 * provider secret is involved, which is why this can live in the app at all.
 *
 * It cannot work until it is configured on both sides - the client ids in
 * `.env` and the Google provider switched on for the Supabase project - and
 * it does not pretend otherwise: `providerAvailability` is consulted before
 * Google's sheet opens, and the button says what is missing.
 *
 * Sign in with Apple is deliberately absent. This app ships on Android, and
 * Apple's provider cannot be configured without a paid Apple Developer
 * membership.
 */

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    return err(
      appError(
        'not_configured',
        'Accounts are not set up in this build. Your meals are saved on this device.',
        { detail: 'no supabase client', retryable: false },
      ),
    );
  }
  return ok(client);
}

/**
 * Exchanges a Google identity token for a session.
 *
 * Getting the token is the caller's job, because it needs React state and a
 * browser round trip; see `useGoogleSignIn`.
 */
export async function signInWithGoogleToken(
  idToken: string,
): Promise<Result<Session | null>> {
  const client = requireClient();
  if (!client.ok) return client;

  try {
    const { data, error } = await client.value.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) return err(mapAuthError(error, 'signInWithGoogle'));
    return ok(data.session);
  } catch (cause) {
    logger.warn('google sign-in failed', { cause: String(cause) });
    return err(
      appError('provider_error', 'Signing in with Google did not work. Try again.', {
        detail: String(cause),
      }),
    );
  }
}
