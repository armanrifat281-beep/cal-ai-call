import type { Result } from '@/lib/result';
import type {
  Recipe,
  RecipeIngredient,
  RecipeNutrition,
  RecipeRequest,
  RecipeStep,
  ShoppingList,
  ShoppingListItem,
  ShoppingListStatus,
} from '@/types/recipe';

/**
 * Recipe and shopping list storage contracts.
 *
 * Same pattern as the journal: one interface, a device-local implementation
 * and a Supabase one. Screens never learn which they got, which is what lets
 * the recipe creator work before an account exists.
 */

export interface RecipeRepository {
  readonly kind: 'local' | 'supabase';

  /** Saved recipes, newest first. Rejected ones are excluded by default. */
  listRecipes(options?: ListRecipesOptions): Promise<Result<Recipe[]>>;
  getRecipe(recipeId: string): Promise<Result<Recipe | null>>;
  createRecipe(input: CreateRecipeInput): Promise<Result<Recipe>>;
  updateRecipe(recipeId: string, patch: UpdateRecipePatch): Promise<Result<Recipe>>;
  deleteRecipe(recipeId: string): Promise<Result<void>>;

  /** Marks or unmarks a favourite. */
  setFavorite(recipeId: string, isFavorite: boolean): Promise<Result<Recipe>>;
  /**
   * Records that the user does not want this recipe. It stays stored but
   * stops appearing in suggestions.
   */
  setRejected(recipeId: string, rejected: boolean): Promise<Result<Recipe>>;
  /** Bumps the cook count and timestamp when cooking mode is finished. */
  recordCooked(recipeId: string): Promise<Result<Recipe>>;

  /** Case-insensitive search over title, description and ingredient names. */
  searchRecipes(query: string): Promise<Result<Recipe[]>>;
}

export interface ListRecipesOptions {
  /** Include recipes the user rejected. Default false. */
  includeRejected?: boolean;
  /** Only favourites. */
  favoritesOnly?: boolean;
  /** Most recently cooked first, instead of most recently updated. */
  orderBy?: 'updated' | 'cooked';
  limit?: number;
}

export interface CreateRecipeInput {
  title: string;
  description?: string | null;
  cuisine?: Recipe['cuisine'];
  cuisineNote?: string | null;
  origin: Recipe['origin'];
  servings: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  equipment?: string[];
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tips?: string[];
  tags?: string[];
  nutritionPerServing?: RecipeNutrition | null;
  image?: Recipe['image'];
  /** Kept so the recipe can be regenerated without retyping the request. */
  sourceRequest?: RecipeRequest | null;
}

export interface UpdateRecipePatch {
  title?: string;
  description?: string | null;
  cuisine?: Recipe['cuisine'];
  cuisineNote?: string | null;
  servings?: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  equipment?: string[];
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  tips?: string[];
  tags?: string[];
  nutritionPerServing?: RecipeNutrition | null;
  image?: Recipe['image'];
  isFavorite?: boolean;
}

// ---------------------------------------------------------------------------
// Shopping lists
// ---------------------------------------------------------------------------

export interface ShoppingListRepository {
  readonly kind: 'local' | 'supabase';

  listLists(status?: ShoppingListStatus): Promise<Result<ShoppingList[]>>;
  getList(listId: string): Promise<Result<ShoppingList | null>>;
  createList(input: CreateShoppingListInput): Promise<Result<ShoppingList>>;
  renameList(listId: string, name: string): Promise<Result<ShoppingList>>;
  setListStatus(
    listId: string,
    status: ShoppingListStatus,
  ): Promise<Result<ShoppingList>>;
  deleteList(listId: string): Promise<Result<void>>;

  /**
   * Adds items, merging anything already on the list.
   *
   * Merging matters: adding a second recipe that also needs onions should
   * produce one line, not two.
   */
  addItems(
    listId: string,
    items: NewShoppingListItem[],
  ): Promise<Result<ShoppingList>>;
  setItemChecked(itemId: string, isChecked: boolean): Promise<Result<ShoppingList>>;
  updateItem(
    itemId: string,
    patch: UpdateShoppingListItemPatch,
  ): Promise<Result<ShoppingList>>;
  deleteItem(itemId: string): Promise<Result<ShoppingList>>;
  /** Removes everything already ticked off. */
  clearChecked(listId: string): Promise<Result<ShoppingList>>;
}

export interface CreateShoppingListInput {
  name: string;
  items?: NewShoppingListItem[];
}

export type NewShoppingListItem = Pick<ShoppingListItem, 'name'> &
  Partial<
    Pick<
      ShoppingListItem,
      'quantity' | 'unit' | 'category' | 'note' | 'sourceRecipeId'
    >
  >;

export interface UpdateShoppingListItemPatch {
  name?: string;
  quantity?: number | null;
  unit?: ShoppingListItem['unit'];
  category?: string | null;
  note?: string | null;
}
