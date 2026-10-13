import type { FoodRecord } from '@/types/domain';

import { DEFAULT_GRAMS, recordToEntryItem } from '../toEntryItem';

const RECORD: FoodRecord = {
  id: 'usda:171477',
  name: 'Chicken breast, grilled',
  brand: null,
  nutrientsPer100g: {
    caloriesKcal: 165,
    proteinG: 31,
    carbsG: 0,
    fatG: 3.6,
    fiberG: 0,
    sugarG: 0,
    saturatedFatG: 1,
    sodiumMg: 74,
  },
  portionOptions: [],
  providerLabel: 'USDA FoodData Central',
  providerRef: '171477',
  isGeneric: true,
};

describe('recordToEntryItem', () => {
  /*
    The point of the search screen: a looked-up value is a measurement, where
    the camera's figure for the same food is a guess at one. If this came out
    as an estimate the screen would have no reason to exist.
  */
  it('marks the item as a database lookup, not an estimate', () => {
    const item = recordToEntryItem(RECORD);

    expect(item.provenance.source).toBe('database');
    expect(item.provenance.confidence).toBe('high');
    expect(item.provenance.providerLabel).toBe('USDA FoodData Central');
    expect(item.foodRecordId).toBe('usda:171477');
  });

  // Nothing may move under the user between reading a row and adding it.
  it('opens at 100 g, the weight the record is quoted in', () => {
    const item = recordToEntryItem(RECORD);

    expect(item.portion).toEqual({ quantity: DEFAULT_GRAMS, unit: 'g' });
    expect(item.gramsResolved).toBe(100);
    expect(item.nutrients.caloriesKcal).toBeCloseTo(165);
  });

  it('scales every nutrient to the weight asked for', () => {
    const item = recordToEntryItem(RECORD, 150);

    expect(item.nutrients.caloriesKcal).toBeCloseTo(247.5);
    expect(item.nutrients.proteinG).toBeCloseTo(46.5);
    expect(item.nutrients.sodiumMg).toBeCloseTo(111);
  });

  it('keeps a nutrient the record did not have as unknown', () => {
    const item = recordToEntryItem(
      { ...RECORD, nutrientsPer100g: { ...RECORD.nutrientsPer100g, sodiumMg: null } },
      150,
    );

    // Not zero: scaling an unknown must not invent a measurement.
    expect(item.nutrients.sodiumMg).toBeNull();
  });

  it('carries the brand through for a packaged food', () => {
    const item = recordToEntryItem({ ...RECORD, brand: 'Tesco' });

    expect(item.brand).toBe('Tesco');
  });

  // The same food added twice is two items, so the record id cannot be the
  // item id or the editor's list would collapse them into one.
  it('gives each added copy its own id', () => {
    const first = recordToEntryItem(RECORD);
    const second = recordToEntryItem(RECORD);

    expect(first.foodRecordId).toBe(second.foodRecordId);
    expect(first.id).not.toBe('usda:171477');
  });
});
