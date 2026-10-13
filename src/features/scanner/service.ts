import { File as FileSystemFile } from 'expo-file-system';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { appError, err, toAppError, type Result } from '@/lib/result';
import type { MealType } from '@/types/domain';

import { parseMealAnalysis } from './parseAnalysis';
import type { AnalyzeMealInput, MealAnalysis } from './types';

/**
 * Meal photo analysis.
 *
 * The request goes to our own server endpoint, never straight to an AI
 * provider: the provider key must stay server-side, and the server is also
 * where database matching and response shaping happen.
 *
 * Until that endpoint is configured and deployed, `analyzeMealPhoto` returns a
 * `not_configured` error. The scanner screen handles that explicitly rather
 * than showing invented results.
 */

/**
 * How long the app waits for an analysis.
 *
 * Longer than the server's own provider timeout, deliberately. It used to be
 * shorter, which meant the app hung up first: the server was still working,
 * its own timeout handling never ran, and the user saw a dropped connection
 * instead of the message the server would have sent. Whoever gives up first
 * decides what the user is told, and the server knows more.
 */
export const ANALYSIS_TIMEOUT_MS = 60_000;

/** Path of the Edge Function that performs the analysis. */
const ANALYZE_FUNCTION_PATH = '/functions/v1/analyze-meal';

export interface AnalysisAvailability {
  available: boolean;
  /** Why it is unavailable, in plain language. Null when available. */
  reason: string | null;
}

/**
 * Whether photo analysis can run at all in this build.
 *
 * Checked before the camera opens so the user is told up front rather than
 * after taking a photo.
 */
export function getAnalysisAvailability(): AnalysisAvailability {
  if (!env.isSupabaseConfigured) {
    return {
      available: false,
      reason:
        'Photo analysis runs on a server that is not configured in this build, so no photo can be analysed yet. You can still log meals by hand.',
    };
  }
  return { available: true, reason: null };
}

export interface AnalyzeOptions extends AnalyzeMealInput {
  /**
   * The signed-in user's access token. Required: the endpoint is per-user so
   * that usage limits and photo ownership are enforced server-side.
   */
  accessToken: string | null;
  fallbackMealType: MealType;
}

/**
 * Send a prepared photo for analysis.
 *
 * The photo is uploaded as multipart form data. Nothing identifying is sent
 * besides the authenticated request itself: no name, no email, no allergy list.
 */
export async function analyzeMealPhoto(
  options: AnalyzeOptions,
): Promise<Result<MealAnalysis>> {
  const availability = getAnalysisAvailability();
  if (!availability.available) {
    return err(
      appError('not_configured', availability.reason ?? 'Photo analysis is not set up.', {
        retryable: false,
      }),
    );
  }

  if (!options.accessToken) {
    return err(
      appError('unauthorized', 'Sign in to analyse photos.', { retryable: false }),
    );
  }

  const endpoint = `${env.supabaseUrl}${ANALYZE_FUNCTION_PATH}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

  try {
    const form = new FormData();
    /*
      A real file, not a `{ uri, name, type }` descriptor.

      That descriptor is React Native's own extension, and it stopped working
      when Expo replaced `fetch` with a WinterCG-compliant one: the new
      implementation serialises FormData itself and accepts a string, a Blob,
      or anything exposing `bytes()`. Handed the descriptor it threw
      "Unsupported FormDataPart implementation", which surfaced as a failed
      analysis with nothing on screen to explain it.

      `expo-file-system`'s File satisfies the third case, and carries its own
      name and mime type, so the part arrives with a filename - which is what
      makes the server see a file rather than a text field.
    */
    form.append('photo', new FileSystemFile(options.imageUri) as unknown as Blob);
    form.append('localHour', String(options.localHour));
    form.append('retainPhoto', String(options.retainPhoto));
    if (options.regionHint) form.append('regionHint', options.regionHint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        apikey: env.supabaseKey ?? '',
      },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      return err(httpError(response.status, await readServerError(response)));
    }

    const raw: unknown = await response.json();
    return parseMealAnalysis(raw, { fallbackMealType: options.fallbackMealType });
  } catch (cause) {
    logger.warn('meal analysis request failed', { cause: String(cause) });
    return err(toAppError(cause, 'network'));
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The server's own message, when it sent one.
 *
 * The function answers with `{ error: { code, message } }`, and it knows
 * which of several reasons applied where the status alone cannot say. The
 * body is read once here rather than being thrown away, which is what used
 * to happen.
 */
interface ServerError {
  message: string | null;
  /** The server's own reason, e.g. `invalid_response`. */
  code: string | null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function readServerError(response: Response): Promise<ServerError> {
  try {
    const body: unknown = await response.clone().json();
    const error = (body as { error?: { message?: unknown; code?: unknown } })?.error;
    return { message: readString(error?.message), code: readString(error?.code) };
  } catch {
    // Not our JSON. The status still tells us something.
    return { message: null, code: null };
  }
}

/** Maps an HTTP status to a message the user can act on. */
function httpError(status: number, server: ServerError = { message: null, code: null }) {
  const serverMessage = server.message;
  // The server's reason travels with every error, so a report names the
  // branch that failed instead of a bare status. Two quite different faults
  // answer 502 - the model was unreachable, and the model's answer was
  // unreadable - and without the code they are indistinguishable from here,
  // which cost a long diagnosis once already.
  const detail = server.code === null ? `HTTP ${status}` : `HTTP ${status} · ${server.code}`;

  if (status === 401 || status === 403) {
    return appError('unauthorized', 'Your session expired. Sign in again to analyse photos.', {
      detail,
      retryable: false,
    });
  }
  if (status === 413) {
    return appError('unsupported_media', 'That photo is too large to analyse.', {
      detail,
      retryable: false,
    });
  }
  if (status === 415) {
    return appError('unsupported_media', 'That image format cannot be analysed.', {
      detail,
      retryable: false,
    });
  }
  if (status === 429) {
    // Three different limits answer 429 - this account's daily scans, the
    // provider being momentarily busy, and the provider's own allowance
    // being spent for the day - and only the server knows which. Its
    // sentence says how long the wait actually is.
    return appError(
      'rate_limited',
      serverMessage ??
        'You have reached the scan limit for now. Try again later, or add the meal by hand.',
      // A spent daily allowance will not clear by pressing the button again.
      { detail, retryable: server.code !== 'provider_quota' },
    );
  }
  // 503 before the general 5xx branch: the server uses it for "not set up",
  // which no amount of retrying will fix. Calling that "having trouble, try
  // again" sends the user round a loop that cannot end.
  if (status === 503) {
    return appError(
      'not_configured',
      serverMessage ??
        'Photo analysis is not set up on the server yet. You can still add meals by hand.',
      { detail, retryable: false },
    );
  }
  if (status >= 500) {
    // The server's sentence, when it sent one. It distinguishes "the model
    // could not be reached" from "the model's answer was unreadable", and it
    // is already written for the user - throwing it away to say something
    // vaguer helped nobody.
    return appError(
      'provider_error',
      serverMessage ?? 'The analysis service is having trouble. Try again.',
      { detail },
    );
  }
  return appError('unknown', 'We could not analyse that photo.', {
    detail,
  });
}
