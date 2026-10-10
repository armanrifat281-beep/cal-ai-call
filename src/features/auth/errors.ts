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

    case 'validation_failed':
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
