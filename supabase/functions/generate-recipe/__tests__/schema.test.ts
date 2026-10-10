import { LIMITS, validateGeneratedRecipe } from '../schema';

const MODEL = 'claude-opus-5-5';

function response(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Chicken biryani',
    description: 'A fragrant layered rice dish.',
    cuisine: 'bangladeshi',
    servings: 4,
    prepMinutes: 25,
    cookMinutes: 45,
    equipment: ['Large heavy pot'],
    ingredients: [
      {
        id: 'rice',
        name: 'Basmati rice',
        quantity: 400,
        unit: 'g',
        preparation: 'rinsed',
        scalesWithServings: true,
      },
      { id: 'salt', name: 'Salt', quantity: null, unit: 'to_taste', scalesWithServings: true },
    ],
    steps: [
      { instruction: 'Rinse the rice.', durationMinutes: 3, temperatureC: null, ingredientIds: ['rice'] },
      { instruction: 'Simmer until tender.', durationMinutes: 20, temperatureC: null, ingredientIds: ['rice', 'salt'] },
    ],
    tips: ['Soak the rice first.'],
    nutritionPerServing: { caloriesKcal: 620, proteinG: 34, carbsG: 72, fatG: 21 },
    caveats: ['The amount of ghee varies between cooks.'],
    ...overrides,
  };
}

describe('rejecting unusable responses', () => {
  it('rejects a non-object', () => {
    for (const raw of [null, undefined, 'text', 7, [], true]) {
      expect(validateGeneratedRecipe(raw, MODEL, 4).ok).toBe(false);
    }
  });

  it('rejects a recipe with no title, ingredients or steps', () => {
    expect(validateGeneratedRecipe(response({ title: ' ' }), MODEL, 4).ok).toBe(false);
    expect(validateGeneratedRecipe(response({ ingredients: [] }), MODEL, 4).ok).toBe(false);
    expect(validateGeneratedRecipe(response({ steps: [] }), MODEL, 4).ok).toBe(false);
  });

  it('names the reason, for the function logs', () => {
    const result = validateGeneratedRecipe(response({ ingredients: [] }), MODEL, 4);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('ingredients');
  });
});

describe('ingredients', () => {
  it('reads a complete ingredient', () => {
    const result = validateGeneratedRecipe(response(), MODEL, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rice = result.recipe.ingredients[0];
    expect(rice?.name).toBe('Basmati rice');
    expect(rice?.quantity).toBe(400);
    expect(rice?.unit).toBe('g');
    expect(rice?.preparation).toBe('rinsed');
  });

  it('strips the quantity from a to_taste ingredient', () => {
    const result = validateGeneratedRecipe(
      response({
        ingredients: [{ id: 's', name: 'Salt', quantity: 7, unit: 'to_taste' }],
        steps: [{ instruction: 'Season.', ingredientIds: ['s'] }],
      }),
      MODEL,
      4,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.ingredients[0]?.quantity).toBeNull();
  });

  it('drops an invented unit rather than keeping it', () => {
    const result = validateGeneratedRecipe(
      response({
        ingredients: [{ id: 'r', name: 'Rice', quantity: 2, unit: 'scoops' }],
        steps: [{ instruction: 'Cook.', ingredientIds: [] }],
      }),
      MODEL,
      4,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.ingredients[0]?.unit).toBeNull();
  });

  it('rejects a non-positive or absurd quantity', () => {
    for (const quantity of [0, -3, LIMITS.quantity + 1, 'lots']) {
      const result = validateGeneratedRecipe(
        response({
          ingredients: [{ id: 'r', name: 'Rice', quantity, unit: 'g' }],
          steps: [{ instruction: 'Cook.', ingredientIds: [] }],
        }),
        MODEL,
        4,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.recipe.ingredients[0]?.quantity).toBeNull();
    }
  });

  it('assigns an id when one is missing, since steps reference ids', () => {
    const result = validateGeneratedRecipe(
      response({
        ingredients: [{ name: 'Rice', quantity: 400, unit: 'g' }],
        steps: [{ instruction: 'Cook.', ingredientIds: [] }],
      }),
      MODEL,
      4,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.ingredients[0]?.id).toBe('ing-0');
  });

  it('defaults scalesWithServings to true', () => {
    const result = validateGeneratedRecipe(
      response({
        ingredients: [{ id: 'r', name: 'Rice', quantity: 400, unit: 'g' }],
        steps: [{ instruction: 'Cook.', ingredientIds: [] }],
      }),
      MODEL,
      4,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.ingredients[0]?.scalesWithServings).toBe(true);
  });

  it('honours an explicit opt-out, for oil that depends on the pan', () => {
    const result = validateGeneratedRecipe(
      response({
        ingredients: [
          { id: 'o', name: 'Oil for frying', quantity: 500, unit: 'ml', scalesWithServings: false },
        ],
        steps: [{ instruction: 'Heat the oil.', ingredientIds: ['o'] }],
      }),
      MODEL,
      4,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.ingredients[0]?.scalesWithServings).toBe(false);
  });
});

describe('steps', () => {
  it('numbers steps from position, ignoring any numbering in the response', () => {
    const result = validateGeneratedRecipe(
      response({
        steps: [
          { instruction: 'First.', number: 9, ingredientIds: [] },
          { instruction: 'Second.', number: 1, ingredientIds: [] },
        ],
      }),
      MODEL,
      4,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.steps.map((step) => step.number)).toEqual([1, 2]);
  });

  it('leaves no gap when a bad step is dropped', () => {
    const result = validateGeneratedRecipe(
      response({
        steps: [
          { instruction: 'First.', ingredientIds: [] },
          { instruction: '  ', ingredientIds: [] },
          { instruction: 'Third.', ingredientIds: [] },
        ],
      }),
      MODEL,
      4,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.steps.map((step) => step.number)).toEqual([1, 2]);
    expect(result.recipe.steps[1]?.instruction).toBe('Third.');
  });

  it('drops a reference to an ingredient that is not in the list', () => {
    const result = validateGeneratedRecipe(
      response({
        steps: [{ instruction: 'Cook.', ingredientIds: ['rice', 'ghost'] }],
      }),
      MODEL,
      4,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.steps[0]?.ingredientIds).toEqual(['rice']);
  });

  it('rejects an impossible temperature', () => {
    for (const temperatureC of [-20, 9000, 180.5, 'hot']) {
      const result = validateGeneratedRecipe(
        response({ steps: [{ instruction: 'Bake.', temperatureC, ingredientIds: [] }] }),
        MODEL,
        4,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.recipe.steps[0]?.temperatureC).toBeNull();
    }
  });

  it('keeps a sensible temperature and duration', () => {
    const result = validateGeneratedRecipe(
      response({
        steps: [{ instruction: 'Bake.', temperatureC: 180, durationMinutes: 40, ingredientIds: [] }],
      }),
      MODEL,
      4,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.steps[0]?.temperatureC).toBe(180);
    expect(result.recipe.steps[0]?.durationMinutes).toBe(40);
  });
});

describe('nutrition', () => {
  it('keeps a complete set', () => {
    const result = validateGeneratedRecipe(response(), MODEL, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.nutritionPerServing?.caloriesKcal).toBe(620);
  });

  it('requires all four macros or none', () => {
    for (const key of ['caloriesKcal', 'proteinG', 'carbsG', 'fatG']) {
      const partial: Record<string, unknown> = {
        caloriesKcal: 620,
        proteinG: 34,
        carbsG: 72,
        fatG: 21,
      };
      delete partial[key];
      const result = validateGeneratedRecipe(
        response({ nutritionPerServing: partial }),
        MODEL,
        4,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.recipe.nutritionPerServing).toBeNull();
    }
  });

  it('accepts a null estimate, which is the honest answer for some dishes', () => {
    const result = validateGeneratedRecipe(
      response({ nutritionPerServing: null }),
      MODEL,
      4,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.nutritionPerServing).toBeNull();
  });

  it('rejects absurd figures', () => {
    const result = validateGeneratedRecipe(
      response({
        nutritionPerServing: { caloriesKcal: 500_000, proteinG: 34, carbsG: 72, fatG: 21 },
      }),
      MODEL,
      4,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.nutritionPerServing).toBeNull();
  });
});

describe('servings and metadata', () => {
  it('keeps a valid serving count', () => {
    const result = validateGeneratedRecipe(response({ servings: 6 }), MODEL, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.servings).toBe(6);
  });

  it('falls back to the requested count when the response gives a bad one', () => {
    for (const servings of [undefined, 0, -1, 500, 'four', 4.5]) {
      const result = validateGeneratedRecipe(response({ servings }), MODEL, 4);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.recipe.servings).toBe(4);
    }
  });

  it('drops an unknown cuisine', () => {
    const result = validateGeneratedRecipe(response({ cuisine: 'martian' }), MODEL, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.cuisine).toBeNull();
  });

  it('labels the recipe with the model that wrote it', () => {
    const result = validateGeneratedRecipe(response(), MODEL, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.providerLabel).toBe(MODEL);
  });

  it('carries the caveats through, because they state what is uncertain', () => {
    const result = validateGeneratedRecipe(response(), MODEL, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.caveats[0]).toContain('ghee');
  });

  it('caps long lists and truncates long strings', () => {
    const result = validateGeneratedRecipe(
      response({
        title: 'x'.repeat(600),
        tips: Array.from({ length: 80 }, (_u, i) => `tip ${i}`),
        equipment: Array.from({ length: 80 }, (_u, i) => `kit ${i}`),
      }),
      MODEL,
      4,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.title).toHaveLength(LIMITS.title);
    expect(result.recipe.tips).toHaveLength(LIMITS.tips);
    expect(result.recipe.equipment).toHaveLength(LIMITS.equipment);
  });
});
