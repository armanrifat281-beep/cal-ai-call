import { createFakeSupabase, type RecordedQuery } from '@/test/fakeSupabase';
import type { RecipeIngredient, RecipeStep } from '@/types/recipe';

import {
  createSupabaseRecipeRepository,
  createSupabaseShoppingListRepository,
} from '../supabaseRepository';

function recipeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    user_id: 'u1',
    title: 'Masoor dal',
    description: null,
    origin: 'ai_generated',
    cuisine: 'bangladeshi',
    cuisine_note: null,
    servings: 4,
    prep_minutes: 10,
    cook_minutes: 25,
    equipment: [],
    ingredients: [{ id: 'i1', name: 'Red lentils', quantity: 200, unit: 'g' }],
    steps: [{ instruction: 'Rinse' }],
    tips: [],
    tags: [],
    is_favorite: false,
    calories_kcal: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    nutrition_source: null,
    nutrition_provider_label: null,
    image_uri: null,
    image_kind: null,
    image_attribution: null,
    rejected_at: null,
    last_cooked_at: null,
    cook_count: 2,
    created_at: '2026-10-10T08:00:00.000Z',
    updated_at: '2026-10-10T08:00:00.000Z',
    ...overrides,
  };
}

function listRow(items: Record<string, unknown>[] = []) {
  return {
    id: 'l1',
    user_id: 'u1',
    name: 'Week',
    status: 'active',
    created_at: '2026-10-10T08:00:00.000Z',
    updated_at: '2026-10-10T08:00:00.000Z',
    shopping_list_items: items,
  };
}

function itemRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    list_id: 'l1',
    user_id: 'u1',
    name: id,
    quantity: 1,
    unit: 'piece',
    category: null,
    is_checked: false,
    note: null,
    position: 0,
    source_recipe_id: null,
    created_at: '2026-10-10T08:00:00.000Z',
    updated_at: '2026-10-10T08:00:00.000Z',
    ...overrides,
  };
}

const ingredient: RecipeIngredient = {
  id: 'i1',
  name: 'Red lentils',
  quantity: 200,
  unit: 'g',
  preparation: null,
  group: null,
  substitution: null,
  scalesWithServings: true,
  isOwned: false,
};

const step: RecipeStep = {
  number: 1,
  instruction: 'Rinse the lentils',
  durationMinutes: null,
  temperatureC: null,
  ingredientIds: ['i1'],
};

/** The filters a query applied, as `op:column` strings. */
function filtersOf(query: RecordedQuery | undefined): string[] {
  return (query?.filters ?? []).map(([op, column]) => `${op}:${column}`);
}

describe('the Supabase recipe repository', () => {
  it('hides rejected recipes unless asked for them', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [recipeRow()] }) });
    const repository = createSupabaseRecipeRepository(fake.client);

    await repository.listRecipes();
    expect(filtersOf(fake.queries[0])).toContain('is:rejected_at');

    await repository.listRecipes({ includeRejected: true });
    expect(filtersOf(fake.queries[1])).not.toContain('is:rejected_at');
  });

  it('orders by last cooked when asked, newest first', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [] }) });
    const repository = createSupabaseRecipeRepository(fake.client);

    await repository.listRecipes({ orderBy: 'cooked' });
    expect(fake.queries[0]?.orders[0]).toEqual({
      column: 'last_cooked_at',
      ascending: false,
      nullsFirst: false,
    });
  });

  it('never sends a user id, because RLS is the boundary', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [recipeRow()] }) });
    const repository = createSupabaseRecipeRepository(fake.client);

    await repository.createRecipe({
      title: 'Masoor dal',
      origin: 'ai_generated',
      servings: 4,
      ingredients: [ingredient],
      steps: [step],
    });

    const insert = fake.queries.find((query) => query.operation === 'insert');
    expect(insert?.values).not.toHaveProperty('user_id');
    // A client-side filter would imply it was doing the protecting.
    expect(filtersOf(insert)).not.toContain('eq:user_id');
  });

  it('keeps the request that produced a recipe, for regenerating it', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [recipeRow()] }) });
    const repository = createSupabaseRecipeRepository(fake.client);

    await repository.createRecipe({
      title: 'Dal',
      origin: 'ai_generated',
      servings: 4,
      ingredients: [ingredient],
      steps: [step],
      sourceRequest: {
        prompt: 'masoor dal',
        mode: 'dish_name',
        cuisine: 'bangladeshi',
        cuisineNote: null,
        servings: 4,
        dietaryPatterns: [],
        avoidIngredients: [],
        equipment: [],
        maxTotalMinutes: null,
        pantryIngredients: [],
        referenceImageUri: null,
      },
    });

    const insert = fake.queries.find((query) => query.operation === 'insert');
    const values = insert?.values as Record<string, unknown>;
    expect((values.source_request as { prompt: string }).prompt).toBe('masoor dal');
  });

  it('returns the stored recipe rather than what was sent', async () => {
    // The database trims, defaults and timestamps; the screen should see that.
    const fake = createFakeSupabase({
      onQuery: () => ({ data: [recipeRow({ title: 'Masoor dal', servings: 4 })] }),
    });
    const repository = createSupabaseRecipeRepository(fake.client);

    const result = await repository.createRecipe({
      title: '  Masoor dal  ',
      origin: 'ai_generated',
      servings: 4,
      ingredients: [ingredient],
      steps: [step],
    });

    expect(result.ok && result.value.title).toBe('Masoor dal');
    expect(result.ok && result.value.createdAt).toBe('2026-10-10T08:00:00.000Z');
  });

  it('treats a missing recipe as absent, not as a failure', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [] }) });
    const repository = createSupabaseRecipeRepository(fake.client);

    const result = await repository.getRecipe('gone');
    expect(result.ok && result.value).toBeNull();
  });

  it('records a cooking by reading the count and raising it', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [recipeRow()] }) });
    const repository = createSupabaseRecipeRepository(fake.client);

    await repository.recordCooked('r1');

    const update = fake.queries.find((query) => query.operation === 'update');
    const values = update?.values as Record<string, unknown>;
    expect(values.cook_count).toBe(3);
    expect(typeof values.last_cooked_at).toBe('string');
  });

  it('stores a rejection as a timestamp, so when it happened survives', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [recipeRow()] }) });
    const repository = createSupabaseRecipeRepository(fake.client);

    await repository.setRejected('r1', true);
    const rejected = fake.queries.find((query) => query.operation === 'update');
    expect(typeof (rejected?.values as Record<string, unknown>).rejected_at).toBe(
      'string',
    );
  });

  it('clears a rejection with null rather than deleting the recipe', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [recipeRow()] }) });
    const repository = createSupabaseRecipeRepository(fake.client);

    await repository.setRejected('r1', false);
    const update = fake.queries.find((query) => query.operation === 'update');
    expect((update?.values as Record<string, unknown>).rejected_at).toBeNull();
    expect(fake.queries.some((query) => query.operation === 'delete')).toBe(false);
  });

  it('does not write at all when a patch changes nothing', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [recipeRow()] }) });
    const repository = createSupabaseRecipeRepository(fake.client);

    await repository.updateRecipe('r1', {});
    expect(fake.queries.every((query) => query.operation === 'select')).toBe(true);
  });

  it('matches a search on an ingredient name, as the local store does', async () => {
    const fake = createFakeSupabase({
      onQuery: () => ({
        data: [
          recipeRow({ id: 'a', title: 'Dal', ingredients: [{ id: 'i', name: 'Lentils' }] }),
          recipeRow({ id: 'b', title: 'Rice', ingredients: [{ id: 'i', name: 'Basmati' }] }),
        ],
      }),
    });
    const repository = createSupabaseRecipeRepository(fake.client);

    const result = await repository.searchRecipes('lentil');
    expect(result.ok && result.value.map((recipe) => recipe.id)).toEqual(['a']);
  });

  it('returns nothing for a blank search without asking the server', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [recipeRow()] }) });
    const repository = createSupabaseRecipeRepository(fake.client);

    const result = await repository.searchRecipes('   ');
    expect(result.ok && result.value).toEqual([]);
    expect(fake.queries).toHaveLength(0);
  });

  it('names the recipe that clashed when a title is already used', async () => {
    // The database keeps titles unique per user; the local store does not,
    // so this is the one failure a user can hit only once signed in.
    const fake = createFakeSupabase({
      onQuery: () => ({
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      }),
    });
    const repository = createSupabaseRecipeRepository(fake.client);

    const result = await repository.createRecipe({
      title: '  Masoor dal  ',
      origin: 'ai_generated',
      servings: 4,
      ingredients: [ingredient],
      steps: [step],
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.message).toContain('Masoor dal');
    expect(result.ok === false && result.error.retryable).toBe(false);
  });

  it('turns a row-level security refusal into a sign-in message', async () => {
    const fake = createFakeSupabase({
      onQuery: () => ({ error: { code: '42501', message: 'permission denied' } }),
    });
    const repository = createSupabaseRecipeRepository(fake.client);

    const result = await repository.listRecipes();
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.code).toBe('unauthorized');
    // The SQLSTATE never reaches the user.
    expect(result.ok === false && result.error.message).not.toContain('42501');
  });

  it('turns a dropped connection into a network error', async () => {
    const fake = createFakeSupabase({
      onQuery: () => ({ throws: new TypeError('Network request failed') }),
    });
    const repository = createSupabaseRecipeRepository(fake.client);

    const result = await repository.listRecipes();
    expect(result.ok === false && result.error.code).toBe('network');
    expect(result.ok === false && result.error.retryable).toBe(true);
  });
});

describe('the Supabase shopping list repository', () => {
  it('reads a list and its items in one round trip', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [listRow([itemRow('a')])] }) });
    const repository = createSupabaseShoppingListRepository(fake.client);

    const result = await repository.getList('l1');
    expect(result.ok && result.value?.items).toHaveLength(1);
    expect(fake.queries[0]?.selectColumns).toContain('shopping_list_items');
  });

  it('merges a repeated food into the line already there', async () => {
    const fake = createFakeSupabase({
      onQuery: () => ({
        data: [listRow([itemRow('onion', { name: 'Onion', quantity: 2 })])],
      }),
    });
    const repository = createSupabaseShoppingListRepository(fake.client);

    await repository.addItems('l1', [{ name: 'onion', quantity: 3, unit: 'piece' }]);

    const update = fake.queries.find((query) => query.operation === 'update');
    const values = update?.values as Record<string, unknown>;
    expect(values.quantity).toBe(5);
    // A merged line is needed again, so an earlier tick is cleared.
    expect(values.is_checked).toBe(false);
    expect(fake.queries.some((query) => query.operation === 'insert')).toBe(false);
  });

  it('inserts a food the list does not have', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [listRow([])] }) });
    const repository = createSupabaseShoppingListRepository(fake.client);

    await repository.addItems('l1', [{ name: 'Garlic', quantity: 3, unit: 'clove' }]);

    const insert = fake.queries.find((query) => query.operation === 'insert');
    const rows = insert?.values as Record<string, unknown>[];
    expect(rows[0]?.name).toBe('Garlic');
    expect(rows[0]?.list_id).toBe('l1');
  });

  it('clears only the ticked items', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [listRow([])] }) });
    const repository = createSupabaseShoppingListRepository(fake.client);

    await repository.clearChecked('l1');
    const remove = fake.queries.find((query) => query.operation === 'delete');
    expect(filtersOf(remove)).toEqual(['eq:list_id', 'eq:is_checked']);
  });

  it('returns the whole list after changing one item', async () => {
    const fake = createFakeSupabase({
      onQuery: (query) =>
        query.table === 'shopping_list_items' && query.operation === 'select'
          ? { data: [{ list_id: 'l1' }] }
          : { data: [listRow([itemRow('a', { is_checked: true })])] },
    });
    const repository = createSupabaseShoppingListRepository(fake.client);

    const result = await repository.setItemChecked('a', true);
    expect(result.ok && result.value.items[0]?.isChecked).toBe(true);
  });

  it('says so when the item being changed has gone', async () => {
    const fake = createFakeSupabase({ onQuery: () => ({ data: [] }) });
    const repository = createSupabaseShoppingListRepository(fake.client);

    const result = await repository.setItemChecked('gone', true);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.code).toBe('not_found');
  });

  it('creates a list with its first items in one go', async () => {
    const fake = createFakeSupabase({
      onQuery: (query) =>
        query.operation === 'insert' && query.table === 'shopping_lists'
          ? { data: [{ id: 'l1' }] }
          : { data: [listRow([itemRow('a')])] },
    });
    const repository = createSupabaseShoppingListRepository(fake.client);

    await repository.createList({ name: 'Week', items: [{ name: 'Onion' }] });

    const inserts = fake.queries.filter((query) => query.operation === 'insert');
    expect(inserts.map((query) => query.table)).toEqual([
      'shopping_lists',
      'shopping_list_items',
    ]);
  });

  it('skips a blank item name when creating a list', async () => {
    const fake = createFakeSupabase({
      onQuery: (query) =>
        query.operation === 'insert' && query.table === 'shopping_lists'
          ? { data: [{ id: 'l1' }] }
          : { data: [listRow([])] },
    });
    const repository = createSupabaseShoppingListRepository(fake.client);

    await repository.createList({ name: 'Week', items: [{ name: '  ' }] });
    expect(
      fake.queries.some((query) => query.table === 'shopping_list_items'),
    ).toBe(false);
  });
});
