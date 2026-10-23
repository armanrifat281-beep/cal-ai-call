import { createRevision } from '@/lib/revision';

import type { RecipeRepository, ShoppingListRepository } from './repository';

/**
 * Recipes and shopping lists, kept fresh across screens.
 *
 * Same problem the journal has, for the same reason: the tabs stay mounted,
 * so a recipe saved in `/recipe/create` did not appear on the Recipes tab,
 * and an item added to a list did not show on another screen reading the
 * same list, until something forced a remount.
 *
 * Writes are tracked by wrapping the repository rather than by asking each
 * screen to remember: the screens that write are spread across
 * `recipe/create`, `shopping/index` and `shopping/[id]`, and "remember to
 * reload" is the instruction that produces exactly this bug.
 */

export const recipeRevision = createRevision();

async function tracked<T>(promise: Promise<T>, isOk: (value: T) => boolean): Promise<T> {
  const result = await promise;
  // Bump on success only: a failed write changed nothing to re-read.
  if (isOk(result)) recipeRevision.bump();
  return result;
}

const ok = (value: { ok: boolean }) => value.ok;

export function trackRecipeWrites(repository: RecipeRepository): RecipeRepository {
  return {
    ...repository,
    createRecipe: (input) => tracked(repository.createRecipe(input), ok),
    updateRecipe: (id, patch) => tracked(repository.updateRecipe(id, patch), ok),
    deleteRecipe: (id) => tracked(repository.deleteRecipe(id), ok),
    setFavorite: (id, isFavorite) => tracked(repository.setFavorite(id, isFavorite), ok),
    setRejected: (id, rejected) => tracked(repository.setRejected(id, rejected), ok),
    recordCooked: (id) => tracked(repository.recordCooked(id), ok),
  };
}

export function trackShoppingWrites(
  repository: ShoppingListRepository,
): ShoppingListRepository {
  return {
    ...repository,
    createList: (input) => tracked(repository.createList(input), ok),
    setListStatus: (id, status) => tracked(repository.setListStatus(id, status), ok),
    deleteList: (id) => tracked(repository.deleteList(id), ok),
    addItems: (id, items) => tracked(repository.addItems(id, items), ok),
    setItemChecked: (id, isChecked) =>
      tracked(repository.setItemChecked(id, isChecked), ok),
    updateItem: (id, patch) => tracked(repository.updateItem(id, patch), ok),
    deleteItem: (id) => tracked(repository.deleteItem(id), ok),
  };
}
