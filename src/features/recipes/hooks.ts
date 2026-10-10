import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppError, Result } from '@/lib/result';
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

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
}

/**
 * Runs a read, tracking loading and error state and discarding a result that
 * arrives after the inputs changed or the component unmounted.
 */
function useAsyncResult<T>(
  run: () => Promise<Result<T>>,
  deps: readonly unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    let active = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));

    void runRef.current().then((result) => {
      if (!active) return;
      setState(
        result.ok
          ? { data: result.value, loading: false, error: null }
          : { data: null, loading: false, error: result.error },
      );
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { ...state, reload };
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
  const [override, setOverride] = useState<ShoppingList | null>(null);

  const { data, loading, error, reload } = useAsyncResult(
    async () =>
      listId
        ? repository.getList(listId)
        : ({ ok: true, value: null } as Result<ShoppingList | null>),
    [repository, listId],
  );

  // Clear a stale override when the loaded list changes identity.
  useEffect(() => {
    setOverride(null);
  }, [listId]);

  const list = override ?? data ?? null;

  return {
    list,
    loading,
    error,
    notFound: !loading && error === null && data === null && Boolean(listId),
    reload,
    setList: setOverride,
  };
}
