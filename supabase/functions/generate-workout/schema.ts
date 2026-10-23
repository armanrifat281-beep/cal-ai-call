/**
 * The shape a generated training plan must fit, and the check that it does.
 *
 * A model writing a programme for somebody's body is the highest-stakes
 * thing in this app, so the validation is deliberately strict and
 * deliberately boring: anything outside these bounds is rejected rather
 * than clamped, because a clamped plan is one nobody wrote.
 *
 * Pure: no Deno, no npm. Tested with the project's ordinary Jest setup.
 */

/** Only movements the app can actually show instructions for. */
export interface GenerateInput {
  /** Exercise ids the client says exist in its library. */
  allowedExerciseIds: string[];
  goal: string;
  experience: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  daysPerWeek: number;
  minutesPerSession: number;
  notes: string | null;
}

export interface PlannedEntry {
  exerciseId: string;
  sets: number;
  reps: number | null;
  seconds: number | null;
  restSeconds: number;
  note: string | null;
}

export interface PlanDay {
  title: string;
  entries: PlannedEntry[];
}

export interface GeneratedPlan {
  title: string;
  summary: string;
  days: PlanDay[];
  /** How to make it harder over time. One or two plain sentences. */
  progression: string;
}

/** Bounds a plan has to sit inside to be worth showing anybody. */
const LIMITS = {
  sets: { min: 1, max: 8 },
  reps: { min: 1, max: 50 },
  seconds: { min: 5, max: 600 },
  rest: { min: 15, max: 300 },
  entriesPerDay: { min: 1, max: 10 },
  days: { min: 1, max: 7 },
} as const;

export function planSchema(allowedExerciseIds: string[]): Record<string, unknown> {
  return {
    type: 'object',
    required: ['title', 'summary', 'days', 'progression'],
    properties: {
      title: { type: 'string', description: 'Short, plain. No marketing words.' },
      summary: { type: 'string', description: 'One sentence on who it suits.' },
      progression: {
        type: 'string',
        description: 'One or two sentences on how to make it harder over weeks.',
      },
      days: {
        type: 'array',
        minItems: LIMITS.days.min,
        maxItems: LIMITS.days.max,
        items: {
          type: 'object',
          required: ['title', 'entries'],
          properties: {
            title: {
              type: 'string',
              description: 'e.g. "Full body A", or "Rest" for a rest day.',
            },
            entries: {
              type: 'array',
              maxItems: LIMITS.entriesPerDay.max,
              items: {
                type: 'object',
                required: ['exerciseId', 'sets', 'restSeconds'],
                properties: {
                  exerciseId: {
                    type: 'string',
                    enum: allowedExerciseIds,
                    description: 'MUST be one of these ids exactly.',
                  },
                  sets: { type: 'integer', minimum: LIMITS.sets.min, maximum: LIMITS.sets.max },
                  reps: { type: ['integer', 'null'], minimum: LIMITS.reps.min, maximum: LIMITS.reps.max },
                  seconds: {
                    type: ['integer', 'null'],
                    minimum: LIMITS.seconds.min,
                    maximum: LIMITS.seconds.max,
                    description: 'For holds such as a plank. Null for repetitions.',
                  },
                  restSeconds: {
                    type: 'integer',
                    minimum: LIMITS.rest.min,
                    maximum: LIMITS.rest.max,
                  },
                  note: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
      },
    },
  };
}

export type Validation =
  | { ok: true; value: GeneratedPlan }
  | { ok: false; reason: string };

function text(value: unknown, max = 400): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, max)
    : null;
}

function integer(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : null;
}

/**
 * Checks a model's plan.
 *
 * The rules that matter most:
 *
 *  - **An unknown exercise id fails the whole plan.** The app can only
 *    show instructions for movements in its library, and a row reading
 *    "cable_crossover_variant_2" with no instructions is how somebody
 *    does a lift they have never seen, badly.
 *  - **A day with neither reps nor seconds fails.** "3 sets of ?" is not
 *    something anybody can follow.
 *  - Nothing is clamped into range. A plan asking for twenty sets is not
 *    quietly turned into eight; it is rejected, because the model that
 *    wrote it was not writing for a person.
 */
export function validatePlan(value: unknown, allowed: Set<string>): Validation {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, reason: 'the answer was not an object' };
  }
  const raw = value as Record<string, unknown>;

  const title = text(raw.title, 80);
  const summary = text(raw.summary, 200);
  const progression = text(raw.progression, 400);
  if (title === null) return { ok: false, reason: 'no plan title' };
  if (summary === null) return { ok: false, reason: 'no plan summary' };
  if (progression === null) return { ok: false, reason: 'no progression guidance' };

  const rawDays = Array.isArray(raw.days) ? raw.days : [];
  if (rawDays.length < LIMITS.days.min || rawDays.length > LIMITS.days.max) {
    return { ok: false, reason: `a plan of ${rawDays.length} days is not usable` };
  }

  const days: PlanDay[] = [];
  for (const rawDay of rawDays as Record<string, unknown>[]) {
    const dayTitle = text(rawDay.title, 60);
    if (dayTitle === null) return { ok: false, reason: 'a day had no title' };

    const rawEntries = Array.isArray(rawDay.entries) ? rawDay.entries : [];
    const entries: PlannedEntry[] = [];

    for (const rawEntry of rawEntries as Record<string, unknown>[]) {
      const exerciseId = text(rawEntry.exerciseId, 60);
      if (exerciseId === null || !allowed.has(exerciseId)) {
        return {
          ok: false,
          reason: `unknown exercise "${exerciseId ?? 'missing'}"`,
        };
      }

      const sets = integer(rawEntry.sets, LIMITS.sets.min, LIMITS.sets.max);
      if (sets === null) return { ok: false, reason: `set count out of range for ${exerciseId}` };

      const reps = integer(rawEntry.reps, LIMITS.reps.min, LIMITS.reps.max);
      const seconds = integer(rawEntry.seconds, LIMITS.seconds.min, LIMITS.seconds.max);
      if (reps === null && seconds === null) {
        return { ok: false, reason: `${exerciseId} has neither repetitions nor a duration` };
      }

      const restSeconds = integer(rawEntry.restSeconds, LIMITS.rest.min, LIMITS.rest.max) ?? 60;

      entries.push({
        exerciseId,
        sets,
        reps,
        seconds,
        restSeconds,
        note: text(rawEntry.note, 160),
      });
    }

    if (entries.length > LIMITS.entriesPerDay.max) {
      return { ok: false, reason: `${dayTitle} has too many exercises` };
    }
    days.push({ title: dayTitle, entries });
  }

  // A week of rest days is not a plan.
  if (!days.some((day) => day.entries.length > 0)) {
    return { ok: false, reason: 'the plan has no training days in it' };
  }

  return { ok: true, value: { title, summary, days, progression } };
}
