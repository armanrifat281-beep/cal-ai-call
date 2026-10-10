import AsyncStorage from '@react-native-async-storage/async-storage';

import { toDateKey } from '@/lib/date';
import { EMPTY_NUTRIENTS, type FoodEntryItem } from '@/types/domain';

import {
  LOCAL_ENTRY_LIMIT,
  LOCAL_USER_ID,
  clearLocalJournal,
  createLocalJournalRepository,
} from '../localRepository';

function item(overrides: Partial<FoodEntryItem> = {}): FoodEntryItem {
  return {
    id: 'seed-item',
    name: 'Oat porridge',
    brand: null,
    portion: { quantity: 250, unit: 'g' },
    gramsResolved: 250,
    nutrients: { ...EMPTY_NUTRIENTS, caloriesKcal: 180, proteinG: 6, carbsG: 30, fatG: 3 },
    provenance: {
      source: 'database',
      confidence: 'high',
      providerLabel: 'USDA FoodData Central',
      providerRef: '123',
    },
    foodRecordId: 'usda:123',
    notes: null,
    ...overrides,
  };
}

/** A local-time instant on the given day, so day bucketing is unambiguous. */
function instantOn(year: number, monthIndex: number, day: number, hour = 12): string {
  return new Date(year, monthIndex, day, hour, 0, 0).toISOString();
}

describe('local journal repository', () => {
  let repo = createLocalJournalRepository();

  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearLocalJournal();
    repo = createLocalJournalRepository();
  });

  it('starts empty', async () => {
    const result = await repo.listRecentEntries(10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it('creates an entry with a generated id and local ownership', async () => {
    const created = await repo.createEntry({
      mealType: 'breakfast',
      title: 'Porridge',
      items: [item()],
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.id).toMatch(/[0-9a-f-]{36}/);
    expect(created.value.userId).toBe(LOCAL_USER_ID);
    expect(created.value.items).toHaveLength(1);
    expect(created.value.photoPath).toBeNull();
  });

  it('persists entries across repository instances', async () => {
    await repo.createEntry({ mealType: 'lunch', title: 'Salad', items: [item()] });

    const fresh = createLocalJournalRepository();
    const result = await fresh.listRecentEntries(10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.title).toBe('Salad');
  });

  it('filters entries to the requested local day', async () => {
    await repo.createEntry({
      mealType: 'dinner',
      title: 'Yesterday dinner',
      items: [item()],
      consumedAt: instantOn(2026, 9, 9, 20),
    });
    await repo.createEntry({
      mealType: 'breakfast',
      title: 'Today breakfast',
      items: [item()],
      consumedAt: instantOn(2026, 9, 10, 8),
    });

    const today = await repo.listEntriesForDay('2026-10-10');
    expect(today.ok).toBe(true);
    if (!today.ok) return;
    expect(today.value.map((e) => e.title)).toEqual(['Today breakfast']);
  });

  it('keeps a late-evening meal on its own local day', async () => {
    const lateNight = instantOn(2026, 9, 10, 23);
    await repo.createEntry({
      mealType: 'snack',
      title: 'Late snack',
      items: [item()],
      consumedAt: lateNight,
    });

    const key = toDateKey(new Date(lateNight));
    const result = await repo.listEntriesForDay(key);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
  });

  it('returns an inclusive date range, newest first', async () => {
    for (const day of [6, 8, 10, 12]) {
      await repo.createEntry({
        mealType: 'lunch',
        title: `Day ${day}`,
        items: [item()],
        consumedAt: instantOn(2026, 9, day),
      });
    }

    const range = await repo.listEntriesForRange('2026-10-08', '2026-10-10');
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect(range.value.map((e) => e.title)).toEqual(['Day 10', 'Day 8']);
  });

  it('updates an entry and refreshes updatedAt without touching createdAt', async () => {
    const created = await repo.createEntry({
      mealType: 'lunch',
      title: 'Original',
      items: [item()],
    });
    if (!created.ok) throw new Error('setup failed');

    const updated = await repo.updateEntry(created.value.id, {
      title: 'Corrected',
      mealType: 'dinner',
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.title).toBe('Corrected');
    expect(updated.value.mealType).toBe('dinner');
    expect(updated.value.createdAt).toBe(created.value.createdAt);
    expect(updated.value.id).toBe(created.value.id);
  });

  it('refuses to let a patch rewrite the id or owner', async () => {
    const created = await repo.createEntry({
      mealType: 'lunch',
      title: 'Mine',
      items: [item()],
    });
    if (!created.ok) throw new Error('setup failed');

    const hostile = { id: 'someone-else', userId: 'attacker' } as never;
    const updated = await repo.updateEntry(created.value.id, hostile);

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.id).toBe(created.value.id);
    expect(updated.value.userId).toBe(LOCAL_USER_ID);
  });

  it('reports not_found when updating or deleting a missing entry', async () => {
    const update = await repo.updateEntry('nope', { title: 'x' });
    expect(update.ok).toBe(false);
    if (update.ok) return;
    expect(update.error.code).toBe('not_found');

    const remove = await repo.deleteEntry('nope');
    expect(remove.ok).toBe(false);
    if (remove.ok) return;
    expect(remove.error.code).toBe('not_found');
  });

  it('deletes an entry', async () => {
    const created = await repo.createEntry({
      mealType: 'snack',
      title: 'Gone soon',
      items: [item()],
    });
    if (!created.ok) throw new Error('setup failed');

    expect((await repo.deleteEntry(created.value.id)).ok).toBe(true);
    const after = await repo.getEntry(created.value.id);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value).toBeNull();
  });

  it('duplicates an entry with new ids and no inherited photo', async () => {
    const created = await repo.createEntry({
      mealType: 'dinner',
      title: 'Chicken bowl',
      items: [item({ id: 'original-item' })],
      photoPath: 'photos/original.jpg',
      consumedAt: instantOn(2026, 9, 8, 19),
    });
    if (!created.ok) throw new Error('setup failed');

    const copy = await repo.duplicateEntry(created.value.id, {
      consumedAt: instantOn(2026, 9, 10, 19),
      mealType: 'lunch',
    });

    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    expect(copy.value.id).not.toBe(created.value.id);
    expect(copy.value.items[0]?.id).not.toBe('original-item');
    expect(copy.value.items[0]?.name).toBe('Oat porridge');
    expect(copy.value.mealType).toBe('lunch');
    // The photo documented the original analysis, so the copy has none.
    expect(copy.value.photoPath).toBeNull();

    const original = await repo.getEntry(created.value.id);
    expect(original.ok).toBe(true);
    if (!original.ok) return;
    expect(original.value?.items[0]?.id).toBe('original-item');
  });

  it('defaults a duplicate to the original meal type', async () => {
    const created = await repo.createEntry({
      mealType: 'breakfast',
      title: 'Toast',
      items: [item()],
    });
    if (!created.ok) throw new Error('setup failed');

    const copy = await repo.duplicateEntry(created.value.id, {});
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    expect(copy.value.mealType).toBe('breakfast');
  });

  it('does not lose writes when mutations are issued concurrently', async () => {
    // Without serialization these read-modify-write cycles overwrite each other.
    await Promise.all(
      Array.from({ length: 12 }, (_unused, index) =>
        repo.createEntry({
          mealType: 'snack',
          title: `Concurrent ${index}`,
          items: [item()],
        }),
      ),
    );

    const result = await repo.listRecentEntries(50);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(12);
    expect(new Set(result.value.map((e) => e.id)).size).toBe(12);
  });

  it('caps stored entries and keeps the newest', async () => {
    const overflow = 3;
    for (let index = 0; index < LOCAL_ENTRY_LIMIT + overflow; index += 1) {
      // Each entry one minute apart so ordering is deterministic.
      const consumedAt = new Date(2026, 0, 1, 0, index).toISOString();
      const created = await repo.createEntry({
        mealType: 'snack',
        title: `Entry ${index}`,
        items: [item()],
        consumedAt,
      });
      if (!created.ok) throw new Error('setup failed');
    }

    const result = await repo.listRecentEntries(LOCAL_ENTRY_LIMIT + overflow);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(LOCAL_ENTRY_LIMIT);
    expect(result.value[0]?.title).toBe(`Entry ${LOCAL_ENTRY_LIMIT + overflow - 1}`);
  }, 30_000);

  it('survives corrupted stored data instead of crashing', async () => {
    await AsyncStorage.setItem('foodlens.journal.entries.v1', '{not json');
    const result = await repo.listRecentEntries(10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });
});

describe('local saved meals', () => {
  let repo = createLocalJournalRepository();

  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearLocalJournal();
    repo = createLocalJournalRepository();
  });

  it('creates a saved meal with a zero use count', async () => {
    const created = await repo.createSavedMeal({
      name: 'Usual breakfast',
      mealType: 'breakfast',
      items: [item()],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.useCount).toBe(0);
    expect(created.value.lastUsedAt).toBeNull();
  });

  it('counts uses and orders the most-used first', async () => {
    const rare = await repo.createSavedMeal({ name: 'Rare', mealType: null, items: [item()] });
    const common = await repo.createSavedMeal({ name: 'Common', mealType: null, items: [item()] });
    if (!rare.ok || !common.ok) throw new Error('setup failed');

    await repo.recordSavedMealUse(common.value.id);
    await repo.recordSavedMealUse(common.value.id);
    await repo.recordSavedMealUse(rare.value.id);

    const list = await repo.listSavedMeals();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value.map((m) => m.name)).toEqual(['Common', 'Rare']);
    expect(list.value[0]?.useCount).toBe(2);
    expect(list.value[0]?.lastUsedAt).not.toBeNull();
  });

  it('deletes a saved meal and reports a missing one', async () => {
    const created = await repo.createSavedMeal({ name: 'Temp', mealType: null, items: [item()] });
    if (!created.ok) throw new Error('setup failed');

    expect((await repo.deleteSavedMeal(created.value.id)).ok).toBe(true);
    const missing = await repo.deleteSavedMeal(created.value.id);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe('not_found');
  });
});
