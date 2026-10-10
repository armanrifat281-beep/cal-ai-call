import { useCallback, useState } from 'react';

import { useAuth } from '@/features/auth';
import type { AppError, Result } from '@/lib/result';
import { getSupabaseClient } from '@/lib/supabase';
import { useAsyncResult } from '@/lib/useAsyncResult';
import type { Recipe, ShoppingList, ShoppingListStatus } from '@/types/recipe';

import {
  createLocalRecipeRepository,
  createLocalShoppingListRepository,
} from './localRepository';
import {
  createSupabaseRecipeRepository,
  createSupabaseShoppingListRepository,
} from './supabaseRepository';
import type {
  ListRecipesOptions,
  RecipeRepository,
  ShoppingListRepository,
} from './repository';

/**
 * Recipe and shopping list data access for screens.
 *
 * The repository is chosen here and nowhere else, exactly as the journal
 * does it:
 *
 *   signed in  -> Supabase, where the data is backed up and protected by RLS
 *   otherwise  -> this device
 *
 * The non-React getters stay device-local on purpose. They are called from
 * places with no auth context, and silently reading one store while the
 * screens read another is worse than being predictable.
 */

let recipeRepository: RecipeRepository | null = null;
let shoppingListRepository: ShoppingListRepository | null = null;
let supabaseRecipes: RecipeRepository | null = null;
let supabaseShoppingLists: ShoppingListRepository | null = null;

/**
 * The device-local store, whoever is signed in.
 *
 * Named for the device on purpose. The previous name looked
 * interchangeable with the hook and was not, and five screens ended up
 * reading a recipe from the signed-in user's account and writing the change
 * to the phone. Inside a component, use `useRecipeRepository`.
 */
export function getDeviceRecipeRepository(): RecipeRepository {
  recipeRepository ??= createLocalRecipeRepository();
  return recipeRepository;
}

/** The device-local store, whoever is signed in. See above. */
export function getDeviceShoppingListRepository(): ShoppingListRepository {
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
  const { isSignedIn } = useAuth();

  // A test override wins, so a test never reaches for a real client.
  if (recipeRepository) return recipeRepository;

  if (isSignedIn) {
    const client = getSupabaseClient();
    if (client) {
      // Memoized at module level: the client is a singleton, so the
      // repository built from it can be too, and a new object every render
      // would retrigger every data effect that depends on it.
      supabaseRecipes ??= createSupabaseRecipeRepository(client);
      return supabaseRecipes;
    }
  }

  return getDeviceRecipeRepository();
}

export function useShoppingListRepository(): ShoppingListRepository {
  const { isSignedIn } = useAuth();

  if (shoppingListRepository) return shoppingListRepository;

  if (isSignedIn) {
    const client = getSupabaseClient();
    if (client) {
      supabaseShoppingLists ??= createSupabaseShoppingListRepository(client);
      return supabaseShoppingLists;
    }
  }

  return getDeviceShoppingListRepository();
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
