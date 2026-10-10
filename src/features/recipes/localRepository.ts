import AsyncStorage from '@react-native-async-storage/async-storage';

import { newId } from '@/lib/id';
import { logger } from '@/lib/logger';
import { appError, err, ok, type Result } from '@/lib/result';
import type {
  Recipe,
  ShoppingList,
  ShoppingListItem,
  ShoppingListStatus,
} from '@/types/recipe';

import type {
  CreateRecipeInput,
  CreateShoppingListInput,
  ListRecipesOptions,
  NewShoppingListItem,
  RecipeRepository,
  ShoppingListRepository,
  UpdateRecipePatch,
  UpdateShoppingListItemPatch,
} from './repository';

/**
 * Device-only recipe and shopping list storage.
 *
 * Real persistence, not mock data: recipes survive restarts. The limits are
 * the same as the journal's local store - this device only, and capped - and
 * the UI says so.
 */

const RECIPES_KEY = 'foodlens.recipes.v1';
const LISTS_KEY = 'foodlens.shopping-lists.v1';

export const LOCAL_USER_ID = 'local-device';
export const LOCAL_RECIPE_LIMIT = 200;
export const LOCAL_LIST_LIMIT = 25;

/**
 * Serializes read-modify-write cycles.
 *
 * AsyncStorage has no transactions, so two concurrent saves would each read
 * the old array and the second would overwrite the first.
 */
let writeChain: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const run = writeChain.then(operation, operation);
  writeChain = run.catch(() => undefined);
  return run;
}

async function readArray<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (cause) {
    logger.warn('local recipes: unreadable stored value, starting fresh', {
      key,
      cause: String(cause),
    });
    return [];
  }
}

async function writeArray(key: string, value: unknown[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function storageError(cause: unknown) {
  return appError('unknown', 'Could not save to this device. Free up space and try again.', {
    detail: String(cause),
    retryable: true,
  });
}

function notFound(what: string) {
  return appError('not_found', `That ${what} no longer exists.`, { retryable: false });
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export function createLocalRecipeRepository(): RecipeRepository {
  const all = () => readArray<Recipe>(RECIPES_KEY);

  /** Applies a change to one recipe, or reports that it is gone. */
  function mutate(
    recipeId: string,
    change: (recipe: Recipe) => Recipe,
  ): Promise<Result<Recipe>> {
    return serialize(async () => {
      try {
        const recipes = await all();
        const index = recipes.findIndex((recipe) => recipe.id === recipeId);
        const existing = recipes[index];
        if (index < 0 || !existing) return err(notFound('recipe'));

        const updated: Recipe = {
          ...change(existing),
          // Identity and creation metadata are never rewritten by a change.
          id: existing.id,
          userId: existing.userId,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        };

        const next = [...recipes];
        next[index] = updated;
        await writeArray(RECIPES_KEY, next);
        return ok(updated);
      } catch (cause) {
        return err(storageError(cause));
      }
    });
  }

  return {
    kind: 'local',

    async listRecipes(options: ListRecipesOptions = {}) {
      try {
        let recipes = await all();

        if (!options.includeRejected) {
          recipes = recipes.filter((recipe) => recipe.rejectedAt === null);
        }
        if (options.favoritesOnly) {
          recipes = recipes.filter((recipe) => recipe.isFavorite);
        }

        recipes = recipes.sort((a, b) =>
          options.orderBy === 'cooked'
            ? (b.lastCookedAt ?? '').localeCompare(a.lastCookedAt ?? '')
            : b.updatedAt.localeCompare(a.updatedAt),
        );

        if (options.orderBy === 'cooked') {
          recipes = recipes.filter((recipe) => recipe.lastCookedAt !== null);
        }

        return ok(
          typeof options.limit === 'number'
            ? recipes.slice(0, Math.max(0, options.limit))
            : recipes,
        );
      } catch (cause) {
        return err(storageError(cause));
      }
    },

    async getRecipe(recipeId) {
      try {
        const recipes = await all();
        return ok(recipes.find((recipe) => recipe.id === recipeId) ?? null);
      } catch (cause) {
        return err(storageError(cause));
      }
    },

    createRecipe(input: CreateRecipeInput) {
      return serialize(async () => {
        try {
          const now = new Date().toISOString();
          const recipe: Recipe = {
            id: newId(),
            userId: LOCAL_USER_ID,
            title: input.title.trim(),
            description: input.description ?? null,
            cuisine: input.cuisine ?? null,
            cuisineNote: input.cuisineNote ?? null,
            origin: input.origin,
            servings: input.servings,
            prepMinutes: input.prepMinutes ?? null,
            cookMinutes: input.cookMinutes ?? null,
            equipment: input.equipment ?? [],
            ingredients: input.ingredients,
            steps: input.steps,
            tips: input.tips ?? [],
            tags: input.tags ?? [],
            nutritionPerServing: input.nutritionPerServing ?? null,
            image: input.image ?? null,
            isFavorite: false,
            rejectedAt: null,
            lastCookedAt: null,
            cookCount: 0,
            createdAt: now,
            updatedAt: now,
          };

          const recipes = await all();
          const next = [recipe, ...recipes]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, LOCAL_RECIPE_LIMIT);
          await writeArray(RECIPES_KEY, next);
          return ok(recipe);
        } catch (cause) {
          return err(storageError(cause));
        }
      });
    },

    updateRecipe(recipeId, patch: UpdateRecipePatch) {
      return mutate(recipeId, (recipe) => ({ ...recipe, ...patch }));
    },

    deleteRecipe(recipeId) {
      return serialize(async () => {
        try {
          const recipes = await all();
          const next = recipes.filter((recipe) => recipe.id !== recipeId);
          if (next.length === recipes.length) return err(notFound('recipe'));
          await writeArray(RECIPES_KEY, next);
          return ok(undefined);
        } catch (cause) {
          return err(storageError(cause));
        }
      });
    },

    setFavorite(recipeId, isFavorite) {
      return mutate(recipeId, (recipe) => ({ ...recipe, isFavorite }));
    },

    setRejected(recipeId, rejected) {
      return mutate(recipeId, (recipe) => ({
        ...recipe,
        rejectedAt: rejected ? new Date().toISOString() : null,
      }));
    },

    recordCooked(recipeId) {
      return mutate(recipeId, (recipe) => ({
        ...recipe,
        cookCount: recipe.cookCount + 1,
        lastCookedAt: new Date().toISOString(),
      }));
    },

    async searchRecipes(query) {
      try {
        const needle = query.trim().toLowerCase();
        if (needle.length === 0) return ok([]);

        const recipes = await all();
        return ok(
          recipes
            .filter((recipe) => {
              if (recipe.title.toLowerCase().includes(needle)) return true;
              if (recipe.description?.toLowerCase().includes(needle)) return true;
              return recipe.ingredients.some((ingredient) =>
                ingredient.name.toLowerCase().includes(needle),
              );
            })
            .sort((a, b) => {
              // A title match is a better answer than an ingredient match.
              const aTitle = a.title.toLowerCase().includes(needle) ? 0 : 1;
              const bTitle = b.title.toLowerCase().includes(needle) ? 0 : 1;
              if (aTitle !== bTitle) return aTitle - bTitle;
              return b.updatedAt.localeCompare(a.updatedAt);
            }),
        );
      } catch (cause) {
        return err(storageError(cause));
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Shopping lists
// ---------------------------------------------------------------------------

/**
 * Normalizes an item name for merge comparison.
 *
 * "Red Onions" and "red onions" are the same shopping line.
 */
function mergeKey(name: string, unit: ShoppingListItem['unit']): string {
  return `${name.trim().toLowerCase()}|${unit ?? ''}`;
}

export function createLocalShoppingListRepository(): ShoppingListRepository {
  const all = () => readArray<ShoppingList>(LISTS_KEY);

  function mutateList(
    listId: string,
    change: (list: ShoppingList) => ShoppingList,
  ): Promise<Result<ShoppingList>> {
    return serialize(async () => {
      try {
        const lists = await all();
        const index = lists.findIndex((list) => list.id === listId);
        const existing = lists[index];
        if (index < 0 || !existing) return err(notFound('shopping list'));

        const updated: ShoppingList = {
          ...change(existing),
          id: existing.id,
          userId: existing.userId,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        };

        const next = [...lists];
        next[index] = updated;
        await writeArray(LISTS_KEY, next);
        return ok(updated);
      } catch (cause) {
        return err(storageError(cause));
      }
    });
  }

  /** Finds the list holding a given item. */
  function mutateItemOwner(
    itemId: string,
    change: (list: ShoppingList) => ShoppingList,
  ): Promise<Result<ShoppingList>> {
    return serialize(async () => {
      try {
        const lists = await all();
        const index = lists.findIndex((list) =>
          list.items.some((item) => item.id === itemId),
        );
        const existing = lists[index];
        if (index < 0 || !existing) return err(notFound('shopping list item'));

        const updated: ShoppingList = {
          ...change(existing),
          updatedAt: new Date().toISOString(),
        };
        const next = [...lists];
        next[index] = updated;
        await writeArray(LISTS_KEY, next);
        return ok(updated);
      } catch (cause) {
        return err(storageError(cause));
      }
    });
  }

  function buildItem(
    listId: string,
    input: NewShoppingListItem,
    position: number,
  ): ShoppingListItem {
    const now = new Date().toISOString();
    return {
      id: newId(),
      listId,
      name: input.name.trim(),
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      category: input.category ?? null,
      isChecked: false,
      note: input.note ?? null,
      position,
      sourceRecipeId: input.sourceRecipeId ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    kind: 'local',

    async listLists(status) {
      try {
        const lists = await all();
        const filtered = status ? lists.filter((list) => list.status === status) : lists;
        return ok(filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      } catch (cause) {
        return err(storageError(cause));
      }
    },

    async getList(listId) {
      try {
        const lists = await all();
        return ok(lists.find((list) => list.id === listId) ?? null);
      } catch (cause) {
        return err(storageError(cause));
      }
    },

    createList(input: CreateShoppingListInput) {
      return serialize(async () => {
        try {
          const now = new Date().toISOString();
          const listId = newId();
          const list: ShoppingList = {
            id: listId,
            userId: LOCAL_USER_ID,
            name: input.name.trim(),
            status: 'active',
            items: (input.items ?? []).map((item, index) =>
              buildItem(listId, item, index),
            ),
            createdAt: now,
            updatedAt: now,
          };

          const lists = await all();
          const next = [list, ...lists].slice(0, LOCAL_LIST_LIMIT);
          await writeArray(LISTS_KEY, next);
          return ok(list);
        } catch (cause) {
          return err(storageError(cause));
        }
      });
    },

    renameList(listId, name) {
      return mutateList(listId, (list) => ({ ...list, name: name.trim() }));
    },

    setListStatus(listId, status: ShoppingListStatus) {
      return mutateList(listId, (list) => ({ ...list, status }));
    },

    deleteList(listId) {
      return serialize(async () => {
        try {
          const lists = await all();
          const next = lists.filter((list) => list.id !== listId);
          if (next.length === lists.length) return err(notFound('shopping list'));
          await writeArray(LISTS_KEY, next);
          return ok(undefined);
        } catch (cause) {
          return err(storageError(cause));
        }
      });
    },

    addItems(listId, items) {
      return mutateList(listId, (list) => {
        const merged = [...list.items];

        for (const incoming of items) {
          const name = incoming.name.trim();
          if (name.length === 0) continue;

          const key = mergeKey(name, incoming.unit ?? null);
          const existingIndex = merged.findIndex(
            (item) => mergeKey(item.name, item.unit) === key,
          );
          const existing = merged[existingIndex];

          if (existing) {
            // Same food and same unit: add the amounts together, so a second
            // recipe needing onions produces one line, not two.
            const combinedQuantity =
              existing.quantity === null || incoming.quantity === undefined || incoming.quantity === null
                ? (existing.quantity ?? incoming.quantity ?? null)
                : existing.quantity + incoming.quantity;

            merged[existingIndex] = {
              ...existing,
              quantity: combinedQuantity,
              // A merged line is needed again, so an earlier tick is cleared.
              isChecked: false,
              updatedAt: new Date().toISOString(),
            };
            continue;
          }

          merged.push(buildItem(list.id, { ...incoming, name }, merged.length));
        }

        return { ...list, items: merged };
      });
    },

    setItemChecked(itemId, isChecked) {
      return mutateItemOwner(itemId, (list) => ({
        ...list,
        items: list.items.map((item) =>
          item.id === itemId
            ? { ...item, isChecked, updatedAt: new Date().toISOString() }
            : item,
        ),
      }));
    },

    updateItem(itemId, patch: UpdateShoppingListItemPatch) {
      return mutateItemOwner(itemId, (list) => ({
        ...list,
        items: list.items.map((item) =>
          item.id === itemId
            ? { ...item, ...patch, updatedAt: new Date().toISOString() }
            : item,
        ),
      }));
    },

    deleteItem(itemId) {
      return mutateItemOwner(itemId, (list) => ({
        ...list,
        items: list.items
          .filter((item) => item.id !== itemId)
          // Keep positions contiguous so ordering stays stable.
          .map((item, index) => ({ ...item, position: index })),
      }));
    },

    clearChecked(listId) {
      return mutateList(listId, (list) => ({
        ...list,
        items: list.items
          .filter((item) => !item.isChecked)
          .map((item, index) => ({ ...item, position: index })),
      }));
    },
  };
}

/** Removes every locally stored recipe and shopping list. */
export async function clearLocalRecipes(): Promise<void> {
  await AsyncStorage.multiRemove([RECIPES_KEY, LISTS_KEY]);
}
