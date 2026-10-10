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

/** Analysis is slow; the device gives up well before the user does. */
export const ANALYSIS_TIMEOUT_MS = 45_000;

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
    // React Native's FormData accepts this file descriptor shape for a local URI.
    form.append('photo', {
      uri: options.imageUri,
      name: 'meal.jpg',
      type: options.mimeType,
    } as unknown as Blob);
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
      return err(httpError(response.status));
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

/** Maps an HTTP status to a message the user can act on. */
function httpError(status: number) {
  if (status === 401 || status === 403) {
    return appError('unauthorized', 'Your session expired. Sign in again to analyse photos.', {
      detail: `HTTP ${status}`,
      retryable: false,
    });
  }
  if (status === 413) {
    return appError('unsupported_media', 'That photo is too large to analyse.', {
      detail: `HTTP ${status}`,
      retryable: false,
    });
  }
  if (status === 415) {
    return appError('unsupported_media', 'That image format cannot be analysed.', {
      detail: `HTTP ${status}`,
      retryable: false,
    });
  }
  if (status === 429) {
    return appError(
      'rate_limited',
      'You have reached the scan limit for now. Try again later, or add the meal by hand.',
      { detail: `HTTP ${status}` },
    );
  }
  if (status >= 500) {
    return appError('provider_error', 'The analysis service is having trouble. Try again.', {
      detail: `HTTP ${status}`,
    });
  }
  return appError('unknown', 'We could not analyse that photo.', {
    detail: `HTTP ${status}`,
  });
}
