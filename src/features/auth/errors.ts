import type { AuthError } from '@supabase/supabase-js';

import { appError, type AppError } from '@/lib/result';

/**
 * Maps a Supabase auth error to something the user can act on.
 *
 * One rule shapes most of this file: **never reveal whether an account
 * exists.** A sign-in failure says the details do not match, not "no user with
 * that email", because the latter turns the sign-in form into a tool for
 * discovering who has an account here. The same reasoning is why
 * `requestPasswordReset` reports success unconditionally.
 */
export function mapAuthError(error: AuthError, context: string): AppError {
  const detail = `${context}: ${error.code ?? error.status ?? 'no code'} ${error.message}`;

  switch (error.code) {
    case 'invalid_credentials':
    case 'invalid_grant':
      return appError(
        'unauthorized',
        'That email and password do not match an account.',
        { detail, retryable: false },
      );

    case 'email_not_confirmed':
      return appError(
        'unauthorized',
        'Check your email and confirm your address before signing in.',
        { detail, retryable: false },
      );

    case 'user_already_exists':
    case 'email_exists':
      return appError(
        'validation',
        'An account already exists for that email. Try signing in instead.',
        { detail, retryable: false },
      );

    // Supabase keeps its own list of addresses it will not accept - example
    // domains, disposable providers, and anything its validator dislikes. The
    // user has to change the address, and without this case that arrived as
    // "Something went wrong. Try again.", which invites them to press the
    // button again with the same address.
    case 'email_address_invalid':
      return appError(
        'validation',
        'That email address was not accepted. Try a different one.',
        { detail, retryable: false },
      );

    // The project is restricted to an allow-list, so this address cannot be
    // used here at all - a different password will not help.
    case 'email_address_not_authorized':
      return appError(
        'unauthorized',
        'That email address cannot be used to sign up here.',
        { detail, retryable: false },
      );

    case 'user_banned':
      return appError('unauthorized', 'This account has been suspended.', {
        detail,
        retryable: false,
      });

    // Email sign-in itself is switched off for the project. Nothing the user
    // types will work, so say so rather than blaming their details.
    case 'email_provider_disabled':
      return appError(
        'not_configured',
        'Email sign-in is not set up for this app.',
        { detail, retryable: false },
      );

    case 'weak_password':
      return appError('validation', 'Choose a stronger password.', {
        detail,
        retryable: false,
      });

    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return appError(
        'rate_limited',
        'Too many attempts. Wait a few minutes and try again.',
        { detail },
      );

    case 'same_password':
      return appError('validation', 'That is already your password.', {
        detail,
        retryable: false,
      });

    case 'session_not_found':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
      return appError('unauthorized', 'Your session expired. Sign in again.', {
        detail,
        retryable: false,
      });

    case 'signup_disabled':
      return appError('not_configured', 'New accounts are not being accepted.', {
        detail,
        retryable: false,
      });

    // Supabase reports a provider nobody has set up in two different ways:
    // the id-token path returns `provider_disabled`, and the OAuth path
    // returns `validation_failed` with "provider is not enabled" in the
    // message. Both used to land further down and read as "something went
    // wrong" or "check the details you entered" - advice for a problem the
    // user does not have and cannot fix.
    case 'provider_disabled':
      return appError('not_configured', 'That sign-in method is not set up yet.', {
        detail,
        retryable: false,
      });

    case 'validation_failed':
      if (isDisabledProviderMessage(error.message)) {
        return appError('not_configured', 'That sign-in method is not set up yet.', {
          detail,
          retryable: false,
        });
      }
      return appError('validation', 'Check the details you entered.', {
        detail,
        retryable: false,
      });

    default:
      break;
  }

  // Fall back to the HTTP status when there is no recognised code.
  if (error.status === 429) {
    return appError('rate_limited', 'Too many attempts. Try again shortly.', {
      detail,
    });
  }
  if (error.status === 401 || error.status === 403) {
    return appError('unauthorized', 'That did not work. Check your details.', {
      detail,
      retryable: false,
    });
  }
  if (typeof error.status === 'number' && error.status >= 500) {
    return appError('provider_error', 'The sign-in service had a problem. Try again.', {
      detail,
    });
  }

  // A fetch failure arrives with no status at all.
  if (!error.status) {
    return appError('network', 'No connection. Check your internet and try again.', {
      detail,
    });
  }

  return appError('unknown', 'Something went wrong. Try again.', { detail });
}

/**
 * Whether a `validation_failed` is really a provider that is switched off.
 *
 * Matched on the message because the code is the same one a genuinely
 * malformed request gets, and the two need opposite advice.
 */
function isDisabledProviderMessage(message: string): boolean {
  return /provider is not enabled|unsupported provider/i.test(message);
}
