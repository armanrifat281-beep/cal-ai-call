import { LIMITS, validateAnalysis } from '../schema';

const MODEL = 'claude-opus-5-5';

function nutrients(overrides: Record<string, unknown> = {}) {
  return { caloriesKcal: 420, proteinG: 32, carbsG: 18, fatG: 22, ...overrides };
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    foods: [
      {
        name: 'Grilled chicken thigh',
        possibleIngredients: ['chicken', 'oil', 'salt'],
        confidence: 'medium',
        estimatedPortion: { quantity: 1, unit: 'piece' },
        estimatedGrams: 140,
        estimatedNutrients: nutrients(),
      },
    ],
    suggestedMealType: 'dinner',
    suggestedTitle: 'Chicken dinner',
    caveats: ['Cooking oil is not visible in the photo'],
    ...overrides,
  };
}

describe('rejecting unusable responses', () => {
  it('rejects anything that is not an object', () => {
    for (const raw of [null, undefined, 'text', 7, [], true]) {
      const result = validateAnalysis(raw, MODEL, 'lunch');
      expect(result.ok).toBe(false);
    }
  });

  it('rejects a response with no foods, which is how "no food here" arrives', () => {
    const result = validateAnalysis({ foods: [] }, MODEL, 'lunch');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('no identifiable food');
  });

  it('rejects a response whose foods are all unusable', () => {
    const result = validateAnalysis(
      { foods: [null, 'rice', { name: '' }, { name: 'No nutrients' }] },
      MODEL,
      'lunch',
    );
    expect(result.ok).toBe(false);
  });

  it('drops an unusable food but keeps the usable ones', () => {
    const result = validateAnalysis(
      {
        foods: [{ name: 'Mystery', estimatedNutrients: null }, response().foods[0]],
      },
      MODEL,
      'lunch',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.foods).toHaveLength(1);
    expect(result.analysis.foods[0]?.name).toBe('Grilled chicken thigh');
  });
});

describe('value ranges a schema cannot express', () => {
  it('rejects a food whose calories exceed any real portion', () => {
    const result = validateAnalysis(
      { foods: [{ name: 'Apple', estimatedNutrients: nutrients({ caloriesKcal: 50_000 }) }] },
      MODEL,
      'lunch',
    );
    expect(result.ok).toBe(false);
  });

  it('accepts a value right at the limit and rejects just past it', () => {
    const atLimit = validateAnalysis(
      {
        foods: [
          { name: 'Huge', estimatedNutrients: nutrients({ caloriesKcal: LIMITS.caloriesKcal }) },
        ],
      },
      MODEL,
      'lunch',
    );
    expect(atLimit.ok).toBe(true);

    const past = validateAnalysis(
      {
        foods: [
          {
            name: 'Huger',
            estimatedNutrients: nutrients({ caloriesKcal: LIMITS.caloriesKcal + 1 }),
          },
        ],
      },
      MODEL,
      'lunch',
    );
    expect(past.ok).toBe(false);
  });

  it('rejects negative and non-finite nutrient values', () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, 'abc', null]) {
      const result = validateAnalysis(
        { foods: [{ name: 'Food', estimatedNutrients: nutrients({ proteinG: bad }) }] },
        MODEL,
        'lunch',
      );
      expect(result.ok).toBe(false);
    }
  });

  it('requires all four core macros', () => {
    for (const key of ['caloriesKcal', 'proteinG', 'carbsG', 'fatG']) {
      const partial = nutrients();
      delete (partial as Record<string, unknown>)[key];
      const result = validateAnalysis(
        { foods: [{ name: 'Food', estimatedNutrients: partial }] },
        MODEL,
        'lunch',
      );
      expect(result.ok).toBe(false);
    }
  });

  it('accepts numeric strings, because models are inconsistent about types', () => {
    const result = validateAnalysis(
      {
        foods: [
          {
            name: 'Food',
            estimatedNutrients: {
              caloriesKcal: '420',
              proteinG: '32.5',
              carbsG: '18',
              fatG: '22',
            },
          },
        ],
      },
      MODEL,
      'lunch',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.foods[0]?.estimatedNutrients?.caloriesKcal).toBe(420);
    expect(result.analysis.foods[0]?.estimatedNutrients?.proteinG).toBe(32.5);
  });

  it('never invents the optional nutrients it did not ask for', () => {
    const result = validateAnalysis(response(), MODEL, 'lunch');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = result.analysis.foods[0]?.estimatedNutrients;
    expect(parsed?.fiberG).toBeNull();
    expect(parsed?.sugarG).toBeNull();
    expect(parsed?.saturatedFatG).toBeNull();
    expect(parsed?.sodiumMg).toBeNull();
  });
});

describe('confidence', () => {
  it('keeps a valid level', () => {
    for (const level of ['high', 'medium', 'low'] as const) {
      const result = validateAnalysis(
        {
          foods: [{ name: 'Food', confidence: level, estimatedNutrients: nutrients() }],
        },
        MODEL,
        'lunch',
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.analysis.foods[0]?.confidence).toBe(level);
    }
  });

  it('downgrades an unrecognised level to low rather than up to high', () => {
    for (const value of [undefined, null, 'certain', 'HIGH', 1]) {
      const result = validateAnalysis(
        { foods: [{ name: 'Food', confidence: value, estimatedNutrients: nutrients() }] },
        MODEL,
        'lunch',
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.analysis.foods[0]?.confidence).toBe('low');
    }
  });
});

describe('portions', () => {
  it('keeps a valid portion', () => {
    const result = validateAnalysis(response(), MODEL, 'lunch');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.foods[0]?.estimatedPortion).toEqual({
      quantity: 1,
      unit: 'piece',
    });
  });

  it('drops a portion with an invented unit rather than keeping it', () => {
    const result = validateAnalysis(
      {
        foods: [
          {
            name: 'Food',
            estimatedPortion: { quantity: 2, unit: 'handful' },
            estimatedNutrients: nutrients(),
          },
        ],
      },
      MODEL,
      'lunch',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.foods[0]?.estimatedPortion).toBeNull();
  });

  it('drops a non-positive quantity', () => {
    for (const quantity of [0, -5]) {
      const result = validateAnalysis(
        {
          foods: [
            {
              name: 'Food',
              estimatedPortion: { quantity, unit: 'g' },
              estimatedNutrients: nutrients(),
            },
          ],
        },
        MODEL,
        'lunch',
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.analysis.foods[0]?.estimatedPortion).toBeNull();
    }
  });

  it('accepts a null portion, which is the honest answer without a size cue', () => {
    const result = validateAnalysis(
      {
        foods: [
          {
            name: 'Soup',
            estimatedPortion: null,
            estimatedGrams: null,
            estimatedNutrients: nutrients(),
          },
        ],
      },
      MODEL,
      'lunch',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.foods[0]?.estimatedPortion).toBeNull();
    expect(result.analysis.foods[0]?.estimatedGrams).toBeNull();
  });
});

describe('provenance and confirmation', () => {
  it('always requires user confirmation while no verified match exists', () => {
    const result = validateAnalysis(response(), MODEL, 'lunch');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.needsUserConfirmation).toBe(true);
  });

  it('never claims a verified database candidate', () => {
    const result = validateAnalysis(
      {
        foods: [
          {
            name: 'Apple',
            estimatedNutrients: nutrients(),
            // Even if a response invents candidates, none are trusted.
            candidates: [
              { foodRecordId: 'usda:1', name: 'Apple', providerLabel: 'USDA', matchScore: 1 },
            ],
          },
        ],
      },
      MODEL,
      'lunch',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.foods[0]?.candidates).toEqual([]);
  });

  it('labels the response with the model that produced it', () => {
    const result = validateAnalysis(response(), MODEL, 'lunch');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.providerLabel).toBe(MODEL);
  });

  it('never returns a photo path of its own accord', () => {
    const result = validateAnalysis(
      { ...response(), photoPath: 'someone-else/photo.jpg' },
      MODEL,
      'lunch',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Retention is decided by the handler, not by the model's output.
    expect(result.analysis.photoPath).toBeNull();
  });
});

describe('meal type and title', () => {
  it('keeps a valid meal type', () => {
    const result = validateAnalysis(response(), MODEL, 'lunch');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.suggestedMealType).toBe('dinner');
  });

  it('uses the clock-based fallback for a missing or invalid meal type', () => {
    for (const value of [undefined, 'brunch', 3, null]) {
      const result = validateAnalysis(
        response({ suggestedMealType: value }),
        MODEL,
        'breakfast',
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.analysis.suggestedMealType).toBe('breakfast');
    }
  });

  it('falls back to the first food name when no title is usable', () => {
    const result = validateAnalysis(response({ suggestedTitle: '   ' }), MODEL, 'lunch');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.suggestedTitle).toBe('Grilled chicken thigh');
  });

  it('truncates an over-long title instead of passing it through', () => {
    const result = validateAnalysis(
      response({ suggestedTitle: 'x'.repeat(500) }),
      MODEL,
      'lunch',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.suggestedTitle).toHaveLength(120);
  });
});

describe('caveats', () => {
  it('keeps usable caveats and discards junk entries', () => {
    const result = validateAnalysis(
      response({ caveats: ['Sauce unclear', '', null, 5, '  ', 'Oil not visible'] }),
      MODEL,
      'lunch',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.caveats).toEqual(['Sauce unclear', 'Oil not visible']);
  });

  it('caps the number of caveats', () => {
    const many = Array.from({ length: 50 }, (_unused, i) => `caveat ${i}`);
    const result = validateAnalysis(response({ caveats: many }), MODEL, 'lunch');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.caveats).toHaveLength(8);
  });

  it('tolerates caveats being absent or the wrong type', () => {
    for (const value of [undefined, null, 'a string', 42]) {
      const result = validateAnalysis(response({ caveats: value }), MODEL, 'lunch');
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.analysis.caveats).toEqual([]);
    }
  });
});

describe('response size limits', () => {
  it('caps the number of foods', () => {
    const many = Array.from({ length: 50 }, (_unused, i) => ({
      name: `Food ${i}`,
      estimatedNutrients: nutrients(),
    }));
    const result = validateAnalysis({ foods: many }, MODEL, 'lunch');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.foods).toHaveLength(20);
  });

  it('caps the ingredient list per food', () => {
    const many = Array.from({ length: 100 }, (_unused, i) => `ingredient ${i}`);
    const result = validateAnalysis(
      {
        foods: [
          { name: 'Food', possibleIngredients: many, estimatedNutrients: nutrients() },
        ],
      },
      MODEL,
      'lunch',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.foods[0]?.possibleIngredients).toHaveLength(20);
  });
});
