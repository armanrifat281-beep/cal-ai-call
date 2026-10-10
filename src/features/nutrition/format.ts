import type { MeasurementSystem, Nutrients, NutrientSource } from '@/types/domain';

import { gramsToOunces } from './units';
import type { OptionalNutrientKey } from './nutrients';

/**
 * Display formatting for nutrition values.
 *
 * All uncertainty wording lives here so the app never accidentally presents an
 * estimate as a measurement.
 */

/** Energy, e.g. "412 kcal". Unknown renders as an em dash. */
export function formatCalories(kcal: number | null): string {
  if (kcal === null || !Number.isFinite(kcal)) return '--';
  return `${Math.round(kcal)} kcal`;
}

/** Grams with one decimal under 10 and none above, e.g. "7.5 g", "32 g". */
export function formatGrams(grams: number | null): string {
  if (grams === null || !Number.isFinite(grams)) return '--';
  if (grams === 0) return '0 g';
  return grams < 10 ? `${grams.toFixed(1)} g` : `${Math.round(grams)} g`;
}

export function formatMilligrams(mg: number | null): string {
  if (mg === null || !Number.isFinite(mg)) return '--';
  return `${Math.round(mg)} mg`;
}

/** A weight in the user's preferred system. */
export function formatWeight(grams: number | null, system: MeasurementSystem): string {
  if (grams === null || !Number.isFinite(grams)) return '--';
  if (system === 'imperial') {
    const oz = gramsToOunces(grams);
    return oz < 10 ? `${oz.toFixed(1)} oz` : `${Math.round(oz)} oz`;
  }
  return formatGrams(grams);
}

/**
 * A total that may be incomplete, e.g. "12 g or more".
 *
 * Used when some items in a day had no value for this nutrient, so the sum is
 * a lower bound rather than the real total.
 */
export function formatPossiblyIncomplete(
  value: number | null,
  incomplete: boolean,
  formatter: (v: number | null) => string = formatGrams,
): string {
  const base = formatter(value);
  if (value === null) return '--';
  return incomplete ? `${base} or more` : base;
}

/** Short label for where a value came from. */
export const SOURCE_LABELS: Record<NutrientSource, string> = {
  database: 'From food database',
  ai_estimate: 'AI estimate',
  user_entered: 'You entered this',
  demo_sample: 'Demo sample data',
};

/** One sentence explaining what the source means, for a tooltip or sheet. */
export const SOURCE_EXPLANATIONS: Record<NutrientSource, string> = {
  database:
    'These numbers were looked up in a published food composition database and scaled to your portion.',
  ai_estimate:
    'These numbers are an estimate produced by an AI model from your photo. They are not a measurement and can be well off, especially for cooking oil, sauces and hidden ingredients.',
  user_entered: 'You typed or corrected these values, so they are kept exactly as entered.',
  demo_sample:
    'This is sample data bundled with the app so you can try the interface. It is not from your photo and not from a real analysis.',
};

export const NUTRIENT_LABELS: Record<keyof Nutrients, string> = {
  caloriesKcal: 'Calories',
  proteinG: 'Protein',
  carbsG: 'Carbs',
  fatG: 'Fat',
  fiberG: 'Fiber',
  sugarG: 'Sugar',
  saturatedFatG: 'Saturated fat',
  sodiumMg: 'Sodium',
};

/** Sentence naming which totals are incomplete, or null when all are complete. */
export function describeIncompleteTotals(keys: readonly OptionalNutrientKey[]): string | null {
  if (keys.length === 0) return null;
  const names = keys.map((key) => NUTRIENT_LABELS[key].toLowerCase());
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Some foods today had no ${list} data, so those totals are a minimum rather than a full count.`;
}

/** Percentage for display, e.g. "63%". */
export function formatPercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '--';
  return `${Math.round(ratio * 100)}%`;
}
