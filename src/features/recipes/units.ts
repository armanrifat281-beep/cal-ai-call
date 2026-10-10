import type { RecipeUnit } from '@/types/recipe';

/**
 * Recipe units: labels, and turning a scaled quantity back into something a
 * person would actually write.
 *
 * Scaling a recipe produces numbers like 1.3333333 cups. Showing that is both
 * ugly and unusable, so quantities are snapped to the fractions cooks use and
 * rounded to a sensible precision for the unit. A gram is a gram; a cup comes
 * in thirds and quarters.
 */

interface UnitSpec {
  /** Singular label, e.g. "cup". */
  label: string;
  /** Plural label, when it differs from `label + 's'`. */
  plural?: string;
  /**
   * How to round a scaled quantity.
   *  - `fraction`: snap to cooking fractions (1/8, 1/4, 1/3, 1/2, 2/3, 3/4).
   *  - `metric`: round to a sensible step for the magnitude.
   *  - `count`: whole things, with halves allowed.
   *  - `none`: no quantity at all.
   */
  rounding: 'fraction' | 'metric' | 'count' | 'none';
  /** Rendered without a space, e.g. "200g" reads better than "200 g". */
  tight?: boolean;
  /**
   * An abbreviation, which is never pluralized: "2 tsps" and "200 gs" are
   * both wrong. Explicit rather than inferred from length, because "tsp" and
   * "cup" are both three characters and only one of them takes an 's'.
   */
  abbreviation?: boolean;
}

const UNITS: Record<RecipeUnit, UnitSpec> = {
  g: { label: 'g', rounding: 'metric', tight: true, abbreviation: true },
  kg: { label: 'kg', rounding: 'metric', tight: true, abbreviation: true },
  oz: { label: 'oz', rounding: 'fraction', abbreviation: true },
  lb: { label: 'lb', rounding: 'fraction', abbreviation: true },

  ml: { label: 'ml', rounding: 'metric', tight: true, abbreviation: true },
  l: { label: 'l', rounding: 'metric', tight: true, abbreviation: true },
  tsp: { label: 'tsp', rounding: 'fraction', abbreviation: true },
  tbsp: { label: 'tbsp', rounding: 'fraction', abbreviation: true },
  cup: { label: 'cup', rounding: 'fraction' },
  fl_oz: { label: 'fl oz', rounding: 'fraction', abbreviation: true },

  piece: { label: 'piece', rounding: 'count' },
  slice: { label: 'slice', rounding: 'count' },
  clove: { label: 'clove', rounding: 'count' },
  can: { label: 'can', rounding: 'count' },
  packet: { label: 'packet', rounding: 'count' },
  bunch: { label: 'bunch', rounding: 'fraction' },
  handful: { label: 'handful', rounding: 'fraction' },
  pinch: { label: 'pinch', plural: 'pinches', rounding: 'fraction' },
  to_taste: { label: 'to taste', rounding: 'none' },
};

export const RECIPE_UNITS = Object.keys(UNITS) as RecipeUnit[];

export function isRecipeUnit(value: unknown): value is RecipeUnit {
  return typeof value === 'string' && value in UNITS;
}

/** A unit with no quantity, so the UI hides the number input. */
export function isUnitWithoutQuantity(unit: RecipeUnit | null): boolean {
  return unit === 'to_taste';
}

/** The fractions cooks actually measure with, as [numerator, denominator]. */
const COOKING_FRACTIONS: [number, number][] = [
  [1, 8],
  [1, 4],
  [1, 3],
  [1, 2],
  [2, 3],
  [3, 4],
];

const FRACTION_GLYPHS: Record<string, string> = {
  '1/8': '1/8',
  '1/4': '1/4',
  '1/3': '1/3',
  '1/2': '1/2',
  '2/3': '2/3',
  '3/4': '3/4',
};

/**
 * Snaps a value to the nearest cooking fraction.
 *
 * Returns the whole part and the fraction separately, so 1.3333 becomes
 * `{ whole: 1, fraction: '1/3' }` and renders as "1 1/3".
 */
export function toCookingFraction(value: number): {
  whole: number;
  fraction: string | null;
} {
  const whole = Math.floor(value);
  const remainder = value - whole;

  // Close enough to a whole number that a fraction would be noise.
  if (remainder < 1 / 16) return { whole, fraction: null };
  // Close enough to the next whole number.
  if (remainder > 15 / 16) return { whole: whole + 1, fraction: null };

  let best: [number, number] = COOKING_FRACTIONS[0] ?? [1, 8];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [numerator, denominator] of COOKING_FRACTIONS) {
    const distance = Math.abs(remainder - numerator / denominator);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = [numerator, denominator];
    }
  }

  return { whole, fraction: `${best[0]}/${best[1]}` };
}

/**
 * Rounds a metric quantity to a step that suits its size.
 *
 * Nobody measures 237 g of flour. Below 10 the precision matters (7.5 g of
 * yeast is meaningfully different from 8 g), above 100 it does not.
 */
export function roundMetric(value: number): number {
  if (value < 1) return Math.round(value * 100) / 100;
  if (value < 10) return Math.round(value * 2) / 2;
  if (value < 100) return Math.round(value);
  if (value < 1000) return Math.round(value / 5) * 5;
  return Math.round(value / 25) * 25;
}

/** Rounds a count to a whole thing, allowing halves. */
export function roundCount(value: number): number {
  if (value < 1) return Math.round(value * 2) / 2 || 0.5;
  return Math.round(value * 2) / 2;
}

/**
 * Rounds a scaled quantity for its unit.
 *
 * Applied once, at display time. Intermediate maths keeps full precision, so
 * repeated scaling does not accumulate rounding error.
 */
export function roundQuantityForUnit(
  quantity: number,
  unit: RecipeUnit | null,
): number {
  if (!Number.isFinite(quantity) || quantity < 0) return 0;
  const spec = unit ? UNITS[unit] : null;

  switch (spec?.rounding) {
    case 'metric':
      return roundMetric(quantity);
    case 'count':
      return roundCount(quantity);
    case 'none':
      return 0;
    case 'fraction':
    default: {
      const { whole, fraction } = toCookingFraction(quantity);
      if (!fraction) return whole;
      const [numerator, denominator] = fraction.split('/').map(Number);
      return whole + (numerator ?? 0) / (denominator ?? 1);
    }
  }
}

/** The unit's label, pluralized for the quantity. */
export function formatUnit(unit: RecipeUnit | null, quantity: number | null): string {
  if (!unit) return '';
  const spec = UNITS[unit];
  if (spec.rounding === 'none') return spec.label;

  // Plural only ABOVE one. A recipe writes "3/4 cup", not "3/4 cups".
  const isPlural = quantity !== null && quantity > 1;
  if (!isPlural) return spec.label;
  if (spec.abbreviation) return spec.label;
  return spec.plural ?? `${spec.label}s`;
}

/**
 * Formats a quantity and unit the way a recipe would write it.
 *
 * Examples: "200g", "1 1/3 cups", "2 cloves", "to taste", "1/2 tsp".
 */
export function formatIngredientAmount(
  quantity: number | null,
  unit: RecipeUnit | null,
): string {
  if (unit && isUnitWithoutQuantity(unit)) return UNITS[unit].label;

  if (quantity === null || !Number.isFinite(quantity)) {
    // No quantity, but a unit: the unit alone is still informative.
    return unit ? formatUnit(unit, null) : '';
  }

  const spec = unit ? UNITS[unit] : null;
  const rounded = roundQuantityForUnit(quantity, unit);

  let quantityText: string;
  if (spec?.rounding === 'fraction' || spec === null) {
    const { whole, fraction } = toCookingFraction(rounded);
    if (fraction && whole > 0) {
      quantityText = `${whole} ${FRACTION_GLYPHS[fraction] ?? fraction}`;
    } else if (fraction) {
      quantityText = FRACTION_GLYPHS[fraction] ?? fraction;
    } else {
      quantityText = String(whole);
    }
  } else {
    quantityText = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }

  if (!unit) return quantityText;
  const label = formatUnit(unit, rounded);
  return spec?.tight ? `${quantityText}${label}` : `${quantityText} ${label}`;
}
