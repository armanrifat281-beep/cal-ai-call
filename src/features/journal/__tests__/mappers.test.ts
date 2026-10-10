import { EMPTY_NUTRIENTS, type FoodEntryItem } from '@/types/domain';

import {
  itemToPayload,
  mapPostgrestError,
  mapThrownError,
  rowToEntry,
  rowToItem,
  rowToSavedMeal,
  toNullableNumber,
  toNumber,
  type FoodEntryItemRow,
  type FoodEntryRow,
} from '../mappers';

function itemRow(overrides: Partial<FoodEntryItemRow> = {}): FoodEntryItemRow {
  return {
    id: 'item-1',
    entry_id: 'entry-1',
    user_id: 'user-1',
    name: 'Basmati rice',
    brand: null,
    portion_quantity: 180,
    portion_unit: 'g',
    grams_resolved: 180,
    calories_kcal: 234,
    protein_g: 4.9,
    carbs_g: 50.4,
    fat_g: 0.5,
    fiber_g: null,
    sugar_g: null,
    saturated_fat_g: null,
    sodium_mg: null,
    source: 'database',
    confidence: 'high',
    provider_label: 'USDA FoodData Central',
    provider_ref: '169704',
    food_record_id: 'usda:169704',
    notes: null,
    position: 0,
    ...overrides,
  };
}

function entryRow(overrides: Partial<FoodEntryRow> = {}): FoodEntryRow {
  return {
    id: 'entry-1',
    user_id: 'user-1',
    consumed_at: '2026-10-10T12:00:00.000Z',
    meal_type: 'lunch',
    title: 'Rice bowl',
    photo_path: null,
    notes: null,
    created_at: '2026-10-10T12:05:00.000Z',
    updated_at: '2026-10-10T12:05:00.000Z',
    food_entry_items: [itemRow()],
    ...overrides,
  };
}

describe('numeric coercion', () => {
  it('accepts a number', () => {
    expect(toNumber(234)).toBe(234);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(4.9)).toBeCloseTo(4.9, 10);
  });

  it('accepts a numeric STRING, which is how Postgres numeric can arrive', () => {
    // The bug this prevents: "234" + "410" is "234410", not 644.
    expect(toNumber('234')).toBe(234);
    expect(toNumber('4.90')).toBeCloseTo(4.9, 10);
    expect(toNumber('0')).toBe(0);
  });

  it('falls back to zero for a required field that is unusable', () => {
    for (const value of [null, undefined, 'abc', Number.NaN]) {
      expect(toNumber(value as never)).toBe(0);
    }
  });

  it('keeps an unknown optional value null rather than turning it into zero', () => {
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber(undefined)).toBeNull();
    expect(toNullableNumber('not a number')).toBeNull();
    expect(toNullableNumber(0)).toBe(0);
    expect(toNullableNumber('2.4')).toBeCloseTo(2.4, 10);
  });
});

describe('rowToItem', () => {
  it('maps every column to its domain field', () => {
    const item = rowToItem(itemRow());
    expect(item.id).toBe('item-1');
    expect(item.name).toBe('Basmati rice');
    expect(item.portion).toEqual({ quantity: 180, unit: 'g' });
    expect(item.gramsResolved).toBe(180);
    expect(item.nutrients.caloriesKcal).toBe(234);
    expect(item.nutrients.carbsG).toBeCloseTo(50.4, 10);
    expect(item.provenance).toEqual({
      source: 'database',
      confidence: 'high',
      providerLabel: 'USDA FoodData Central',
      providerRef: '169704',
    });
    expect(item.foodRecordId).toBe('usda:169704');
  });

  it('coerces numeric strings throughout', () => {
    const item = rowToItem(
      itemRow({
        portion_quantity: '180.5',
        calories_kcal: '234',
        protein_g: '4.90',
        grams_resolved: '180.5',
        sodium_mg: '412',
      }),
    );
    expect(item.portion.quantity).toBeCloseTo(180.5, 10);
    expect(item.nutrients.caloriesKcal).toBe(234);
    expect(item.nutrients.proteinG).toBeCloseTo(4.9, 10);
    expect(item.gramsResolved).toBeCloseTo(180.5, 10);
    expect(item.nutrients.sodiumMg).toBe(412);
  });

  it('keeps unknown optional nutrients null', () => {
    const item = rowToItem(itemRow());
    expect(item.nutrients.fiberG).toBeNull();
    expect(item.nutrients.sodiumMg).toBeNull();
    expect(item.gramsResolved).not.toBeNull();
  });

  it('reads an unrecognised source as an estimate, not as a verified lookup', () => {
    // Defaulting the other way would assert verification we cannot show.
    const item = rowToItem(itemRow({ source: 'something_new' }));
    expect(item.provenance.source).toBe('ai_estimate');
  });

  it('reads an unrecognised confidence as the lowest', () => {
    const item = rowToItem(itemRow({ confidence: 'very sure' }));
    expect(item.provenance.confidence).toBe('low');
  });

  it('falls back to a serving for an unrecognised portion unit', () => {
    const item = rowToItem(itemRow({ portion_unit: 'handful' }));
    expect(item.portion.unit).toBe('serving');
  });
});

describe('rowToEntry', () => {
  it('maps the entry and its items', () => {
    const entry = rowToEntry(entryRow());
    expect(entry.id).toBe('entry-1');
    expect(entry.mealType).toBe('lunch');
    expect(entry.title).toBe('Rice bowl');
    expect(entry.items).toHaveLength(1);
    expect(entry.items[0]?.name).toBe('Basmati rice');
  });

  it('sorts items by position, because an embedded select does not guarantee order', () => {
    const entry = rowToEntry(
      entryRow({
        food_entry_items: [
          itemRow({ id: 'c', name: 'Third', position: 2 }),
          itemRow({ id: 'a', name: 'First', position: 0 }),
          itemRow({ id: 'b', name: 'Second', position: 1 }),
        ],
      }),
    );
    expect(entry.items.map((item) => item.name)).toEqual(['First', 'Second', 'Third']);
  });

  it('handles an entry with no items embedded', () => {
    expect(rowToEntry(entryRow({ food_entry_items: undefined })).items).toEqual([]);
    expect(rowToEntry(entryRow({ food_entry_items: null })).items).toEqual([]);
    expect(rowToEntry(entryRow({ food_entry_items: [] })).items).toEqual([]);
  });

  it('falls back to snack for an unrecognised meal type', () => {
    expect(rowToEntry(entryRow({ meal_type: 'brunch' })).mealType).toBe('snack');
  });

  it('does not mutate the row it was given', () => {
    const row = entryRow({
      food_entry_items: [itemRow({ position: 1 }), itemRow({ id: 'x', position: 0 })],
    });
    const originalOrder = row.food_entry_items?.map((item) => item.id);
    rowToEntry(row);
    expect(row.food_entry_items?.map((item) => item.id)).toEqual(originalOrder);
  });
});

describe('rowToSavedMeal', () => {
  it('maps a saved meal and its JSON item snapshot', () => {
    const meal = rowToSavedMeal({
      id: 'meal-1',
      user_id: 'user-1',
      name: 'Usual breakfast',
      meal_type: 'breakfast',
      items: [{ name: 'Oats' }],
      use_count: 7,
      last_used_at: '2026-10-09T08:00:00.000Z',
      created_at: '2026-09-01T08:00:00.000Z',
      updated_at: '2026-10-09T08:00:00.000Z',
    });

    expect(meal.name).toBe('Usual breakfast');
    expect(meal.mealType).toBe('breakfast');
    expect(meal.useCount).toBe(7);
    expect(meal.items).toHaveLength(1);
  });

  it('accepts a null meal type, meaning any time of day', () => {
    const meal = rowToSavedMeal({
      id: 'm',
      user_id: 'u',
      name: 'Anytime',
      meal_type: null,
      items: [],
      use_count: '0',
      last_used_at: null,
      created_at: 'now',
      updated_at: 'now',
    });
    expect(meal.mealType).toBeNull();
    expect(meal.useCount).toBe(0);
  });

  it('tolerates a non-array items column instead of crashing', () => {
    const meal = rowToSavedMeal({
      id: 'm',
      user_id: 'u',
      name: 'Broken',
      meal_type: null,
      items: { not: 'an array' },
      use_count: 0,
      last_used_at: null,
      created_at: 'now',
      updated_at: 'now',
    });
    expect(meal.items).toEqual([]);
  });
});

describe('itemToPayload', () => {
  const item: FoodEntryItem = {
    id: 'client-generated-id',
    name: '  Chicken curry  ',
    brand: null,
    portion: { quantity: 1, unit: 'serving' },
    gramsResolved: null,
    nutrients: {
      ...EMPTY_NUTRIENTS,
      caloriesKcal: 410,
      proteinG: 32,
      carbsG: 9,
      fatG: 27,
    },
    provenance: {
      source: 'ai_estimate',
      confidence: 'low',
      providerLabel: 'claude-opus-5-5',
      providerRef: null,
    },
    foodRecordId: null,
    notes: null,
  };

  it('maps domain fields to snake_case database columns', () => {
    const payload = itemToPayload(item);
    expect(payload.portion_quantity).toBe(1);
    expect(payload.portion_unit).toBe('serving');
    expect(payload.calories_kcal).toBe(410);
    expect(payload.protein_g).toBe(32);
    expect(payload.source).toBe('ai_estimate');
    expect(payload.confidence).toBe('low');
    expect(payload.provider_label).toBe('claude-opus-5-5');
  });

  it('trims the name', () => {
    expect(itemToPayload(item).name).toBe('Chicken curry');
  });

  it('does not send the client-side id: Postgres issues its own', () => {
    expect(itemToPayload(item)).not.toHaveProperty('id');
  });

  it('preserves nulls rather than sending zeroes', () => {
    const payload = itemToPayload(item);
    expect(payload.grams_resolved).toBeNull();
    expect(payload.fiber_g).toBeNull();
    expect(payload.sodium_mg).toBeNull();
  });

  it('round-trips through the row mapper', () => {
    const payload = itemToPayload(item);
    const roundTripped = rowToItem({
      ...itemRow(),
      ...payload,
      id: 'db-id',
      entry_id: 'e',
      user_id: 'u',
      position: 0,
    });

    expect(roundTripped.name).toBe('Chicken curry');
    expect(roundTripped.nutrients.caloriesKcal).toBe(410);
    expect(roundTripped.provenance.source).toBe('ai_estimate');
    expect(roundTripped.provenance.confidence).toBe('low');
    expect(roundTripped.gramsResolved).toBeNull();
  });
});

describe('mapPostgrestError', () => {
  const cases: [string, string, boolean][] = [
    ['PGRST116', 'not_found', true],
    ['42501', 'unauthorized', false],
    ['23514', 'validation', false],
    ['23505', 'validation', false],
    ['23503', 'not_found', false],
    ['23502', 'validation', false],
    ['P0002', 'not_found', true],
    ['PGRST301', 'unauthorized', false],
    ['XX000', 'unknown', true],
  ];

  it.each(cases)('maps %s to %s', (code, expectedCode) => {
    const mapped = mapPostgrestError(
      { code, message: 'database said no' },
      'testContext',
    );
    expect(mapped.code).toBe(expectedCode);
  });

  it('never puts a SQLSTATE or constraint name in the user-facing message', () => {
    for (const [code] of cases) {
      const mapped = mapPostgrestError(
        { code, message: 'violates check constraint "food_entry_items_calories_range"' },
        'testContext',
      );
      expect(mapped.message).not.toContain(code);
      expect(mapped.message).not.toContain('constraint');
      expect(mapped.message).not.toContain('food_entry_items');
      // The raw text is kept for developers, not shown in release builds.
      expect(mapped.detail).toContain('food_entry_items_calories_range');
    }
  });

  it('records the calling context in the detail, for log triage', () => {
    const mapped = mapPostgrestError(
      { code: '23514', message: 'nope' },
      'createEntry',
    );
    expect(mapped.detail).toContain('createEntry');
  });
});

describe('mapThrownError', () => {
  it('treats a failed fetch as a network problem', () => {
    const mapped = mapThrownError(new TypeError('Network request failed'), 'ctx');
    expect(mapped.code).toBe('network');
    expect(mapped.retryable).toBe(true);
  });

  it('recognises a network problem from the message alone', () => {
    expect(mapThrownError(new Error('fetch failed'), 'ctx').code).toBe('network');
    expect(mapThrownError(new Error('request timeout'), 'ctx').code).toBe('network');
  });

  it('falls back to unknown for anything else', () => {
    expect(mapThrownError(new Error('something odd'), 'ctx').code).toBe('unknown');
    expect(mapThrownError('a string', 'ctx').code).toBe('unknown');
    expect(mapThrownError(undefined, 'ctx').code).toBe('unknown');
  });
});
