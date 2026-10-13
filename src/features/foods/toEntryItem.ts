import { scaleNutrientsByGrams } from '@/features/nutrition';
import type { FoodEntryItem, FoodRecord } from '@/types/domain';

/**
 * A database record as a journal item.
 *
 * The weight is the user's: a record is per 100 g, and what they ate is
 * whatever they say. 100 g is the opening figure because it is the one the
 * record is quoted in, so the numbers on the search row are the numbers on
 * the item until the portion is changed - nothing moves under the user
 * between seeing a food and adding it.
 *
 * Provenance is `database` with `high` confidence, and that is the whole
 * point of this screen. A looked-up value is a measurement someone made in
 * a laboratory; the camera's figure for the same food is a guess at one.
 * Only the weight is uncertain here, and the user sets that themselves.
 */
export const DEFAULT_GRAMS = 100;

export function recordToEntryItem(
  record: FoodRecord,
  grams: number = DEFAULT_GRAMS,
): FoodEntryItem {
  return {
    // Unique within a draft. The record id is not usable as the item id: the
    // same food added twice is two items, not one.
    id: `food-${record.providerRef}-${Date.now()}`,
    name: record.name,
    brand: record.brand,
    portion: { quantity: grams, unit: 'g' },
    gramsResolved: grams,
    nutrients: scaleNutrientsByGrams(record.nutrientsPer100g, grams),
    provenance: {
      source: 'database',
      confidence: 'high',
      providerLabel: record.providerLabel,
      providerRef: record.providerRef,
    },
    foodRecordId: record.id,
    notes: null,
  };
}
