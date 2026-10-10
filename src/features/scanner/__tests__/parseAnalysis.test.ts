import { parseMealAnalysis } from '../parseAnalysis';

const OPTIONS = { fallbackMealType: 'lunch' } as const;

function nutrients(overrides: Record<string, unknown> = {}) {
  return { caloriesKcal: 250, proteinG: 20, carbsG: 10, fatG: 14, ...overrides };
}

function validResponse(overrides: Record<string, unknown> = {}) {
  return {
    foods: [
      {
        name: 'Grilled chicken thigh',
        possibleIngredients: ['chicken', 'olive oil', 'salt'],
        confidence: 'high',
        estimatedPortion: { quantity: 1, unit: 'piece' },
        estimatedGrams: 120,
        estimatedNutrients: nutrients(),
        candidates: [],
      },
    ],
    suggestedMealType: 'dinner',
    suggestedTitle: 'Chicken dinner',
    needsUserConfirmation: false,
    caveats: [],
    providerLabel: 'test-vision-model',
    photoPath: null,
    ...overrides,
  };
}

describe('rejecting unusable responses', () => {
  it('rejects non-objects', () => {
    for (const raw of [null, undefined, 'text', 42, [], true]) {
      const result = parseMealAnalysis(raw, OPTIONS);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe('provider_error');
    }
  });

  it('rejects a response with no foods', () => {
    const result = parseMealAnalysis({ foods: [] }, OPTIONS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('could not identify any food');
    expect(result.error.retryable).toBe(true);
  });

  it('rejects a response whose foods are all malformed', () => {
    const result = parseMealAnalysis(
      { foods: [null, 'rice', { noName: true }, { name: '' }] },
      OPTIONS,
    );
    expect(result.ok).toBe(false);
  });

  it('drops a food that has neither a database match nor usable nutrients', () => {
    const result = parseMealAnalysis(
      {
        foods: [
          { name: 'Mystery sauce', candidates: [], estimatedNutrients: null },
          validResponse().foods[0],
        ],
      },
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.foods).toHaveLength(1);
    expect(result.value.foods[0]?.name).toBe('Grilled chicken thigh');
  });
});

describe('nutrient validation', () => {
  it('requires all four core macros', () => {
    for (const missing of ['caloriesKcal', 'proteinG', 'carbsG', 'fatG']) {
      const incomplete = nutrients();
      delete (incomplete as Record<string, unknown>)[missing];
      const result = parseMealAnalysis(
        { foods: [{ name: 'Food', estimatedNutrients: incomplete, candidates: [] }] },
        OPTIONS,
      );
      expect(result.ok).toBe(false);
    }
  });

  it('accepts numeric strings, because providers are inconsistent', () => {
    const result = parseMealAnalysis(
      {
        foods: [
          {
            name: 'Food',
            estimatedNutrients: {
              caloriesKcal: '250',
              proteinG: '20.5',
              carbsG: '10',
              fatG: '14',
            },
            candidates: [],
          },
        ],
      },
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.foods[0]?.estimatedNutrients?.caloriesKcal).toBe(250);
    expect(result.value.foods[0]?.estimatedNutrients?.proteinG).toBe(20.5);
  });

  it('rejects negative, non-finite and absurd values', () => {
    for (const bad of [-5, Number.NaN, 'abc', null, 99_999_999]) {
      const result = parseMealAnalysis(
        {
          foods: [
            {
              name: 'Food',
              estimatedNutrients: nutrients({ caloriesKcal: bad }),
              candidates: [],
            },
          ],
        },
        OPTIONS,
      );
      expect(result.ok).toBe(false);
    }
  });

  it('keeps missing optional nutrients as null rather than zero', () => {
    const result = parseMealAnalysis(
      { foods: [{ name: 'Food', estimatedNutrients: nutrients(), candidates: [] }] },
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = result.value.foods[0]?.estimatedNutrients;
    expect(parsed?.fiberG).toBeNull();
    expect(parsed?.sodiumMg).toBeNull();
  });
});

describe('confidence handling', () => {
  it('treats an unknown or missing confidence as the lowest, not the highest', () => {
    for (const value of [undefined, null, 'very sure', 'HIGH', 42]) {
      const result = parseMealAnalysis(
        {
          foods: [
            {
              name: 'Food',
              confidence: value,
              estimatedNutrients: nutrients(),
              candidates: [],
            },
          ],
        },
        OPTIONS,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.foods[0]?.confidence).toBe('low');
    }
  });

  it('keeps a valid confidence level', () => {
    const result = parseMealAnalysis(validResponse(), OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.foods[0]?.confidence).toBe('high');
  });
});

describe('needsUserConfirmation', () => {
  it('is forced on when any food is low confidence, whatever the response says', () => {
    const result = parseMealAnalysis(
      validResponse({
        needsUserConfirmation: false,
        foods: [
          {
            name: 'Unclear thing',
            confidence: 'low',
            estimatedNutrients: nutrients(),
            candidates: [],
          },
        ],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.needsUserConfirmation).toBe(true);
  });

  it('is forced on when a food has no database match', () => {
    const result = parseMealAnalysis(validResponse({ needsUserConfirmation: false }), OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The fixture's single food has an empty candidate list.
    expect(result.value.needsUserConfirmation).toBe(true);
  });

  it('can be false when every food is high confidence and matched', () => {
    const result = parseMealAnalysis(
      validResponse({
        needsUserConfirmation: false,
        foods: [
          {
            name: 'Apple',
            confidence: 'high',
            estimatedPortion: { quantity: 1, unit: 'piece' },
            estimatedNutrients: nutrients(),
            candidates: [
              {
                foodRecordId: 'usda:1750340',
                name: 'Apple, raw',
                providerLabel: 'USDA FoodData Central',
                nutrientsPer100g: nutrients({ caloriesKcal: 52 }),
                matchScore: 0.95,
              },
            ],
          },
        ],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.needsUserConfirmation).toBe(false);
  });

  it('respects an explicit true from the server', () => {
    const result = parseMealAnalysis(
      validResponse({
        needsUserConfirmation: true,
        foods: [
          {
            name: 'Apple',
            confidence: 'high',
            estimatedNutrients: nutrients(),
            candidates: [
              {
                foodRecordId: 'usda:1',
                name: 'Apple',
                providerLabel: 'USDA FoodData Central',
                nutrientsPer100g: nutrients(),
                matchScore: 1,
              },
            ],
          },
        ],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.needsUserConfirmation).toBe(true);
  });
});

describe('portions', () => {
  it('accepts a valid portion', () => {
    const result = parseMealAnalysis(validResponse(), OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.foods[0]?.estimatedPortion).toEqual({ quantity: 1, unit: 'piece' });
  });

  it('drops a portion with an unknown unit rather than inventing one', () => {
    const result = parseMealAnalysis(
      validResponse({
        foods: [
          {
            name: 'Food',
            estimatedPortion: { quantity: 2, unit: 'handful' },
            estimatedNutrients: nutrients(),
            candidates: [],
          },
        ],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.foods[0]?.estimatedPortion).toBeNull();
  });

  it('drops a zero or negative quantity', () => {
    for (const quantity of [0, -1]) {
      const result = parseMealAnalysis(
        validResponse({
          foods: [
            {
              name: 'Food',
              estimatedPortion: { quantity, unit: 'g' },
              estimatedNutrients: nutrients(),
              candidates: [],
            },
          ],
        }),
        OPTIONS,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.foods[0]?.estimatedPortion).toBeNull();
    }
  });
});

describe('candidates', () => {
  it('sorts matches best first and drops malformed ones', () => {
    const result = parseMealAnalysis(
      validResponse({
        foods: [
          {
            name: 'Rice',
            estimatedNutrients: nutrients(),
            candidates: [
              {
                foodRecordId: 'usda:2',
                name: 'Rice, brown',
                providerLabel: 'USDA FoodData Central',
                nutrientsPer100g: nutrients(),
                matchScore: 0.4,
              },
              { name: 'broken, no id', nutrientsPer100g: nutrients() },
              {
                foodRecordId: 'usda:1',
                name: 'Rice, white',
                providerLabel: 'USDA FoodData Central',
                nutrientsPer100g: nutrients(),
                matchScore: 0.9,
              },
            ],
          },
        ],
      }),
      OPTIONS,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const candidates = result.value.foods[0]?.candidates ?? [];
    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.name).toBe('Rice, white');
    expect(candidates[1]?.name).toBe('Rice, brown');
  });
});

describe('meal type and title', () => {
  it('keeps a valid meal type', () => {
    const result = parseMealAnalysis(validResponse(), OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.suggestedMealType).toBe('dinner');
  });

  it('falls back to the caller default for a missing or invalid meal type', () => {
    for (const value of [undefined, 'brunch', 7]) {
      const result = parseMealAnalysis(
        validResponse({ suggestedMealType: value }),
        OPTIONS,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.suggestedMealType).toBe('lunch');
    }
  });

  it('falls back to the first food name when no title is given', () => {
    const result = parseMealAnalysis(validResponse({ suggestedTitle: '  ' }), OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.suggestedTitle).toBe('Grilled chicken thigh');
  });
});

describe('text sanitisation', () => {
  it('trims and truncates long strings', () => {
    const result = parseMealAnalysis(
      validResponse({ suggestedTitle: `  ${'x'.repeat(500)}  ` }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.suggestedTitle).toHaveLength(120);
  });

  it('keeps only usable strings in list fields', () => {
    const result = parseMealAnalysis(
      validResponse({
        caveats: ['Sauce unclear', '', null, 42, '   ', 'Portion uncertain'],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.caveats).toEqual(['Sauce unclear', 'Portion uncertain']);
  });

  it('labels the provider, defaulting when it is absent', () => {
    const withLabel = parseMealAnalysis(validResponse(), OPTIONS);
    expect(withLabel.ok).toBe(true);
    if (withLabel.ok) expect(withLabel.value.providerLabel).toBe('test-vision-model');

    const without = parseMealAnalysis(validResponse({ providerLabel: null }), OPTIONS);
    expect(without.ok).toBe(true);
    if (without.ok) expect(without.value.providerLabel).toBe('AI vision model');
  });
});
