import type { FoodRecord, Portion, PortionOption, PortionUnit } from '@/types/domain';

/**
 * Portion-to-gram conversion.
 *
 * Only two units convert on their own: grams are grams, and ounces have a fixed
 * definition. Everything else ("1 cup", "1 slice") depends on the food, so it
 * can only be converted when the food record tells us the gram weight of that
 * measure. When it cannot be converted we return `null` rather than guessing.
 */

/** International avoirdupois ounce. */
export const GRAMS_PER_OUNCE = 28.349523125;

/**
 * Density assumption for millilitre portions when the food record has no
 * explicit ml measure: 1 ml is treated as 1 g, i.e. the density of water.
 *
 * This is close for water, tea, coffee, broth and most soft drinks, and wrong
 * for oils (~0.92) and syrups (~1.3). Conversions that rely on it are marked
 * `assumedDensity: true` so the UI can label them.
 */
export const ASSUMED_G_PER_ML = 1;

/** Units that never need food-specific information. */
const SELF_CONTAINED_UNITS: ReadonlySet<PortionUnit> = new Set(['g', 'oz']);

export interface GramConversion {
  grams: number;
  /** True when the water-density assumption was used for an ml portion. */
  assumedDensity: boolean;
  /** Which portion option supplied the weight, when one did. */
  usedOption: PortionOption | null;
}

/** Can this unit be converted without any food-specific data? */
export function isSelfContainedUnit(unit: PortionUnit): boolean {
  return SELF_CONTAINED_UNITS.has(unit);
}

/**
 * Convert a portion to grams.
 *
 * @param portion  The quantity and unit the user chose.
 * @param options  Household measures the matched food record knows about.
 * @returns The weight in grams, or `null` when it cannot be determined.
 */
export function portionToGrams(
  portion: Portion,
  options: readonly PortionOption[] = [],
): GramConversion | null {
  const { quantity, unit } = portion;

  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  if (unit === 'g') {
    return { grams: quantity, assumedDensity: false, usedOption: null };
  }

  if (unit === 'oz') {
    return { grams: quantity * GRAMS_PER_OUNCE, assumedDensity: false, usedOption: null };
  }

  // A record-supplied measure always wins over any assumption.
  const match = options.find((option) => option.unit === unit && option.gramsPerUnit > 0);
  if (match) {
    return {
      grams: quantity * match.gramsPerUnit,
      assumedDensity: false,
      usedOption: match,
    };
  }

  if (unit === 'ml') {
    return {
      grams: quantity * ASSUMED_G_PER_ML,
      assumedDensity: true,
      usedOption: null,
    };
  }

  // 'piece' / 'slice' / 'cup' / 'tbsp' / 'tsp' / 'serving' with no record data.
  return null;
}

/** Convenience wrapper when you already have the full food record. */
export function portionToGramsForRecord(
  portion: Portion,
  record: Pick<FoodRecord, 'portionOptions'>,
): GramConversion | null {
  return portionToGrams(portion, record.portionOptions);
}

/** Grams to ounces, for display in imperial units. */
export function gramsToOunces(grams: number): number {
  return grams / GRAMS_PER_OUNCE;
}

/** Human label for a unit, singular or plural based on the quantity. */
export function formatPortion(portion: Portion): string {
  const { quantity, unit } = portion;
  const qty = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(quantity < 10 ? 1 : 0);

  switch (unit) {
    case 'g':
      return `${qty} g`;
    case 'ml':
      return `${qty} ml`;
    case 'oz':
      return `${qty} oz`;
    default: {
      const plural = quantity === 1 ? unit : `${unit}s`;
      return `${qty} ${plural}`;
    }
  }
}
