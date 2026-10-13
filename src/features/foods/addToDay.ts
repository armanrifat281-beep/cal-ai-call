import type { JournalRepository } from '@/features/journal';
import { todayKey } from '@/lib/date';
import { err, ok, type Result } from '@/lib/result';
import type { FoodEntry, FoodRecord, MealType } from '@/types/domain';

import { recordToEntryItem } from './toEntryItem';

/**
 * Adding a looked-up food to today.
 *
 * It joins the meal it belongs to rather than becoming one. Someone adding
 * a banana to breakfast means "this was part of breakfast", and three
 * separate one-item entries called Breakfast would make the day's timeline
 * unreadable and the per-meal totals meaningless.
 *
 * So: find today's entry for that meal and append, or start it if there is
 * none. The title is left alone when appending - a meal the user has named
 * must not be renamed by adding a banana to it.
 */
export interface AddFoodResult {
  entry: FoodEntry;
  /** True when this started the meal rather than joining one. */
  createdMeal: boolean;
}

/** Names a new meal after its first food, as the editor does. */
function titleFor(record: FoodRecord): string {
  const name = record.name.trim();
  return name.length > 0 ? name : 'Untitled meal';
}

export async function addFoodToDay(
  repository: JournalRepository,
  record: FoodRecord,
  grams: number,
  mealType: MealType,
): Promise<Result<AddFoodResult>> {
  const item = recordToEntryItem(record, grams);

  const today = await repository.listEntriesForDay(todayKey());
  if (!today.ok) return today;

  const existing = today.value.find((entry) => entry.mealType === mealType);

  if (existing === undefined) {
    const created = await repository.createEntry({
      mealType,
      title: titleFor(record),
      items: [item],
    });
    return created.ok ? ok({ entry: created.value, createdMeal: true }) : err(created.error);
  }

  const updated = await repository.updateEntry(existing.id, {
    items: [...existing.items, item],
  });
  return updated.ok ? ok({ entry: updated.value, createdMeal: false }) : err(updated.error);
}
