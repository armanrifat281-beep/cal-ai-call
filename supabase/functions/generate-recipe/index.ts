/**
 * generate-recipe - writes a complete recipe from what the user asked for.
 *
 * Runs on Supabase Edge Functions (Deno). The model's API key exists only
 * here, as an Edge Function secret, and never reaches the app.
 *
 * Which model answers is `_shared/vision.ts`'s decision, made from whichever
 * key is configured, so this function and analyze-meal are never set up for
 * different providers.
 *
 * A request:
 *   1. authenticates the caller;
 *   2. checks their rolling recipe allowance (server-side);
 *   3. optionally reads a reference photo, validated by its magic bytes;
 *   4. asks the configured model for a recipe, shaped by a JSON schema;
 *   5. validates the response against ranges a schema cannot express;
 *   6. records the attempt, success or failure.
 *
 * It does NOT generate an image. Nothing here invents a photograph of a
 * finished dish; the app shows a labelled placeholder instead. Wiring a real
 * image provider is documented in docs/SETUP.md.
 *
 * Deploy with:
 *   supabase secrets set ANTHROPIC_API_KEY=...   # or GEMINI_API_KEY
 *   supabase functions deploy generate-recipe
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';

import { selectVisionProvider } from '../_shared/vision.ts';

import {
  RECIPE_SCHEMA,
  validateGeneratedRecipe,
  type ValidatedRecipe,
} from './schema.ts';

/**
 * Writing a good recipe needs more care than reading a photo: quantities have
 * to be internally consistent and the steps have to work in order.
 */
const EFFORT = 'high' as const;

/** A long recipe plus thinking tokens needs room. */
const MAX_TOKENS = 16_000;

const PROVIDER_TIMEOUT_MS = 90_000;

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const SYSTEM_PROMPT = `You write practical recipes that a home cook can follow and that work the first time.

Rules that matter more than sounding impressive:

- Quantities must be internally consistent. The amounts you give must feed exactly the number of servings you state. If you cannot be precise, give a range in the ingredient's preparation note rather than a false precision.
- Give every ingredient a short id, and refer to those ids from the steps that use them. The app shows the relevant ingredients beside each step while the user is cooking.
- Put the food in "name" and the handling in "preparation": name "Onion", preparation "finely sliced". Never "1 large onion, finely sliced" as a name.
- Mark "scalesWithServings" false only when the amount genuinely depends on the equipment rather than the number of eaters, such as oil for deep frying or water for boiling pasta. Almost everything else scales.
- One action per step, in the order it happens. Do not number the steps in the text; the app numbers them.
- Give temperatures in Celsius, and times in minutes, wherever they matter. Omit them where they do not.
- Nutrition is for ONE serving, and it is an estimate. Make the macros and the calories agree with each other at roughly 4 kcal per gram of protein and carbohydrate and 9 per gram of fat. If you cannot estimate a dish, return null rather than a number you do not believe.
- Use "caveats" honestly: name the ingredient whose amount varies most between cooks, the step that needs judgement, and say when the nutrition is a rough guess.
- Respect the stated dietary restrictions absolutely: do not include an ingredient the user said to avoid, and do not suggest it as a substitution either. You cannot guarantee a dish is free of an allergen, so do not claim to; the app tells the user that.
- If the request is too vague to produce one specific dish, still produce the most reasonable interpretation and say in "caveats" what you assumed.`;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string, code: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

// ---------------------------------------------------------------------------
// Request reading
// ---------------------------------------------------------------------------

type RequestMode = 'dish_name' | 'description' | 'from_pantry' | 'from_photo';

const MODES = new Set<string>(['dish_name', 'description', 'from_pantry', 'from_photo']);

interface RecipeRequestInput {
  prompt: string;
  mode: RequestMode;
  cuisine: string | null;
  cuisineNote: string | null;
  servings: number;
  dietaryPatterns: string[];
  avoidIngredients: string[];
  equipment: string[];
  maxTotalMinutes: number | null;
  pantryIngredients: string[];
}

function readStringList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry.length <= 120)
    .slice(0, maxItems);
}

function readRequest(body: unknown): RecipeRequestInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = body as Record<string, unknown>;

  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim().slice(0, 600) : '';
  const mode = typeof raw.mode === 'string' && MODES.has(raw.mode) ? raw.mode : null;
  if (!mode) return null;

  // A photo request can have an empty prompt; everything else needs words.
  if (prompt.length === 0 && mode !== 'from_photo') return null;

  const servingsRaw = raw.servings;
  const servings =
    typeof servingsRaw === 'number' && Number.isInteger(servingsRaw)
      ? Math.max(1, Math.min(24, servingsRaw))
      : 4;

  const maxTotal = raw.maxTotalMinutes;
  const maxTotalMinutes =
    typeof maxTotal === 'number' && Number.isFinite(maxTotal) && maxTotal > 0
      ? Math.min(1440, Math.round(maxTotal))
      : null;

  return {
    prompt,
    mode: mode as RequestMode,
    cuisine: typeof raw.cuisine === 'string' ? raw.cuisine.slice(0, 40) : null,
    cuisineNote: typeof raw.cuisineNote === 'string' ? raw.cuisineNote.slice(0, 80) : null,
    servings,
    dietaryPatterns: readStringList(raw.dietaryPatterns, 12),
    avoidIngredients: readStringList(raw.avoidIngredients, 30),
    equipment: readStringList(raw.equipment, 15),
    maxTotalMinutes,
    pantryIngredients: readStringList(raw.pantryIngredients, 40),
  };
}

/** Identifies an image format from its magic bytes, not a claimed type. */
function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) return 'image/png';

  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (
    riff.every((byte, index) => bytes[index] === byte) &&
    webp.every((byte, index) => bytes[index + 8] === byte)
  ) {
    return 'image/webp';
  }
  return null;
}

function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

/**
 * Builds the user turn.
 *
 * Only what the user asked for goes in. Their email, name and journal never
 * do. Dietary restrictions are included because the user asked for them to be
 * respected, and nothing else about them is sent.
 */
function buildPrompt(request: RecipeRequestInput, hasPhoto: boolean): string {
  const lines: string[] = [];

  switch (request.mode) {
    case 'dish_name':
      lines.push(`Write a recipe for: ${request.prompt}`);
      break;
    case 'description':
      lines.push(`Write a recipe for a dish described as: ${request.prompt}`);
      break;
    case 'from_pantry':
      lines.push(
        'Write a recipe that uses mainly what this person already has, adding as few extra ingredients as possible.',
        `They have: ${request.pantryIngredients.join(', ') || request.prompt}`,
      );
      if (request.prompt && request.pantryIngredients.length > 0) {
        lines.push(`They also said: ${request.prompt}`);
      }
      break;
    case 'from_photo':
      lines.push(
        hasPhoto
          ? 'Identify the dish in the attached photo and write a recipe that would produce something close to it.'
          : 'Write a recipe for the dish described below.',
      );
      if (request.prompt) lines.push(`They added: ${request.prompt}`);
      if (hasPhoto) {
        lines.push(
          'A photo cannot reveal every ingredient or the exact method, so say in "caveats" what you inferred rather than observed.',
        );
      }
      break;
  }

  lines.push(`It must serve exactly ${request.servings}.`);

  if (request.cuisine && request.cuisine !== 'other') {
    lines.push(`Cook it in the ${request.cuisine.replace(/_/g, ' ')} style.`);
  } else if (request.cuisineNote) {
    lines.push(`Cook it in this style: ${request.cuisineNote}.`);
  }

  if (request.dietaryPatterns.length > 0) {
    lines.push(
      `It must suit these eating patterns: ${request.dietaryPatterns.join(', ')}.`,
    );
  }

  if (request.avoidIngredients.length > 0) {
    lines.push(
      `It must NOT contain, and must not suggest as a substitute: ${request.avoidIngredients.join(', ')}.`,
    );
  }

  if (request.equipment.length > 0) {
    lines.push(`They have: ${request.equipment.join(', ')}. Do not require anything else.`);
  } else {
    lines.push('Assume a basic kitchen: a hob, a couple of pans, and an oven.');
  }

  if (request.maxTotalMinutes !== null) {
    lines.push(
      `Preparation and cooking together must fit in about ${request.maxTotalMinutes} minutes.`,
    );
  }

  if (request.mode !== 'from_pantry' && request.pantryIngredients.length > 0) {
    lines.push(
      `They already have these at home, so prefer using them: ${request.pantryIngredients.join(', ')}.`,
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return errorResponse(405, 'Use POST to generate a recipe.', 'method_not_allowed');
  }

  const startedAt = Date.now();

  // Whichever model the deployment has a key for. Shared with analyze-meal,
  // so a deployment configured for one feature is configured for both - the
  // recipe creator used to demand an Anthropic key specifically and answered
  // 503 on a Gemini-only deployment, with the app correctly reporting that
  // the feature was not set up.
  const vision = selectVisionProvider(PROVIDER_TIMEOUT_MS);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!vision || !supabaseUrl || !serviceRoleKey) {
    console.error('generate-recipe: missing required secrets', {
      hasVisionProvider: Boolean(vision),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return errorResponse(503, 'Recipe creation is not available right now.', 'not_configured');
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(401, 'Sign in to create recipes.', 'unauthorized');
  }

  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  const user = userData?.user;
  if (userError || !user) {
    return errorResponse(401, 'Your session has expired. Sign in again.', 'unauthorized');
  }

  // ---- Allowance -----------------------------------------------------------

  const { data: allowanceRows, error: allowanceError } = await admin.rpc(
    'check_ai_allowance',
    { target_user_id: user.id, request_kind: 'recipe_generation' },
  );

  if (allowanceError) {
    console.error('generate-recipe: allowance check failed', allowanceError);
    return errorResponse(500, 'Could not start. Try again.', 'internal');
  }

  const allowance = Array.isArray(allowanceRows) ? allowanceRows[0] : allowanceRows;
  if (allowance && allowance.allowed === false) {
    return jsonResponse(
      {
        error: {
          code: 'rate_limited',
          message: `You have created ${allowance.allowance} recipes today. You can still open your saved recipes, and write one by hand.`,
        },
        allowance: {
          used: allowance.used,
          limit: allowance.allowance,
          tier: allowance.tier,
          resetsAt: allowance.resets_at,
        },
      },
      429,
    );
  }

  // ---- Read the request ----------------------------------------------------

  let recipeRequest: RecipeRequestInput | null = null;
  let photoBytes: Uint8Array | null = null;
  let photoType: string | null = null;

  const contentType = request.headers.get('Content-Type') ?? '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const payload = form.get('request');
      recipeRequest = readRequest(
        typeof payload === 'string' ? JSON.parse(payload) : null,
      );

      const photo = form.get('photo');
      if (photo instanceof File) {
        const bytes = new Uint8Array(await photo.arrayBuffer());
        if (bytes.byteLength > MAX_IMAGE_BYTES) {
          return errorResponse(413, 'That photo is too large.', 'unsupported_media');
        }
        const detected = detectImageType(bytes);
        if (!detected || !ALLOWED_IMAGE_TYPES.has(detected)) {
          return errorResponse(
            415,
            'That image format cannot be read. Use a JPEG, PNG or WebP photo.',
            'unsupported_media',
          );
        }
        photoBytes = bytes;
        photoType = detected;
      }
    } else {
      recipeRequest = readRequest(await request.json());
    }
  } catch {
    return errorResponse(400, 'The request was malformed.', 'bad_request');
  }

  if (!recipeRequest) {
    return errorResponse(
      400,
      'Tell us what you would like to cook.',
      'validation',
    );
  }

  // ---- Ask the model -------------------------------------------------------

  let recipe: ValidatedRecipe;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  try {
    const response = await vision.analyse({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildPrompt(recipeRequest, photoBytes !== null),
      imageBase64: photoBytes ? toBase64(photoBytes) : null,
      mimeType: photoType,
      schema: RECIPE_SCHEMA,
      maxTokens: MAX_TOKENS,
      timeoutMs: PROVIDER_TIMEOUT_MS,
      // A recipe has to be cookable, which is worth more thinking than
      // naming what is on a plate.
      effort: EFFORT,
    });

    inputTokens = response.inputTokens;
    outputTokens = response.outputTokens;

    // Checked BEFORE reading content: a refusal is an HTTP 200 with no usable
    // output.
    if (response.refused) {
      console.warn('generate-recipe: provider declined');
      await recordUsage(admin, user.id, 'refused', {
        providerLabel: vision.label,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
      });
      return errorResponse(
        422,
        'That request could not be turned into a recipe. Try describing the dish differently.',
        'provider_refused',
      );
    }

    // Cut off at the token budget: the JSON is unclosed, so parsing it would
    // report "unreadable" and blame the model for a budget that was too small.
    if (response.truncated) {
      console.warn('generate-recipe: answer truncated at the token budget', {
        outputTokens,
        maxTokens: MAX_TOKENS,
      });
      await recordUsage(admin, user.id, 'invalid_response', {
        providerLabel: vision.label,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
      });
      return errorResponse(
        502,
        'That recipe came out longer than the model could finish in one go. Try asking for something simpler, or fewer servings.',
        'response_truncated',
      );
    }

    const rawText = response.text;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error('generate-recipe: response was not valid JSON', {
        length: rawText.length,
      });
      await recordUsage(admin, user.id, 'invalid_response', {
        providerLabel: vision.label,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
      });
      return errorResponse(502, 'The recipe came back unreadable. Try again.', 'invalid_response');
    }

    const validation = validateGeneratedRecipe(parsed, vision.label, recipeRequest.servings);
    if (!validation.ok) {
      console.warn('generate-recipe: response failed validation', validation.reason);
      await recordUsage(admin, user.id, 'invalid_response', {
        providerLabel: vision.label,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
      });
      return errorResponse(
        422,
        'The recipe came back incomplete. Try again, or describe the dish differently.',
        'invalid_response',
      );
    }

    recipe = validation.recipe;
  } catch (cause) {
    const status =
      typeof (cause as { status?: number })?.status === 'number'
        ? (cause as { status: number }).status
        : null;
    console.error('generate-recipe: provider request failed', {
      status,
      message: cause instanceof Error ? cause.message : String(cause),
    });

    await recordUsage(admin, user.id, 'provider_error', {
      providerLabel: vision.label,
      durationMs: Date.now() - startedAt,
    });

    if (status === 429) {
      return errorResponse(429, 'The recipe service is busy. Try again in a minute.', 'rate_limited');
    }
    return errorResponse(502, 'The recipe service had a problem. Try again.', 'provider_error');
  }

  await recordUsage(admin, user.id, 'succeeded', {
    providerLabel: vision.label,
    inputTokens,
    outputTokens,
    durationMs: Date.now() - startedAt,
  });

  return jsonResponse(recipe, 200);
});

interface UsageDetails {
  providerLabel?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationMs?: number;
}

/**
 * Records the attempt.
 *
 * Every outcome, not just successes: a failed attempt still cost a provider
 * request, and counting only successes would let a client retry past the
 * limit. A failure to record never fails the request.
 */
async function recordUsage(
  admin: SupabaseClient,
  userId: string,
  outcome: 'succeeded' | 'provider_error' | 'invalid_response' | 'refused',
  details: UsageDetails,
): Promise<void> {
  const { error } = await admin.from('scan_events').insert({
    user_id: userId,
    kind: 'recipe_generation',
    outcome,
    provider_label: details.providerLabel ?? null,
    input_tokens: details.inputTokens ?? null,
    output_tokens: details.outputTokens ?? null,
    duration_ms: details.durationMs ?? null,
  });

  if (error) {
    console.error('generate-recipe: could not record usage', error.message);
  }
}
