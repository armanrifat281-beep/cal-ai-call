import { useCallback, useState } from 'react';

import type { AppError, Result } from '@/lib/result';
import { useAsyncResult } from '@/lib/useAsyncResult';
import type { Recipe, ShoppingList, ShoppingListStatus } from '@/types/recipe';

import {
  createLocalRecipeRepository,
  createLocalShoppingListRepository,
} from './localRepository';
import type {
  ListRecipesOptions,
  RecipeRepository,
  ShoppingListRepository,
} from './repository';

/**
 * Recipe and shopping list data access for screens.
 *
 * Device-local for now. A Supabase implementation slots in here exactly as it
 * did for the journal, and no screen changes when it does.
 */

let recipeRepository: RecipeRepository | null = null;
let shoppingListRepository: ShoppingListRepository | null = null;

export function getRecipeRepository(): RecipeRepository {
  recipeRepository ??= createLocalRecipeRepository();
  return recipeRepository;
}

export function getShoppingListRepository(): ShoppingListRepository {
  shoppingListRepository ??= createLocalShoppingListRepository();
  return shoppingListRepository;
}

/** Replaces the active repositories. Used by tests. */
export function setRecipeRepositories(repositories: {
  recipes?: RecipeRepository | null;
  shoppingLists?: ShoppingListRepository | null;
}): void {
  if (repositories.recipes !== undefined) recipeRepository = repositories.recipes;
  if (repositories.shoppingLists !== undefined) {
    shoppingListRepository = repositories.shoppingLists;
  }
}

export function useRecipeRepository(): RecipeRepository {
  return getRecipeRepository();
}

export function useShoppingListRepository(): ShoppingListRepository {
  return getShoppingListRepository();
}

export interface RecipeListState {
  recipes: Recipe[];
  loading: boolean;
  error: AppError | null;
  reload: () => void;
}

export function useRecipes(options: ListRecipesOptions = {}): RecipeListState {
  const repository = useRecipeRepository();
  const { includeRejected, favoritesOnly, orderBy, limit } = options;

  const { data, loading, error, reload } = useAsyncResult(
    () => repository.listRecipes({ includeRejected, favoritesOnly, orderBy, limit }),
    [repository, includeRejected, favoritesOnly, orderBy, limit],
  );

  return { recipes: data ?? [], loading, error, reload };
}

export interface RecipeState {
  recipe: Recipe | null;
  loading: boolean;
  error: AppError | null;
  /** True when the lookup succeeded but there is no such recipe. */
  notFound: boolean;
  reload: () => void;
}

export function useRecipe(recipeId: string | undefined): RecipeState {
  const repository = useRecipeRepository();

  const { data, loading, error, reload } = useAsyncResult(
    async () =>
      recipeId
        ? repository.getRecipe(recipeId)
        : ({ ok: true, value: null } as Result<Recipe | null>),
    [repository, recipeId],
  );

  return {
    recipe: data ?? null,
    loading,
    error,
    notFound: !loading && error === null && data === null && Boolean(recipeId),
    reload,
  };
}

export interface RecipeSearchState {
  results: Recipe[];
  loading: boolean;
  error: AppError | null;
}

export function useRecipeSearch(query: string): RecipeSearchState {
  const repository = useRecipeRepository();
  const trimmed = query.trim();

  const { data, loading, error } = useAsyncResult(
    async () =>
      trimmed.length === 0
        ? ({ ok: true, value: [] } as Result<Recipe[]>)
        : repository.searchRecipes(trimmed),
    [repository, trimmed],
  );

  return { results: data ?? [], loading: trimmed.length > 0 && loading, error };
}

export interface ShoppingListsState {
  lists: ShoppingList[];
  loading: boolean;
  error: AppError | null;
  reload: () => void;
}

export function useShoppingLists(status?: ShoppingListStatus): ShoppingListsState {
  const repository = useShoppingListRepository();

  const { data, loading, error, reload } = useAsyncResult(
    () => repository.listLists(status),
    [repository, status],
  );

  return { lists: data ?? [], loading, error, reload };
}

export interface ShoppingListState {
  list: ShoppingList | null;
  loading: boolean;
  error: AppError | null;
  notFound: boolean;
  reload: () => void;
  /** Replaces the loaded list after a mutation, avoiding a refetch. */
  setList: (list: ShoppingList) => void;
}

export function useShoppingList(listId: string | undefined): ShoppingListState {
  const repository = useShoppingListRepository();

  /**
   * A locally edited copy, shown instead of the stored one until the next
   * read lands. It carries the list id it was made for, so switching lists
   * discards it by simply not matching - an effect that cleared it would
   * leave one render showing the previous list's contents under the new
   * list's heading.
   */
  const [override, setOverride] = useState<{
    listId: string | undefined;
    list: ShoppingList;
  } | null>(null);

  const { data, loading, error, reload } = useAsyncResult(
    async () =>
      listId
        ? repository.getList(listId)
        : ({ ok: true, value: null } as Result<ShoppingList | null>),
    [repository, listId],
  );

  const list = (override && override.listId === listId ? override.list : null) ?? data ?? null;

  const setList = useCallback(
    (next: ShoppingList) => setOverride({ listId, list: next }),
    [listId],
  );

  return {
    list,
    loading,
    error,
    notFound: !loading && error === null && data === null && Boolean(listId),
    reload,
    setList,
  };
}
