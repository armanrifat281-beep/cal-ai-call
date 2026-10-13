import type { FoodEntry, FoodEntryItem, NutrientSource } from '@/types/domain';

/**
 * How much of a day's figures are measured, and how much are guessed.
 *
 * This is the one number no other nutrition app shows, and it is the whole
 * argument for this one. Every app can tell you that you ate 1,840 calories.
 * Only this one can tell you that 1,200 of them came from laboratory
 * measurements and 640 from a model looking at a photograph - and therefore
 * which part of the day is worth correcting.
 *
 * Weighted by calories, not by item count. A day of five looked-up foods and
 * one estimated sauce is not "83% measured" when the sauce is a third of the
 * energy; counting items would flatter the figure exactly where it matters
 * most.
 *
 * Items with no calories at all are left out of the share entirely rather
 * than counted as measured zeroes, and reported separately: a food the
 * analyser named but could not quantify is a known unknown, and rolling it
 * into either side would hide it.
 */
export interface DayConfidence {
  /** Calories whose values came from a food database. */
  measuredKcal: number;
  /** Calories a model estimated. */
  estimatedKcal: number;
  /** Calories the user typed or corrected themselves. */
  ownKcal: number;
  /** Calories from clearly labelled sample data. */
  demoKcal: number;
  /**
   * Measured share of the energy that has a figure at all, 0..1.
   *
   * Null when nothing is logged: a share of nothing is not 0%, it is not a
   * share.
   */
  measuredShare: number | null;
  /** Foods that were named but carry no calorie figure. */
  unquantifiedCount: number;
  /** Total items considered. */
  itemCount: number;
}

const EMPTY: DayConfidence = {
  measuredKcal: 0,
  estimatedKcal: 0,
  ownKcal: 0,
  demoKcal: 0,
  measuredShare: null,
  unquantifiedCount: 0,
  itemCount: 0,
};

/** Where a figure a user has corrected should count. */
function bucketFor(source: NutrientSource): keyof DayConfidence | null {
  switch (source) {
    case 'database':
      return 'measuredKcal';
    case 'ai_estimate':
      return 'estimatedKcal';
    case 'user_entered':
      return 'ownKcal';
    case 'demo_sample':
      return 'demoKcal';
    default:
      return null;
  }
}

export function summarizeConfidence(
  entries: readonly FoodEntry[],
): DayConfidence {
  const items: FoodEntryItem[] = entries.flatMap((entry) => entry.items);
  if (items.length === 0) return { ...EMPTY };

  const totals = { ...EMPTY, itemCount: items.length };

  for (const item of items) {
    const kcal = item.nutrients.caloriesKcal;

    // A food with no energy figure is a known unknown. Counting it as a
    // measured zero would make the day look better the less it knew.
    if (!Number.isFinite(kcal) || kcal <= 0) {
      totals.unquantifiedCount += 1;
      continue;
    }

    const bucket = bucketFor(item.provenance.source);
    if (bucket === null) continue;
    (totals[bucket] as number) += kcal;
  }

  const known =
    totals.measuredKcal + totals.estimatedKcal + totals.ownKcal + totals.demoKcal;

  return {
    ...totals,
    // A user's own number is their claim, not a measurement, so it does not
    // count as measured - but it is not a guess by this app either, which is
    // why it has its own bucket rather than being folded into estimates.
    measuredShare: known > 0 ? totals.measuredKcal / known : null,
  };
}

/**
 * One sentence about how much of the day is actually known.
 *
 * Written so it is true at a glance and never congratulatory: the point is
 * to say what to go and check, not to score the user.
 */
export function describeConfidence(confidence: DayConfidence): string | null {
  if (confidence.itemCount === 0) return null;

  const parts: string[] = [];
  const share = confidence.measuredShare;

  if (share !== null) {
    parts.push(`${Math.round(share * 100)}% of today's calories are measured`);
  }

  if (confidence.estimatedKcal > 0) {
    parts.push(`${Math.round(confidence.estimatedKcal)} kcal are estimated`);
  }

  if (confidence.unquantifiedCount > 0) {
    const n = confidence.unquantifiedCount;
    parts.push(`${n} food${n === 1 ? '' : 's'} could not be quantified at all`);
  }

  return parts.length === 0 ? null : `${parts.join(' · ')}.`;
}
