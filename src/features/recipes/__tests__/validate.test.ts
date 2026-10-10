import { RECIPE_LIMITS, toCuisineId, validateRecipe } from '../validate';

const OPTIONS = {
  nutritionSource: 'ai_estimate' as const,
  providerLabel: 'claude-opus-5-5',
  requestedServings: 4,
};

function response(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Chicken biryani',
    description: 'A fragrant layered rice dish.',
    cuisine: 'bangladeshi',
    servings: 4,
    prepMinutes: 25,
    cookMinutes: 45,
    equipment: ['Large heavy pot', 'Sieve'],
    ingredients: [
      {
        id: 'rice',
        name: 'Basmati rice',
        quantity: 400,
        unit: 'g',
        preparation: 'rinsed and soaked 30 minutes',
      },
      { id: 'salt', name: 'Salt', quantity: null, unit: 'to_taste' },
    ],
    steps: [
      { instruction: 'Rinse the rice until the water runs clear.', ingredientIds: ['rice'] },
      {
        instruction: 'Parboil the rice for 5 minutes, then drain.',
        durationMinutes: 5,
        ingredientIds: ['rice', 'salt'],
      },
    ],
    tips: ['Soaking the rice keeps the grains separate.'],
    tags: ['rice', 'one pot'],
    nutritionPerServing: { caloriesKcal: 620, proteinG: 34, carbsG: 72, fatG: 21 },
    caveats: ['The amount of ghee varies a lot between cooks.'],
    ...overrides,
  };
}

describe('toCuisineId', () => {
  it('accepts a known cuisine', () => {
    expect(toCuisineId('bangladeshi')).toBe('bangladeshi');
    expect(toCuisineId('italian')).toBe('italian');
    expect(toCuisineId('other')).toBe('other');
  });

  it('rejects anything unknown rather than guessing', () => {
    for (const value of ['Bangladeshi', 'martian', '', null, 7]) {
      expect(toCuisineId(value)).toBeNull();
    }
  });
});

describe('rejecting unusable responses', () => {
  it('rejects a non-object', () => {
    for (const raw of [null, undefined, 'text', 7, [], true]) {
      expect(validateRecipe(raw, OPTIONS).ok).toBe(false);
    }
  });

  it('rejects a recipe with no name', () => {
    const result = validateRecipe(response({ title: '  ' }), OPTIONS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('without a name');
  });

  it('rejects a recipe with no usable ingredients', () => {
    for (const ingredients of [[], [null, 'rice', { noName: true }, { name: '' }]]) {
      const result = validateRecipe(response({ ingredients }), OPTIONS);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.message).toContain('no ingredients');
    }
  });

  it('rejects a recipe with no usable steps', () => {
    for (const steps of [[], [null, { instruction: '   ' }]]) {
      const result = validateRecipe(response({ steps }), OPTIONS);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.message).toContain('no cooking steps');
    }
  });
});

describe('ingredients', () => {
  it('reads a complete ingredient', () => {
    const result = validateRecipe(response(), OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rice = result.value.ingredients[0];
    expect(rice?.name).toBe('Basmati rice');
    expect(rice?.quantity).toBe(400);
    expect(rice?.unit).toBe('g');
    expect(rice?.preparation).toBe('rinsed and soaked 30 minutes');
  });

  it('assigns an id when the response omits one, because steps reference ids', () => {
    const result = validateRecipe(
      response({
        ingredients: [{ name: 'Onion', quantity: 2, unit: 'piece' }],
        steps: [{ instruction: 'Chop the onion.' }],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ingredients[0]?.id).toBe('ing-0');
  });

  it('drops an unknown unit rather than inventing one', () => {
    const result = validateRecipe(
      response({
        ingredients: [{ name: 'Rice', quantity: 2, unit: 'scoops' }],
        steps: [{ instruction: 'Cook it.' }],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ingredients[0]?.unit).toBeNull();
    expect(result.value.ingredients[0]?.quantity).toBe(2);
  });

  it('strips the quantity from a to_taste ingredient', () => {
    const result = validateRecipe(
      response({
        ingredients: [{ name: 'Salt', quantity: 5, unit: 'to_taste' }],
        steps: [{ instruction: 'Season.' }],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ingredients[0]?.quantity).toBeNull();
  });

  it('rejects a non-positive or absurd quantity', () => {
    for (const quantity of [0, -5, 'abc', RECIPE_LIMITS.quantity + 1]) {
      const result = validateRecipe(
        response({
          ingredients: [{ name: 'Rice', quantity, unit: 'g' }],
          steps: [{ instruction: 'Cook it.' }],
        }),
        OPTIONS,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.ingredients[0]?.quantity).toBeNull();
    }
  });

  it('defaults scalesWithServings to true, so a doubled recipe is not under-fed', () => {
    const result = validateRecipe(response(), OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ingredients[0]?.scalesWithServings).toBe(true);
  });

  it('honours an explicit opt-out from scaling', () => {
    const result = validateRecipe(
      response({
        ingredients: [
          { name: 'Oil for frying', quantity: 500, unit: 'ml', scalesWithServings: false },
        ],
        steps: [{ instruction: 'Heat the oil.' }],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ingredients[0]?.scalesWithServings).toBe(false);
  });

  it('never marks an ingredient as already owned', () => {
    // The user ticks this themselves. Inferring it is how a shopping list
    // ends up missing something they actually needed to buy.
    const result = validateRecipe(
      response({
        ingredients: [{ name: 'Rice', quantity: 400, unit: 'g', isOwned: true }],
        steps: [{ instruction: 'Cook it.' }],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ingredients[0]?.isOwned).toBe(false);
  });

  it('caps the ingredient list', () => {
    const many = Array.from({ length: 200 }, (_unused, i) => ({
      name: `Ingredient ${i}`,
      quantity: 1,
      unit: 'g',
    }));
    const result = validateRecipe(
      response({ ingredients: many, steps: [{ instruction: 'Cook.' }] }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ingredients).toHaveLength(RECIPE_LIMITS.ingredients);
  });
});

describe('steps', () => {
  it('numbers steps from their position, not from the response', () => {
    const result = validateRecipe(
      response({
        steps: [
          { instruction: 'First.', number: 7 },
          { instruction: 'Second.', number: 99 },
        ],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.steps.map((step) => step.number)).toEqual([1, 2]);
  });

  it('leaves no gap in the numbering when a bad step is dropped', () => {
    const result = validateRecipe(
      response({
        steps: [
          { instruction: 'First.' },
          { instruction: '   ' },
          { instruction: 'Third.' },
        ],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.steps.map((step) => step.number)).toEqual([1, 2]);
    expect(result.value.steps[1]?.instruction).toBe('Third.');
  });

  it('drops a reference to an ingredient that is not in the list', () => {
    const result = validateRecipe(
      response({
        steps: [{ instruction: 'Cook.', ingredientIds: ['rice', 'does-not-exist'] }],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.steps[0]?.ingredientIds).toEqual(['rice']);
  });

  it('reads a step duration and temperature', () => {
    const result = validateRecipe(
      response({
        steps: [{ instruction: 'Bake.', durationMinutes: 30, temperatureC: 180 }],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.steps[0]?.durationMinutes).toBe(30);
    expect(result.value.steps[0]?.temperatureC).toBe(180);
  });

  it('rejects an impossible oven temperature', () => {
    for (const temperatureC of [-10, 5000, 'hot']) {
      const result = validateRecipe(
        response({ steps: [{ instruction: 'Bake.', temperatureC }] }),
        OPTIONS,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.steps[0]?.temperatureC).toBeNull();
    }
  });
});

describe('nutrition', () => {
  it('records the provenance given by the caller, not by the response', () => {
    const result = validateRecipe(
      response({
        // A response claiming a verified source must not be believed.
        nutritionPerServing: {
          caloriesKcal: 620,
          proteinG: 34,
          carbsG: 72,
          fatG: 21,
          source: 'database',
          providerLabel: 'USDA FoodData Central',
        },
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nutritionPerServing?.source).toBe('ai_estimate');
    expect(result.value.nutritionPerServing?.providerLabel).toBe('claude-opus-5-5');
  });

  it('requires all four macros, or none', () => {
    for (const key of ['caloriesKcal', 'proteinG', 'carbsG', 'fatG']) {
      const partial: Record<string, unknown> = {
        caloriesKcal: 620,
        proteinG: 34,
        carbsG: 72,
        fatG: 21,
      };
      delete partial[key];
      const result = validateRecipe(
        response({ nutritionPerServing: partial }),
        OPTIONS,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      // Null, not a partial set: "0g protein" reads as a measurement of zero.
      expect(result.value.nutritionPerServing).toBeNull();
    }
  });

  it('accepts a recipe with no nutrition at all', () => {
    const result = validateRecipe(response({ nutritionPerServing: null }), OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nutritionPerServing).toBeNull();
  });

  it('rejects absurd figures', () => {
    const result = validateRecipe(
      response({
        nutritionPerServing: {
          caloriesKcal: 999_999,
          proteinG: 34,
          carbsG: 72,
          fatG: 21,
        },
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nutritionPerServing).toBeNull();
  });
});

describe('servings and metadata', () => {
  it('keeps a valid serving count', () => {
    const result = validateRecipe(response({ servings: 6 }), OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.servings).toBe(6);
  });

  it('falls back to the requested count when the response omits one', () => {
    for (const servings of [undefined, 0, -2, 'four', 1000]) {
      const result = validateRecipe(response({ servings }), OPTIONS);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.servings).toBe(4);
    }
  });

  it('keeps a known cuisine and drops an unknown one', () => {
    const known = validateRecipe(response({ cuisine: 'italian' }), OPTIONS);
    if (known.ok) expect(known.value.cuisine).toBe('italian');

    const unknown = validateRecipe(response({ cuisine: 'martian' }), OPTIONS);
    if (unknown.ok) expect(unknown.value.cuisine).toBeNull();
  });

  it('truncates an over-long title and description', () => {
    const result = validateRecipe(
      response({ title: 'x'.repeat(500), description: 'y'.repeat(5000) }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toHaveLength(RECIPE_LIMITS.titleLength);
    expect(result.value.description).toHaveLength(RECIPE_LIMITS.descriptionLength);
  });

  it('keeps usable tips and equipment, discarding junk entries', () => {
    const result = validateRecipe(
      response({
        tips: ['Good tip', '', null, 5, '   ', 'Another tip'],
        equipment: ['Pot', '', 'Oven'],
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tips).toEqual(['Good tip', 'Another tip']);
    expect(result.value.equipment).toEqual(['Pot', 'Oven']);
  });

  it('carries the caveats through, since they explain what is uncertain', () => {
    const result = validateRecipe(response(), OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.caveats).toHaveLength(1);
    expect(result.value.caveats[0]).toContain('ghee');
  });
});
