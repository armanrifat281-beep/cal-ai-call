/**
 * A small Result type.
 *
 * Network and provider calls fail routinely, and we want those failures to be
 * values the UI can render rather than exceptions that unmount a screen.
 */

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** Error categories the UI branches on to pick a message and a retry option. */
export type AppErrorCode =
  | 'network'
  | 'timeout'
  | 'rate_limited'
  | 'unauthorized'
  | 'not_found'
  | 'validation'
  | 'unsupported_media'
  | 'provider_error'
  | 'not_configured'
  | 'unknown';

export interface AppError {
  code: AppErrorCode;
  /** Shown to the user. Plain language, no stack traces, no provider jargon. */
  message: string;
  /** Developer detail. Logged in dev builds, never shown in release UI. */
  detail?: string;
  /** Whether retrying the same request could plausibly succeed. */
  retryable: boolean;
}

export function appError(
  code: AppErrorCode,
  message: string,
  options: { detail?: string; retryable?: boolean } = {},
): AppError {
  const retryable =
    options.retryable ??
    (code === 'network' ||
      code === 'timeout' ||
      code === 'rate_limited' ||
      code === 'provider_error');
  return { code, message, detail: options.detail, retryable };
}

/** Default user-facing copy per category, so messages stay consistent. */
export const DEFAULT_ERROR_MESSAGES: Record<AppErrorCode, string> = {
  network: 'No connection. Check your internet and try again.',
  timeout: 'That took too long. Try again in a moment.',
  rate_limited: 'Too many requests right now. Wait a minute and try again.',
  unauthorized: 'You need to sign in again to do that.',
  not_found: "We couldn't find that.",
  validation: 'Please check the highlighted fields.',
  unsupported_media: 'That file type is not supported. Use a JPEG or PNG photo.',
  provider_error: 'The analysis service had a problem. Try again.',
  not_configured: 'This feature is not set up yet in this build.',
  unknown: 'Something went wrong. Try again.',
};

/** Turn an unknown thrown value into an AppError without leaking internals. */
export function toAppError(cause: unknown, fallback: AppErrorCode = 'unknown'): AppError {
  if (cause instanceof Error) {
    const isAbort = cause.name === 'AbortError';
    const code: AppErrorCode = isAbort ? 'timeout' : fallback;
    return appError(code, DEFAULT_ERROR_MESSAGES[code], { detail: cause.message });
  }
  return appError(fallback, DEFAULT_ERROR_MESSAGES[fallback], {
    detail: typeof cause === 'string' ? cause : undefined,
  });
}
