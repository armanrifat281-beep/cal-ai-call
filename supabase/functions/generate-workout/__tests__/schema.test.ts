import { validatePlan } from '../schema';

/**
 * The check between a model and somebody's training week.
 *
 * Everything here is about refusing rather than repairing: a plan that is
 * wrong in any of these ways was not written for a person, and quietly
 * fixing it would hide that.
 */

const ALLOWED = new Set(['db_row', 'press_up', 'plank', 'bb_squat']);

function plan(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Three days, dumbbells',
    summary: 'Full body, for somebody new to lifting.',
    progression: 'Add one repetition per set each week until you reach twelve.',
    days: [
      {
        title: 'Full body A',
        entries: [
          { exerciseId: 'db_row', sets: 3, reps: 10, seconds: null, restSeconds: 90, note: null },
          { exerciseId: 'plank', sets: 3, reps: null, seconds: 40, restSeconds: 45, note: null },
        ],
      },
      { title: 'Rest', entries: [] },
    ],
    ...overrides,
  };
}

describe('validatePlan', () => {
  it('accepts a sane plan', () => {
    const result = validatePlan(plan(), ALLOWED);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.days).toHaveLength(2);
    expect(result.value.days[0]?.entries[0]?.exerciseId).toBe('db_row');
  });

  /*
    The rule that matters most. The app can only show instructions for
    movements in its library; a row naming something it cannot explain is
    somebody performing a lift from its name alone.
  */
  it('rejects the whole plan over one unknown exercise', () => {
    const result = validatePlan(
      plan({
        days: [
          {
            title: 'Day',
            entries: [
              { exerciseId: 'db_row', sets: 3, reps: 10, restSeconds: 90 },
              { exerciseId: 'cable_crossover_variant_2', sets: 3, reps: 12, restSeconds: 60 },
            ],
          },
        ],
      }),
      ALLOWED,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('unknown exercise');
  });

  it('rejects an entry with neither repetitions nor a duration', () => {
    const result = validatePlan(
      plan({
        days: [
          { title: 'Day', entries: [{ exerciseId: 'db_row', sets: 3, restSeconds: 60 }] },
        ],
      }),
      ALLOWED,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('neither repetitions nor a duration');
  });

  /*
    Not clamped to eight. A plan asking for twenty sets of squats was not
    written for a person, and silently making it sane would hide that from
    the one reader who needs to know.
  */
  it('rejects volume outside sane bounds rather than trimming it', () => {
    const result = validatePlan(
      plan({
        days: [
          { title: 'Day', entries: [{ exerciseId: 'bb_squat', sets: 20, reps: 10, restSeconds: 60 }] },
        ],
      }),
      ALLOWED,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('set count out of range');
  });

  it('rejects a plan that is nothing but rest days', () => {
    const result = validatePlan(
      plan({ days: [{ title: 'Rest', entries: [] }, { title: 'Rest', entries: [] }] }),
      ALLOWED,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('no training days');
  });

  it('keeps rest days when there is training around them', () => {
    const result = validatePlan(plan(), ALLOWED);
    expect(result.ok && result.value.days[1]?.entries).toEqual([]);
  });

  it('requires progression guidance, which is the point of a plan', () => {
    const result = validatePlan(plan({ progression: '' }), ALLOWED);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('progression');
  });

  it('rejects more than a week of days', () => {
    const day = { title: 'Day', entries: [{ exerciseId: 'db_row', sets: 3, reps: 10, restSeconds: 60 }] };
    const result = validatePlan(plan({ days: Array.from({ length: 9 }, () => day) }), ALLOWED);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('not usable');
  });

  it('falls back to a minute of rest rather than failing over it', () => {
    const result = validatePlan(
      plan({
        days: [{ title: 'Day', entries: [{ exerciseId: 'db_row', sets: 3, reps: 10 }] }],
      }),
      ALLOWED,
    );

    expect(result.ok && result.value.days[0]?.entries[0]?.restSeconds).toBe(60);
  });

  it('survives a shape that is nothing like the contract', () => {
    expect(validatePlan('nope', ALLOWED).ok).toBe(false);
    expect(validatePlan(null, ALLOWED).ok).toBe(false);
    expect(validatePlan({ title: 'x' }, ALLOWED).ok).toBe(false);
  });
});
