import type { Recipe, RecipeNutrition } from '@/types/recipe';

import { recipeToJournalItem } from '../toJournalEntry';

function recipe(nutrition: RecipeNutrition | null): Recipe {
  return {
    id: 'r1',
    userId: 'u1',
    title: 'Masoor dal',
    description: null,
    cuisine: 'bangladeshi',
    cuisineNote: null,
    origin: 'ai_generated',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 25,
    equipment: [],
    ingredients: [],
    steps: [],
    tips: [],
    tags: [],
    nutritionPerServing: nutrition,
    image: null,
    isFavorite: false,
    rejectedAt: null,
    lastCookedAt: null,
    cookCount: 0,
    createdAt: '2026-10-10T08:00:00.000Z',
    updatedAt: '2026-10-10T08:00:00.000Z',
  };
}

const ESTIMATE: RecipeNutrition = {
  caloriesKcal: 320,
  proteinG: 18,
  carbsG: 52,
  fatG: 6,
  source: 'ai_estimate',
  providerLabel: 'Claude',
};

describe('recipeToJournalItem', () => {
  it('logs one serving as the recipe states it', () => {
    const item = recipeToJournalItem({ recipe: recipe(ESTIMATE), servingsEaten: 1 });

    expect(item?.name).toBe('Masoor dal');
    expect(item?.nutrients.caloriesKcal).toBe(320);
    expect(item?.portion).toEqual({ quantity: 1, unit: 'serving' });
  });

  it('scales every figure by the servings eaten', () => {
    const item = recipeToJournalItem({ recipe: recipe(ESTIMATE), servingsEaten: 2 });

    expect(item?.nutrients.caloriesKcal).toBe(640);
    expect(item?.nutrients.proteinG).toBe(36);
    expect(item?.nutrients.carbsG).toBe(104);
    expect(item?.nutrients.fatG).toBe(12);
  });

  it('handles half a serving', () => {
    const item = recipeToJournalItem({ recipe: recipe(ESTIMATE), servingsEaten: 0.5 });
    expect(item?.nutrients.caloriesKcal).toBe(160);
  });

  it('keeps the recipe’s provenance rather than claiming it was measured', () => {
    // Copying an estimate in as user_entered would launder it into something
    // the user appears to have weighed.
    const item = recipeToJournalItem({ recipe: recipe(ESTIMATE), servingsEaten: 1 });

    expect(item?.provenance.source).toBe('ai_estimate');
    expect(item?.provenance.confidence).toBe('low');
    expect(item?.provenance.providerLabel).toBe('Claude');
  });

  it('carries a demo recipe through as a demo', () => {
    const item = recipeToJournalItem({
      recipe: recipe({ ...ESTIMATE, source: 'demo_sample', providerLabel: null }),
      servingsEaten: 1,
    });
    expect(item?.provenance.source).toBe('demo_sample');
  });

  it('trusts a figure the user typed themselves', () => {
    const item = recipeToJournalItem({
      recipe: recipe({ ...ESTIMATE, source: 'user_entered' }),
      servingsEaten: 1,
    });
    expect(item?.provenance.confidence).toBe('high');
  });

  it('logs nothing for a recipe with no nutrition, rather than zeroes', () => {
    // Zero would be a lie the daily total believes.
    expect(recipeToJournalItem({ recipe: recipe(null), servingsEaten: 1 })).toBeNull();
  });

  it('claims no gram weight, because a serving is not a weight', () => {
    const item = recipeToJournalItem({ recipe: recipe(ESTIMATE), servingsEaten: 1 });
    expect(item?.gramsResolved).toBeNull();
  });

  it('refuses to log a zero or negative serving as nothing', () => {
    const item = recipeToJournalItem({ recipe: recipe(ESTIMATE), servingsEaten: 0 });
    // Floors at a quarter serving rather than logging an empty meal.
    expect(item?.nutrients.caloriesKcal).toBe(80);
  });

  it('leaves optional nutrients unknown rather than zero', () => {
    const item = recipeToJournalItem({ recipe: recipe(ESTIMATE), servingsEaten: 1 });
    expect(item?.nutrients.fiberG).toBeNull();
    expect(item?.nutrients.sodiumMg).toBeNull();
  });
});
