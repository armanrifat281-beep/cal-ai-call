import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { CORS_HEADERS } from '../_shared/cors.ts';

/**
 * Food database search.
 *
 * Looks a food up in USDA FoodData Central and returns records in the app's
 * own shape. It exists as a function rather than a direct call from the app
 * for one reason: the USDA key would otherwise ship inside the bundle, where
 * anyone who downloads the app can read it and spend its rate limit.
 *
 * The app's half of the promise is that every number says where it came
 * from. A record from here carries `usda:<fdcId>`, so a meal logged from a
 * search is a lookup, not an estimate - which is the difference between this
 * screen and the camera.
 *
 * Deploy with:
 *   supabase secrets set USDA_FDC_API_KEY=...
 *   supabase functions deploy search-foods
 */

const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

/**
 * Which USDA datasets to search.
 *
 * Foundation and SR Legacy are the generic, analysed foods - "chicken
 * breast, grilled" rather than one shop's packet of it. Branded is included
 * because people eat packaged food, but it is listed last so generic
 * records rank first when both match.
 */
const DATA_TYPES = 'Foundation,SR Legacy,Branded';

const MAX_RESULTS = 25;
const MAX_QUERY_LENGTH = 100;

/**
 * USDA nutrient ids.
 *
 * Taken from real responses rather than from the docs, which do not list
 * them. The energy one matters: 1062 is also called "Energy" and is in
 * kilojoules, so a lookup by name alone silently returns a figure 4.18x too
 * large.
 */
const NUTRIENT_IDS = {
  caloriesKcal: 1008,
  proteinG: 1003,
  carbsG: 1005,
  fatG: 1004,
  fiberG: 1079,
  // Some records use 1063 ("Sugars, Total") and others 2000 ("Sugars, total
  // including NLEA"). Either is the same measurement.
  sugarG: [1063, 2000],
  saturatedFatG: 1258,
  sodiumMg: 1093,
} as const;


function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string, code: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

interface UsdaNutrient {
  nutrientId?: number;
  unitName?: string;
  value?: number;
}

interface UsdaFood {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  dataType?: string;
  foodNutrients?: UsdaNutrient[];
}

/**
 * One nutrient from a record, or null when it is absent.
 *
 * `unit` is checked where it matters: see the kilojoule trap above.
 */
function readNutrient(
  nutrients: UsdaNutrient[],
  id: number | readonly number[],
  unit?: string,
): number | null {
  const ids = typeof id === 'number' ? [id] : id;

  for (const nutrient of nutrients) {
    if (nutrient.nutrientId === undefined) continue;
    if (!ids.includes(nutrient.nutrientId)) continue;
    if (unit !== undefined && nutrient.unitName?.toUpperCase() !== unit) continue;
    if (typeof nutrient.value !== 'number' || !Number.isFinite(nutrient.value)) continue;
    return nutrient.value;
  }
  return null;
}

/**
 * A USDA record in the app's shape, or null when it cannot be used.
 *
 * Returns null when any of calories, protein, carbs or fat is missing. Many
 * Foundation records carry only trace nutrients - one real result for
 * "chicken breast" had none of the four - and showing such a record would
 * mean logging a meal as zero calories. The app's rule is that unknown never
 * silently becomes zero, so these are dropped rather than padded.
 */
function toRecord(food: UsdaFood): Record<string, unknown> | null {
  const fdcId = food.fdcId;
  const description = food.description?.trim();
  if (fdcId === undefined || !description) return null;

  const nutrients = food.foodNutrients ?? [];
  const caloriesKcal = readNutrient(nutrients, NUTRIENT_IDS.caloriesKcal, 'KCAL');
  const proteinG = readNutrient(nutrients, NUTRIENT_IDS.proteinG, 'G');
  const carbsG = readNutrient(nutrients, NUTRIENT_IDS.carbsG, 'G');
  const fatG = readNutrient(nutrients, NUTRIENT_IDS.fatG, 'G');

  if (
    caloriesKcal === null ||
    proteinG === null ||
    carbsG === null ||
    fatG === null
  ) {
    return null;
  }

  const brand = food.brandName?.trim() || food.brandOwner?.trim() || null;

  return {
    id: `usda:${fdcId}`,
    name: description,
    brand,
    nutrientsPer100g: {
      caloriesKcal,
      proteinG,
      carbsG,
      fatG,
      fiberG: readNutrient(nutrients, NUTRIENT_IDS.fiberG, 'G'),
      sugarG: readNutrient(nutrients, NUTRIENT_IDS.sugarG, 'G'),
      saturatedFatG: readNutrient(nutrients, NUTRIENT_IDS.saturatedFatG, 'G'),
      sodiumMg: readNutrient(nutrients, NUTRIENT_IDS.sodiumMg, 'MG'),
    },
    // USDA search results carry no household measures; the detail endpoint
    // does. Left empty rather than invented - the app falls back to grams,
    // which is what the figures above are per.
    portionOptions: [],
    providerLabel: 'USDA FoodData Central',
    providerRef: String(fdcId),
    isGeneric: food.dataType !== 'Branded',
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return errorResponse(405, 'Use POST to search for a food.', 'method_not_allowed');
  }

  const usdaKey = Deno.env.get('USDA_FDC_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!usdaKey || !supabaseUrl || !serviceRoleKey) {
    // Which secret is missing stays in the logs: saying so to an
    // unauthenticated caller would leak deployment detail.
    console.error('search-foods: missing configuration', {
      hasUsdaKey: Boolean(usdaKey),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return errorResponse(
      503,
      'Food search is not set up on the server yet. You can still add meals by hand.',
      'not_configured',
    );
  }

  // Authenticated, so the USDA rate limit cannot be spent by anyone who
  // merely knows the URL.
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(401, 'Sign in to search for foods.', 'unauthorized');
  }

  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (userError || !userData?.user) {
    return errorResponse(401, 'Your session has expired. Sign in again.', 'unauthorized');
  }

  let query: string;
  try {
    const body: unknown = await request.json();
    const raw = (body as { query?: unknown })?.query;
    query = typeof raw === 'string' ? raw.trim().slice(0, MAX_QUERY_LENGTH) : '';
  } catch {
    return errorResponse(400, 'The search was malformed.', 'bad_request');
  }

  if (query.length < 2) {
    return errorResponse(400, 'Type at least two letters to search.', 'bad_request');
  }

  const url = new URL(SEARCH_URL);
  url.searchParams.set('api_key', usdaKey);
  url.searchParams.set('query', query);
  url.searchParams.set('dataType', DATA_TYPES);
  url.searchParams.set('pageSize', String(MAX_RESULTS));

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (cause) {
    console.error('search-foods: request failed', { cause: String(cause) });
    return errorResponse(502, 'The food database did not answer. Try again.', 'provider_error');
  }

  if (response.status === 429) {
    return errorResponse(
      429,
      'The food database is busy. Try again in a few minutes.',
      'rate_limited',
    );
  }
  if (!response.ok) {
    console.error('search-foods: provider error', { status: response.status });
    return errorResponse(502, 'The food database had a problem. Try again.', 'provider_error');
  }

  let foods: UsdaFood[];
  try {
    const body: unknown = await response.json();
    const list = (body as { foods?: unknown })?.foods;
    foods = Array.isArray(list) ? (list as UsdaFood[]) : [];
  } catch (cause) {
    console.error('search-foods: unreadable response', { cause: String(cause) });
    return errorResponse(502, 'The food database sent something unreadable.', 'provider_error');
  }

  const records = foods
    .map(toRecord)
    .filter((record): record is Record<string, unknown> => record !== null);

  /*
    Generic foods first.

    USDA ranks purely by text relevance, and there are far more branded
    records than analysed ones - a live search for "chicken breast" came
    back with twenty-two results, every one of them an American
    supermarket's packet. Someone typing those words wants the food, not a
    shop's version of it.

    A stable partition rather than a re-ranking: USDA's order is kept within
    each group, so the best text match is still the first generic result.
  */
  records.sort((a, b) => Number(b.isGeneric === true) - Number(a.isGeneric === true));

  return jsonResponse({ records }, 200);
});
