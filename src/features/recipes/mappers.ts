import { toNullableNumber, toNumber } from '@/lib/postgrest';
import type { NutrientSource } from '@/types/domain';
import type {
  CuisineId,
  Recipe,
  RecipeImage,
  RecipeImageKind,
  RecipeIngredient,
  RecipeNutrition,
  RecipeOrigin,
  RecipeStep,
  RecipeUnit,
  ShoppingList,
  ShoppingListItem,
  ShoppingListStatus,
} from '@/types/recipe';

import { toCuisineId } from './validate';

/**
 * Translation between database rows and recipe objects.
 *
 * Ingredients and steps are stored as `jsonb`, which means Postgres will
 * hand back whatever was put in without checking its shape. Anything read
 * out of those columns is therefore parsed defensively: a row written by an
 * older version of the app, or by a model that drifted, must degrade to a
 * usable recipe rather than crash a screen. A malformed ingredient is
 * dropped; it is never guessed at.
 */

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface RecipeRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  origin: string;
  cuisine: string | null;
  cuisine_note: string | null;
  servings: number | string;
  prep_minutes: number | string | null;
  cook_minutes: number | string | null;
  equipment: string[] | null;
  ingredients: unknown;
  steps: unknown;
  tips: string[] | null;
  tags: string[] | null;
  is_favorite: boolean;
  calories_kcal: number | string | null;
  protein_g: number | string | null;
  carbs_g: number | string | null;
  fat_g: number | string | null;
  nutrition_source: string | null;
  nutrition_provider_label: string | null;
  image_uri: string | null;
  image_kind: string | null;
  image_attribution: string | null;
  rejected_at: string | null;
  last_cooked_at: string | null;
  cook_count: number | string | null;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItemRow {
  id: string;
  list_id: string;
  user_id: string;
  name: string;
  quantity: number | string | null;
  unit: string | null;
  category: string | null;
  is_checked: boolean;
  note: string | null;
  position: number | string;
  source_recipe_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListRow {
  id: string;
  user_id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  shopping_list_items?: ShoppingListItemRow[] | null;
}

// ---------------------------------------------------------------------------
// Enumerated values
// ---------------------------------------------------------------------------

const ORIGINS = new Set<string>([
  'user_created',
  'ai_generated',
  'imported',
  'demo_sample',
  // Written by an earlier version of the schema. Read, never written.
  'ai_suggested',
]);

const UNITS = new Set<string>([
  'g', 'kg', 'oz', 'lb',
  'ml', 'l', 'tsp', 'tbsp', 'cup', 'fl_oz',
  'piece', 'slice', 'clove', 'can', 'packet', 'bunch', 'handful', 'pinch',
  'to_taste',
]);

const IMAGE_KINDS = new Set<string>([
  'ai_generated',
  'stock_library',
  'user_photo',
  'placeholder',
]);

const NUTRIENT_SOURCES = new Set<string>([
  'database',
  'ai_estimate',
  'user_entered',
  'demo_sample',
]);

function toOrigin(value: unknown): RecipeOrigin {
  if (typeof value !== 'string' || !ORIGINS.has(value)) return 'user_created';
  // The old name and the current one mean the same thing to the app.
  return (value === 'ai_suggested' ? 'ai_generated' : value) as RecipeOrigin;
}

export function toRecipeUnit(value: unknown): RecipeUnit | null {
  return typeof value === 'string' && UNITS.has(value) ? (value as RecipeUnit) : null;
}

function toImageKind(value: unknown): RecipeImageKind | null {
  return typeof value === 'string' && IMAGE_KINDS.has(value)
    ? (value as RecipeImageKind)
    : null;
}

function toNutrientSource(value: unknown): NutrientSource | null {
  return typeof value === 'string' && NUTRIENT_SOURCES.has(value)
    ? (value as NutrientSource)
    : null;
}

function toText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, max);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

// ---------------------------------------------------------------------------
// The jsonb columns
// ---------------------------------------------------------------------------

/**
 * Ingredients, from whatever is in the column.
 *
 * An entry without an id or a name cannot be rendered or referred to by a
 * step, so it is dropped rather than patched up with a placeholder.
 */
export function parseIngredients(value: unknown): RecipeIngredient[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): RecipeIngredient[] => {
    if (!entry || typeof entry !== 'object') return [];
    const raw = entry as Record<string, unknown>;

    const id = typeof raw.id === 'string' ? raw.id : null;
    const name = toText(raw.name, 200);
    if (!id || !name) return [];

    return [
      {
        id,
        name,
        quantity: toNullableNumber(raw.quantity as number | string | null),
        unit: toRecipeUnit(raw.unit),
        preparation: toText(raw.preparation, 200),
        group: toText(raw.group, 120),
        substitution: toText(raw.substitution, 300),
        // Most quantities scale. Only an explicit false says otherwise, so a
        // row written before the field existed keeps the common behaviour.
        scalesWithServings: raw.scalesWithServings !== false,
        isOwned: raw.isOwned === true,
      },
    ];
  });
}

/** Steps, renumbered from their order so the sequence is always 1..n. */
export function parseSteps(value: unknown): RecipeStep[] {
  if (!Array.isArray(value)) return [];

  const parsed = value.flatMap((entry): Omit<RecipeStep, 'number'>[] => {
    if (!entry || typeof entry !== 'object') return [];
    const raw = entry as Record<string, unknown>;

    const instruction = toText(raw.instruction, 2000);
    if (!instruction) return [];

    return [
      {
        instruction,
        durationMinutes: toNullableNumber(raw.durationMinutes as number | string | null),
        temperatureC: toNullableNumber(raw.temperatureC as number | string | null),
        ingredientIds: toStringArray(raw.ingredientIds),
      },
    ];
  });

  return parsed.map((step, index) => ({ ...step, number: index + 1 }));
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

function rowToNutrition(row: RecipeRow): RecipeNutrition | null {
  const source = toNutrientSource(row.nutrition_source);
  // The schema requires a source whenever a figure is stored. Without one
  // the numbers cannot be labelled, and an unlabelled figure is not shown.
  if (!source) return null;

  return {
    caloriesKcal: toNumber(row.calories_kcal),
    proteinG: toNumber(row.protein_g),
    carbsG: toNumber(row.carbs_g),
    fatG: toNumber(row.fat_g),
    source,
    providerLabel: row.nutrition_provider_label,
  };
}

function rowToImage(row: RecipeRow): RecipeImage | null {
  const kind = toImageKind(row.image_kind);
  if (!kind) return null;
  return {
    uri: row.image_uri,
    kind,
    attribution: row.image_attribution,
  };
}

export function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    cuisine: toCuisineId(row.cuisine) as CuisineId | null,
    cuisineNote: row.cuisine_note,
    origin: toOrigin(row.origin),
    servings: Math.max(1, Math.round(toNumber(row.servings))),
    prepMinutes: toNullableNumber(row.prep_minutes),
    cookMinutes: toNullableNumber(row.cook_minutes),
    equipment: toStringArray(row.equipment),
    ingredients: parseIngredients(row.ingredients),
    steps: parseSteps(row.steps),
    tips: toStringArray(row.tips),
    tags: toStringArray(row.tags),
    nutritionPerServing: rowToNutrition(row),
    image: rowToImage(row),
    isFavorite: row.is_favorite === true,
    rejectedAt: row.rejected_at,
    lastCookedAt: row.last_cooked_at,
    cookCount: Math.max(0, Math.round(toNumber(row.cook_count))),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The columns a recipe write sets.
 *
 * `user_id` is deliberately absent: the column defaults to the caller's own
 * id and Row Level Security refuses anything else, so sending it would add
 * a value the client could get wrong without adding any protection.
 */
export function recipeFieldsToColumns(
  fields: Partial<{
    title: string;
    description: string | null;
    cuisine: CuisineId | null;
    cuisineNote: string | null;
    origin: RecipeOrigin;
    servings: number;
    prepMinutes: number | null;
    cookMinutes: number | null;
    equipment: string[];
    ingredients: RecipeIngredient[];
    steps: RecipeStep[];
    tips: string[];
    tags: string[];
    nutritionPerServing: RecipeNutrition | null;
    image: RecipeImage | null;
    isFavorite: boolean;
  }>,
): Record<string, unknown> {
  const columns: Record<string, unknown> = {};

  if (fields.title !== undefined) columns.title = fields.title.trim();
  if (fields.description !== undefined) columns.description = fields.description;
  if (fields.cuisine !== undefined) columns.cuisine = fields.cuisine;
  if (fields.cuisineNote !== undefined) columns.cuisine_note = fields.cuisineNote;
  if (fields.origin !== undefined) columns.origin = fields.origin;
  if (fields.servings !== undefined) columns.servings = fields.servings;
  if (fields.prepMinutes !== undefined) columns.prep_minutes = fields.prepMinutes;
  if (fields.cookMinutes !== undefined) columns.cook_minutes = fields.cookMinutes;
  if (fields.equipment !== undefined) columns.equipment = fields.equipment;
  if (fields.ingredients !== undefined) columns.ingredients = fields.ingredients;
  if (fields.steps !== undefined) columns.steps = fields.steps;
  if (fields.tips !== undefined) columns.tips = fields.tips;
  if (fields.tags !== undefined) columns.tags = fields.tags;
  if (fields.isFavorite !== undefined) columns.is_favorite = fields.isFavorite;

  if (fields.nutritionPerServing !== undefined) {
    const nutrition = fields.nutritionPerServing;
    columns.calories_kcal = nutrition?.caloriesKcal ?? null;
    columns.protein_g = nutrition?.proteinG ?? null;
    columns.carbs_g = nutrition?.carbsG ?? null;
    columns.fat_g = nutrition?.fatG ?? null;
    columns.nutrition_source = nutrition?.source ?? null;
    columns.nutrition_provider_label = nutrition?.providerLabel ?? null;
  }

  if (fields.image !== undefined) {
    columns.image_uri = fields.image?.uri ?? null;
    columns.image_kind = fields.image?.kind ?? null;
    columns.image_attribution = fields.image?.attribution ?? null;
  }

  return columns;
}

// ---------------------------------------------------------------------------
// Shopping lists
// ---------------------------------------------------------------------------

export function rowToShoppingListItem(row: ShoppingListItemRow): ShoppingListItem {
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    quantity: toNullableNumber(row.quantity),
    unit: toRecipeUnit(row.unit),
    category: row.category,
    isChecked: row.is_checked === true,
    note: row.note,
    position: Math.max(0, Math.round(toNumber(row.position))),
    sourceRecipeId: row.source_recipe_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToShoppingList(row: ShoppingListRow): ShoppingList {
  const items = (row.shopping_list_items ?? [])
    .map(rowToShoppingListItem)
    // PostgREST does not promise the order of an embedded collection, and
    // the list is shown in position order.
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    status: row.status === 'archived' ? 'archived' : ('active' as ShoppingListStatus),
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
