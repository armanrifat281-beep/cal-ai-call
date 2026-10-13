import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { appError, err, ok, type Result } from '@/lib/result';
import { getSupabaseClient } from '@/lib/supabase';
import type { FoodRecord, Nutrients } from '@/types/domain';

/**
 * Looking a food up in a nutrition database.
 *
 * The search runs on the server, not here: the USDA key would otherwise
 * ship inside the app bundle where anyone can read it. See
 * supabase/functions/search-foods.
 *
 * Everything that comes back is validated before the app sees it. A record
 * from a database is the strongest claim this app makes about a number, so
 * it has to actually be one - a malformed response must not become a meal
 * logged as zero calories wearing a "USDA" badge.
 */
const SEARCH_FUNCTION = 'search-foods';

export interface SearchAvailability {
  available: boolean;
  /** Why not, in the user's terms. Null when it is available. */
  reason: string | null;
}

export function getSearchAvailability(): SearchAvailability {
  if (!env.isSupabaseConfigured) {
    return {
      available: false,
      reason:
        'Food search runs on a server that is not configured in this build. You can still add meals by hand.',
    };
  }
  return { available: true, reason: null };
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readNutrients(value: unknown): Nutrients | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  const caloriesKcal = readNumber(raw.caloriesKcal);
  const proteinG = readNumber(raw.proteinG);
  const carbsG = readNumber(raw.carbsG);
  const fatG = readNumber(raw.fatG);

  // The four the app always shows. A record without them is not a usable
  // lookup, whatever else it carries.
  if (caloriesKcal === null || proteinG === null || carbsG === null || fatG === null) {
    return null;
  }

  return {
    caloriesKcal,
    proteinG,
    carbsG,
    fatG,
    fiberG: readNumber(raw.fiberG),
    sugarG: readNumber(raw.sugarG),
    saturatedFatG: readNumber(raw.saturatedFatG),
    sodiumMg: readNumber(raw.sodiumMg),
  };
}

function readRecord(value: unknown): FoodRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  const id = typeof raw.id === 'string' ? raw.id : null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const nutrientsPer100g = readNutrients(raw.nutrientsPer100g);
  const providerRef = typeof raw.providerRef === 'string' ? raw.providerRef : null;

  if (id === null || name.length === 0 || nutrientsPer100g === null || providerRef === null) {
    return null;
  }

  return {
    id,
    name,
    brand: typeof raw.brand === 'string' && raw.brand.trim().length > 0 ? raw.brand.trim() : null,
    nutrientsPer100g,
    // The search endpoint supplies no household measures. An invented one
    // would be a portion nobody measured.
    portionOptions: [],
    providerLabel:
      typeof raw.providerLabel === 'string' && raw.providerLabel.trim().length > 0
        ? raw.providerLabel.trim()
        : 'Food database',
    providerRef,
    isGeneric: raw.isGeneric !== false,
  };
}

/** The server's own message, when it sent one. */
async function readServerMessage(error: unknown): Promise<string | null> {
  const response = (error as { context?: unknown })?.context;
  if (typeof (response as Response | undefined)?.json !== 'function') return null;

  try {
    const body: unknown = await (response as Response).clone().json();
    const message = (body as { error?: { message?: unknown } })?.error?.message;
    return typeof message === 'string' && message.trim().length > 0 ? message.trim() : null;
  } catch {
    return null;
  }
}

function mapFunctionError(error: unknown, serverMessage: string | null) {
  const detail = error instanceof Error ? error.message : String(error);
  const status = (error as { context?: { status?: number } })?.context?.status ?? null;

  if (status === 401 || status === 403) {
    return appError('unauthorized', 'Sign in again to search for foods.', {
      detail,
      retryable: false,
    });
  }
  if (status === 429) {
    return appError(
      'rate_limited',
      serverMessage ?? 'The food database is busy. Try again in a few minutes.',
      { detail },
    );
  }
  // Not set up is permanent until someone configures it, so retrying it
  // sends the user round a loop that cannot end.
  if (status === 503) {
    return appError(
      'not_configured',
      serverMessage ?? 'Food search is not set up on the server yet.',
      { detail, retryable: false },
    );
  }
  if (status !== null && status >= 500) {
    return appError('provider_error', serverMessage ?? 'The food database had a problem.', {
      detail,
    });
  }
  return appError('network', 'No connection. Check your internet and try again.', { detail });
}

export async function searchFoods(query: string): Promise<Result<FoodRecord[]>> {
  const availability = getSearchAvailability();
  if (!availability.available) {
    return err(
      appError('not_configured', availability.reason ?? 'Food search is not set up.', {
        retryable: false,
      }),
    );
  }

  const client = getSupabaseClient();
  if (!client) {
    return err(
      appError('not_configured', 'Food search is not set up in this build.', {
        detail: 'no supabase client',
        retryable: false,
      }),
    );
  }

  try {
    const { data, error } = await client.functions.invoke(SEARCH_FUNCTION, {
      method: 'POST',
      body: { query },
    });

    if (error) return err(mapFunctionError(error, await readServerMessage(error)));

    const list = (data as { records?: unknown })?.records;
    if (!Array.isArray(list)) {
      return err(
        appError('provider_error', 'The food database sent something unreadable.', {
          detail: 'no records array in the response',
        }),
      );
    }

    // Anything malformed is dropped rather than shown with holes in it: a
    // row wearing a provider badge has to be a real record.
    return ok(list.map(readRecord).filter((record): record is FoodRecord => record !== null));
  } catch (cause) {
    logger.warn('food search failed', { cause: String(cause) });
    return err(
      appError('network', 'No connection. Check your internet and try again.', {
        detail: String(cause),
      }),
    );
  }
}
