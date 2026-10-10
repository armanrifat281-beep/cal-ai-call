import type { ShoppingListItem } from '@/types/recipe';

import type { NewShoppingListItem } from './repository';

/**
 * Two lines are the same shopping line when the food and the unit match.
 *
 * Case and surrounding space are ignored, so "Red Onions" and "red onions"
 * are one line. The unit is part of the key because 2 cloves and 2 grams of
 * garlic are not four of anything.
 */
export function shoppingMergeKey(
  name: string,
  unit: ShoppingListItem['unit'],
): string {
  return `${name.trim().toLowerCase()}|${unit ?? ''}`;
}

export interface MergePlan {
  /** Lines already on the list whose quantity changed. */
  updates: { id: string; quantity: number | null }[];
  /** Lines that were not on the list, with the position each should take. */
  inserts: { input: NewShoppingListItem; position: number }[];
}

/**
 * Works out what adding these items does to a list that already has some.
 *
 * Shared by the device-local store and the Supabase one. The rule is the
 * interesting part and it is easy to get subtly different in two places:
 * adding a second recipe that also needs onions has to produce one line, not
 * two, and that line has to come back unticked because it is needed again.
 *
 * Quantities only add up when both sides have one. An amount plus an
 * unspecified amount is still an unspecified amount - "2 onions" merged with
 * "onions, to taste" is not 2 of anything certain, so the known figure is
 * kept rather than invented upward.
 */
export function planShoppingMerge(
  existing: readonly ShoppingListItem[],
  incoming: readonly NewShoppingListItem[],
): MergePlan {
  const updates: MergePlan['updates'] = [];
  const inserts: MergePlan['inserts'] = [];

  // Quantities accumulate across the incoming batch too, so adding two
  // recipes that each need an onion in one call still makes one line.
  const quantities = new Map<string, number | null>();
  const ids = new Map<string, string>();

  for (const item of existing) {
    const key = shoppingMergeKey(item.name, item.unit);
    quantities.set(key, item.quantity);
    ids.set(key, item.id);
  }

  let nextPosition = existing.length;

  for (const candidate of incoming) {
    const name = candidate.name.trim();
    if (name.length === 0) continue;

    const key = shoppingMergeKey(name, candidate.unit ?? null);
    const existingId = ids.get(key);

    if (existingId === undefined) {
      inserts.push({ input: { ...candidate, name }, position: nextPosition });
      nextPosition += 1;
      // A later duplicate in the same batch merges into this new line, which
      // only the database can do once it has an id, so it is left to settle
      // on the next add rather than guessed at here.
      ids.set(key, '');
      quantities.set(key, candidate.quantity ?? null);
      continue;
    }

    if (existingId === '') continue;

    const current = quantities.get(key) ?? null;
    const addition = candidate.quantity ?? null;
    const combined =
      current === null || addition === null ? (current ?? addition) : current + addition;

    quantities.set(key, combined);

    const already = updates.find((update) => update.id === existingId);
    if (already) already.quantity = combined;
    else updates.push({ id: existingId, quantity: combined });
  }

  return { updates, inserts };
}
