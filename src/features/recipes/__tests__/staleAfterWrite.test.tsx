import { act, waitFor } from '@testing-library/react-native';

import { renderHookWithProviders } from '@/test/renderWithProviders';

import type { Recipe } from '@/types/recipe';

import {
  setRecipeRepositories,
  useRecipeRepository,
  useRecipes,
  useShoppingListRepository,
  useShoppingLists,
} from '../hooks';
import type { RecipeRepository, ShoppingListRepository } from '../repository';
import { recipeRevision } from '../revision';

/**
 * A recipe saved in `/recipe/create` did not appear on the Recipes tab, and
 * a shopping list made on one screen did not show on another, until
 * something forced a remount. The tabs stay mounted and the read hooks
 * depended only on their arguments, so nothing ever told them to read again.
 */

function recipe(id: string): Recipe {
  return { id, title: id } as unknown as Recipe;
}

function repos() {
  const recipes: Recipe[] = [];
  const lists: { id: string }[] = [];

  const recipeRepository = {
    kind: 'local',
    listRecipes: async () => ({ ok: true as const, value: [...recipes] }),
    createRecipe: async () => {
      const made = recipe(`r${recipes.length + 1}`);
      recipes.push(made);
      return { ok: true as const, value: made };
    },
    deleteRecipe: async () => {
      recipes.pop();
      return { ok: true as const, value: undefined };
    },
  } as unknown as RecipeRepository;

  const shoppingRepository = {
    kind: 'local',
    listLists: async () => ({ ok: true as const, value: [...lists] }),
    createList: async () => {
      lists.push({ id: `l${lists.length + 1}` });
      return { ok: true as const, value: lists[lists.length - 1] };
    },
  } as unknown as ShoppingListRepository;

  return { recipes: recipeRepository, shoppingLists: shoppingRepository };
}

afterEach(() => {
  setRecipeRepositories({ recipes: null, shoppingLists: null });
  recipeRevision.reset();
});

describe('saving a recipe or a list refreshes the screens showing them', () => {
  it('shows a new recipe without a manual reload', async () => {
    setRecipeRepositories(repos());

    const { result } = await renderHookWithProviders(() => ({
      list: useRecipes(),
      repository: useRecipeRepository(),
    }));
    await waitFor(() => expect(result.current.list.loading).toBe(false));
    expect(result.current.list.recipes).toHaveLength(0);

    await act(async () => {
      await result.current.repository.createRecipe({} as never);
    });

    await waitFor(() => expect(result.current.list.recipes).toHaveLength(1));
  });

  it('notices a deleted recipe too', async () => {
    setRecipeRepositories(repos());

    const { result } = await renderHookWithProviders(() => ({
      list: useRecipes(),
      repository: useRecipeRepository(),
    }));
    await act(async () => {
      await result.current.repository.createRecipe({} as never);
    });
    await waitFor(() => expect(result.current.list.recipes).toHaveLength(1));

    await act(async () => {
      await result.current.repository.deleteRecipe('r1');
    });

    await waitFor(() => expect(result.current.list.recipes).toHaveLength(0));
  });

  it('refreshes shopping lists on the same signal', async () => {
    setRecipeRepositories(repos());

    const { result } = await renderHookWithProviders(() => ({
      lists: useShoppingLists(),
      repository: useShoppingListRepository(),
    }));
    await waitFor(() => expect(result.current.lists.loading).toBe(false));
    expect(result.current.lists.lists).toHaveLength(0);

    await act(async () => {
      await result.current.repository.createList({} as never);
    });

    await waitFor(() => expect(result.current.lists.lists).toHaveLength(1));
  });
});
