/**
 * analyze-meal - estimates nutrition from a meal photo.
 *
 * Runs on Supabase Edge Functions (Deno). This is the only place the Anthropic
 * API key exists: it is read from an Edge Function secret and never reaches
 * the mobile app.
 *
 * What a request does, in order:
 *
 *   1. authenticate the caller against Supabase auth;
 *   2. check their rolling scan allowance (server-side, not client-trusted);
 *   3. validate the uploaded image's type and size for real, not by trusting
 *      the client's claims about it;
 *   4. ask Claude to identify foods and estimate nutrition, constrained to a
 *      JSON schema;
 *   5. validate the response against value ranges a schema cannot express;
 *   6. record the attempt for usage accounting, success or failure;
 *   7. store the photo only if the user asked us to keep it.
 *
 * Deploy with:
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   supabase functions deploy analyze-meal
 */

import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';

import {
  ALLOWED_MIME_TYPES,
  buildUserPrompt,
  detectImageType,
  extensionFor,
  fallbackMealType,
  parseHour,
  parseRegionHint,
  toBase64,
} from './helpers.ts';
import {
  MEAL_ANALYSIS_SCHEMA,
  validateAnalysis,
  type ValidatedAnalysis,
} from './schema.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Claude Opus 5.5. Thinking is always on for this model, so the `thinking`
 * parameter is deliberately omitted; depth is controlled with
 * `output_config.effort` instead.
 */
const MODEL = 'claude-opus-5-5';

/**
 * `medium` is this model's default and suits the task: reading a photo needs
 * care but not deep reasoning. Raise it if identification proves weak.
 */
const EFFORT = 'medium' as const;

/** Thinking tokens count toward output, so leave generous headroom. */
const MAX_TOKENS = 8_000;

/** Give up before the platform's own request timeout. */
const PROVIDER_TIMEOUT_MS = 50_000;

/** Hard server-side ceiling, independent of what the client compressed to. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Below this, the upload cannot be a real photo. */
const MIN_IMAGE_BYTES = 1024;

const PHOTO_BUCKET = 'meal-photos';

const SYSTEM_PROMPT = `You identify foods in photographs for a nutrition journal and estimate their nutrition.

Your estimates are shown to the user clearly labelled as AI estimates, alongside a prompt to correct them. Accuracy about your own uncertainty matters more than appearing confident.

Rules:
- Name only foods you can actually see. Do not infer a side dish, drink, or garnish that is out of frame.
- A photograph cannot reveal cooking oil, butter, added sugar, salt, or anything mixed in and no longer visible. Never state these as fact. Where such an ingredient would materially change the numbers, say so in "caveats".
- Estimate a portion ONLY when the photo contains a usable size reference (a utensil, a hand, a standard plate or can edge, visible packaging). A plate of food alone is usually not enough. When you cannot judge size, set estimatedPortion and estimatedGrams to null, and base estimatedNutrients on a single typical serving instead.
- Use "low" confidence freely. A low-confidence identification the user corrects is far more useful than a confident wrong one.
- If the image contains no food at all, return an empty "foods" array.
- Your nutrient numbers are estimates for the portion you described, not per 100 g, and not measurements.`;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

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

/**
 * An error the client can show.
 *
 * `message` is written for the user. Provider internals and stack traces stay
 * in the function logs.
 */
function errorResponse(status: number, message: string, code: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return errorResponse(405, 'Use POST to analyse a photo.', 'method_not_allowed');
  }

  const startedAt = Date.now();

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!anthropicKey || !supabaseUrl || !serviceRoleKey) {
    // A configuration gap is our fault, and saying which secret is missing to
    // an unauthenticated caller would leak deployment detail.
    console.error('analyze-meal: missing required secrets', {
      hasAnthropicKey: Boolean(anthropicKey),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return errorResponse(
      503,
      'Photo analysis is not available right now.',
      'not_configured',
    );
  }

  // ---- 1. Authenticate -----------------------------------------------------

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(401, 'Sign in to analyse photos.', 'unauthorized');
  }

  // The service-role client is used for the writes the user is not allowed to
  // make themselves (scan accounting). It bypasses RLS, so every query made
  // with it filters by the authenticated user id explicitly.
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

  // ---- 2. Scan allowance ---------------------------------------------------

  const { data: allowanceRows, error: allowanceError } = await admin.rpc(
    'check_scan_allowance',
    { target_user_id: user.id },
  );

  if (allowanceError) {
    console.error('analyze-meal: allowance check failed', allowanceError);
    return errorResponse(500, 'Could not start the analysis. Try again.', 'internal');
  }

  const allowance = Array.isArray(allowanceRows) ? allowanceRows[0] : allowanceRows;
  if (allowance && allowance.allowed === false) {
    return jsonResponse(
      {
        error: {
          code: 'rate_limited',
          message: `You have used all ${allowance.allowance} scans for today. You can still add meals by hand.`,
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

  // ---- 3. Read and validate the upload ------------------------------------

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, 'The upload was malformed.', 'bad_request');
  }

  const photo = form.get('photo');
  if (!(photo instanceof File)) {
    return errorResponse(400, 'No photo was attached.', 'bad_request');
  }

  const bytes = new Uint8Array(await photo.arrayBuffer());

  if (bytes.byteLength < MIN_IMAGE_BYTES) {
    return errorResponse(400, 'That file is too small to be a photo.', 'unsupported_media');
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    await recordScan(admin, user.id, 'rejected_media', {
      imageBytes: bytes.byteLength,
      durationMs: Date.now() - startedAt,
    });
    return errorResponse(413, 'That photo is too large to analyse.', 'unsupported_media');
  }

  // The real format comes from the file's own bytes. A client-supplied
  // content type is a claim, not evidence, and the model will reject a
  // mislabelled image anyway.
  const detectedType = detectImageType(bytes);
  if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType)) {
    await recordScan(admin, user.id, 'rejected_media', {
      imageBytes: bytes.byteLength,
      durationMs: Date.now() - startedAt,
    });
    return errorResponse(
      415,
      'That image format cannot be analysed. Use a JPEG, PNG or WebP photo.',
      'unsupported_media',
    );
  }

  const localHour = parseHour(form.get('localHour'));
  const retainPhoto = form.get('retainPhoto') === 'true';
  const regionHint = parseRegionHint(form.get('regionHint'));

  // ---- 4. Ask Claude -------------------------------------------------------

  const anthropic = new Anthropic({
    apiKey: anthropicKey,
    timeout: PROVIDER_TIMEOUT_MS,
    maxRetries: 1,
  });

  let analysis: ValidatedAnalysis;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: EFFORT,
        format: { type: 'json_schema', schema: MEAL_ANALYSIS_SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: detectedType as 'image/jpeg' | 'image/png' | 'image/webp',
                data: toBase64(bytes),
              },
            },
            { type: 'text', text: buildUserPrompt(localHour, regionHint) },
          ],
        },
      ],
    });

    inputTokens = response.usage?.input_tokens ?? null;
    outputTokens = response.usage?.output_tokens ?? null;

    // Check the stop reason BEFORE reading content: a refusal returns HTTP 200
    // with no usable output.
    if (response.stop_reason === 'refusal') {
      console.warn('analyze-meal: provider declined', response.stop_details);
      await recordScan(admin, user.id, 'refused', {
        providerLabel: MODEL,
        imageBytes: bytes.byteLength,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
      });
      return errorResponse(
        422,
        'That photo could not be analysed. Try a different photo, or add the meal by hand.',
        'provider_refused',
      );
    }

    const rawText = response.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error('analyze-meal: response was not valid JSON', {
        length: rawText.length,
      });
      await recordScan(admin, user.id, 'invalid_response', {
        providerLabel: MODEL,
        imageBytes: bytes.byteLength,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
      });
      return errorResponse(
        502,
        'The analysis came back unreadable. Try again.',
        'invalid_response',
      );
    }

    const validation = validateAnalysis(parsed, MODEL, fallbackMealType(localHour));
    if (!validation.ok) {
      console.warn('analyze-meal: response failed validation', validation.reason);
      await recordScan(admin, user.id, 'invalid_response', {
        providerLabel: MODEL,
        imageBytes: bytes.byteLength,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
      });
      return errorResponse(
        422,
        'We could not identify any food in that photo. Try a clearer shot, or add the meal by hand.',
        'no_food_found',
      );
    }

    analysis = validation.analysis;
  } catch (cause) {
    const status = typeof (cause as { status?: number })?.status === 'number'
      ? (cause as { status: number }).status
      : null;
    console.error('analyze-meal: provider request failed', {
      status,
      message: cause instanceof Error ? cause.message : String(cause),
    });

    await recordScan(admin, user.id, 'provider_error', {
      providerLabel: MODEL,
      imageBytes: bytes.byteLength,
      durationMs: Date.now() - startedAt,
    });

    if (status === 429) {
      return errorResponse(
        429,
        'The analysis service is busy. Try again in a minute.',
        'rate_limited',
      );
    }
    return errorResponse(
      502,
      'The analysis service had a problem. Try again.',
      'provider_error',
    );
  }

  // ---- 5. Keep the photo only if asked ------------------------------------

  if (retainPhoto) {
    const path = `${user.id}/${crypto.randomUUID()}.${extensionFor(detectedType)}`;
    const { error: uploadError } = await admin.storage
      .from(PHOTO_BUCKET)
      .upload(path, bytes, { contentType: detectedType, upsert: false });

    if (uploadError) {
      // The analysis is still valid and worth returning; the user simply does
      // not get a stored photo. Failing the whole request would be worse.
      console.warn('analyze-meal: photo retention failed', uploadError.message);
    } else {
      analysis.photoPath = path;
    }
  }
  // When retainPhoto is false the bytes are never written anywhere. They exist
  // only in this function's memory for the duration of the request.

  await recordScan(admin, user.id, 'succeeded', {
    providerLabel: MODEL,
    imageBytes: bytes.byteLength,
    inputTokens,
    outputTokens,
    durationMs: Date.now() - startedAt,
  });

  return jsonResponse(analysis, 200);
});

interface ScanDetails {
  providerLabel?: string;
  imageBytes?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationMs?: number;
}

/**
 * Records an attempt for usage accounting.
 *
 * Every outcome is recorded, not just successes: a failed attempt still cost a
 * provider request, and counting only successes would let a client retry its
 * way past the limit. A failure to record is logged but never fails the
 * request, because the user already has their answer.
 */
async function recordScan(
  admin: SupabaseClient,
  userId: string,
  outcome:
    | 'succeeded'
    | 'provider_error'
    | 'invalid_response'
    | 'rejected_media'
    | 'refused',
  details: ScanDetails,
): Promise<void> {
  const { error } = await admin.from('scan_events').insert({
    user_id: userId,
    outcome,
    provider_label: details.providerLabel ?? null,
    image_bytes: details.imageBytes ?? null,
    input_tokens: details.inputTokens ?? null,
    output_tokens: details.outputTokens ?? null,
    duration_ms: details.durationMs ?? null,
  });

  if (error) {
    console.error('analyze-meal: could not record scan event', error.message);
  }
}
