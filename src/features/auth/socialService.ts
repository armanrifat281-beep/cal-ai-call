import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { getSupabaseClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { appError, err, ok, type Result } from '@/lib/result';

import { mapAuthError } from './errors';
import { exchangeCodeForSession } from './service';

/** Where the provider sends the browser back to. Same route the emails use. */
const REDIRECT_URL = 'foodlens://auth-callback';

/**
 * Signing in with Apple and with Google.
 *
 * Both work the same way underneath: the provider hands back an identity
 * token, and Supabase verifies it and issues a session. The token never
 * leaves the device except to Supabase, and no provider secret is involved,
 * which is why this can live in the app at all.
 *
 * Neither can work until it is configured on both sides - the ids in `.env`
 * and the provider switched on in the Supabase dashboard - and neither
 * pretends otherwise. The buttons say what is missing rather than failing
 * silently.
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
 * Whether this device has Apple's own sign-in sheet.
 *
 * iOS 13 and later. Everywhere else this is false and the web flow is used
 * instead - the button is offered either way, because Sign in with Apple is
 * not an iOS-only service and an Android user with an Apple ID has every
 * reason to expect it.
 */
export async function isNativeAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Sign in with Apple.
 *
 * Uses Apple's own sheet where the device has one, because it is faster and
 * does not leave the app. Everywhere else it opens Apple's web flow in a
 * browser session and completes the same PKCE exchange the confirmation
 * emails use.
 *
 * `null` means the user closed it, which is a decision rather than a
 * failure and must not surface as one.
 */
export async function signInWithApple(): Promise<Result<Session | null>> {
  const native = await isNativeAppleAvailable();
  return native ? signInWithAppleNative() : signInWithAppleWeb();
}

async function signInWithAppleWeb(): Promise<Result<Session | null>> {
  const client = requireClient();
  if (!client.ok) return client;

  try {
    const { data, error } = await client.value.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: REDIRECT_URL,
        // The browser is opened by hand below, so the session can be
        // completed inside the app rather than left to a redirect.
        skipBrowserRedirect: true,
      },
    });

    if (error) return err(mapAuthError(error, 'signInWithAppleWeb'));
    if (!data.url) {
      return err(
        appError('provider_error', 'Apple sign-in could not be started.', {
          detail: 'signInWithOAuth returned no url',
        }),
      );
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);
    if (result.type !== 'success') return ok(null);

    const code = new URL(result.url).searchParams.get('code');
    if (!code) {
      return err(
        appError('provider_error', 'Apple did not return a sign-in code.', {
          detail: `no code on ${result.url}`,
        }),
      );
    }

    const session = await exchangeCodeForSession(code);
    return session.ok ? ok(session.value) : session;
  } catch (cause) {
    if (isCancellation(cause)) return ok(null);
    logger.warn('apple web sign-in failed', { cause: String(cause) });
    return err(
      appError('provider_error', 'Signing in with Apple did not work. Try again.', {
        detail: String(cause),
      }),
    );
  }
}

async function signInWithAppleNative(): Promise<Result<Session | null>> {
  const client = requireClient();
  if (!client.ok) return client;

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return err(
        appError('unauthorized', 'Apple did not return a sign-in token.', {
          detail: 'no identityToken on credential',
          retryable: true,
        }),
      );
    }

    const { data, error } = await client.value.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) return err(mapAuthError(error, 'signInWithApple'));
    return ok(data.session);
  } catch (cause) {
    // Apple reports a cancelled sheet as a thrown error with this code. It
    // is not a failure and must not surface as one.
    if (isCancellation(cause)) return ok(null);

    logger.warn('apple sign-in failed', { cause: String(cause) });
    return err(
      appError('provider_error', 'Signing in with Apple did not work. Try again.', {
        detail: String(cause),
      }),
    );
  }
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

/** A cancelled provider sheet, which the user did on purpose. */
export function isCancellation(cause: unknown): boolean {
  const code = (cause as { code?: string } | null)?.code;
  if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') return true;
  return /cancel/i.test(cause instanceof Error ? cause.message : String(cause));
}
