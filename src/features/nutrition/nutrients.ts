import { EMPTY_NUTRIENTS, type Nutrients } from '@/types/domain';

/**
 * Nutrient arithmetic.
 *
 * Two rules run through this file:
 *
 *  1. `null` means "unknown" and never silently becomes `0`. Adding an unknown
 *     to a known value gives an incomplete total, and we say so.
 *  2. Rounding happens once, at display time, never between calculations.
 */

/** Macros we always have a number for. */
export const REQUIRED_KEYS = [
  'caloriesKcal',
  'proteinG',
  'carbsG',
  'fatG',
] as const satisfies readonly (keyof Nutrients)[];

/** Nutrients a provider may not supply. */
export const OPTIONAL_KEYS = [
  'fiberG',
  'sugarG',
  'saturatedFatG',
  'sodiumMg',
] as const satisfies readonly (keyof Nutrients)[];

export type RequiredNutrientKey = (typeof REQUIRED_KEYS)[number];
export type OptionalNutrientKey = (typeof OPTIONAL_KEYS)[number];

/** Energy per gram, used only to sanity-check a model's numbers. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * Scale a per-100 g nutrient set to an actual weight.
 *
 * @param per100g  Nutrients for 100 g of the food.
 * @param grams    The weight actually eaten.
 */
export function scaleNutrientsByGrams(per100g: Nutrients, grams: number): Nutrients {
  if (!Number.isFinite(grams) || grams < 0) {
    throw new RangeError(`grams must be a non-negative finite number, got ${grams}`);
  }
  return scaleNutrients(per100g, grams / 100);
}

/** Multiply every known nutrient by `factor`, leaving unknowns unknown. */
export function scaleNutrients(nutrients: Nutrients, factor: number): Nutrients {
  if (!Number.isFinite(factor) || factor < 0) {
    throw new RangeError(`factor must be a non-negative finite number, got ${factor}`);
  }
  return {
    caloriesKcal: nutrients.caloriesKcal * factor,
    proteinG: nutrients.proteinG * factor,
    carbsG: nutrients.carbsG * factor,
    fatG: nutrients.fatG * factor,
    fiberG: nutrients.fiberG === null ? null : nutrients.fiberG * factor,
    sugarG: nutrients.sugarG === null ? null : nutrients.sugarG * factor,
    saturatedFatG:
      nutrients.saturatedFatG === null ? null : nutrients.saturatedFatG * factor,
    sodiumMg: nutrients.sodiumMg === null ? null : nutrients.sodiumMg * factor,
  };
}

export interface NutrientSum {
  nutrients: Nutrients;
  /**
   * Optional nutrients where at least one contributing item was unknown. The
   * summed value covers only the known items, so the UI must show it as a
   * lower bound (e.g. "12 g or more").
   */
  incompleteKeys: OptionalNutrientKey[];
}

/**
 * Add up nutrients across items.
 *
 * Unknown optional values are skipped rather than treated as zero, and the keys
 * they affected are reported so the total can be labeled as incomplete.
 */
export function sumNutrients(items: readonly Nutrients[]): NutrientSum {
  if (items.length === 0) {
    return { nutrients: { ...EMPTY_NUTRIENTS }, incompleteKeys: [] };
  }

  const total: Nutrients = { ...EMPTY_NUTRIENTS };
  const incomplete = new Set<OptionalNutrientKey>();

  for (const key of OPTIONAL_KEYS) {
    total[key] = null;
  }

  for (const item of items) {
    for (const key of REQUIRED_KEYS) {
      total[key] += item[key];
    }
    for (const key of OPTIONAL_KEYS) {
      const value = item[key];
      if (value === null) {
        incomplete.add(key);
      } else {
        total[key] = (total[key] ?? 0) + value;
      }
    }
  }

  return { nutrients: total, incompleteKeys: [...incomplete] };
}

/** Round for display. Calories and sodium to whole units, macros to 0.1 g. */
export function roundNutrientsForDisplay(nutrients: Nutrients): Nutrients {
  const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
  return {
    caloriesKcal: Math.round(nutrients.caloriesKcal),
    proteinG: round1(nutrients.proteinG) ?? 0,
    carbsG: round1(nutrients.carbsG) ?? 0,
    fatG: round1(nutrients.fatG) ?? 0,
    fiberG: round1(nutrients.fiberG),
    sugarG: round1(nutrients.sugarG),
    saturatedFatG: round1(nutrients.saturatedFatG),
    sodiumMg: nutrients.sodiumMg === null ? null : Math.round(nutrients.sodiumMg),
  };
}

/** Calories implied by the macro grams, using 4/4/9 kcal per gram. */
export function caloriesFromMacros(nutrients: Nutrients): number {
  return (
    nutrients.proteinG * KCAL_PER_GRAM.protein +
    nutrients.carbsG * KCAL_PER_GRAM.carbs +
    nutrients.fatG * KCAL_PER_GRAM.fat
  );
}

export interface MacroConsistency {
  /** Calories implied by the macros. */
  impliedKcal: number;
  statedKcal: number;
  /** Absolute difference as a share of the larger value, 0..1. */
  relativeDifference: number;
  /**
   * True when the stated calories and the macros disagree by more than the
   * tolerance. Fibre, alcohol and rounding make small gaps normal, so this
   * only flags differences large enough to indicate a bad estimate.
   */
  isInconsistent: boolean;
}

/**
 * Check whether stated calories match the macro breakdown.
 *
 * We run this on every AI estimate. A wildly inconsistent result means the
 * model's numbers should not be trusted, and the UI asks the user to confirm.
 *
 * @param tolerance Allowed relative difference, default 25%.
 */
export function checkMacroConsistency(
  nutrients: Nutrients,
  tolerance = 0.25,
): MacroConsistency {
  const impliedKcal = caloriesFromMacros(nutrients);
  const statedKcal = nutrients.caloriesKcal;
  const largest = Math.max(impliedKcal, statedKcal);

  // Both near zero: nothing meaningful to compare.
  if (largest < 1) {
    return { impliedKcal, statedKcal, relativeDifference: 0, isInconsistent: false };
  }

  const relativeDifference = Math.abs(impliedKcal - statedKcal) / largest;
  return {
    impliedKcal,
    statedKcal,
    relativeDifference,
    isInconsistent: relativeDifference > tolerance,
  };
}

/** Share of calories from each macro, for the macro breakdown bar. */
export interface MacroSplit {
  proteinShare: number;
  carbsShare: number;
  fatShare: number;
  /** False when there are no macro calories to split. */
  hasData: boolean;
}

export function macroSplit(nutrients: Nutrients): MacroSplit {
  const proteinKcal = nutrients.proteinG * KCAL_PER_GRAM.protein;
  const carbsKcal = nutrients.carbsG * KCAL_PER_GRAM.carbs;
  const fatKcal = nutrients.fatG * KCAL_PER_GRAM.fat;
  const total = proteinKcal + carbsKcal + fatKcal;

  if (total <= 0) {
    return { proteinShare: 0, carbsShare: 0, fatShare: 0, hasData: false };
  }

  return {
    proteinShare: proteinKcal / total,
    carbsShare: carbsKcal / total,
    fatShare: fatKcal / total,
    hasData: true,
  };
}
