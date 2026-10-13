import type { JournalRepository } from '@/features/journal';
import type { FoodEntry, FoodRecord } from '@/types/domain';

import { addFoodToDay } from '../addToDay';

const RECORD: FoodRecord = {
  id: 'usda:173944',
  name: 'Bananas, raw',
  brand: null,
  nutrientsPer100g: {
    caloriesKcal: 89,
    proteinG: 1.1,
    carbsG: 22.8,
    fatG: 0.3,
    fiberG: 2.6,
    sugarG: 12.2,
    saturatedFatG: 0.1,
    sodiumMg: 1,
  },
  portionOptions: [],
  providerLabel: 'USDA FoodData Central',
  providerRef: '173944',
  isGeneric: true,
};

function entry(overrides: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: 'entry-1',
    userId: 'u1',
    consumedAt: new Date().toISOString(),
    mealType: 'breakfast',
    title: 'Toast and eggs',
    items: [],
    photoPath: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function repo(today: FoodEntry[]) {
  const created: unknown[] = [];
  const updated: { id: string; patch: unknown }[] = [];

  const repository = {
    kind: 'local',
    listEntriesForDay: async () => ({ ok: true as const, value: today }),
    createEntry: async (input: unknown) => {
      created.push(input);
      return { ok: true as const, value: entry({ id: 'new-entry' }) };
    },
    updateEntry: async (id: string, patch: unknown) => {
      updated.push({ id, patch });
      return { ok: true as const, value: entry({ id }) };
    },
  } as unknown as JournalRepository;

  return { repository, created, updated };
}

describe('addFoodToDay', () => {
  describe('when the meal already exists', () => {
    /*
      It joins the meal rather than becoming one. Three separate one-item
      entries all called "Breakfast" would make the day's timeline
      unreadable and the per-meal totals meaningless.
    */
    it('appends to it instead of starting another', async () => {
      const existing = entry({ id: 'bf', mealType: 'breakfast', items: [] });
      const { repository, created, updated } = repo([existing]);

      const result = await addFoodToDay(repository, RECORD, 120, 'breakfast');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.createdMeal).toBe(false);
      expect(created).toHaveLength(0);
      expect(updated[0]?.id).toBe('bf');
    });

    it('keeps the foods already in it', async () => {
      const already = {
        id: 'i1',
        name: 'Toast',
        brand: null,
        portion: { quantity: 1, unit: 'slice' as const },
        gramsResolved: 30,
        nutrients: RECORD.nutrientsPer100g,
        provenance: {
          source: 'user_entered' as const,
          confidence: 'high' as const,
          providerLabel: null,
          providerRef: null,
        },
        foodRecordId: null,
        notes: null,
      };
      const { repository, updated } = repo([
        entry({ id: 'bf', mealType: 'breakfast', items: [already] }),
      ]);

      await addFoodToDay(repository, RECORD, 120, 'breakfast');

      const items = (updated[0]?.patch as { items: unknown[] }).items;
      expect(items).toHaveLength(2);
    });

    // A meal the user named must not be renamed by adding a banana to it.
    it('does not rename it', async () => {
      const { repository, updated } = repo([
        entry({ id: 'bf', mealType: 'breakfast', title: 'Toast and eggs' }),
      ]);

      await addFoodToDay(repository, RECORD, 120, 'breakfast');

      expect((updated[0]?.patch as { title?: string }).title).toBeUndefined();
    });

    it('ignores a meal of a different type on the same day', async () => {
      const { repository, created } = repo([entry({ id: 'lunch', mealType: 'lunch' })]);

      const result = await addFoodToDay(repository, RECORD, 120, 'breakfast');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.createdMeal).toBe(true);
      expect(created).toHaveLength(1);
    });
  });

  describe('when the meal does not exist yet', () => {
    it('starts it, named after the food', async () => {
      const { repository, created } = repo([]);

      const result = await addFoodToDay(repository, RECORD, 120, 'snack');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.createdMeal).toBe(true);
      expect((created[0] as { title: string }).title).toBe('Bananas, raw');
      expect((created[0] as { mealType: string }).mealType).toBe('snack');
    });
  });

  it('scales the food to the amount asked for', async () => {
    const { repository, created } = repo([]);

    await addFoodToDay(repository, RECORD, 200, 'snack');

    const items = (created[0] as { items: { nutrients: { caloriesKcal: number } }[] }).items;
    expect(items[0]?.nutrients.caloriesKcal).toBeCloseTo(178);
  });

  it('reports a failed read rather than writing anything', async () => {
    const repository = {
      kind: 'local',
      listEntriesForDay: async () => ({
        ok: false as const,
        error: { code: 'network' as const, message: 'offline', retryable: true },
      }),
    } as unknown as JournalRepository;

    const result = await addFoodToDay(repository, RECORD, 100, 'lunch');

    expect(result.ok).toBe(false);
  });
});
