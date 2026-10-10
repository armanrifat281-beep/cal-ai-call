import type { RecipeRequest } from '@/types/recipe';

import { DEMO_RECIPE_COUNT, pickDemoRecipe } from '../demoRecipes';
import { generateDemoRecipe } from '../service';
import { checkRecipeConsistency } from '../scaling';
import type { Recipe } from '@/types/recipe';

function request(overrides: Partial<RecipeRequest> = {}): RecipeRequest {
  return {
    prompt: '',
    mode: 'dish_name',
    cuisine: null,
    cuisineNote: null,
    servings: 4,
    dietaryPatterns: [],
    avoidIngredients: [],
    equipment: [],
    maxTotalMinutes: null,
    pantryIngredients: [],
    referenceImageUri: null,
    ...overrides,
  };
}

/** Wraps a draft as a stored Recipe, so the consistency checker can run. */
function asRecipe(draft: ReturnType<typeof pickDemoRecipe>): Recipe {
  return {
    id: 'r',
    userId: 'u',
    title: draft.title,
    description: draft.description,
    cuisine: draft.cuisine,
    cuisineNote: draft.cuisineNote,
    origin: 'demo_sample' as Recipe['origin'],
    servings: draft.servings,
    prepMinutes: draft.prepMinutes,
    cookMinutes: draft.cookMinutes,
    equipment: draft.equipment,
    ingredients: draft.ingredients,
    steps: draft.steps,
    tips: draft.tips,
    tags: draft.tags,
    nutritionPerServing: draft.nutritionPerServing,
    image: null,
    isFavorite: false,
    rejectedAt: null,
    lastCookedAt: null,
    cookCount: 0,
    createdAt: 'now',
    updatedAt: 'now',
  };
}

describe('bundled demo recipes', () => {
  it('bundles more than one, so the demo is not a single canned answer', () => {
    expect(DEMO_RECIPE_COUNT).toBeGreaterThan(1);
  });

  it('matches a request to a relevant demo', () => {
    expect(pickDemoRecipe(request({ prompt: 'chicken biryani' })).title).toContain(
      'pulao',
    );
    expect(
      pickDemoRecipe(request({ prompt: 'pasta with eggs and cheese' })).title,
    ).toContain('Pasta');
    expect(
      pickDemoRecipe(
        request({
          mode: 'from_pantry',
          pantryIngredients: ['rice', 'eggs', 'onions', 'tomatoes'],
        }),
      ).title,
    ).toContain('Tomato');
  });

  it('always returns something, even for an unrelated request', () => {
    const draft = pickDemoRecipe(request({ prompt: 'zxcvbnm qwerty' }));
    expect(draft.title.length).toBeGreaterThan(0);
    expect(draft.ingredients.length).toBeGreaterThan(0);
    expect(draft.steps.length).toBeGreaterThan(0);
  });

  it('returns a fresh copy, so editing one demo cannot affect the next', () => {
    const first = pickDemoRecipe(request({ prompt: 'biryani' }));
    const firstIngredient = first.ingredients[0];
    if (!firstIngredient) throw new Error('fixture has no ingredients');
    firstIngredient.name = 'MUTATED';

    const second = pickDemoRecipe(request({ prompt: 'biryani' }));
    expect(second.ingredients[0]?.name).not.toBe('MUTATED');
  });
});

describe('every demo recipe is internally consistent', () => {
  const prompts = ['biryani', 'pasta with eggs and cheese', 'rice eggs onions tomatoes'];

  it.each(prompts)('passes the consistency checks: %s', (prompt) => {
    const draft = pickDemoRecipe(request({ prompt }));
    const report = checkRecipeConsistency(asRecipe(draft));
    expect(report.issues).toEqual([]);
    expect(report.isConsistent).toBe(true);
  });

  it.each(prompts)('has steps that only cite real ingredients: %s', (prompt) => {
    const draft = pickDemoRecipe(request({ prompt }));
    const ids = new Set(draft.ingredients.map((ingredient) => ingredient.id));
    for (const step of draft.steps) {
      for (const id of step.ingredientIds) {
        expect(ids.has(id)).toBe(true);
      }
    }
  });

  it.each(prompts)('numbers its steps from one, in order: %s', (prompt) => {
    const draft = pickDemoRecipe(request({ prompt }));
    expect(draft.steps.map((step) => step.number)).toEqual(
      draft.steps.map((_step, index) => index + 1),
    );
  });

  it.each(prompts)('keeps the food out of the preparation field: %s', (prompt) => {
    const draft = pickDemoRecipe(request({ prompt }));
    for (const ingredient of draft.ingredients) {
      // A name holding an amount means it would render twice.
      expect(ingredient.name).not.toMatch(/^\d/);
    }
  });
});

describe('demo recipes are labelled as demo data', () => {
  it('marks nutrition with the demo_sample source, not as an AI estimate', () => {
    const generated = generateDemoRecipe(request({ prompt: 'biryani' }));
    expect(generated.nutritionPerServing?.source).toBe('demo_sample');
  });

  it('reports itself as a demo', () => {
    const generated = generateDemoRecipe(request({ prompt: 'biryani' }));
    expect(generated.isDemo).toBe(true);
    expect(generated.providerLabel).toBe('Bundled demo recipe');
  });

  it('says in its own caveats that it was not written for the request', () => {
    const generated = generateDemoRecipe(request({ prompt: 'biryani' }));
    const text = generated.caveats.join(' ').toLowerCase();
    expect(text).toContain('demo');
    expect(text).toContain('not');
  });

  it('never claims its nutrition came from a database', () => {
    for (const prompt of ['biryani', 'pasta', 'tomatoes']) {
      const generated = generateDemoRecipe(request({ prompt }));
      expect(generated.nutritionPerServing?.source).not.toBe('database');
      expect(generated.nutritionPerServing?.source).not.toBe('ai_estimate');
    }
  });
});
