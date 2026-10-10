import { EMPTY_NUTRIENTS, type Nutrients } from '@/types/domain';

import {
  KCAL_PER_GRAM,
  caloriesFromMacros,
  checkMacroConsistency,
  macroSplit,
  roundNutrientsForDisplay,
  scaleNutrients,
  scaleNutrientsByGrams,
  sumNutrients,
} from '../nutrients';

function nutrients(partial: Partial<Nutrients>): Nutrients {
  return { ...EMPTY_NUTRIENTS, ...partial };
}

/** Chicken breast, raw, per 100 g, roughly matching USDA generic values. */
const CHICKEN_PER_100G = nutrients({
  caloriesKcal: 120,
  proteinG: 22.5,
  carbsG: 0,
  fatG: 2.6,
  fiberG: 0,
  sugarG: 0,
  saturatedFatG: 0.7,
  sodiumMg: 45,
});

describe('scaleNutrientsByGrams', () => {
  it('scales a per-100 g record to the eaten weight', () => {
    const result = scaleNutrientsByGrams(CHICKEN_PER_100G, 150);
    expect(result.caloriesKcal).toBeCloseTo(180, 10);
    expect(result.proteinG).toBeCloseTo(33.75, 10);
    expect(result.fatG).toBeCloseTo(3.9, 10);
    expect(result.sodiumMg).toBeCloseTo(67.5, 10);
  });

  it('is the identity at exactly 100 g', () => {
    expect(scaleNutrientsByGrams(CHICKEN_PER_100G, 100)).toEqual(CHICKEN_PER_100G);
  });

  it('returns zeroes at 0 g but keeps unknowns unknown', () => {
    const source = nutrients({ caloriesKcal: 200, proteinG: 10, fiberG: null });
    const result = scaleNutrientsByGrams(source, 0);
    expect(result.caloriesKcal).toBe(0);
    expect(result.proteinG).toBe(0);
    expect(result.fiberG).toBeNull();
  });

  it('never turns an unknown nutrient into a number', () => {
    const source = nutrients({ caloriesKcal: 100, fiberG: null, sodiumMg: null });
    const result = scaleNutrientsByGrams(source, 250);
    expect(result.fiberG).toBeNull();
    expect(result.sodiumMg).toBeNull();
  });

  it('rejects negative or non-finite weights instead of producing junk', () => {
    expect(() => scaleNutrientsByGrams(CHICKEN_PER_100G, -1)).toThrow(RangeError);
    expect(() => scaleNutrientsByGrams(CHICKEN_PER_100G, Number.NaN)).toThrow(RangeError);
    expect(() =>
      scaleNutrientsByGrams(CHICKEN_PER_100G, Number.POSITIVE_INFINITY),
    ).toThrow(RangeError);
  });

  it('composes: scaling to 100 g then to N g equals scaling straight to N g', () => {
    const forPortion = scaleNutrientsByGrams(CHICKEN_PER_100G, 173);
    const backToPer100 = scaleNutrientsByGrams(forPortion, (100 / 173) * 100);
    expect(backToPer100.caloriesKcal).toBeCloseTo(CHICKEN_PER_100G.caloriesKcal, 8);
    expect(backToPer100.proteinG).toBeCloseTo(CHICKEN_PER_100G.proteinG, 8);
  });
});

describe('scaleNutrients', () => {
  it('multiplies by an arbitrary factor', () => {
    const result = scaleNutrients(nutrients({ caloriesKcal: 50, proteinG: 2 }), 3);
    expect(result.caloriesKcal).toBe(150);
    expect(result.proteinG).toBe(6);
  });

  it('rejects a negative factor', () => {
    expect(() => scaleNutrients(CHICKEN_PER_100G, -0.5)).toThrow(RangeError);
  });
});

describe('sumNutrients', () => {
  it('returns zeroes for an empty list', () => {
    const { nutrients: total, incompleteKeys } = sumNutrients([]);
    expect(total).toEqual(EMPTY_NUTRIENTS);
    expect(incompleteKeys).toEqual([]);
  });

  it('adds required macros across items', () => {
    const { nutrients: total } = sumNutrients([
      nutrients({ caloriesKcal: 200, proteinG: 10, carbsG: 20, fatG: 5 }),
      nutrients({ caloriesKcal: 350, proteinG: 25, carbsG: 15, fatG: 12 }),
    ]);
    expect(total.caloriesKcal).toBe(550);
    expect(total.proteinG).toBe(35);
    expect(total.carbsG).toBe(35);
    expect(total.fatG).toBe(17);
  });

  it('sums optional nutrients when every item has them', () => {
    const { nutrients: total, incompleteKeys } = sumNutrients([
      nutrients({ fiberG: 3, sugarG: 5, saturatedFatG: 1, sodiumMg: 100 }),
      nutrients({ fiberG: 2, sugarG: 1, saturatedFatG: 4, sodiumMg: 250 }),
    ]);
    expect(total.fiberG).toBe(5);
    expect(total.sodiumMg).toBe(350);
    expect(incompleteKeys).toEqual([]);
  });

  it('treats an unknown optional value as unknown, not zero, and reports it', () => {
    const { nutrients: total, incompleteKeys } = sumNutrients([
      nutrients({ fiberG: 4, sodiumMg: 120 }),
      nutrients({ fiberG: null, sodiumMg: 80 }),
    ]);
    // 4 g is a floor, not the real total, and the caller is told which key.
    expect(total.fiberG).toBe(4);
    expect(incompleteKeys).toContain('fiberG');
    expect(total.sodiumMg).toBe(200);
    expect(incompleteKeys).not.toContain('sodiumMg');
  });

  it('reports null when no item has a value for an optional nutrient', () => {
    const { nutrients: total, incompleteKeys } = sumNutrients([
      nutrients({ sugarG: null }),
      nutrients({ sugarG: null }),
    ]);
    expect(total.sugarG).toBeNull();
    expect(incompleteKeys).toContain('sugarG');
  });

  it('does not mutate its inputs', () => {
    const a = nutrients({ caloriesKcal: 10, fiberG: 1 });
    const snapshot = { ...a };
    sumNutrients([a, nutrients({ caloriesKcal: 5 })]);
    expect(a).toEqual(snapshot);
  });
});

describe('caloriesFromMacros', () => {
  it('uses 4/4/9 kcal per gram', () => {
    const value = caloriesFromMacros(nutrients({ proteinG: 10, carbsG: 20, fatG: 5 }));
    expect(value).toBe(
      10 * KCAL_PER_GRAM.protein + 20 * KCAL_PER_GRAM.carbs + 5 * KCAL_PER_GRAM.fat,
    );
    expect(value).toBe(165);
  });
});

describe('checkMacroConsistency', () => {
  it('accepts a self-consistent estimate', () => {
    const result = checkMacroConsistency(
      nutrients({ caloriesKcal: 165, proteinG: 10, carbsG: 20, fatG: 5 }),
    );
    expect(result.relativeDifference).toBeCloseTo(0, 10);
    expect(result.isInconsistent).toBe(false);
  });

  it('tolerates small gaps from fibre and rounding', () => {
    const result = checkMacroConsistency(
      nutrients({ caloriesKcal: 180, proteinG: 10, carbsG: 20, fatG: 5 }),
    );
    expect(result.isInconsistent).toBe(false);
  });

  it('flags calories that cannot come from the stated macros', () => {
    const result = checkMacroConsistency(
      nutrients({ caloriesKcal: 900, proteinG: 10, carbsG: 20, fatG: 5 }),
    );
    expect(result.impliedKcal).toBe(165);
    expect(result.isInconsistent).toBe(true);
    expect(result.relativeDifference).toBeGreaterThan(0.25);
  });

  it('flags macros that imply far more calories than stated', () => {
    const result = checkMacroConsistency(
      nutrients({ caloriesKcal: 100, proteinG: 30, carbsG: 40, fatG: 20 }),
    );
    expect(result.isInconsistent).toBe(true);
  });

  it('does not flag an all-zero item', () => {
    expect(checkMacroConsistency(EMPTY_NUTRIENTS).isInconsistent).toBe(false);
  });

  it('respects a custom tolerance', () => {
    const value = nutrients({ caloriesKcal: 200, proteinG: 10, carbsG: 20, fatG: 5 });
    expect(checkMacroConsistency(value, 0.25).isInconsistent).toBe(false);
    expect(checkMacroConsistency(value, 0.1).isInconsistent).toBe(true);
  });
});

describe('macroSplit', () => {
  it('splits calories by macro contribution', () => {
    const split = macroSplit(nutrients({ proteinG: 10, carbsG: 10, fatG: 10 }));
    // 40 / 40 / 90 kcal out of 170.
    expect(split.proteinShare).toBeCloseTo(40 / 170, 10);
    expect(split.carbsShare).toBeCloseTo(40 / 170, 10);
    expect(split.fatShare).toBeCloseTo(90 / 170, 10);
    expect(split.proteinShare + split.carbsShare + split.fatShare).toBeCloseTo(1, 10);
    expect(split.hasData).toBe(true);
  });

  it('reports no data when every macro is zero', () => {
    const split = macroSplit(EMPTY_NUTRIENTS);
    expect(split.hasData).toBe(false);
    expect(split.proteinShare).toBe(0);
  });
});

describe('roundNutrientsForDisplay', () => {
  it('rounds calories and sodium to whole numbers and macros to 0.1 g', () => {
    const result = roundNutrientsForDisplay(
      nutrients({
        caloriesKcal: 180.4,
        proteinG: 33.749,
        carbsG: 0.04,
        fatG: 3.95,
        sodiumMg: 67.5,
        fiberG: 2.349,
      }),
    );
    expect(result.caloriesKcal).toBe(180);
    expect(result.proteinG).toBe(33.7);
    expect(result.carbsG).toBe(0);
    expect(result.fatG).toBe(4);
    expect(result.sodiumMg).toBe(68);
    expect(result.fiberG).toBe(2.3);
  });

  it('keeps unknown optional nutrients unknown', () => {
    const result = roundNutrientsForDisplay(nutrients({ fiberG: null, sodiumMg: null }));
    expect(result.fiberG).toBeNull();
    expect(result.sodiumMg).toBeNull();
  });
});
