import { appError, type AppError } from '@/lib/result';

/**
 * Translating PostgREST responses into things the app can use.
 *
 * Shared by every Supabase-backed repository. Two concerns live here:
 *
 *  - `numeric` columns arrive over the wire as JSON numbers in most cases
 *    but as strings when PostgREST preserves precision, so every numeric
 *    field is coerced rather than trusted. A silent `"234"` where a number
 *    is expected turns a daily total into string concatenation.
 *  - a database error has to become a message a person can read, without
 *    leaking a SQLSTATE or a constraint name into the interface.
 */

// ---------------------------------------------------------------------------
// Coercion
// ---------------------------------------------------------------------------

/** A required numeric column. Falls back to 0 only when truly unusable. */
export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * An optional numeric column.
 *
 * Null stays null: it means "unknown", which the app shows as a dash and
 * never as zero.
 */
export function toNullableNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * The part of a PostgrestError this mapper reads.
 *
 * Declared structurally rather than importing PostgrestError, so the mapper
 * states exactly what it depends on and stays callable from tests without
 * constructing a full SDK error object.
 */
export interface DatabaseErrorLike {
  code?: string;
  message: string;
}

/**
 * Turns a database error into something the UI can show.
 *
 * The user-facing message never contains a SQLSTATE or a constraint name; the
 * original goes in `detail`, which is only rendered in development builds.
 */
export function mapPostgrestError(
  error: DatabaseErrorLike,
  context: string,
): AppError {
  const detail = `${context}: ${error.code ?? 'no code'} ${error.message}`;

  switch (error.code) {
    // No rows where exactly one was expected.
    case 'PGRST116':
      return appError('not_found', 'We could not find that.', { detail });

    // insufficient_privilege, which is how a row-level security refusal and a
    // missing grant both surface.
    case '42501':
      return appError(
        'unauthorized',
        'You do not have access to that. Try signing in again.',
        { detail, retryable: false },
      );

    // check_violation: a value the schema refuses, e.g. negative calories.
    case '23514':
      return appError('validation', 'Some of those values are not valid.', {
        detail,
        retryable: false,
      });

    // unique_violation.
    case '23505':
      return appError('validation', 'That name is already used.', {
        detail,
        retryable: false,
      });

    // foreign_key_violation.
    case '23503':
      return appError('not_found', 'That item no longer exists.', {
        detail,
        retryable: false,
      });

    // not_null_violation.
    case '23502':
      return appError('validation', 'Something required was missing.', {
        detail,
        retryable: false,
      });

    // Raised by our own functions when a meal is not reachable.
    case 'P0002':
      return appError('not_found', 'That meal is no longer in your journal.', {
        detail,
      });

    // JWT expired / invalid.
    case 'PGRST301':
    case 'PGRST302':
      return appError('unauthorized', 'Your session expired. Sign in again.', {
        detail,
        retryable: false,
      });

    default:
      return appError('unknown', 'Something went wrong. Try again.', { detail });
  }
}

/** Turns a thrown value from a Supabase call into an AppError. */
export function mapThrownError(cause: unknown, context: string): AppError {
  const message = cause instanceof Error ? cause.message : String(cause);
  const detail = `${context}: ${message}`;

  // supabase-js surfaces a failed fetch as a TypeError.
  if (cause instanceof TypeError || /network|fetch|timeout/i.test(message)) {
    return appError('network', 'No connection. Check your internet and try again.', {
      detail,
    });
  }

  return appError('unknown', 'Something went wrong. Try again.', { detail });
}
