import {
  EMPTY_NUTRIENTS,
  type FoodEntry,
  type FoodEntryItem,
  type FoodRecord,
  type Nutrients,
} from '@/types/domain';

import {
  buildItemFromEstimate,
  buildItemFromRecord,
  computeDailyProgress,
  computeEntryTotals,
  computeTargetProgress,
  reportionItem,
  suggestedUnitsFor,
  summarizeEntries,
} from '../engine';

function nutrients(partial: Partial<Nutrients>): Nutrients {
  return { ...EMPTY_NUTRIENTS, ...partial };
}

const APPLE: FoodRecord = {
  id: 'usda:1750340',
  name: 'Apple, raw, with skin',
  brand: null,
  nutrientsPer100g: nutrients({
    caloriesKcal: 52,
    proteinG: 0.26,
    carbsG: 13.8,
    fatG: 0.17,
    fiberG: 2.4,
    sugarG: 10.4,
    saturatedFatG: 0.028,
    sodiumMg: 1,
  }),
  portionOptions: [
    { unit: 'piece', label: 'medium apple (3" dia)', gramsPerUnit: 182 },
    { unit: 'cup', label: '1 cup, chopped', gramsPerUnit: 125 },
  ],
  providerLabel: 'USDA FoodData Central',
  providerRef: '1750340',
  isGeneric: true,
};

/** A record with no household measures, to exercise the unresolved path. */
const MYSTERY_SAUCE: FoodRecord = {
  ...APPLE,
  id: 'usda:999999',
  name: 'Mystery sauce',
  portionOptions: [],
  providerRef: '999999',
};

describe('buildItemFromRecord', () => {
  it('scales database values to the portion and marks provenance as database', () => {
    const outcome = buildItemFromRecord({
      id: 'item-1',
      record: APPLE,
      portion: { quantity: 1, unit: 'piece' },
      confidence: 'high',
    });

    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;

    expect(outcome.item.gramsResolved).toBe(182);
    expect(outcome.item.nutrients.caloriesKcal).toBeCloseTo(52 * 1.82, 8);
    expect(outcome.item.nutrients.carbsG).toBeCloseTo(13.8 * 1.82, 8);
    expect(outcome.item.provenance.source).toBe('database');
    expect(outcome.item.provenance.providerLabel).toBe('USDA FoodData Central');
    expect(outcome.item.provenance.providerRef).toBe('1750340');
    expect(outcome.item.foodRecordId).toBe('usda:1750340');
  });

  it('asks for a portion instead of guessing an unknown household measure', () => {
    const outcome = buildItemFromRecord({
      id: 'item-2',
      record: MYSTERY_SAUCE,
      portion: { quantity: 2, unit: 'tbsp' },
      confidence: 'medium',
    });

    expect(outcome.status).toBe('needs_portion');
    if (outcome.status !== 'needs_portion') return;
    expect(outcome.reason).toContain('tbsp');
    expect(outcome.suggestedUnits).toContain('g');
  });

  it('warns when an ml portion relied on the water-density assumption', () => {
    const outcome = buildItemFromRecord({
      id: 'item-3',
      record: MYSTERY_SAUCE,
      portion: { quantity: 30, unit: 'ml' },
      confidence: 'medium',
    });

    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.warnings.map((w) => w.kind)).toContain('assumed_density');
  });

  it('warns when a record lacks optional nutrients', () => {
    const sparse: FoodRecord = {
      ...APPLE,
      nutrientsPer100g: nutrients({
        caloriesKcal: 52,
        proteinG: 0.3,
        carbsG: 13.8,
        fatG: 0.2,
        fiberG: null,
        sodiumMg: null,
      }),
    };

    const outcome = buildItemFromRecord({
      id: 'item-4',
      record: sparse,
      portion: { quantity: 100, unit: 'g' },
      confidence: 'high',
    });

    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    const warning = outcome.warnings.find((w) => w.kind === 'missing_nutrients');
    expect(warning).toBeDefined();
    if (warning?.kind !== 'missing_nutrients') return;
    expect(warning.keys).toEqual(expect.arrayContaining(['fiberG', 'sodiumMg']));
  });

  it('carries the identification confidence through untouched', () => {
    const outcome = buildItemFromRecord({
      id: 'item-5',
      record: APPLE,
      portion: { quantity: 50, unit: 'g' },
      confidence: 'low',
    });
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.item.provenance.confidence).toBe('low');
  });
});

describe('suggestedUnitsFor', () => {
  it('always offers weight units first, then the record measures', () => {
    expect(suggestedUnitsFor(APPLE)).toEqual(['g', 'oz', 'piece', 'cup']);
  });

  it('does not duplicate a unit the record also supplies', () => {
    const withGrams = { portionOptions: [{ unit: 'g' as const, label: 'g', gramsPerUnit: 1 }] };
    expect(suggestedUnitsFor(withGrams)).toEqual(['g', 'oz']);
  });
});

describe('buildItemFromEstimate', () => {
  it('records model output as an ai_estimate without rescaling it', () => {
    const { item } = buildItemFromEstimate({
      id: 'item-6',
      name: 'Grilled salmon fillet',
      portion: { quantity: 1, unit: 'piece' },
      nutrientsForPortion: nutrients({
        caloriesKcal: 310,
        proteinG: 34,
        carbsG: 0,
        fatG: 19,
      }),
      estimatedGrams: 150,
      confidence: 'medium',
      providerLabel: 'vision-model',
    });

    expect(item.provenance.source).toBe('ai_estimate');
    expect(item.provenance.providerRef).toBeNull();
    expect(item.foodRecordId).toBeNull();
    expect(item.nutrients.caloriesKcal).toBe(310);
    expect(item.gramsResolved).toBe(150);
  });

  it('treats a missing or invalid gram estimate as unknown', () => {
    for (const grams of [null, 0, -10, Number.NaN]) {
      const { item } = buildItemFromEstimate({
        id: 'item-7',
        name: 'Soup',
        portion: { quantity: 1, unit: 'serving' },
        nutrientsForPortion: nutrients({ caloriesKcal: 180, proteinG: 6, carbsG: 20, fatG: 7 }),
        estimatedGrams: grams,
        confidence: 'low',
        providerLabel: 'vision-model',
      });
      expect(item.gramsResolved).toBeNull();
    }
  });

  it('flags an estimate whose calories contradict its macros', () => {
    const { warnings } = buildItemFromEstimate({
      id: 'item-8',
      name: 'Suspicious salad',
      portion: { quantity: 1, unit: 'serving' },
      nutrientsForPortion: nutrients({
        caloriesKcal: 1200,
        proteinG: 5,
        carbsG: 10,
        fatG: 3,
      }),
      confidence: 'low',
      providerLabel: 'vision-model',
    });

    expect(warnings.map((w) => w.kind)).toContain('macro_mismatch');
  });
});

describe('reportionItem', () => {
  const baseItem = (() => {
    const outcome = buildItemFromRecord({
      id: 'item-9',
      record: APPLE,
      portion: { quantity: 182, unit: 'g' },
      confidence: 'high',
    });
    if (outcome.status !== 'ok') throw new Error('fixture failed to build');
    return outcome.item;
  })();

  it('rescales nutrients proportionally when the portion changes', () => {
    const outcome = reportionItem(baseItem, { quantity: 91, unit: 'g' });
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.item.gramsResolved).toBe(91);
    expect(outcome.item.nutrients.caloriesKcal).toBeCloseTo(
      baseItem.nutrients.caloriesKcal / 2,
      8,
    );
  });

  it('round-trips back to the original values', () => {
    const halved = reportionItem(baseItem, { quantity: 91, unit: 'g' });
    if (halved.status !== 'ok') throw new Error('unexpected');
    const restored = reportionItem(halved.item, { quantity: 182, unit: 'g' });
    if (restored.status !== 'ok') throw new Error('unexpected');
    expect(restored.item.nutrients.caloriesKcal).toBeCloseTo(
      baseItem.nutrients.caloriesKcal,
      6,
    );
  });

  it('uses the record measures when they are supplied', () => {
    const outcome = reportionItem(baseItem, { quantity: 1, unit: 'cup' }, APPLE.portionOptions);
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.item.gramsResolved).toBe(125);
  });

  it('refuses to rescale an item that never had a resolved weight', () => {
    const unresolved: FoodEntryItem = { ...baseItem, gramsResolved: null };
    const outcome = reportionItem(unresolved, { quantity: 50, unit: 'g' });
    expect(outcome.status).toBe('needs_portion');
  });
});

// ---------------------------------------------------------------------------
// Totals and summaries
// ---------------------------------------------------------------------------

function itemWith(partial: Partial<FoodEntryItem>): FoodEntryItem {
  return {
    id: 'i',
    name: 'Food',
    brand: null,
    portion: { quantity: 100, unit: 'g' },
    gramsResolved: 100,
    nutrients: nutrients({ caloriesKcal: 100, proteinG: 5, carbsG: 10, fatG: 3 }),
    provenance: {
      source: 'database',
      confidence: 'high',
      providerLabel: 'USDA FoodData Central',
      providerRef: '1',
    },
    foodRecordId: 'usda:1',
    notes: null,
    ...partial,
  };
}

function entryWith(partial: Partial<FoodEntry>): FoodEntry {
  return {
    id: 'e',
    userId: 'u1',
    consumedAt: '2026-10-10T08:00:00.000Z',
    mealType: 'breakfast',
    title: 'Breakfast',
    items: [itemWith({ id: 'i1' })],
    photoPath: null,
    notes: null,
    createdAt: '2026-10-10T08:05:00.000Z',
    updatedAt: '2026-10-10T08:05:00.000Z',
    ...partial,
  };
}

describe('computeEntryTotals', () => {
  it('adds the items of one entry', () => {
    const entry = entryWith({
      items: [
        itemWith({ id: 'a', nutrients: nutrients({ caloriesKcal: 100, proteinG: 5 }) }),
        itemWith({ id: 'b', nutrients: nutrients({ caloriesKcal: 250, proteinG: 20 }) }),
      ],
    });
    const { nutrients: totals } = computeEntryTotals(entry);
    expect(totals.caloriesKcal).toBe(350);
    expect(totals.proteinG).toBe(25);
  });

  it('is zero for an entry with no items', () => {
    expect(computeEntryTotals({ items: [] }).nutrients).toEqual(EMPTY_NUTRIENTS);
  });
});

describe('summarizeEntries', () => {
  it('splits totals by meal type', () => {
    const summary = summarizeEntries([
      entryWith({
        id: 'e1',
        mealType: 'breakfast',
        items: [itemWith({ nutrients: nutrients({ caloriesKcal: 300 }) })],
      }),
      entryWith({
        id: 'e2',
        mealType: 'dinner',
        items: [itemWith({ nutrients: nutrients({ caloriesKcal: 700 }) })],
      }),
    ]);

    expect(summary.entryCount).toBe(2);
    expect(summary.itemCount).toBe(2);
    expect(summary.totals.nutrients.caloriesKcal).toBe(1000);
    expect(summary.byMealType.breakfast.nutrients.caloriesKcal).toBe(300);
    expect(summary.byMealType.dinner.nutrients.caloriesKcal).toBe(700);
    expect(summary.byMealType.lunch.nutrients.caloriesKcal).toBe(0);
  });

  it('reports when any item is a model estimate', () => {
    const withEstimate = summarizeEntries([
      entryWith({
        items: [
          itemWith({
            provenance: {
              source: 'ai_estimate',
              confidence: 'low',
              providerLabel: 'vision-model',
              providerRef: null,
            },
          }),
        ],
      }),
    ]);
    expect(withEstimate.containsEstimates).toBe(true);
    expect(summarizeEntries([entryWith({})]).containsEstimates).toBe(false);
  });

  it('handles an empty day', () => {
    const summary = summarizeEntries([]);
    expect(summary.entryCount).toBe(0);
    expect(summary.totals.nutrients).toEqual(EMPTY_NUTRIENTS);
    expect(summary.containsEstimates).toBe(false);
  });
});

describe('computeTargetProgress', () => {
  it('reports a ratio and remaining amount against a target', () => {
    const progress = computeTargetProgress(1200, 2000);
    expect(progress.ratio).toBeCloseTo(0.6, 10);
    expect(progress.remaining).toBe(800);
    expect(progress.isOver).toBe(false);
  });

  it('marks consumption above the target as over, with no negative remainder', () => {
    const progress = computeTargetProgress(2400, 2000);
    expect(progress.isOver).toBe(true);
    expect(progress.remaining).toBe(0);
    expect(progress.ratio).toBeCloseTo(1.2, 10);
  });

  it('returns a null ratio when no usable target is set', () => {
    for (const target of [null, 0, -100]) {
      const progress = computeTargetProgress(500, target);
      expect(progress.ratio).toBeNull();
      expect(progress.target).toBeNull();
    }
  });
});

describe('computeDailyProgress', () => {
  it('knows when the user has set no targets at all', () => {
    const progress = computeDailyProgress(EMPTY_NUTRIENTS, {
      caloriesKcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
    expect(progress.hasAnyTarget).toBe(false);
    expect(progress.calories.ratio).toBeNull();
  });

  it('computes each macro independently', () => {
    const progress = computeDailyProgress(
      nutrients({ caloriesKcal: 1000, proteinG: 60, carbsG: 100, fatG: 30 }),
      { caloriesKcal: 2000, proteinG: 120, carbsG: null, fatG: 60 },
    );
    expect(progress.hasAnyTarget).toBe(true);
    expect(progress.calories.ratio).toBeCloseTo(0.5, 10);
    expect(progress.protein.ratio).toBeCloseTo(0.5, 10);
    expect(progress.carbs.ratio).toBeNull();
    expect(progress.fat.ratio).toBeCloseTo(0.5, 10);
  });
});
