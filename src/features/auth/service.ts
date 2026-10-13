import type { Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { appError, err, ok, type Result } from '@/lib/result';

import { mapAuthError } from './errors';
import { normalizeEmail } from './validation';

/**
 * Email authentication.
 *
 * Every function returns a Result rather than throwing, and returns
 * `not_configured` when no Supabase project is set up, so the UI can show the
 * demo-mode explanation instead of a broken form.
 */

/** Deep link the confirmation and reset emails return to. */
const REDIRECT_URL = 'foodlens://auth-callback';

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    return err(
      appError(
        'not_configured',
        'Accounts are not set up in this build. Your meals are saved on this device.',
        { retryable: false },
      ),
    );
  }
  return ok(client);
}

export interface SignUpOutcome {
  user: User | null;
  session: Session | null;
  /**
   * True when the project requires email confirmation, so the user is not
   * signed in yet and must check their inbox.
   */
  needsEmailConfirmation: boolean;
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<Result<SignUpOutcome>> {
  const client = requireClient();
  if (!client.ok) return client;

  try {
    const { data, error } = await client.value.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: { emailRedirectTo: REDIRECT_URL },
    });

    if (error) return err(mapAuthError(error, 'signUp'));

    // With confirmation required, Supabase returns a user but no session.
    return ok({
      user: data.user,
      session: data.session,
      needsEmailConfirmation: data.user !== null && data.session === null,
    });
  } catch (cause) {
    logger.warn('signUp threw', { cause: String(cause) });
    return err(
      appError('network', 'No connection. Check your internet and try again.', {
        detail: String(cause),
      }),
    );
  }
}

/**
 * Sends the confirmation email again.
 *
 * Without this, a confirmation email that never arrives is the end of the
 * road: the sign-in screen only offers a password reset, which does not
 * confirm an address, so the account stays unreachable and the email is
 * already taken. That matters most where it is hardest to notice - a typo
 * in the address, or a first message that went to spam.
 *
 * Reports success unconditionally, for the same reason `requestPasswordReset`
 * does: a different answer for "no such pending signup" would turn this into
 * a way to discover who has an account here.
 */
export async function resendConfirmationEmail(email: string): Promise<Result<void>> {
  const client = requireClient();
  if (!client.ok) return client;

  try {
    const { error } = await client.value.auth.resend({
      type: 'signup',
      email: normalizeEmail(email),
      options: { emailRedirectTo: REDIRECT_URL },
    });

    // Rate limiting is worth saying out loud: the built-in sender allows very
    // few messages an hour, and silence here would look like a broken button.
    if (error && error.code === 'over_email_send_rate_limit') {
      return err(mapAuthError(error, 'resendConfirmation'));
    }
    if (error) {
      logger.warn('resend confirmation failed', { detail: error.message });
    }
    return ok(undefined);
  } catch (cause) {
    logger.warn('resendConfirmation threw', { cause: String(cause) });
    return err(
      appError('network', 'No connection. Check your internet and try again.', {
        detail: String(cause),
      }),
    );
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<Result<Session>> {
  const client = requireClient();
  if (!client.ok) return client;

  try {
    const { data, error } = await client.value.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error) return err(mapAuthError(error, 'signIn'));
    if (!data.session) {
      return err(
        appError('unknown', 'Sign-in did not complete. Try again.', {
          detail: 'signIn returned no session and no error',
        }),
      );
    }
    return ok(data.session);
  } catch (cause) {
    return err(
      appError('network', 'No connection. Check your internet and try again.', {
        detail: String(cause),
      }),
    );
  }
}

export async function signOut(): Promise<Result<void>> {
  const client = requireClient();
  if (!client.ok) return client;

  try {
    const { error } = await client.value.auth.signOut();
    // A "session not found" error on sign-out is not worth showing: the user
    // asked to be signed out and they are.
    if (error && error.code !== 'session_not_found') {
      return err(mapAuthError(error, 'signOut'));
    }
    return ok(undefined);
  } catch (cause) {
    // The local session is cleared regardless, so this still counts as done.
    logger.warn('signOut threw; local session cleared anyway', {
      cause: String(cause),
    });
    return ok(undefined);
  }
}

/**
 * Sends a password reset email.
 *
 * Always reports success, even for an address with no account. Reporting
 * "no account found" would let anyone test whether a given person has signed
 * up here. A real send failure is logged, not surfaced.
 */
export async function requestPasswordReset(email: string): Promise<Result<void>> {
  const client = requireClient();
  if (!client.ok) return client;

  try {
    const { error } = await client.value.auth.resetPasswordForEmail(
      normalizeEmail(email),
      { redirectTo: REDIRECT_URL },
    );

    if (error) {
      // Rate limiting is worth surfacing: it is about the request, not about
      // whether the account exists.
      if (
        error.code === 'over_email_send_rate_limit' ||
        error.code === 'over_request_rate_limit' ||
        error.status === 429
      ) {
        return err(mapAuthError(error, 'requestPasswordReset'));
      }
      logger.warn('password reset not sent', { code: error.code });
    }

    return ok(undefined);
  } catch (cause) {
    return err(
      appError('network', 'No connection. Check your internet and try again.', {
        detail: String(cause),
      }),
    );
  }
}

/** Sets a new password for the signed-in user, after a reset link. */
export async function updatePassword(newPassword: string): Promise<Result<void>> {
  const client = requireClient();
  if (!client.ok) return client;

  try {
    const { error } = await client.value.auth.updateUser({ password: newPassword });
    if (error) return err(mapAuthError(error, 'updatePassword'));
    return ok(undefined);
  } catch (cause) {
    return err(
      appError('network', 'No connection. Check your internet and try again.', {
        detail: String(cause),
      }),
    );
  }
}

export async function getCurrentSession(): Promise<Result<Session | null>> {
  const client = requireClient();
  if (!client.ok) return client;

  try {
    const { data, error } = await client.value.auth.getSession();
    if (error) return err(mapAuthError(error, 'getSession'));
    return ok(data.session);
  } catch (cause) {
    return err(
      appError('network', 'Could not check your sign-in status.', {
        detail: String(cause),
      }),
    );
  }
}

/**
 * Deletes the account and everything it owns.
 *
 * A client cannot delete its own auth user: that needs the service role. So
 * this calls the `delete-account` Edge Function, which verifies the caller and
 * then removes the user, which cascades to every row they own.
 */
export async function deleteAccount(): Promise<Result<void>> {
  const client = requireClient();
  if (!client.ok) return client;

  try {
    const { error } = await client.value.functions.invoke('delete-account', {
      method: 'POST',
    });

    if (error) {
      return err(
        appError('unknown', 'We could not delete your account. Try again.', {
          detail: `deleteAccount: ${error.message}`,
        }),
      );
    }

    // The account is gone, so the stored session is meaningless. Clearing it
    // locally is what actually signs the device out.
    await client.value.auth.signOut().catch(() => undefined);
    return ok(undefined);
  } catch (cause) {
    return err(
      appError('network', 'No connection. Check your internet and try again.', {
        detail: String(cause),
      }),
    );
  }
}

/**
 * Completes a link from a confirmation or password-reset email.
 *
 * The client is configured for PKCE with `detectSessionInUrl` off, which is
 * correct on a phone - there is no browser URL for it to read. The trade is
 * that the exchange has to be done by hand: the email link returns to
 * `foodlens://auth-callback?code=...`, and that code is worth a session
 * exactly once.
 */
export async function exchangeCodeForSession(code: string): Promise<Result<Session>> {
  const client = requireClient();
  if (!client.ok) return client;

  try {
    const { data, error } = await client.value.auth.exchangeCodeForSession(code);
    if (error) return err(mapAuthError(error, 'exchangeCodeForSession'));
    if (!data.session) {
      return err(
        appError('unauthorized', 'That link has expired. Ask for a new one.', {
          detail: 'exchangeCodeForSession returned no session',
          retryable: false,
        }),
      );
    }
    return ok(data.session);
  } catch (cause) {
    return err(
      appError('network', 'No connection. Check your internet and try again.', {
        detail: String(cause),
      }),
    );
  }
}
