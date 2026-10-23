/**
 * Reads a photograph of a packaged food's nutrition panel.
 *
 * Why this exists next to the barcode lookup rather than instead of it: a
 * barcode gives the manufacturer's own published figures and is always the
 * better answer when the product is in the database. This is for the rest -
 * local brands, loose packaging, anything Open Food Facts has never seen -
 * where the panel on the packet is the only source there is.
 *
 * What it will not do:
 *  - fill in a figure the panel does not print,
 *  - work out added sugar from total sugar,
 *  - read allergens off the ingredient list.
 *
 * The first two would turn a guess into something indistinguishable from a
 * measurement. The third could hurt somebody.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';

import { ALLOWED_MIME_TYPES, detectImageType, toBase64 } from '../_shared/image.ts';
import { selectVisionProvider } from '../_shared/vision.ts';

import { LABEL_SCHEMA, toPer100g, validateLabel } from './schema.ts';
import { CORS_HEADERS } from '../_shared/cors.ts';

const MAX_TOKENS = 3_000;
const PROVIDER_TIMEOUT_MS = 45_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIN_IMAGE_BYTES = 1024;

const SYSTEM_PROMPT = `You read the nutrition panel printed on packaged food and report exactly what it says.

Rules, in order of importance:

1. Report only what is printed. If a figure is not on the panel, return null
   for it. Never estimate, never infer from similar products, never calculate
   a missing value from the others.
2. Added sugars: return a figure ONLY if the panel prints added sugars as its
   own line. Never derive it from total sugars. Most labels outside the United
   States do not print it; null is the correct and expected answer.
3. Allergens: list only what the packaging declares itself, such as
   "Contains: milk, soy". Never read allergens off the ingredient list.
4. Say what the figures are per. Set basis to per_100g or per_serving to match
   the column you read. If both are printed, read the per 100 g column.
5. Salt is not sodium. If the panel gives salt in grams, convert to sodium in
   milligrams by multiplying by 400, and do not report the salt figure as
   sodium.
6. Anything blurred, cut off, or that you are unsure of goes in "uncertain" by
   field name, and its value stays null.
7. If the photograph is not a readable nutrition panel at all, set readable to
   false and leave everything else empty. That is a useful answer, not a
   failure.`;


function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(
  status: number,
  message: string,
  code: string,
  detail?: string,
): Response {
  return jsonResponse(
    {
      error: {
        code,
        message,
        // The cause travels to the phone: this function's logs cannot be
        // read from the CLI, so an error that stays on the server is an
        // error nobody can act on.
        ...(detail ? { detail: detail.slice(0, 180) } : {}),
      },
    },
    status,
  );
}

/** Slices from the first brace to the last, surviving fences and prose. */
function extractJson(text: string): string {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return text.trim();
  return text.slice(first, last + 1);
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return errorResponse(405, 'Use POST to read a label.', 'method_not_allowed');
  }

  const startedAt = Date.now();

  const vision = selectVisionProvider(PROVIDER_TIMEOUT_MS);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!vision || !supabaseUrl || !serviceRoleKey) {
    console.error('read-label: missing required secrets', {
      hasVisionProvider: Boolean(vision),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return errorResponse(503, 'Label reading is not available right now.', 'not_configured');
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(401, 'Sign in to read labels.', 'unauthorized');
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

  // The same allowance as a meal photo: it is the same provider, the same
  // cost, and a second counter would let the two be spent twice over.
  const { data: allowanceRows, error: allowanceError } = await admin.rpc(
    'check_ai_allowance',
    { target_user_id: user.id, request_kind: 'photo_scan' },
  );

  if (allowanceError) {
    console.error('read-label: allowance check failed', allowanceError);
    return errorResponse(500, 'Could not start reading the label. Try again.', 'internal');
  }

  const allowance = Array.isArray(allowanceRows) ? allowanceRows[0] : allowanceRows;
  if (allowance && allowance.allowed === false) {
    return jsonResponse(
      {
        error: {
          code: 'rate_limited',
          message: `You have used all ${allowance.allowance} scans for today. You can still type a product in by hand.`,
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
    await recordScan(admin, user.id, 'rejected_media', bytes.byteLength, startedAt);
    return errorResponse(413, 'That photo is too large to read.', 'unsupported_media');
  }

  const detectedType = detectImageType(bytes);
  if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType)) {
    await recordScan(admin, user.id, 'rejected_media', bytes.byteLength, startedAt);
    return errorResponse(
      415,
      'That image format cannot be read. Use a JPEG, PNG or WebP photo.',
      'unsupported_media',
    );
  }

  try {
    const response = await vision.analyse({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt:
        'Read the nutrition panel in this photograph. Report only what is printed on it.',
      imageBase64: toBase64(bytes),
      mimeType: detectedType,
      schema: LABEL_SCHEMA,
      maxTokens: MAX_TOKENS,
      timeoutMs: PROVIDER_TIMEOUT_MS,
    });

    if (response.refused) {
      await recordScan(admin, user.id, 'refused', bytes.byteLength, startedAt, vision.label);
      return errorResponse(
        422,
        'That photo could not be read. Try again with the panel filling the frame.',
        'provider_refused',
      );
    }

    if (response.truncated) {
      await recordScan(
        admin,
        user.id,
        'invalid_response',
        bytes.byteLength,
        startedAt,
        vision.label,
      );
      return errorResponse(
        502,
        'The label had more on it than could be read in one go. Try a closer photo of the panel itself.',
        'response_truncated',
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(response.text));
    } catch {
      await recordScan(
        admin,
        user.id,
        'invalid_response',
        bytes.byteLength,
        startedAt,
        vision.label,
      );
      return errorResponse(
        502,
        'The reading came back unreadable. Try again.',
        'invalid_response',
        `len ${response.text.length}: ...${response.text.slice(-80)}`,
      );
    }

    const validation = validateLabel(parsed);
    if (!validation.ok) {
      await recordScan(admin, user.id, 'refused', bytes.byteLength, startedAt, vision.label);
      return errorResponse(
        422,
        'No nutrition panel could be read in that photo. Try again with the panel square on and in focus.',
        'label_unreadable',
        validation.reason,
      );
    }

    const reading = validation.value;
    // Per 100 g is how packaged food is compared, so it is computed once
    // here when the serving weight allows it. When it does not, the
    // per-serving figures stand and the app says which they are.
    const per100g =
      reading.basis === 'per_100g'
        ? reading.nutrients
        : toPer100g(reading.nutrients, reading.servingGrams);

    await recordScan(
      admin,
      user.id,
      'succeeded',
      bytes.byteLength,
      startedAt,
      vision.label,
      response.inputTokens,
      response.outputTokens,
    );

    return jsonResponse(
      {
        label: reading,
        per100g,
        providerLabel: vision.label,
      },
      200,
    );
  } catch (cause) {
    const status = (cause as { status?: number })?.status;
    console.error('read-label: provider call failed', String(cause));
    await recordScan(
      admin,
      user.id,
      'provider_error',
      bytes.byteLength,
      startedAt,
      vision.label,
    );
    return errorResponse(
      502,
      'The label reader had a problem. Try again.',
      'provider_error',
      `${status ?? 'no status'}: ${(cause as Error)?.message ?? String(cause)}`,
    );
  }
});

/**
 * Records the request against the daily allowance.
 *
 * `photo_scan`, the same kind a meal photo uses, because it is the same
 * provider and the same cost. Only outcomes the user got something from are
 * counted by `check_ai_allowance`, so a provider fault here is free.
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
  imageBytes: number,
  startedAt: number,
  providerLabel?: string,
  inputTokens?: number | null,
  outputTokens?: number | null,
): Promise<void> {
  const { error } = await admin.from('scan_events').insert({
    user_id: userId,
    kind: 'photo_scan',
    outcome,
    provider_label: providerLabel ?? null,
    image_bytes: imageBytes,
    input_tokens: inputTokens ?? null,
    output_tokens: outputTokens ?? null,
    duration_ms: Date.now() - startedAt,
  });

  if (error) {
    console.error('read-label: could not record scan event', error.message);
  }
}
