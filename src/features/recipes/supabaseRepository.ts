import type { SupabaseClient } from '@supabase/supabase-js';

import { mapPostgrestError, mapThrownError } from '@/lib/postgrest';
import { appError, err, ok, type Result } from '@/lib/result';
import type { Recipe, ShoppingList, ShoppingListStatus } from '@/types/recipe';

import {
  recipeFieldsToColumns,
  rowToRecipe,
  rowToShoppingList,
  type RecipeRow,
  type ShoppingListRow,
} from './mappers';
import { planShoppingMerge } from './mergeItems';
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
 * Supabase-backed recipe and shopping list storage.
 *
 * Implements the same contracts as the device-local store, so no screen
 * changes when a user signs in. Until this existed, signing in backed up the
 * journal and quietly left recipes and shopping lists on the phone, where
 * losing the phone lost them.
 *
 * No query filters by user id. Row Level Security already restricts every
 * row to its owner, and a client-side filter would imply it was the security
 * boundary when it is not.
 */

/** A list with its items in one round trip. */
const LIST_WITH_ITEMS = '*, shopping_list_items(*)';

/**
 * How many recipes a search reads before filtering.
 *
 * Search matches ingredient names as well as the title and description, and
 * ingredients live in a `jsonb` column that PostgREST cannot filter inside.
 * Rather than let the remote store find different recipes from the local one,
 * both filter the same way over the same fields; this caps how much is read
 * to do it. A personal cookbook is tens to low hundreds of recipes, so the
 * cap is generous. Past it, search would need a tsvector column and an
 * index, which is a migration rather than a client change.
 */
const SEARCH_SCAN_LIMIT = 500;

export function createSupabaseRecipeRepository(
  client: SupabaseClient,
): RecipeRepository {
  /** Reads one recipe back after a write, so callers get the stored truth. */
  async function readRecipe(recipeId: string, context: string): Promise<Result<Recipe>> {
    const { data, error } = await client
      .from('saved_recipes')
      .select('*')
      .eq('id', recipeId)
      .limit(1);

    if (error) return err(mapPostgrestError(error, context));
    const row = (data as RecipeRow[] | null)?.[0];
    if (!row) {
      return err(
        appError('not_found', 'That recipe is no longer saved.', {
          detail: `${context}: no row for ${recipeId}`,
          retryable: false,
        }),
      );
    }
    return ok(rowToRecipe(row));
  }

  async function patchRecipe(
    recipeId: string,
    columns: Record<string, unknown>,
    context: string,
  ): Promise<Result<Recipe>> {
    try {
      const { error } = await client
        .from('saved_recipes')
        .update(columns)
        .eq('id', recipeId);

      if (error) return err(mapPostgrestError(error, context));
      return await readRecipe(recipeId, context);
    } catch (cause) {
      return err(mapThrownError(cause, context));
    }
  }

  return {
    kind: 'supabase',

    async listRecipes(options: ListRecipesOptions = {}) {
      try {
        let query = client.from('saved_recipes').select('*');

        // Rejected recipes are hidden rather than deleted, so they are
        // excluded here unless asked for.
        if (options.includeRejected !== true) {
          query = query.is('rejected_at', null);
        }
        if (options.favoritesOnly) query = query.eq('is_favorite', true);

        query =
          options.orderBy === 'cooked'
            ? query.order('last_cooked_at', { ascending: false, nullsFirst: false })
            : query.order('updated_at', { ascending: false });

        if (options.limit !== undefined) query = query.limit(options.limit);

        const { data, error } = await query;
        if (error) return err(mapPostgrestError(error, 'listRecipes'));
        return ok(((data as RecipeRow[] | null) ?? []).map(rowToRecipe));
      } catch (cause) {
        return err(mapThrownError(cause, 'listRecipes'));
      }
    },

    async getRecipe(recipeId: string) {
      try {
        const { data, error } = await client
          .from('saved_recipes')
          .select('*')
          .eq('id', recipeId)
          .limit(1);

        if (error) return err(mapPostgrestError(error, 'getRecipe'));
        const row = (data as RecipeRow[] | null)?.[0];
        // Missing is a valid answer here, not a failure: the screen shows
        // "no longer saved" rather than an error.
        return ok(row ? rowToRecipe(row) : null);
      } catch (cause) {
        return err(mapThrownError(cause, 'getRecipe'));
      }
    },

    async createRecipe(input: CreateRecipeInput) {
      try {
        const columns = {
          ...recipeFieldsToColumns({
            title: input.title,
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
          }),
          // Kept so a generated recipe can be regenerated without the user
          // retyping what they asked for. Not part of the domain object.
          source_request: input.sourceRequest ?? null,
        };

        const { data, error } = await client
          .from('saved_recipes')
          .insert(columns)
          .select('*')
          .single();

        if (error) {
          // The database keeps recipe titles unique per user, case
          // insensitively, which the device-local store does not. Saying
          // which name clashed is the difference between a usable message
          // and "some of those values are not valid".
          if (error.code === '23505') {
            return err(
              appError(
                'validation',
                `You already have a recipe called "${input.title.trim()}". Give this one a different name.`,
                { detail: `createRecipe: ${error.message}`, retryable: false },
              ),
            );
          }
          return err(mapPostgrestError(error, 'createRecipe'));
        }
        return ok(rowToRecipe(data as RecipeRow));
      } catch (cause) {
        return err(mapThrownError(cause, 'createRecipe'));
      }
    },

    async updateRecipe(recipeId: string, patch: UpdateRecipePatch) {
      const columns = recipeFieldsToColumns(patch);
      if (Object.keys(columns).length === 0) {
        return readRecipe(recipeId, 'updateRecipe');
      }
      return patchRecipe(recipeId, columns, 'updateRecipe');
    },

    async deleteRecipe(recipeId: string) {
      try {
        const { error } = await client
          .from('saved_recipes')
          .delete()
          .eq('id', recipeId);

        if (error) return err(mapPostgrestError(error, 'deleteRecipe'));
        return ok(undefined);
      } catch (cause) {
        return err(mapThrownError(cause, 'deleteRecipe'));
      }
    },

    async setFavorite(recipeId: string, isFavorite: boolean) {
      return patchRecipe(recipeId, { is_favorite: isFavorite }, 'setFavorite');
    },

    async setRejected(recipeId: string, rejected: boolean) {
      // A timestamp rather than a flag, so "when did they say no" survives.
      return patchRecipe(
        recipeId,
        { rejected_at: rejected ? new Date().toISOString() : null },
        'setRejected',
      );
    },

    async recordCooked(recipeId: string) {
      try {
        const current = await readRecipe(recipeId, 'recordCooked');
        if (!current.ok) return current;

        return await patchRecipe(
          recipeId,
          {
            last_cooked_at: new Date().toISOString(),
            cook_count: current.value.cookCount + 1,
          },
          'recordCooked',
        );
      } catch (cause) {
        return err(mapThrownError(cause, 'recordCooked'));
      }
    },

    async searchRecipes(query: string) {
      const needle = query.trim().toLowerCase();
      if (needle.length === 0) return ok([]);

      try {
        const { data, error } = await client
          .from('saved_recipes')
          .select('*')
          .is('rejected_at', null)
          .order('updated_at', { ascending: false })
          .limit(SEARCH_SCAN_LIMIT);

        if (error) return err(mapPostgrestError(error, 'searchRecipes'));

        const matches = ((data as RecipeRow[] | null) ?? [])
          .map(rowToRecipe)
          .filter((recipe) => {
            const haystack = [
              recipe.title,
              recipe.description ?? '',
              ...recipe.ingredients.map((ingredient) => ingredient.name),
            ]
              .join(' ')
              .toLowerCase();
            return haystack.includes(needle);
          });

        return ok(matches);
      } catch (cause) {
        return err(mapThrownError(cause, 'searchRecipes'));
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Shopping lists
// ---------------------------------------------------------------------------

export function createSupabaseShoppingListRepository(
  client: SupabaseClient,
): ShoppingListRepository {
  async function readList(listId: string, context: string): Promise<Result<ShoppingList>> {
    const { data, error } = await client
      .from('shopping_lists')
      .select(LIST_WITH_ITEMS)
      .eq('id', listId)
      .limit(1);

    if (error) return err(mapPostgrestError(error, context));
    const row = (data as ShoppingListRow[] | null)?.[0];
    if (!row) {
      return err(
        appError('not_found', 'That shopping list no longer exists.', {
          detail: `${context}: no row for ${listId}`,
          retryable: false,
        }),
      );
    }
    return ok(rowToShoppingList(row));
  }

  /** The list an item belongs to, so an item write can return the whole list. */
  async function listIdForItem(
    itemId: string,
    context: string,
  ): Promise<Result<string>> {
    const { data, error } = await client
      .from('shopping_list_items')
      .select('list_id')
      .eq('id', itemId)
      .limit(1);

    if (error) return err(mapPostgrestError(error, context));
    const row = (data as { list_id: string }[] | null)?.[0];
    if (!row) {
      return err(
        appError('not_found', 'That item is no longer on the list.', {
          detail: `${context}: no row for ${itemId}`,
          retryable: false,
        }),
      );
    }
    return ok(row.list_id);
  }

  function itemColumns(
    listId: string,
    input: NewShoppingListItem,
    position: number,
  ): Record<string, unknown> {
    return {
      list_id: listId,
      name: input.name.trim(),
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      category: input.category ?? null,
      note: input.note ?? null,
      position,
      source_recipe_id: input.sourceRecipeId ?? null,
    };
  }

  return {
    kind: 'supabase',

    async listLists(status?: ShoppingListStatus) {
      try {
        let query = client.from('shopping_lists').select(LIST_WITH_ITEMS);
        if (status) query = query.eq('status', status);
        query = query.order('updated_at', { ascending: false });

        const { data, error } = await query;
        if (error) return err(mapPostgrestError(error, 'listLists'));
        return ok(((data as ShoppingListRow[] | null) ?? []).map(rowToShoppingList));
      } catch (cause) {
        return err(mapThrownError(cause, 'listLists'));
      }
    },

    async getList(listId: string) {
      try {
        const { data, error } = await client
          .from('shopping_lists')
          .select(LIST_WITH_ITEMS)
          .eq('id', listId)
          .limit(1);

        if (error) return err(mapPostgrestError(error, 'getList'));
        const row = (data as ShoppingListRow[] | null)?.[0];
        return ok(row ? rowToShoppingList(row) : null);
      } catch (cause) {
        return err(mapThrownError(cause, 'getList'));
      }
    },

    async createList(input: CreateShoppingListInput) {
      try {
        const { data, error } = await client
          .from('shopping_lists')
          .insert({ name: input.name.trim() })
          .select('id')
          .single();

        if (error) return err(mapPostgrestError(error, 'createList'));
        const listId = (data as { id: string }).id;

        const items = (input.items ?? []).filter(
          (item) => item.name.trim().length > 0,
        );
        if (items.length > 0) {
          const { error: itemsError } = await client
            .from('shopping_list_items')
            .insert(items.map((item, index) => itemColumns(listId, item, index)));

          if (itemsError) {
            return err(mapPostgrestError(itemsError, 'createList.items'));
          }
        }

        return await readList(listId, 'createList');
      } catch (cause) {
        return err(mapThrownError(cause, 'createList'));
      }
    },

    async renameList(listId: string, name: string) {
      try {
        const { error } = await client
          .from('shopping_lists')
          .update({ name: name.trim() })
          .eq('id', listId);

        if (error) return err(mapPostgrestError(error, 'renameList'));
        return await readList(listId, 'renameList');
      } catch (cause) {
        return err(mapThrownError(cause, 'renameList'));
      }
    },

    async setListStatus(listId: string, status: ShoppingListStatus) {
      try {
        const { error } = await client
          .from('shopping_lists')
          .update({ status })
          .eq('id', listId);

        if (error) return err(mapPostgrestError(error, 'setListStatus'));
        return await readList(listId, 'setListStatus');
      } catch (cause) {
        return err(mapThrownError(cause, 'setListStatus'));
      }
    },

    async deleteList(listId: string) {
      try {
        const { error } = await client
          .from('shopping_lists')
          .delete()
          .eq('id', listId);

        if (error) return err(mapPostgrestError(error, 'deleteList'));
        return ok(undefined);
      } catch (cause) {
        return err(mapThrownError(cause, 'deleteList'));
      }
    },

    async addItems(listId: string, items: NewShoppingListItem[]) {
      try {
        const current = await readList(listId, 'addItems');
        if (!current.ok) return current;

        // The merge rule is shared with the device-local store, so adding
        // the same recipe twice behaves identically either side of sign-in.
        const plan = planShoppingMerge(current.value.items, items);

        for (const update of plan.updates) {
          const { error } = await client
            .from('shopping_list_items')
            // A merged line is needed again, so an earlier tick is cleared.
            .update({ quantity: update.quantity, is_checked: false })
            .eq('id', update.id);

          if (error) return err(mapPostgrestError(error, 'addItems.merge'));
        }

        if (plan.inserts.length > 0) {
          const { error } = await client
            .from('shopping_list_items')
            .insert(
              plan.inserts.map((insert) =>
                itemColumns(listId, insert.input, insert.position),
              ),
            );

          if (error) return err(mapPostgrestError(error, 'addItems.insert'));
        }

        return await readList(listId, 'addItems');
      } catch (cause) {
        return err(mapThrownError(cause, 'addItems'));
      }
    },

    async setItemChecked(itemId: string, isChecked: boolean) {
      try {
        const listId = await listIdForItem(itemId, 'setItemChecked');
        if (!listId.ok) return listId;

        const { error } = await client
          .from('shopping_list_items')
          .update({ is_checked: isChecked })
          .eq('id', itemId);

        if (error) return err(mapPostgrestError(error, 'setItemChecked'));
        return await readList(listId.value, 'setItemChecked');
      } catch (cause) {
        return err(mapThrownError(cause, 'setItemChecked'));
      }
    },

    async updateItem(itemId: string, patch: UpdateShoppingListItemPatch) {
      try {
        const listId = await listIdForItem(itemId, 'updateItem');
        if (!listId.ok) return listId;

        const columns: Record<string, unknown> = {};
        if (patch.name !== undefined) columns.name = patch.name.trim();
        if (patch.quantity !== undefined) columns.quantity = patch.quantity;
        if (patch.unit !== undefined) columns.unit = patch.unit;
        if (patch.category !== undefined) columns.category = patch.category;
        if (patch.note !== undefined) columns.note = patch.note;

        if (Object.keys(columns).length > 0) {
          const { error } = await client
            .from('shopping_list_items')
            .update(columns)
            .eq('id', itemId);

          if (error) return err(mapPostgrestError(error, 'updateItem'));
        }

        return await readList(listId.value, 'updateItem');
      } catch (cause) {
        return err(mapThrownError(cause, 'updateItem'));
      }
    },

    async deleteItem(itemId: string) {
      try {
        const listId = await listIdForItem(itemId, 'deleteItem');
        if (!listId.ok) return listId;

        const { error } = await client
          .from('shopping_list_items')
          .delete()
          .eq('id', itemId);

        if (error) return err(mapPostgrestError(error, 'deleteItem'));
        return await readList(listId.value, 'deleteItem');
      } catch (cause) {
        return err(mapThrownError(cause, 'deleteItem'));
      }
    },

    async clearChecked(listId: string) {
      try {
        const { error } = await client
          .from('shopping_list_items')
          .delete()
          .eq('list_id', listId)
          .eq('is_checked', true);

        if (error) return err(mapPostgrestError(error, 'clearChecked'));
        return await readList(listId, 'clearChecked');
      } catch (cause) {
        return err(mapThrownError(cause, 'clearChecked'));
      }
    },
  };
}
