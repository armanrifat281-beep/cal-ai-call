import type { Recipe, RecipeIngredient, RecipeStep } from '@/types/recipe';

import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  batchNutrition,
  checkRecipeConsistency,
  clampServings,
  describeConsistencyIssue,
  scaleFactor,
  scaleIngredient,
  scaleRecipe,
} from '../scaling';

function ingredient(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return {
    id: 'ing-1',
    name: 'Basmati rice',
    quantity: 300,
    unit: 'g',
    preparation: 'rinsed',
    group: null,
    substitution: null,
    scalesWithServings: true,
    isOwned: false,
    ...overrides,
  };
}

function step(overrides: Partial<RecipeStep> = {}): RecipeStep {
  return {
    number: 1,
    instruction: 'Rinse the rice until the water runs clear.',
    durationMinutes: 3,
    temperatureC: null,
    ingredientIds: ['ing-1'],
    ...overrides,
  };
}

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    userId: 'user-1',
    title: 'Chicken biryani',
    description: null,
    cuisine: 'bangladeshi',
    cuisineNote: null,
    origin: 'ai_generated',
    servings: 4,
    prepMinutes: 25,
    cookMinutes: 45,
    equipment: ['Large pot'],
    ingredients: [ingredient()],
    steps: [step()],
    tips: [],
    tags: [],
    nutritionPerServing: {
      caloriesKcal: 620,
      proteinG: 34,
      carbsG: 72,
      fatG: 21,
      source: 'ai_estimate',
      providerLabel: 'claude-opus-5-5',
    },
    image: null,
    isFavorite: false,
    rejectedAt: null,
    lastCookedAt: null,
    cookCount: 0,
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('clampServings', () => {
  it('keeps a sensible value', () => {
    expect(clampServings(4)).toBe(4);
  });

  it('clamps to the offered range', () => {
    expect(clampServings(0)).toBe(MIN_SERVINGS);
    expect(clampServings(-3)).toBe(MIN_SERVINGS);
    expect(clampServings(1000)).toBe(MAX_SERVINGS);
  });

  it('rounds a fractional count', () => {
    expect(clampServings(4.4)).toBe(4);
    expect(clampServings(4.6)).toBe(5);
  });

  it('falls back to the minimum for nonsense, not the maximum', () => {
    // An unreadable value is a bug. Producing a 1-serving recipe from one is
    // a smaller mistake than producing a 24-serving shopping list.
    expect(clampServings(Number.NaN)).toBe(MIN_SERVINGS);
    expect(clampServings(Number.POSITIVE_INFINITY)).toBe(MIN_SERVINGS);
    expect(clampServings(Number.NEGATIVE_INFINITY)).toBe(MIN_SERVINGS);
  });
});

describe('scaleFactor', () => {
  it('is the ratio of target to base', () => {
    expect(scaleFactor(4, 8)).toBe(2);
    expect(scaleFactor(4, 2)).toBe(0.5);
    expect(scaleFactor(4, 4)).toBe(1);
    expect(scaleFactor(3, 4)).toBeCloseTo(4 / 3, 10);
  });

  it('returns 1 rather than Infinity for a zero or invalid base', () => {
    expect(scaleFactor(0, 4)).toBe(1);
    expect(scaleFactor(-2, 4)).toBe(1);
    expect(scaleFactor(Number.NaN, 4)).toBe(1);
    expect(scaleFactor(4, 0)).toBe(1);
  });
});

describe('scaleIngredient', () => {
  it('scales a normal quantity', () => {
    const scaled = scaleIngredient(ingredient({ quantity: 300 }), 2);
    expect(scaled.scaledQuantity).toBe(600);
    expect(scaled.displayAmount).toBe('600g');
    expect(scaled.wasHeldFixed).toBe(false);
  });

  it('leaves an ingredient alone when it does not scale with servings', () => {
    // Oil for frying depends on the pan, not on how many people eat.
    const scaled = scaleIngredient(
      ingredient({ name: 'Oil for frying', quantity: 500, unit: 'ml', scalesWithServings: false }),
      3,
    );
    expect(scaled.scaledQuantity).toBe(500);
    expect(scaled.wasHeldFixed).toBe(true);
  });

  it('leaves a to_taste ingredient with no number', () => {
    const scaled = scaleIngredient(
      ingredient({ name: 'Salt', quantity: null, unit: 'to_taste' }),
      4,
    );
    expect(scaled.scaledQuantity).toBeNull();
    expect(scaled.displayAmount).toBe('to taste');
  });

  it('formats a scaled cup measurement as a fraction', () => {
    const scaled = scaleIngredient(
      ingredient({ name: 'Flour', quantity: 1, unit: 'cup' }),
      4 / 3,
    );
    expect(scaled.displayAmount).toBe('1 1/3 cups');
  });

  it('does not mutate the ingredient it was given', () => {
    const original = ingredient({ quantity: 300 });
    const snapshot = { ...original };
    scaleIngredient(original, 2);
    expect(original).toEqual(snapshot);
  });
});

describe('scaleRecipe', () => {
  it('scales ingredients to the target serving count', () => {
    const scaled = scaleRecipe(recipe(), 8);
    expect(scaled.servings).toBe(8);
    expect(scaled.factor).toBe(2);
    expect(scaled.ingredients[0]?.scaledQuantity).toBe(600);
  });

  it('does NOT scale nutrition: those figures are per serving', () => {
    // This is the easiest way to mislead someone, so it is asserted directly.
    const scaled = scaleRecipe(recipe(), 8);
    expect(scaled.nutritionPerServing?.caloriesKcal).toBe(620);
    expect(scaled.nutritionPerServing).toEqual(recipe().nutritionPerServing);
  });

  it('is the identity at the recipe own serving count', () => {
    const base = recipe();
    const scaled = scaleRecipe(base, base.servings);
    expect(scaled.factor).toBe(1);
    expect(scaled.ingredients[0]?.scaledQuantity).toBe(base.ingredients[0]?.quantity);
  });

  it('is always derived from the stored recipe, so rounding cannot compound', () => {
    const base = recipe();
    // Scaling up then asking for the original count must return the original
    // amount exactly, not an amount that drifted through a rounded step.
    const up = scaleRecipe(base, 24);
    expect(up.ingredients[0]?.scaledQuantity).toBe(1800);

    const backDown = scaleRecipe(base, 4);
    expect(backDown.ingredients[0]?.scaledQuantity).toBe(300);
  });

  it('clamps an out-of-range request', () => {
    expect(scaleRecipe(recipe(), 0).servings).toBe(MIN_SERVINGS);
    expect(scaleRecipe(recipe(), 9999).servings).toBe(MAX_SERVINGS);
  });

  it('reports when an ingredient was held fixed, so the UI can explain it', () => {
    const withFixed = recipe({
      ingredients: [
        ingredient(),
        ingredient({ id: 'ing-2', name: 'Oil for frying', scalesWithServings: false }),
      ],
    });
    expect(scaleRecipe(withFixed, 8).hasHeldIngredients).toBe(true);
    expect(scaleRecipe(recipe(), 8).hasHeldIngredients).toBe(false);
  });

  it('handles a recipe with no nutrition at all', () => {
    const scaled = scaleRecipe(recipe({ nutritionPerServing: null }), 6);
    expect(scaled.nutritionPerServing).toBeNull();
  });
});

describe('batchNutrition', () => {
  it('multiplies per-serving figures by the serving count', () => {
    const total = batchNutrition(recipe().nutritionPerServing, 4);
    expect(total?.caloriesKcal).toBe(2480);
    expect(total?.proteinG).toBe(136);
  });

  it('keeps the provenance of the per-serving figures', () => {
    const total = batchNutrition(recipe().nutritionPerServing, 2);
    expect(total?.source).toBe('ai_estimate');
    expect(total?.providerLabel).toBe('claude-opus-5-5');
  });

  it('returns null when there is nothing to total', () => {
    expect(batchNutrition(null, 4)).toBeNull();
  });
});

describe('checkRecipeConsistency', () => {
  it('passes a well-formed recipe', () => {
    const report = checkRecipeConsistency(recipe());
    expect(report.isConsistent).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it('flags a unit with no amount', () => {
    const report = checkRecipeConsistency(
      recipe({ ingredients: [ingredient({ quantity: null, unit: 'g' })] }),
    );
    expect(report.issues.map((i) => i.kind)).toContain('missing_quantity');
  });

  it('accepts to_taste with no amount, which is correct', () => {
    const report = checkRecipeConsistency(
      recipe({
        ingredients: [ingredient({ name: 'Salt', quantity: null, unit: 'to_taste' })],
        steps: [step({ ingredientIds: [] })],
      }),
    );
    expect(report.issues.map((i) => i.kind)).not.toContain('missing_quantity');
  });

  it('flags a zero or negative amount', () => {
    for (const quantity of [0, -50]) {
      const report = checkRecipeConsistency(
        recipe({ ingredients: [ingredient({ quantity })] }),
      );
      expect(report.issues.map((i) => i.kind)).toContain('non_positive_quantity');
    }
  });

  it('flags a step referring to an ingredient that does not exist', () => {
    const report = checkRecipeConsistency(
      recipe({ steps: [step({ ingredientIds: ['ing-does-not-exist'] })] }),
    );
    const issue = report.issues.find((i) => i.kind === 'unknown_ingredient_reference');
    expect(issue).toBeDefined();
    if (issue?.kind !== 'unknown_ingredient_reference') return;
    expect(issue.ingredientId).toBe('ing-does-not-exist');
  });

  it('flags steps that are not numbered in order', () => {
    const report = checkRecipeConsistency(
      recipe({
        steps: [step({ number: 1 }), step({ number: 3, ingredientIds: [] })],
      }),
    );
    expect(report.issues.map((i) => i.kind)).toContain('step_numbering');
  });

  it('flags a duplicated ingredient, which makes the checklist ambiguous', () => {
    const report = checkRecipeConsistency(
      recipe({
        ingredients: [
          ingredient({ id: 'a', name: 'Onion' }),
          ingredient({ id: 'b', name: 'onion' }),
        ],
        steps: [step({ ingredientIds: ['a'] })],
      }),
    );
    expect(report.issues.map((i) => i.kind)).toContain('duplicate_ingredient');
  });

  it('flags calories that contradict the stated macros', () => {
    const report = checkRecipeConsistency(
      recipe({
        nutritionPerServing: {
          caloriesKcal: 2000,
          proteinG: 10,
          carbsG: 20,
          fatG: 5,
          source: 'ai_estimate',
          providerLabel: 'test',
        },
      }),
    );
    const issue = report.issues.find((i) => i.kind === 'macro_mismatch');
    expect(issue).toBeDefined();
    if (issue?.kind !== 'macro_mismatch') return;
    expect(Math.round(issue.impliedKcal)).toBe(165);
  });

  it('tolerates the small gap that fibre and rounding produce', () => {
    const report = checkRecipeConsistency(
      recipe({
        nutritionPerServing: {
          caloriesKcal: 700,
          proteinG: 34,
          carbsG: 72,
          fatG: 21,
          source: 'ai_estimate',
          providerLabel: 'test',
        },
      }),
    );
    expect(report.issues.map((i) => i.kind)).not.toContain('macro_mismatch');
  });

  it('does not flag a recipe with no nutrition figures', () => {
    const report = checkRecipeConsistency(recipe({ nutritionPerServing: null }));
    expect(report.isConsistent).toBe(true);
  });

  it('reports several problems at once', () => {
    const report = checkRecipeConsistency(
      recipe({
        ingredients: [ingredient({ quantity: -1 }), ingredient({ id: 'b', quantity: null, unit: 'g' })],
        steps: [step({ number: 2, ingredientIds: ['nope'] })],
      }),
    );
    expect(report.issues.length).toBeGreaterThanOrEqual(3);
    expect(report.isConsistent).toBe(false);
  });
});

describe('describeConsistencyIssue', () => {
  it('writes a readable sentence for every issue kind', () => {
    const issues = [
      { kind: 'missing_quantity' as const, ingredientName: 'Rice' },
      { kind: 'non_positive_quantity' as const, ingredientName: 'Rice' },
      { kind: 'unknown_ingredient_reference' as const, stepNumber: 2, ingredientId: 'x' },
      { kind: 'step_numbering' as const, detail: 'position 2 is numbered 3' },
      { kind: 'duplicate_ingredient' as const, ingredientName: 'Onion' },
      { kind: 'macro_mismatch' as const, impliedKcal: 165, statedKcal: 2000 },
      { kind: 'scaling_not_reversible' as const, ingredientName: 'Rice' },
    ];

    for (const issue of issues) {
      const text = describeConsistencyIssue(issue);
      expect(text.length).toBeGreaterThan(10);
      // Plain language: no field names or enum values leak into the message.
      expect(text).not.toContain('_');
    }
  });
});
