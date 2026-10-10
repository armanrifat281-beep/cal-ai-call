import { EMPTY_NUTRIENTS, type FoodEntry, type FoodEntryItem } from '@/types/domain';

import {
  MIN_DAYS_FOR_INSIGHTS,
  MIN_ENTRIES_FOR_INSIGHTS,
  generateInsights,
} from '../insights';

const USER = 'user-1';
const WINDOW = { periodStart: '2026-10-04', periodEnd: '2026-10-10' } as const;

function item(name: string, overrides: Partial<FoodEntryItem> = {}): FoodEntryItem {
  return {
    id: `item-${name}-${Math.random()}`,
    name,
    brand: null,
    portion: { quantity: 100, unit: 'g' },
    gramsResolved: 100,
    nutrients: { ...EMPTY_NUTRIENTS, caloriesKcal: 200, proteinG: 10, carbsG: 20, fatG: 8 },
    provenance: {
      source: 'database',
      confidence: 'high',
      providerLabel: 'USDA FoodData Central',
      providerRef: '1',
    },
    foodRecordId: 'usda:1',
    notes: null,
    ...overrides,
  };
}

/** An entry on a given local day in October 2026. */
function entryOn(day: number, id: string, items: FoodEntryItem[]): FoodEntry {
  const consumedAt = new Date(2026, 9, day, 12, 0, 0).toISOString();
  return {
    id,
    userId: USER,
    consumedAt,
    mealType: 'lunch',
    title: `Meal ${id}`,
    items,
    photoPath: null,
    notes: null,
    createdAt: consumedAt,
    updatedAt: consumedAt,
  };
}

describe('data sufficiency', () => {
  it('produces nothing and explains why when there are no entries', () => {
    const result = generateInsights([], USER, WINDOW);
    expect(result.insights).toEqual([]);
    expect(result.sufficiency.sufficient).toBe(false);
    expect(result.sufficiency.entryCount).toBe(0);
    expect(result.sufficiency.daysLogged).toBe(0);
    expect(result.sufficiency.requirement).toContain(String(MIN_ENTRIES_FOR_INSIGHTS));
  });

  it('produces nothing when enough meals are all on one day', () => {
    const entries = [
      entryOn(8, 'a', [item('Rice')]),
      entryOn(8, 'b', [item('Rice')]),
      entryOn(8, 'c', [item('Rice')]),
    ];
    const result = generateInsights(entries, USER, WINDOW);
    expect(result.sufficiency.daysLogged).toBe(1);
    expect(result.sufficiency.sufficient).toBe(false);
    expect(result.insights).toEqual([]);
  });

  it('produces nothing when there are too few meals spread over enough days', () => {
    const entries = [entryOn(6, 'a', [item('Rice')]), entryOn(8, 'b', [item('Rice')])];
    const result = generateInsights(entries, USER, WINDOW);
    expect(result.sufficiency.daysLogged).toBe(MIN_DAYS_FOR_INSIGHTS);
    expect(result.sufficiency.sufficient).toBe(false);
  });

  it('becomes sufficient at the threshold', () => {
    const entries = [
      entryOn(6, 'a', [item('Rice')]),
      entryOn(7, 'b', [item('Rice')]),
      entryOn(8, 'c', [item('Rice')]),
    ];
    const result = generateInsights(entries, USER, WINDOW);
    expect(result.sufficiency.sufficient).toBe(true);
    expect(result.insights.length).toBeGreaterThan(0);
  });
});

describe('window filtering', () => {
  it('ignores entries outside the requested period', () => {
    const entries = [
      entryOn(1, 'before', [item('Rice')]),
      entryOn(6, 'in-1', [item('Rice')]),
      entryOn(7, 'in-2', [item('Rice')]),
      entryOn(8, 'in-3', [item('Rice')]),
      entryOn(20, 'after', [item('Rice')]),
    ];

    const result = generateInsights(entries, USER, WINDOW);
    expect(result.sufficiency.entryCount).toBe(3);

    const summary = result.insights.find((i) => i.kind === 'weekly_summary');
    expect(summary?.evidence.entryIds).toEqual(['in-1', 'in-2', 'in-3']);
    expect(summary?.evidence.entryIds).not.toContain('before');
    expect(summary?.evidence.entryIds).not.toContain('after');
  });
});

describe('every insight carries checkable evidence', () => {
  const entries = [
    entryOn(5, 'e1', [item('Oats'), item('Banana')]),
    entryOn(6, 'e2', [item('Oats'), item('Chicken')]),
    entryOn(7, 'e3', [item('Rice'), item('Chicken')]),
    entryOn(8, 'e4', [item('Rice')]),
  ];
  const result = generateInsights(entries, USER, WINDOW);

  it('names the entries it used and how it counted', () => {
    expect(result.insights.length).toBeGreaterThan(0);
    for (const insight of result.insights) {
      expect(insight.evidence.entryIds.length).toBeGreaterThan(0);
      expect(insight.evidence.entryCount).toBe(insight.evidence.entryIds.length);
      expect(insight.evidence.method.length).toBeGreaterThan(20);
      // Every referenced id must be a real entry we were given.
      for (const id of insight.evidence.entryIds) {
        expect(entries.some((entry) => entry.id === id)).toBe(true);
      }
    }
  });

  it('stamps the period and owner on each insight', () => {
    for (const insight of result.insights) {
      expect(insight.userId).toBe(USER);
      expect(insight.periodStart).toBe(WINDOW.periodStart);
      expect(insight.periodEnd).toBe(WINDOW.periodEnd);
    }
  });

  it('uses deterministic ids so regenerating replaces rather than duplicates', () => {
    const again = generateInsights(entries, USER, WINDOW);
    expect(again.insights.map((i) => i.id)).toEqual(result.insights.map((i) => i.id));
    expect(new Set(result.insights.map((i) => i.id)).size).toBe(result.insights.length);
  });
});

describe('weekly summary', () => {
  it('averages over days that were logged, not over the whole window', () => {
    // 3 days logged, 600 kcal each = 600 per logged day, not 1800/7.
    const entries = [
      entryOn(5, 'e1', [item('A'), item('B'), item('C')]),
      entryOn(6, 'e2', [item('A'), item('B'), item('C')]),
      entryOn(7, 'e3', [item('A'), item('B'), item('C')]),
    ];

    const summary = generateInsights(entries, USER, WINDOW).insights.find(
      (i) => i.kind === 'weekly_summary',
    );
    expect(summary?.headline).toContain('600');
    expect(summary?.detail).toContain('3 of 7 days');
    expect(summary?.detail).toContain('left out rather than counted as zero');
  });
});

describe('repeat meal', () => {
  it('picks the food logged on the most separate days', () => {
    const entries = [
      entryOn(5, 'e1', [item('Oats')]),
      entryOn(6, 'e2', [item('Oats')]),
      entryOn(7, 'e3', [item('Oats'), item('Rice')]),
      entryOn(8, 'e4', [item('Rice')]),
    ];

    const repeat = generateInsights(entries, USER, WINDOW).insights.find(
      (i) => i.kind === 'repeat_meal',
    );
    expect(repeat?.headline).toBe('Oats showed up on 3 days');
  });

  it('counts days rather than portions, so one big meal is not a habit', () => {
    const entries = [
      // Five portions of Soup, but on a single day.
      entryOn(5, 'e1', [item('Soup'), item('Soup'), item('Soup'), item('Soup'), item('Soup')]),
      entryOn(6, 'e2', [item('Toast')]),
      entryOn(7, 'e3', [item('Toast')]),
    ];

    const repeat = generateInsights(entries, USER, WINDOW).insights.find(
      (i) => i.kind === 'repeat_meal',
    );
    expect(repeat?.headline).toContain('Toast');
    expect(repeat?.headline).not.toContain('Soup');
  });

  it('is omitted when nothing repeats across days', () => {
    const entries = [
      entryOn(5, 'e1', [item('Alpha')]),
      entryOn(6, 'e2', [item('Beta')]),
      entryOn(7, 'e3', [item('Gamma')]),
    ];

    const repeat = generateInsights(entries, USER, WINDOW).insights.find(
      (i) => i.kind === 'repeat_meal',
    );
    expect(repeat).toBeUndefined();
  });

  it('matches food names case-insensitively but shows the original spelling', () => {
    const entries = [
      entryOn(5, 'e1', [item('Greek Yogurt')]),
      entryOn(6, 'e2', [item('greek yogurt')]),
      entryOn(7, 'e3', [item('Rice')]),
    ];

    const repeat = generateInsights(entries, USER, WINDOW).insights.find(
      (i) => i.kind === 'repeat_meal',
    );
    expect(repeat?.headline).toBe('Greek Yogurt showed up on 2 days');
  });

  it('ignores items with a blank name', () => {
    const entries = [
      entryOn(5, 'e1', [item('   ')]),
      entryOn(6, 'e2', [item('   ')]),
      entryOn(7, 'e3', [item('Rice')]),
    ];

    const repeat = generateInsights(entries, USER, WINDOW).insights.find(
      (i) => i.kind === 'repeat_meal',
    );
    expect(repeat).toBeUndefined();
  });
});

describe('macro balance', () => {
  it('reports shares that sum to about 100 percent', () => {
    const entries = [
      entryOn(5, 'e1', [item('A')]),
      entryOn(6, 'e2', [item('B')]),
      entryOn(7, 'e3', [item('C')]),
    ];

    const macro = generateInsights(entries, USER, WINDOW).insights.find(
      (i) => i.kind === 'macro_balance',
    );
    expect(macro).toBeDefined();
    const percentages = [...(macro?.headline.matchAll(/(\d+)%/g) ?? [])].map((m) =>
      Number.parseInt(m[1] ?? '0', 10),
    );
    expect(percentages).toHaveLength(3);
    const sum = percentages.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThanOrEqual(99);
    expect(sum).toBeLessThanOrEqual(101);
  });

  it('states that it is a description, not a recommendation', () => {
    const entries = [
      entryOn(5, 'e1', [item('A')]),
      entryOn(6, 'e2', [item('B')]),
      entryOn(7, 'e3', [item('C')]),
    ];
    const macro = generateInsights(entries, USER, WINDOW).insights.find(
      (i) => i.kind === 'macro_balance',
    );
    expect(macro?.detail).toContain('not a recommendation');
  });

  it('is omitted when every macro is zero', () => {
    const zeroItem = item('Water', { nutrients: { ...EMPTY_NUTRIENTS } });
    const entries = [
      entryOn(5, 'e1', [zeroItem]),
      entryOn(6, 'e2', [zeroItem]),
      entryOn(7, 'e3', [zeroItem]),
    ];

    const macro = generateInsights(entries, USER, WINDOW).insights.find(
      (i) => i.kind === 'macro_balance',
    );
    expect(macro).toBeUndefined();
  });
});

describe('logging streak', () => {
  it('reports the longest unbroken run of logged days', () => {
    const entries = [
      entryOn(4, 'e1', [item('A')]),
      entryOn(5, 'e2', [item('A')]),
      entryOn(6, 'e3', [item('A')]),
      // Gap on the 7th.
      entryOn(8, 'e4', [item('A')]),
    ];

    const streak = generateInsights(entries, USER, WINDOW).insights.find(
      (i) => i.kind === 'logging_streak',
    );
    expect(streak?.headline).toBe('3 days in a row');
  });

  it('is omitted when no two logged days are adjacent', () => {
    const entries = [
      entryOn(4, 'e1', [item('A')]),
      entryOn(6, 'e2', [item('A')]),
      entryOn(8, 'e3', [item('A')]),
    ];

    const streak = generateInsights(entries, USER, WINDOW).insights.find(
      (i) => i.kind === 'logging_streak',
    );
    expect(streak).toBeUndefined();
  });
});

describe('variety', () => {
  it('counts distinct food names and admits the measure is rough', () => {
    const entries = [
      entryOn(5, 'e1', [item('Oats'), item('Banana')]),
      entryOn(6, 'e2', [item('oats'), item('Milk')]),
      entryOn(7, 'e3', [item('Rice')]),
    ];

    const variety = generateInsights(entries, USER, WINDOW).insights.find(
      (i) => i.kind === 'variety',
    );
    expect(variety?.headline).toBe('4 different foods');
    expect(variety?.detail).toContain('rough measure');
  });
});
