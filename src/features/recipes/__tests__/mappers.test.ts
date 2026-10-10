import {
  parseIngredients,
  parseSteps,
  recipeFieldsToColumns,
  rowToRecipe,
  rowToShoppingList,
  type RecipeRow,
} from '../mappers';

function recipeRow(overrides: Partial<RecipeRow> = {}): RecipeRow {
  return {
    id: 'r1',
    user_id: 'u1',
    title: 'Masoor dal',
    description: 'Red lentils',
    origin: 'ai_generated',
    cuisine: 'bangladeshi',
    cuisine_note: null,
    servings: 4,
    prep_minutes: 10,
    cook_minutes: 25,
    equipment: ['Saucepan'],
    ingredients: [
      { id: 'i1', name: 'Red lentils', quantity: 200, unit: 'g', scalesWithServings: true },
    ],
    steps: [{ instruction: 'Rinse the lentils', ingredientIds: ['i1'] }],
    tips: ['Skim the foam'],
    tags: ['vegetarian'],
    is_favorite: false,
    calories_kcal: '320.5',
    protein_g: '18.2',
    carbs_g: '52.1',
    fat_g: '3.4',
    nutrition_source: 'ai_estimate',
    nutrition_provider_label: 'Claude',
    image_uri: null,
    image_kind: null,
    image_attribution: null,
    rejected_at: null,
    last_cooked_at: null,
    cook_count: 0,
    created_at: '2026-10-10T08:00:00.000Z',
    updated_at: '2026-10-10T08:00:00.000Z',
    ...overrides,
  };
}

describe('rowToRecipe', () => {
  it('coerces numerics that arrive as strings', () => {
    // PostgREST sends `numeric` as a string when it preserves precision.
    const recipe = rowToRecipe(recipeRow());
    expect(recipe.nutritionPerServing?.caloriesKcal).toBe(320.5);
    expect(recipe.nutritionPerServing?.proteinG).toBe(18.2);
    expect(typeof recipe.nutritionPerServing?.caloriesKcal).toBe('number');
  });

  it('drops nutrition that has no stated source', () => {
    // The app never shows a figure it cannot label.
    const recipe = rowToRecipe(recipeRow({ nutrition_source: null }));
    expect(recipe.nutritionPerServing).toBeNull();
  });

  it('reads the old origin name as the current one', () => {
    const recipe = rowToRecipe(recipeRow({ origin: 'ai_suggested' }));
    expect(recipe.origin).toBe('ai_generated');
  });

  it('falls back to user_created for an origin it does not know', () => {
    const recipe = rowToRecipe(recipeRow({ origin: 'something_else' }));
    expect(recipe.origin).toBe('user_created');
  });

  it('ignores a cuisine it does not know', () => {
    expect(rowToRecipe(recipeRow({ cuisine: 'martian' })).cuisine).toBeNull();
  });

  it('never returns fewer than one serving', () => {
    expect(rowToRecipe(recipeRow({ servings: 0 })).servings).toBe(1);
  });

  it('treats a null array column as empty rather than crashing', () => {
    const recipe = rowToRecipe(
      recipeRow({ equipment: null, tips: null, tags: null }),
    );
    expect(recipe.equipment).toEqual([]);
    expect(recipe.tips).toEqual([]);
    expect(recipe.tags).toEqual([]);
  });

  it('builds an image only when the kind is known', () => {
    expect(rowToRecipe(recipeRow()).image).toBeNull();
    const withImage = rowToRecipe(
      recipeRow({ image_uri: 'https://x.test/a.jpg', image_kind: 'stock_library' }),
    );
    expect(withImage.image).toEqual({
      uri: 'https://x.test/a.jpg',
      kind: 'stock_library',
      attribution: null,
    });
  });
});

describe('parseIngredients', () => {
  it('drops an entry with no id, because a step could not refer to it', () => {
    const parsed = parseIngredients([
      { name: 'Rice', quantity: 200 },
      { id: 'i1', name: 'Dal' },
    ]);
    expect(parsed.map((entry) => entry.id)).toEqual(['i1']);
  });

  it('drops an entry with no name', () => {
    expect(parseIngredients([{ id: 'i1', name: '   ' }])).toEqual([]);
  });

  it('assumes a quantity scales unless told otherwise', () => {
    // A row written before the field existed must keep the common behaviour.
    const [withoutField] = parseIngredients([{ id: 'i1', name: 'Rice' }]);
    expect(withoutField?.scalesWithServings).toBe(true);

    const [explicit] = parseIngredients([
      { id: 'i1', name: 'Oil', scalesWithServings: false },
    ]);
    expect(explicit?.scalesWithServings).toBe(false);
  });

  it('keeps an unknown unit out rather than storing nonsense', () => {
    const [entry] = parseIngredients([{ id: 'i1', name: 'Rice', unit: 'furlong' }]);
    expect(entry?.unit).toBeNull();
  });

  it('survives a column that is not an array at all', () => {
    expect(parseIngredients(null)).toEqual([]);
    expect(parseIngredients('nonsense')).toEqual([]);
    expect(parseIngredients({ id: 'i1' })).toEqual([]);
  });

  it('skips a null entry inside the array', () => {
    expect(parseIngredients([null, { id: 'i1', name: 'Rice' }])).toHaveLength(1);
  });
});

describe('parseSteps', () => {
  it('numbers steps from their order', () => {
    const steps = parseSteps([
      { instruction: 'First' },
      { instruction: 'Second' },
      { instruction: 'Third' },
    ]);
    expect(steps.map((step) => step.number)).toEqual([1, 2, 3]);
  });

  it('renumbers after dropping a malformed step, leaving no gap', () => {
    const steps = parseSteps([
      { instruction: 'First' },
      { instruction: '' },
      { instruction: 'Third' },
    ]);
    expect(steps.map((step) => step.number)).toEqual([1, 2]);
    expect(steps[1]?.instruction).toBe('Third');
  });

  it('keeps a duration and a temperature when the recipe gives them', () => {
    const [step] = parseSteps([
      { instruction: 'Bake', durationMinutes: '25', temperatureC: '180' },
    ]);
    expect(step?.durationMinutes).toBe(25);
    expect(step?.temperatureC).toBe(180);
  });

  it('leaves an unstated duration null rather than zero', () => {
    const [step] = parseSteps([{ instruction: 'Stir' }]);
    expect(step?.durationMinutes).toBeNull();
  });
});

describe('recipeFieldsToColumns', () => {
  it('sends only the fields that were given', () => {
    const columns = recipeFieldsToColumns({ title: 'New title' });
    expect(columns).toEqual({ title: 'New title' });
  });

  it('never sends user_id, which the database sets and RLS enforces', () => {
    const columns = recipeFieldsToColumns({ title: 'x', servings: 2 });
    expect(columns).not.toHaveProperty('user_id');
  });

  it('spreads nutrition across its columns', () => {
    const columns = recipeFieldsToColumns({
      nutritionPerServing: {
        caloriesKcal: 320,
        proteinG: 18,
        carbsG: 52,
        fatG: 3,
        source: 'ai_estimate',
        providerLabel: 'Claude',
      },
    });
    expect(columns.calories_kcal).toBe(320);
    expect(columns.nutrition_source).toBe('ai_estimate');
    expect(columns.nutrition_provider_label).toBe('Claude');
  });

  it('clears every nutrition column when nutrition is removed', () => {
    // Leaving a stale source behind would label numbers that are gone.
    const columns = recipeFieldsToColumns({ nutritionPerServing: null });
    expect(columns.calories_kcal).toBeNull();
    expect(columns.nutrition_source).toBeNull();
  });

  it('trims the title', () => {
    expect(recipeFieldsToColumns({ title: '  Dal  ' }).title).toBe('Dal');
  });
});

describe('rowToShoppingList', () => {
  const base = {
    id: 'l1',
    user_id: 'u1',
    name: 'Week',
    status: 'active',
    created_at: '2026-10-10T08:00:00.000Z',
    updated_at: '2026-10-10T08:00:00.000Z',
  };

  function item(id: string, position: number, overrides = {}) {
    return {
      id,
      list_id: 'l1',
      user_id: 'u1',
      name: id,
      quantity: '2',
      unit: 'piece',
      category: null,
      is_checked: false,
      note: null,
      position,
      source_recipe_id: null,
      created_at: '2026-10-10T08:00:00.000Z',
      updated_at: '2026-10-10T08:00:00.000Z',
      ...overrides,
    };
  }

  it('orders items by position, which the wire does not promise', () => {
    const list = rowToShoppingList({
      ...base,
      shopping_list_items: [item('c', 2), item('a', 0), item('b', 1)],
    });
    expect(list.items.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('reads a list with no items', () => {
    expect(rowToShoppingList({ ...base, shopping_list_items: null }).items).toEqual([]);
  });

  it('coerces a quantity that arrived as a string', () => {
    const list = rowToShoppingList({ ...base, shopping_list_items: [item('a', 0)] });
    expect(list.items[0]?.quantity).toBe(2);
  });

  it('falls back to active for a status it does not know', () => {
    expect(rowToShoppingList({ ...base, status: 'weird' }).status).toBe('active');
    expect(rowToShoppingList({ ...base, status: 'archived' }).status).toBe('archived');
  });
});
