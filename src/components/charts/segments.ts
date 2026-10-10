import type { DaySummary } from '@/features/nutrition';
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '@/types/domain';

import type { DayPlateSegment } from './DayPlate';

/**
 * A day's totals as plate segments, in the order meals are eaten.
 *
 * Grouped by meal type rather than by entry, so the dial reads as a day -
 * four arcs at most, each one a name a person recognises - however many
 * separate things were logged under each heading. Meal types with nothing
 * logged are dropped rather than drawn as empty slivers.
 */
export function dayPlateSegments(summary: DaySummary): DayPlateSegment[] {
  return MEAL_TYPES.map((mealType) => ({
    id: mealType,
    label: MEAL_TYPE_LABELS[mealType],
    nutrients: summary.byMealType[mealType].nutrients,
  })).filter((segment) => segment.nutrients.caloriesKcal > 0);
}
