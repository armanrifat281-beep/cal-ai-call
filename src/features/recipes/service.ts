import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { appError, err, ok, toAppError, type Result } from '@/lib/result';
import { getSupabaseClient } from '@/lib/supabase';
import type { RecipeRequest } from '@/types/recipe';

import { pickDemoRecipe } from './demoRecipes';
import { validateRecipe, type ValidatedRecipeDraft } from './validate';

/**
 * Recipe generation.
 *
 * The request goes to our own Edge Function, never straight to the AI
 * provider: the key must stay server-side, and the server is where the
 * per-user limit is enforced.
 *
 * When no provider is configured, `generateRecipe` fails with
 * `not_configured` and the UI offers a clearly labelled demo recipe instead.
 * A demo is never substituted silently - the user taps for it, and everything
 * built from it is marked `demo_sample` all the way into the database.
 */

const GENERATE_FUNCTION = 'generate-recipe';

/** Writing a recipe at high effort takes a while. */
export const GENERATION_TIMEOUT_MS = 95_000;

export interface GenerationAvailability {
  available: boolean;
  /** Why it is unavailable, in plain language. Null when available. */
  reason: string | null;
  /** What the developer needs to configure. Empty when available. */
  missing: string[];
}

/**
 * Whether recipe generation can run at all.
 *
 * Checked before the form is submitted, so the user is told up front rather
 * than after filling it in.
 */
export function getGenerationAvailability(): GenerationAvailability {
  if (!env.isSupabaseConfigured) {
    return {
      available: false,
      reason:
        'Recipe creation runs on a server that is not set up in this build, so no recipe can be written for you yet.',
      missing: ['A Supabase project', 'An Anthropic API key as an Edge Function secret'],
    };
  }
  return { available: true, reason: null, missing: [] };
}

export interface GeneratedRecipe extends ValidatedRecipeDraft {
  /** The model that wrote it, or the demo label. */
  providerLabel: string;
  /** True when this came from the bundled demo set rather than a model. */
  isDemo: boolean;
}

export interface GenerateRecipeOptions {
  request: RecipeRequest;
  /** The signed-in user's access token. The endpoint is per-user. */
  accessToken: string | null;
}

/**
 * Asks the server to write a recipe.
 *
 * Nothing identifying is sent: the prompt, the serving count, the dietary
 * restrictions the user asked to have respected, and an optional reference
 * photo. No name, no email, no journal history.
 */
export async function generateRecipe(
  options: GenerateRecipeOptions,
): Promise<Result<GeneratedRecipe>> {
  const availability = getGenerationAvailability();
  if (!availability.available) {
    return err(
      appError('not_configured', availability.reason ?? 'Recipe creation is not set up.', {
        retryable: false,
      }),
    );
  }

  if (!options.accessToken) {
    return err(
      appError('unauthorized', 'Sign in to create recipes.', { retryable: false }),
    );
  }

  const client = getSupabaseClient();
  if (!client) {
    return err(
      appError('not_configured', 'Recipe creation is not set up in this build.', {
        retryable: false,
      }),
    );
  }

  const { request } = options;

  // Only the fields the server reads. Building this explicitly rather than
  // sending the whole object keeps an accidental new field from leaking.
  const payload = {
    prompt: request.prompt,
    mode: request.mode,
    cuisine: request.cuisine,
    cuisineNote: request.cuisineNote,
    servings: request.servings,
    dietaryPatterns: request.dietaryPatterns,
    avoidIngredients: request.avoidIngredients,
    equipment: request.equipment,
    maxTotalMinutes: request.maxTotalMinutes,
    pantryIngredients: request.pantryIngredients,
  };

  try {
    let body: FormData | Record<string, unknown>;

    if (request.referenceImageUri) {
      // Multipart, so the photo rides along with the request.
      const form = new FormData();
      form.append('request', JSON.stringify(payload));
      form.append('photo', {
        uri: request.referenceImageUri,
        name: 'reference.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);
      body = form;
    } else {
      body = payload;
    }

    const { data, error } = await client.functions.invoke(GENERATE_FUNCTION, {
      method: 'POST',
      body,
    });

    if (error) {
      return err(mapFunctionError(error));
    }

    const validation = validateRecipe(data, {
      nutritionSource: 'ai_estimate',
      providerLabel: readProviderLabel(data),
      requestedServings: request.servings,
    });

    if (!validation.ok) return validation;

    return ok({
      ...validation.value,
      providerLabel: readProviderLabel(data),
      isDemo: false,
    });
  } catch (cause) {
    logger.warn('recipe generation request failed', { cause: String(cause) });
    return err(toAppError(cause, 'network'));
  }
}

function readProviderLabel(data: unknown): string {
  if (typeof data === 'object' && data !== null) {
    const label = (data as Record<string, unknown>).providerLabel;
    if (typeof label === 'string' && label.trim().length > 0) return label.trim();
  }
  return 'AI model';
}

/**
 * Maps an Edge Function error to something the user can act on.
 *
 * `functions.invoke` surfaces a non-2xx as a FunctionsHttpError whose body
 * holds our own structured error, so the server's message is preferred over a
 * generic one where it exists.
 */
function mapFunctionError(error: unknown): ReturnType<typeof appError> {
  const message = error instanceof Error ? error.message : String(error);
  const context = (error as { context?: { status?: number } })?.context;
  const status = typeof context?.status === 'number' ? context.status : null;

  if (status === 401 || status === 403) {
    return appError('unauthorized', 'Your session expired. Sign in again.', {
      detail: message,
      retryable: false,
    });
  }
  if (status === 429) {
    return appError(
      'rate_limited',
      'You have reached your recipe limit for today. Saved recipes still work, and you can write one by hand.',
      { detail: message },
    );
  }
  if (status === 413 || status === 415) {
    return appError('unsupported_media', 'That photo could not be used.', {
      detail: message,
      retryable: false,
    });
  }
  if (status === 422) {
    return appError(
      'provider_error',
      'That could not be turned into a recipe. Try describing the dish differently.',
      { detail: message, retryable: true },
    );
  }
  if (status === 503) {
    return appError('not_configured', 'Recipe creation is not available right now.', {
      detail: message,
      retryable: false,
    });
  }
  if (status !== null && status >= 500) {
    return appError('provider_error', 'The recipe service had a problem. Try again.', {
      detail: message,
    });
  }

  return appError('network', 'No connection. Check your internet and try again.', {
    detail: message,
  });
}

/**
 * Returns a bundled demo recipe.
 *
 * Called only from an explicit "show me a demo recipe" action. The result is
 * marked `isDemo`, its nutrition carries the `demo_sample` source, and its
 * caveats say plainly that it was not written for the request. Callers must
 * store it with the `demo_sample` origin so the label survives into the
 * database and back out again.
 */
export function generateDemoRecipe(request: RecipeRequest): GeneratedRecipe {
  const draft = pickDemoRecipe(request);
  return {
    ...draft,
    // The demo set has fixed serving counts; the user can rescale afterwards
    // exactly as with a generated recipe.
    providerLabel: 'Bundled demo recipe',
    isDemo: true,
  };
}
