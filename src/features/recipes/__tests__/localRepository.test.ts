import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RecipeIngredient, RecipeStep } from '@/types/recipe';

import {
  LOCAL_RECIPE_LIMIT,
  LOCAL_USER_ID,
  clearLocalRecipes,
  createLocalRecipeRepository,
  createLocalShoppingListRepository,
} from '../localRepository';
import type { CreateRecipeInput } from '../repository';

function ingredient(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return {
    id: 'ing-1',
    name: 'Basmati rice',
    quantity: 400,
    unit: 'g',
    preparation: null,
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
    instruction: 'Rinse the rice.',
    durationMinutes: null,
    temperatureC: null,
    ingredientIds: ['ing-1'],
    ...overrides,
  };
}

function recipeInput(overrides: Partial<CreateRecipeInput> = {}): CreateRecipeInput {
  return {
    title: 'Chicken biryani',
    origin: 'ai_generated',
    servings: 4,
    ingredients: [ingredient()],
    steps: [step()],
    ...overrides,
  };
}

describe('local recipe repository', () => {
  let repo = createLocalRecipeRepository();

  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearLocalRecipes();
    repo = createLocalRecipeRepository();
  });

  it('starts empty', async () => {
    const result = await repo.listRecipes();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it('creates a recipe with sensible defaults', async () => {
    const created = await repo.createRecipe(recipeInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.value.id).toMatch(/[0-9a-f-]{36}/);
    expect(created.value.userId).toBe(LOCAL_USER_ID);
    expect(created.value.isFavorite).toBe(false);
    expect(created.value.rejectedAt).toBeNull();
    expect(created.value.cookCount).toBe(0);
    expect(created.value.lastCookedAt).toBeNull();
    expect(created.value.equipment).toEqual([]);
  });

  it('persists across repository instances', async () => {
    await repo.createRecipe(recipeInput({ title: 'Dal' }));

    const fresh = createLocalRecipeRepository();
    const result = await fresh.listRecipes();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.title).toBe('Dal');
  });

  it('trims the title', async () => {
    const created = await repo.createRecipe(recipeInput({ title: '  Dal  ' }));
    if (!created.ok) return;
    expect(created.value.title).toBe('Dal');
  });

  it('updates a recipe without rewriting its identity', async () => {
    const created = await repo.createRecipe(recipeInput());
    if (!created.ok) throw new Error('setup failed');

    const updated = await repo.updateRecipe(created.value.id, {
      title: 'Chicken biryani, corrected',
      servings: 6,
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.title).toBe('Chicken biryani, corrected');
    expect(updated.value.servings).toBe(6);
    expect(updated.value.id).toBe(created.value.id);
    expect(updated.value.createdAt).toBe(created.value.createdAt);
  });

  it('refuses a patch that tries to rewrite the id or owner', async () => {
    const created = await repo.createRecipe(recipeInput());
    if (!created.ok) throw new Error('setup failed');

    const hostile = { id: 'someone-else', userId: 'attacker' } as never;
    const updated = await repo.updateRecipe(created.value.id, hostile);

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.id).toBe(created.value.id);
    expect(updated.value.userId).toBe(LOCAL_USER_ID);
  });

  it('reports not_found for a missing recipe', async () => {
    for (const result of [
      await repo.updateRecipe('nope', { title: 'x' }),
      await repo.deleteRecipe('nope'),
      await repo.setFavorite('nope', true),
      await repo.recordCooked('nope'),
    ]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe('not_found');
    }
  });

  it('marks and unmarks a favourite', async () => {
    const created = await repo.createRecipe(recipeInput());
    if (!created.ok) throw new Error('setup failed');

    const favorited = await repo.setFavorite(created.value.id, true);
    if (!favorited.ok) return;
    expect(favorited.value.isFavorite).toBe(true);

    const unfavorited = await repo.setFavorite(created.value.id, false);
    if (!unfavorited.ok) return;
    expect(unfavorited.value.isFavorite).toBe(false);
  });

  it('keeps a rejected recipe but hides it from the default list', async () => {
    const keep = await repo.createRecipe(recipeInput({ title: 'Keep me' }));
    const reject = await repo.createRecipe(recipeInput({ title: 'Not for me' }));
    if (!keep.ok || !reject.ok) throw new Error('setup failed');

    await repo.setRejected(reject.value.id, true);

    const visible = await repo.listRecipes();
    if (!visible.ok) return;
    expect(visible.value.map((r) => r.title)).toEqual(['Keep me']);

    // Still stored, so the user can find it again.
    const everything = await repo.listRecipes({ includeRejected: true });
    if (!everything.ok) return;
    expect(everything.value).toHaveLength(2);
  });

  it('can un-reject a recipe', async () => {
    const created = await repo.createRecipe(recipeInput());
    if (!created.ok) throw new Error('setup failed');

    await repo.setRejected(created.value.id, true);
    const restored = await repo.setRejected(created.value.id, false);
    if (!restored.ok) return;
    expect(restored.value.rejectedAt).toBeNull();

    const visible = await repo.listRecipes();
    if (!visible.ok) return;
    expect(visible.value).toHaveLength(1);
  });

  it('records cooking, counting each time', async () => {
    const created = await repo.createRecipe(recipeInput());
    if (!created.ok) throw new Error('setup failed');

    const once = await repo.recordCooked(created.value.id);
    if (!once.ok) return;
    expect(once.value.cookCount).toBe(1);
    expect(once.value.lastCookedAt).not.toBeNull();

    const twice = await repo.recordCooked(created.value.id);
    if (!twice.ok) return;
    expect(twice.value.cookCount).toBe(2);
  });

  it('lists only cooked recipes when ordering by cooked', async () => {
    const cooked = await repo.createRecipe(recipeInput({ title: 'Cooked' }));
    await repo.createRecipe(recipeInput({ title: 'Never cooked' }));
    if (!cooked.ok) throw new Error('setup failed');
    await repo.recordCooked(cooked.value.id);

    const result = await repo.listRecipes({ orderBy: 'cooked' });
    if (!result.ok) return;
    expect(result.value.map((r) => r.title)).toEqual(['Cooked']);
  });

  it('filters to favourites', async () => {
    const fav = await repo.createRecipe(recipeInput({ title: 'Favourite' }));
    await repo.createRecipe(recipeInput({ title: 'Ordinary' }));
    if (!fav.ok) throw new Error('setup failed');
    await repo.setFavorite(fav.value.id, true);

    const result = await repo.listRecipes({ favoritesOnly: true });
    if (!result.ok) return;
    expect(result.value.map((r) => r.title)).toEqual(['Favourite']);
  });

  it('searches titles, descriptions and ingredient names', async () => {
    await repo.createRecipe(recipeInput({ title: 'Chicken biryani' }));
    await repo.createRecipe(
      recipeInput({
        title: 'Lentil dal',
        description: 'Comforting and cheap.',
        ingredients: [ingredient({ name: 'Red lentils' })],
      }),
    );

    const byTitle = await repo.searchRecipes('biryani');
    if (byTitle.ok) expect(byTitle.value.map((r) => r.title)).toEqual(['Chicken biryani']);

    const byIngredient = await repo.searchRecipes('lentils');
    if (byIngredient.ok) expect(byIngredient.value.map((r) => r.title)).toEqual(['Lentil dal']);

    const byDescription = await repo.searchRecipes('comforting');
    if (byDescription.ok) expect(byDescription.value).toHaveLength(1);
  });

  it('ranks a title match above an ingredient match', async () => {
    await repo.createRecipe(
      recipeInput({ title: 'Something else', ingredients: [ingredient({ name: 'Rice' })] }),
    );
    await repo.createRecipe(recipeInput({ title: 'Rice pudding' }));

    const result = await repo.searchRecipes('rice');
    if (!result.ok) return;
    expect(result.value[0]?.title).toBe('Rice pudding');
  });

  it('searches case-insensitively and returns nothing for a blank query', async () => {
    await repo.createRecipe(recipeInput({ title: 'Chicken Biryani' }));

    const upper = await repo.searchRecipes('BIRYANI');
    if (upper.ok) expect(upper.value).toHaveLength(1);

    const blank = await repo.searchRecipes('   ');
    if (blank.ok) expect(blank.value).toEqual([]);
  });

  it('does not lose writes when recipes are created concurrently', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_unused, index) =>
        repo.createRecipe(recipeInput({ title: `Recipe ${index}` })),
      ),
    );

    const result = await repo.listRecipes();
    if (!result.ok) return;
    expect(result.value).toHaveLength(10);
    expect(new Set(result.value.map((r) => r.id)).size).toBe(10);
  });

  it('caps stored recipes', async () => {
    for (let index = 0; index < LOCAL_RECIPE_LIMIT + 2; index += 1) {
      const created = await repo.createRecipe(recipeInput({ title: `Recipe ${index}` }));
      if (!created.ok) throw new Error('setup failed');
    }

    const result = await repo.listRecipes();
    if (!result.ok) return;
    expect(result.value).toHaveLength(LOCAL_RECIPE_LIMIT);
  }, 60_000);

  it('survives corrupted stored data', async () => {
    await AsyncStorage.setItem('foodlens.recipes.v1', '{not json');
    const result = await repo.listRecipes();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });
});

describe('local shopping list repository', () => {
  let lists = createLocalShoppingListRepository();

  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearLocalRecipes();
    lists = createLocalShoppingListRepository();
  });

  it('creates a list with items', async () => {
    const created = await lists.createList({
      name: 'Weekly shop',
      items: [
        { name: 'Basmati rice', quantity: 1, unit: 'kg' },
        { name: 'Onions', quantity: 3, unit: 'piece' },
      ],
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.name).toBe('Weekly shop');
    expect(created.value.status).toBe('active');
    expect(created.value.items).toHaveLength(2);
    expect(created.value.items[0]?.position).toBe(0);
    expect(created.value.items[1]?.position).toBe(1);
    expect(created.value.items[0]?.isChecked).toBe(false);
  });

  it('merges an item that is already on the list, adding the amounts', async () => {
    const created = await lists.createList({
      name: 'Shop',
      items: [{ name: 'Onions', quantity: 2, unit: 'piece' }],
    });
    if (!created.ok) throw new Error('setup failed');

    const updated = await lists.addItems(created.value.id, [
      { name: 'onions', quantity: 3, unit: 'piece' },
    ]);

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    // One line, not two: a second recipe needing onions should not duplicate.
    expect(updated.value.items).toHaveLength(1);
    expect(updated.value.items[0]?.quantity).toBe(5);
  });

  it('does not merge the same food in a different unit', async () => {
    const created = await lists.createList({
      name: 'Shop',
      items: [{ name: 'Rice', quantity: 1, unit: 'kg' }],
    });
    if (!created.ok) throw new Error('setup failed');

    const updated = await lists.addItems(created.value.id, [
      { name: 'Rice', quantity: 200, unit: 'g' },
    ]);

    if (!updated.ok) return;
    // Adding 1 to 200 across kg and g would be wrong, so they stay separate.
    expect(updated.value.items).toHaveLength(2);
  });

  it('un-ticks a merged line, because it is needed again', async () => {
    const created = await lists.createList({
      name: 'Shop',
      items: [{ name: 'Onions', quantity: 2, unit: 'piece' }],
    });
    if (!created.ok) throw new Error('setup failed');

    const itemId = created.value.items[0]?.id ?? '';
    await lists.setItemChecked(itemId, true);

    const merged = await lists.addItems(created.value.id, [
      { name: 'Onions', quantity: 1, unit: 'piece' },
    ]);
    if (!merged.ok) return;
    expect(merged.value.items[0]?.isChecked).toBe(false);
    expect(merged.value.items[0]?.quantity).toBe(3);
  });

  it('skips a blank item name', async () => {
    const created = await lists.createList({ name: 'Shop' });
    if (!created.ok) throw new Error('setup failed');

    const updated = await lists.addItems(created.value.id, [
      { name: '   ' },
      { name: 'Real item' },
    ]);
    if (!updated.ok) return;
    expect(updated.value.items.map((item) => item.name)).toEqual(['Real item']);
  });

  it('ticks an item off and back on', async () => {
    const created = await lists.createList({
      name: 'Shop',
      items: [{ name: 'Milk' }],
    });
    if (!created.ok) throw new Error('setup failed');
    const itemId = created.value.items[0]?.id ?? '';

    const checked = await lists.setItemChecked(itemId, true);
    if (checked.ok) expect(checked.value.items[0]?.isChecked).toBe(true);

    const unchecked = await lists.setItemChecked(itemId, false);
    if (unchecked.ok) expect(unchecked.value.items[0]?.isChecked).toBe(false);
  });

  it('clears only the ticked items and keeps positions contiguous', async () => {
    const created = await lists.createList({
      name: 'Shop',
      items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    });
    if (!created.ok) throw new Error('setup failed');

    await lists.setItemChecked(created.value.items[1]?.id ?? '', true);
    const cleared = await lists.clearChecked(created.value.id);

    if (!cleared.ok) return;
    expect(cleared.value.items.map((item) => item.name)).toEqual(['A', 'C']);
    expect(cleared.value.items.map((item) => item.position)).toEqual([0, 1]);
  });

  it('deletes an item and renumbers the rest', async () => {
    const created = await lists.createList({
      name: 'Shop',
      items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    });
    if (!created.ok) throw new Error('setup failed');

    const updated = await lists.deleteItem(created.value.items[0]?.id ?? '');
    if (!updated.ok) return;
    expect(updated.value.items.map((item) => item.name)).toEqual(['B', 'C']);
    expect(updated.value.items.map((item) => item.position)).toEqual([0, 1]);
  });

  it('renames and archives a list', async () => {
    const created = await lists.createList({ name: 'Old name' });
    if (!created.ok) throw new Error('setup failed');

    const renamed = await lists.renameList(created.value.id, '  New name  ');
    if (renamed.ok) expect(renamed.value.name).toBe('New name');

    const archived = await lists.setListStatus(created.value.id, 'archived');
    if (archived.ok) expect(archived.value.status).toBe('archived');

    const active = await lists.listLists('active');
    if (active.ok) expect(active.value).toHaveLength(0);

    const all = await lists.listLists();
    if (all.ok) expect(all.value).toHaveLength(1);
  });

  it('deletes a list and reports a missing one', async () => {
    const created = await lists.createList({ name: 'Temp' });
    if (!created.ok) throw new Error('setup failed');

    expect((await lists.deleteList(created.value.id)).ok).toBe(true);
    const missing = await lists.deleteList(created.value.id);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe('not_found');
  });

  it('records which recipe put an item on the list', async () => {
    const created = await lists.createList({
      name: 'Shop',
      items: [{ name: 'Saffron', sourceRecipeId: 'recipe-1' }],
    });
    if (!created.ok) return;
    expect(created.value.items[0]?.sourceRecipeId).toBe('recipe-1');
  });

  it('reports not_found for an item that does not exist', async () => {
    const result = await lists.setItemChecked('nope', true);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not_found');
  });
});
