import type { DailyTargets, Nutrients } from '@/types/domain';

/**
 * "How much of a day is this?"
 *
 * Shown beside every nutrient on a food's own screen. The point is to turn a
 * figure nobody has a feel for - 480 mg of sodium - into one anybody does:
 * a fifth of a day.
 *
 * The reference is the user's own target wherever they have set one, and a
 * published reference intake everywhere else. Which of the two was used is
 * returned rather than hidden, because "40% of your protein goal" and "40%
 * of a reference adult's" are different sentences and the screens say so.
 */

/**
 * Reference intakes for an average adult, used when the user has set no
 * target of their own.
 *
 * These are the EU Reference Intake values that appear on food packaging in
 * the UK and Europe, which is the same table the numbers on a label are
 * already calculated against - so a percentage here and a percentage on the
 * packet mean the same thing.
 */
export const REFERENCE_INTAKE = {
  caloriesKcal: 2000,
  proteinG: 50,
  carbsG: 260,
  fatG: 70,
  fiberG: 30,
  sugarG: 90,
  saturatedFatG: 20,
  sodiumMg: 2400,
} as const;

export type DailyValueKey = keyof typeof REFERENCE_INTAKE;

export interface DailyValue {
  /** 0..n of the reference. Null when the nutrient itself is unknown. */
  share: number | null;
  /** True when the reference came from the user's own target. */
  personal: boolean;
}

export function dailyValueFor(
  key: DailyValueKey,
  nutrients: Nutrients,
  targets?: DailyTargets,
): DailyValue {
  const amount = nutrients[key];
  if (amount === null || !Number.isFinite(amount)) {
    return { share: null, personal: false };
  }

  // Only the four headline nutrients can have a user target; the rest always
  // fall back to the reference.
  const personalTarget =
    targets && (key === 'caloriesKcal' || key === 'proteinG' || key === 'carbsG' || key === 'fatG')
      ? targets[key]
      : null;

  const reference =
    personalTarget !== null && personalTarget !== undefined && personalTarget > 0
      ? personalTarget
      : REFERENCE_INTAKE[key];

  return { share: amount / reference, personal: personalTarget !== null && personalTarget !== undefined && personalTarget > 0 };
}
