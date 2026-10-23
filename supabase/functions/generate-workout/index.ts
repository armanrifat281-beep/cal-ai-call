/**
 * Writes a training plan.
 *
 * The highest-stakes thing this backend does: a model proposing what
 * somebody should do with their body, several times a week. So the
 * guardrails are in three places, not one.
 *
 * On the way in: the client sends the exercise ids it can actually show
 * instructions for, and the schema restricts the answer to those. A plan
 * naming a movement the app cannot explain is a plan somebody performs
 * from the name alone.
 *
 * In the prompt: conservative volume, real rest, rest days, no medical
 * claims, no "shred" language, and an explicit instruction not to write
 * anything for an injury - the model has no business there.
 *
 * On the way out: every number is checked against bounds and nothing is
 * clamped. A plan asking for twenty sets is rejected, not quietly turned
 * into eight, because the model that wrote it was not writing for a
 * person.
 *
 * And the app never starts one without the user reading it first. That
 * rule lives on the client, where the Start button is.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';

import { selectVisionProvider } from '../_shared/vision.ts';

import { planSchema, validatePlan, type GenerateInput } from './schema.ts';

const MAX_TOKENS = 4_000;
const PROVIDER_TIMEOUT_MS = 50_000;
/** Enough ids for a generous library, not enough to be a prompt-injection sink. */
const MAX_EXERCISE_IDS = 200;

const SYSTEM_PROMPT = `You write simple, conservative training plans for ordinary people.

Hard rules:

1. Use ONLY the exercise ids given to you. Never invent an id, never rename
   one, never write an exercise that is not on the list.
2. Give every entry either repetitions or a duration in seconds, never
   neither. Holds such as planks use seconds.
3. Keep the volume sane: three to five exercises on a training day, three to
   four sets each for a beginner. More is not better and you cannot see the
   person you are writing for.
4. Include rest days. A day with an empty entries array is a rest day, and a
   plan for four days a week has three of them.
5. Rest periods are realistic: 60-90 seconds for ordinary work, 120-180 for
   heavy compound lifts.
6. Never prescribe a weight. You do not know what this person can lift.
7. Write no medical or dietary advice, diagnose nothing, and promise no
   result by any date. If the notes mention an injury, pain or a medical
   condition, do not write around it - say in the summary that they should
   speak to a professional, and keep the plan to gentle general movement.
8. Plain language. No "shred", no "crush", no "beast mode", no emoji.`;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string, code: string, detail?: string) {
  return jsonResponse(
    { error: { code, message, ...(detail ? { detail: detail.slice(0, 180) } : {}) } },
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

function readInput(body: unknown): GenerateInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = body as Record<string, unknown>;

  const ids = Array.isArray(raw.allowedExerciseIds)
    ? (raw.allowedExerciseIds as unknown[])
        .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length < 60)
        .slice(0, MAX_EXERCISE_IDS)
    : [];
  if (ids.length === 0) return null;

  const experience = raw.experience;
  const days = typeof raw.daysPerWeek === 'number' ? Math.round(raw.daysPerWeek) : 3;
  const minutes = typeof raw.minutesPerSession === 'number' ? Math.round(raw.minutesPerSession) : 45;

  return {
    allowedExerciseIds: ids,
    goal: typeof raw.goal === 'string' ? raw.goal.slice(0, 120) : 'general fitness',
    experience:
      experience === 'intermediate' || experience === 'advanced' ? experience : 'beginner',
    equipment: Array.isArray(raw.equipment)
      ? (raw.equipment as unknown[])
          .filter((item): item is string => typeof item === 'string')
          .slice(0, 20)
      : [],
    daysPerWeek: Math.min(7, Math.max(1, days)),
    minutesPerSession: Math.min(120, Math.max(10, minutes)),
    // Free text from the user reaches the model, so it is capped and the
    // system prompt is written to hold under it.
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 300) : null,
  };
}

function userPrompt(input: GenerateInput, names: Map<string, string>): string {
  const list = input.allowedExerciseIds
    .map((id) => `${id} = ${names.get(id) ?? id}`)
    .join('\n');

  return [
    `Goal: ${input.goal}`,
    `Experience: ${input.experience}`,
    `Equipment available: ${input.equipment.length > 0 ? input.equipment.join(', ') : 'bodyweight only'}`,
    `Days a week they can train: ${input.daysPerWeek}`,
    `Minutes per session: ${input.minutesPerSession}`,
    input.notes ? `They also said: ${input.notes}` : '',
    '',
    'Write a plan of exactly 7 days, including rest days.',
    '',
    'The ONLY exercises you may use, as "id = name":',
    list,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') {
    return errorResponse(405, 'Use POST to generate a plan.', 'method_not_allowed');
  }

  const startedAt = Date.now();

  const vision = selectVisionProvider(PROVIDER_TIMEOUT_MS);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!vision || !supabaseUrl || !serviceRoleKey) {
    console.error('generate-workout: missing required secrets', {
      hasVisionProvider: Boolean(vision),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return errorResponse(503, 'Plan generation is not available right now.', 'not_configured');
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(401, 'Sign in to generate a plan.', 'unauthorized');
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

  const { data: allowanceRows, error: allowanceError } = await admin.rpc('check_ai_allowance', {
    target_user_id: user.id,
    request_kind: 'workout_generation',
  });

  if (allowanceError) {
    console.error('generate-workout: allowance check failed', allowanceError);
    return errorResponse(500, 'Could not start. Try again.', 'internal');
  }

  const allowance = Array.isArray(allowanceRows) ? allowanceRows[0] : allowanceRows;
  if (allowance && allowance.allowed === false) {
    return jsonResponse(
      {
        error: {
          code: 'rate_limited',
          message: `You have generated ${allowance.allowance} plans today. A plan is worth keeping for a few weeks before writing another.`,
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'The request was malformed.', 'bad_request');
  }

  const input = readInput(body);
  if (!input) {
    return errorResponse(400, 'No exercises were offered to build a plan from.', 'bad_request');
  }

  const names = new Map<string, string>();
  const rawNames = (body as { exerciseNames?: Record<string, unknown> })?.exerciseNames;
  if (rawNames && typeof rawNames === 'object') {
    for (const [id, name] of Object.entries(rawNames)) {
      if (typeof name === 'string') names.set(id, name.slice(0, 60));
    }
  }

  const allowed = new Set(input.allowedExerciseIds);

  try {
    const response = await vision.analyse({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userPrompt(input, names),
      schema: planSchema(input.allowedExerciseIds),
      maxTokens: MAX_TOKENS,
      timeoutMs: PROVIDER_TIMEOUT_MS,
      // Writing a programme somebody follows for weeks is worth more
      // thought than reading a photograph of a plate.
      effort: 'high',
    });

    if (response.refused) {
      await record(admin, user.id, 'refused', startedAt, vision.label);
      return errorResponse(
        422,
        'The planner declined to write that. Try describing your goal differently.',
        'provider_refused',
      );
    }

    if (response.truncated) {
      await record(admin, user.id, 'invalid_response', startedAt, vision.label);
      return errorResponse(
        502,
        'The plan came back unfinished. Try again, or ask for fewer days.',
        'response_truncated',
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(response.text));
    } catch {
      await record(admin, user.id, 'invalid_response', startedAt, vision.label);
      return errorResponse(
        502,
        'The plan came back unreadable. Try again.',
        'invalid_response',
        `len ${response.text.length}: ...${response.text.slice(-80)}`,
      );
    }

    const validation = validatePlan(parsed, allowed);
    if (!validation.ok) {
      console.warn('generate-workout: plan failed validation', validation.reason);
      await record(admin, user.id, 'invalid_response', startedAt, vision.label);
      return errorResponse(
        422,
        'The plan that came back was not usable, so it has been thrown away rather than shown to you.',
        'invalid_plan',
        validation.reason,
      );
    }

    await record(
      admin,
      user.id,
      'succeeded',
      startedAt,
      vision.label,
      response.inputTokens,
      response.outputTokens,
    );

    return jsonResponse({ plan: validation.value, providerLabel: vision.label }, 200);
  } catch (cause) {
    const status = (cause as { status?: number })?.status;
    console.error('generate-workout: provider call failed', String(cause));
    await record(admin, user.id, 'provider_error', startedAt, vision.label);
    return errorResponse(
      502,
      'The planner had a problem. Try again.',
      'provider_error',
      `${status ?? 'no status'}: ${(cause as Error)?.message ?? String(cause)}`,
    );
  }
});

async function record(
  admin: SupabaseClient,
  userId: string,
  outcome: 'succeeded' | 'provider_error' | 'invalid_response' | 'refused',
  startedAt: number,
  providerLabel?: string,
  inputTokens?: number | null,
  outputTokens?: number | null,
): Promise<void> {
  const { error } = await admin.from('scan_events').insert({
    user_id: userId,
    kind: 'workout_generation',
    outcome,
    provider_label: providerLabel ?? null,
    input_tokens: inputTokens ?? null,
    output_tokens: outputTokens ?? null,
    duration_ms: Date.now() - startedAt,
  });

  if (error) {
    console.error('generate-workout: could not record event', error.message);
  }
}
