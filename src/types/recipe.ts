/**
 * Recipe and shopping list types.
 *
 * Separate from `domain.ts`, which covers the food journal and nutrition. The
 * two share `NutrientSource`, because a recipe's nutrition needs exactly the
 * same honesty about where its numbers came from.
 */

import type { NutrientSource } from './domain';

// ---------------------------------------------------------------------------
// Cuisines
// ---------------------------------------------------------------------------

/**
 * Cuisines the recipe creator can target.
 *
 * A closed list, so the value can be stored, filtered and remembered. `other`
 * carries a free-text note for anything not listed.
 */
export type CuisineId =
  | 'bangladeshi'
  | 'indian'
  | 'pakistani'
  | 'sri_lankan'
  | 'thai'
  | 'vietnamese'
  | 'chinese'
  | 'japanese'
  | 'korean'
  | 'indonesian'
  | 'middle_eastern'
  | 'turkish'
  | 'north_african'
  | 'west_african'
  | 'ethiopian'
  | 'italian'
  | 'french'
  | 'spanish'
  | 'greek'
  | 'german'
  | 'british'
  | 'nordic'
  | 'mexican'
  | 'caribbean'
  | 'brazilian'
  | 'peruvian'
  | 'american'
  | 'other';

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/**
 * Units a recipe ingredient can use.
 *
 * Wider than the journal's `PortionUnit`, because recipes use measures a
 * nutrition database never needs ("2 cloves", "a pinch"). `to_taste` is a unit
 * with no quantity at all, which is why `quantity` is nullable.
 */
export type RecipeUnit =
  // Weight
  | 'g'
  | 'kg'
  | 'oz'
  | 'lb'
  // Volume
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'fl_oz'
  // Count and informal
  | 'piece'
  | 'slice'
  | 'clove'
  | 'can'
  | 'packet'
  | 'bunch'
  | 'handful'
  | 'pinch'
  | 'to_taste';

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

export interface RecipeIngredient {
  /** Stable id, so steps and the checklist can refer to this ingredient. */
  id: string;
  /** The food itself, e.g. "Basmati rice". No quantity, no preparation. */
  name: string;
  /**
   * Quantity for the recipe's BASE servings. Null for `to_taste` and for
   * anything the recipe genuinely does not quantify.
   */
  quantity: number | null;
  unit: RecipeUnit | null;
  /** How to prepare it, e.g. "finely chopped". Kept out of `name`. */
  preparation: string | null;
  /** Section heading, e.g. "For the marinade". Null for the main list. */
  group: string | null;
  /** A substitution the user could make, when the recipe offers one. */
  substitution: string | null;
  /**
   * Whether the quantity scales with servings.
   *
   * Most do. Some do not: oil for deep frying depends on the pan, not on how
   * many people are eating. Scaling those would produce nonsense.
   */
  scalesWithServings: boolean;
  /** True when the user said they already have this at home. */
  isOwned: boolean;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export interface RecipeStep {
  /** 1-based position, as shown to the user. */
  number: number;
  instruction: string;
  /** How long this step takes, when the recipe says. */
  durationMinutes: number | null;
  /** Oven or pan temperature in Celsius, when relevant. */
  temperatureC: number | null;
  /** Ingredient ids used here, so cooking mode can show just those. */
  ingredientIds: string[];
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

/**
 * Nutrition for ONE serving of the recipe.
 *
 * Per serving, not per recipe, so changing the serving count does not change
 * these numbers. `source` is required: a figure with no stated origin cannot
 * be shown, which the database also enforces.
 */
export interface RecipeNutrition {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: NutrientSource;
  /** The model or dataset behind the numbers. */
  providerLabel: string | null;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * How a recipe image was obtained.
 *
 * This drives the label shown beside it. An illustrative image must never be
 * presented as a photograph of the user's own cooking.
 */
export type RecipeImageKind =
  /** Produced by an image model. Illustrative only. */
  | 'ai_generated'
  /** From a licensed stock library. Illustrative only. */
  | 'stock_library'
  /** A photo the user took themselves. */
  | 'user_photo'
  /** No image available: a generated graphic stands in. */
  | 'placeholder';

export interface RecipeImage {
  /** Remote URL or local file URI. Null for a placeholder. */
  uri: string | null;
  kind: RecipeImageKind;
  /** Required attribution, when the provider asks for it. */
  attribution: string | null;
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export type RecipeOrigin = 'user_created' | 'ai_generated' | 'imported';

export interface Recipe {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  cuisine: CuisineId | null;
  /** Free text when `cuisine` is 'other'. */
  cuisineNote: string | null;
  origin: RecipeOrigin;

  /** The serving count the stored quantities are written for. */
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  /** Equipment needed, e.g. ["Large pot", "Oven"]. */
  equipment: string[];

  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  /** Practical tips, shown under the method. */
  tips: string[];
  tags: string[];

  nutritionPerServing: RecipeNutrition | null;
  image: RecipeImage | null;

  isFavorite: boolean;
  /**
   * Set when the user said they did not want this recipe. Food Memory stops
   * suggesting it rather than deleting it, so they can still find it.
   */
  rejectedAt: string | null;
  /** When the user last opened cooking mode for this recipe. */
  lastCookedAt: string | null;
  /** How many times they have cooked it. */
  cookCount: number;

  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Generation request
// ---------------------------------------------------------------------------

/** What the user asked for. Sent to the generator and kept for retries. */
export interface RecipeRequest {
  /**
   * What they typed: a dish name, a description, or a list of what they have.
   * `mode` says which.
   */
  prompt: string;
  mode: RecipeRequestMode;
  cuisine: CuisineId | null;
  cuisineNote: string | null;
  servings: number;
  /** Dietary patterns to respect, from the user's saved preferences. */
  dietaryPatterns: string[];
  /** Ingredients to avoid. Filtering only, never a safety guarantee. */
  avoidIngredients: string[];
  /** Equipment the user has. Empty means "assume a basic kitchen". */
  equipment: string[];
  /** Upper bound on total time, in minutes. Null for no limit. */
  maxTotalMinutes: number | null;
  /** Ingredients the user already has at home. */
  pantryIngredients: string[];
  /** Local file URI of a reference photo, for `from_photo` mode. */
  referenceImageUri: string | null;
}

export type RecipeRequestMode =
  /** "I want to cook chicken biryani." */
  | 'dish_name'
  /** "Something warm with lentils, not too spicy." */
  | 'description'
  /** "I have rice, eggs, onions. What can I cook?" */
  | 'from_pantry'
  /** "Show me how to make this." plus a photo. */
  | 'from_photo';

// ---------------------------------------------------------------------------
// Shopping lists
// ---------------------------------------------------------------------------

export type ShoppingListStatus = 'active' | 'archived';

export interface ShoppingListItem {
  id: string;
  listId: string;
  name: string;
  quantity: number | null;
  unit: RecipeUnit | null;
  /** Aisle or grouping, e.g. "Produce". */
  category: string | null;
  isChecked: boolean;
  note: string | null;
  position: number;
  /** Which recipe put this on the list, if any. */
  sourceRecipeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingList {
  id: string;
  userId: string;
  name: string;
  status: ShoppingListStatus;
  items: ShoppingListItem[];
  createdAt: string;
  updatedAt: string;
}
