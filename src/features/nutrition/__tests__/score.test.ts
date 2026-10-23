import { EMPTY_NUTRIENTS, type Nutrients } from '@/types/domain';

import { describeNutrients, scoreDay, scoreNutrients } from '../score';

function nutrients(partial: Partial<Nutrients>): Nutrients {
  return { ...EMPTY_NUTRIENTS, ...partial };
}

/** Chicken breast: a lot of protein, almost nothing else. */
const LEAN_PROTEIN = nutrients({
  caloriesKcal: 165,
  proteinG: 31,
  carbsG: 0,
  fatG: 3.6,
  fiberG: 0,
  sugarG: 0,
  saturatedFatG: 1,
  sodiumMg: 74,
});

/** A can of cola: energy and sugar, nothing else at all. */
const SUGAR = nutrients({
  caloriesKcal: 139,
  proteinG: 0,
  carbsG: 35,
  fatG: 0,
  fiberG: 0,
  sugarG: 35,
  saturatedFatG: 0,
  sodiumMg: 15,
});

/**
 * The score is the one thing in this app that passes judgement on somebody's
 * food, so what it is built from has to be checkable. These pin the
 * properties the screens rely on - that it reads density rather than size,
 * that it is honest about what it does not know, and that the words beside
 * it never contradict the number.
 */
describe('scoring a food', () => {
  /*
    Asserted as bands rather than as exact figures: the band is what the
    screens print, and pinning the decimal would make every future
    adjustment to a threshold look like a regression.

    Lean protein lands in "good" rather than "excellent" because it carries
    no fibre, and fibre is one of the five things the score is built from.
    That is the intended reading, not a miss: whole foods that bring both -
    lentils, a bean stew - are what the top of the scale is for.
  */
  it('rates a lean protein well and a sugary drink badly', () => {
    expect(scoreNutrients(LEAN_PROTEIN).band).toBe('good');
    expect(scoreNutrients(SUGAR).band).toBe('poor');
    expect(scoreNutrients(LEAN_PROTEIN).value).toBeGreaterThan(
      scoreNutrients(SUGAR).value ?? 0,
    );
  });

  /*
    The portion is the calorie figure's job. A score that fell as you ate
    more of the same food would just be the calorie count a second time.
  */
  it('scores a portion the same however large it is', () => {
    const doubled = nutrients({
      caloriesKcal: LEAN_PROTEIN.caloriesKcal * 2,
      proteinG: LEAN_PROTEIN.proteinG * 2,
      carbsG: 0,
      fatG: LEAN_PROTEIN.fatG * 2,
      fiberG: 0,
      sugarG: 0,
      saturatedFatG: (LEAN_PROTEIN.saturatedFatG ?? 0) * 2,
      sodiumMg: (LEAN_PROTEIN.sodiumMg ?? 0) * 2,
    });

    expect(scoreNutrients(doubled).value).toBe(scoreNutrients(LEAN_PROTEIN).value);
  });

  /*
    A food whose fibre, sugar, saturated fat and sodium were never recorded
    can still be scored on protein - but the screens have to be able to
    hedge it, so the share of known inputs comes back rather than being
    quietly folded in.
  */
  it('reports how much of the score rests on figures it actually has', () => {
    const sparse = nutrients({ caloriesKcal: 200, proteinG: 10 });
    expect(scoreNutrients(sparse).known).toBeCloseTo(0.2);
    expect(scoreNutrients(LEAN_PROTEIN).known).toBe(1);
  });

  // A score of 5.0 meaning "no idea" is worse than no score at all.
  it('refuses to score something with too little energy to judge', () => {
    const score = scoreNutrients(nutrients({ caloriesKcal: 4 }));
    expect(score.value).toBeNull();
    expect(score.band).toBe('unknown');
  });

  it('never leaves the 0 to 10 range, however extreme the food', () => {
    const extreme = nutrients({
      caloriesKcal: 100,
      proteinG: 0,
      carbsG: 25,
      fatG: 0,
      fiberG: 0,
      sugarG: 25,
      saturatedFatG: 10,
      sodiumMg: 4000,
    });
    expect(scoreNutrients(extreme).value).toBeGreaterThanOrEqual(0);
    expect(scoreNutrients(extreme).value).toBeLessThanOrEqual(10);
  });
});

describe('describing a food', () => {
  it('says what the score is made of, in the same direction as the number', () => {
    const good = describeNutrients(LEAN_PROTEIN);
    expect(good.some((c) => c.good && /protein/i.test(c.text))).toBe(true);

    const bad = describeNutrients(SUGAR);
    expect(bad.some((c) => !c.good && /sugar/i.test(c.text))).toBe(true);
    // And nothing claiming the cola is high in protein.
    expect(bad.some((c) => c.good && /protein/i.test(c.text))).toBe(false);
  });

  /*
    Nothing is said about a nutrient the record does not carry. Silence is
    the honest answer; "low in fibre" about a food whose fibre was never
    measured is a claim the app cannot support.
  */
  it('says nothing about a nutrient that was never recorded', () => {
    const sparse = nutrients({ caloriesKcal: 200, proteinG: 10 });
    expect(describeNutrients(sparse).some((c) => /fibre|sugar|salt/i.test(c.text))).toBe(
      false,
    );
  });
});

describe('scoring a day', () => {
  const entry = (n: Nutrients) => ({
    items: [
      {
        id: 'i',
        name: 'x',
        brand: null,
        portion: { quantity: 100, unit: 'g' as const },
        gramsResolved: 100,
        nutrients: n,
        provenance: {
          source: 'database' as const,
          confidence: 'high' as const,
          providerLabel: null,
          providerRef: null,
        },
        foodRecordId: null,
        notes: null,
      },
    ],
  });

  /*
    Weighted by energy. A 40 kcal apple should not move a 2,000 kcal day as
    far as dinner does, which a plain average would let it do.
  */
  it('weights each meal by the energy it carried', () => {
    const bigAndBad = entry(
      nutrients({ caloriesKcal: 1390, proteinG: 0, carbsG: 350, fatG: 0, sugarG: 350 }),
    );
    const smallAndGood = entry(LEAN_PROTEIN);

    const day = scoreDay([bigAndBad, smallAndGood]);
    const plainAverage =
      ((scoreNutrients(bigAndBad.items[0]!.nutrients).value ?? 0) +
        (scoreNutrients(LEAN_PROTEIN).value ?? 0)) /
      2;

    expect(day.value).toBeLessThan(plainAverage);
  });

  // Zero would read as a bad day rather than an empty one.
  it('has no score for a day with nothing logged', () => {
    expect(scoreDay([]).value).toBeNull();
  });
});
