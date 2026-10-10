import { appError, type AppError } from '@/lib/result';
import type {
  ConfidenceLevel,
  FoodEntry,
  FoodEntryItem,
  MealType,
  NutrientSource,
  Nutrients,
  PortionUnit,
  SavedMeal,
} from '@/types/domain';

/**
 * Translation between database rows and domain objects.
 *
 * Kept separate from the repository so it can be tested without a client. Two
 * things need care:
 *
 *  - column names are snake_case in Postgres and camelCase in TypeScript;
 *  - `numeric` columns arrive over the wire as JSON numbers in most cases but
 *    as strings when PostgREST preserves precision, so every numeric field is
 *    coerced rather than trusted. A silent `"234"` where a number is expected
 *    turns a daily total into string concatenation.
 */

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface FoodEntryItemRow {
  id: string;
  entry_id: string;
  user_id: string;
  name: string;
  brand: string | null;
  portion_quantity: number | string;
  portion_unit: string;
  grams_resolved: number | string | null;
  calories_kcal: number | string;
  protein_g: number | string;
  carbs_g: number | string;
  fat_g: number | string;
  fiber_g: number | string | null;
  sugar_g: number | string | null;
  saturated_fat_g: number | string | null;
  sodium_mg: number | string | null;
  source: string;
  confidence: string;
  provider_label: string | null;
  provider_ref: string | null;
  food_record_id: string | null;
  notes: string | null;
  position: number;
}

export interface FoodEntryRow {
  id: string;
  user_id: string;
  consumed_at: string;
  meal_type: string;
  title: string;
  photo_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Present when the query embeds the items. */
  food_entry_items?: FoodEntryItemRow[] | null;
}

export interface SavedMealRow {
  id: string;
  user_id: string;
  name: string;
  meal_type: string | null;
  items: unknown;
  use_count: number | string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Coercion
// ---------------------------------------------------------------------------

/** A required numeric column. Falls back to 0 only when truly unusable. */
export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * An optional numeric column.
 *
 * Null stays null: it means "unknown", which the app shows as a dash and
 * never as zero.
 */
export function toNullableNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const MEAL_TYPES = new Set<string>(['breakfast', 'lunch', 'dinner', 'snack']);
const SOURCES = new Set<string>([
  'database',
  'ai_estimate',
  'user_entered',
  'demo_sample',
]);
const CONFIDENCES = new Set<string>(['high', 'medium', 'low']);
const PORTION_UNITS = new Set<string>([
  'g',
  'ml',
  'oz',
  'piece',
  'slice',
  'cup',
  'tbsp',
  'tsp',
  'serving',
]);

function toMealType(value: string | null): MealType {
  return MEAL_TYPES.has(value ?? '') ? (value as MealType) : 'snack';
}

function toSource(value: string): NutrientSource {
  // An unrecognised source is treated as a model estimate, which is the
  // weaker claim. Defaulting to `database` would assert verification we
  // cannot demonstrate.
  return SOURCES.has(value) ? (value as NutrientSource) : 'ai_estimate';
}

function toConfidence(value: string): ConfidenceLevel {
  // Unknown confidence becomes the lowest, never the highest.
  return CONFIDENCES.has(value) ? (value as ConfidenceLevel) : 'low';
}

function toPortionUnit(value: string): PortionUnit {
  return PORTION_UNITS.has(value) ? (value as PortionUnit) : 'serving';
}

// ---------------------------------------------------------------------------
// Row -> domain
// ---------------------------------------------------------------------------

export function rowToNutrients(row: FoodEntryItemRow): Nutrients {
  return {
    caloriesKcal: toNumber(row.calories_kcal),
    proteinG: toNumber(row.protein_g),
    carbsG: toNumber(row.carbs_g),
    fatG: toNumber(row.fat_g),
    fiberG: toNullableNumber(row.fiber_g),
    sugarG: toNullableNumber(row.sugar_g),
    saturatedFatG: toNullableNumber(row.saturated_fat_g),
    sodiumMg: toNullableNumber(row.sodium_mg),
  };
}

export function rowToItem(row: FoodEntryItemRow): FoodEntryItem {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    portion: {
      quantity: toNumber(row.portion_quantity),
      unit: toPortionUnit(row.portion_unit),
    },
    gramsResolved: toNullableNumber(row.grams_resolved),
    nutrients: rowToNutrients(row),
    provenance: {
      source: toSource(row.source),
      confidence: toConfidence(row.confidence),
      providerLabel: row.provider_label,
      providerRef: row.provider_ref,
    },
    foodRecordId: row.food_record_id,
    notes: row.notes,
  };
}

export function rowToEntry(row: FoodEntryRow): FoodEntry {
  const items = (row.food_entry_items ?? [])
    // Order is a property of the meal, and an embedded select does not
    // guarantee it, so sort explicitly.
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(rowToItem);

  return {
    id: row.id,
    userId: row.user_id,
    consumedAt: row.consumed_at,
    mealType: toMealType(row.meal_type),
    title: row.title,
    items,
    photoPath: row.photo_path,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToSavedMeal(row: SavedMealRow): SavedMeal {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    mealType: row.meal_type === null ? null : toMealType(row.meal_type),
    items: Array.isArray(row.items) ? (row.items as FoodEntryItem[]) : [],
    useCount: toNumber(row.use_count),
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Domain -> RPC payload
// ---------------------------------------------------------------------------

/**
 * The shape `create_food_entry` and `update_food_entry` expect.
 *
 * Deliberately snake_case: it is a database payload, not a domain object. The
 * item's client-side id is NOT sent; Postgres issues its own.
 */
export interface FoodEntryItemPayload {
  name: string;
  brand: string | null;
  portion_quantity: number;
  portion_unit: PortionUnit;
  grams_resolved: number | null;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
  sodium_mg: number | null;
  source: NutrientSource;
  confidence: ConfidenceLevel;
  provider_label: string | null;
  provider_ref: string | null;
  food_record_id: string | null;
  notes: string | null;
}

export function itemToPayload(item: FoodEntryItem): FoodEntryItemPayload {
  return {
    name: item.name.trim(),
    brand: item.brand,
    portion_quantity: item.portion.quantity,
    portion_unit: item.portion.unit,
    grams_resolved: item.gramsResolved,
    calories_kcal: item.nutrients.caloriesKcal,
    protein_g: item.nutrients.proteinG,
    carbs_g: item.nutrients.carbsG,
    fat_g: item.nutrients.fatG,
    fiber_g: item.nutrients.fiberG,
    sugar_g: item.nutrients.sugarG,
    saturated_fat_g: item.nutrients.saturatedFatG,
    sodium_mg: item.nutrients.sodiumMg,
    source: item.provenance.source,
    confidence: item.provenance.confidence,
    provider_label: item.provenance.providerLabel,
    provider_ref: item.provenance.providerRef,
    food_record_id: item.foodRecordId,
    notes: item.notes,
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * The part of a PostgrestError this mapper reads.
 *
 * Declared structurally rather than importing PostgrestError, so the mapper
 * states exactly what it depends on and stays callable from tests without
 * constructing a full SDK error object.
 */
export interface DatabaseErrorLike {
  code?: string;
  message: string;
}

/**
 * Turns a database error into something the UI can show.
 *
 * The user-facing message never contains a SQLSTATE or a constraint name; the
 * original goes in `detail`, which is only rendered in development builds.
 */
export function mapPostgrestError(
  error: DatabaseErrorLike,
  context: string,
): AppError {
  const detail = `${context}: ${error.code ?? 'no code'} ${error.message}`;

  switch (error.code) {
    // No rows where exactly one was expected.
    case 'PGRST116':
      return appError('not_found', 'We could not find that.', { detail });

    // insufficient_privilege, which is how a row-level security refusal and a
    // missing grant both surface.
    case '42501':
      return appError(
        'unauthorized',
        'You do not have access to that. Try signing in again.',
        { detail, retryable: false },
      );

    // check_violation: a value the schema refuses, e.g. negative calories.
    case '23514':
      return appError('validation', 'Some of those values are not valid.', {
        detail,
        retryable: false,
      });

    // unique_violation.
    case '23505':
      return appError('validation', 'That name is already used.', {
        detail,
        retryable: false,
      });

    // foreign_key_violation.
    case '23503':
      return appError('not_found', 'That item no longer exists.', {
        detail,
        retryable: false,
      });

    // not_null_violation.
    case '23502':
      return appError('validation', 'Something required was missing.', {
        detail,
        retryable: false,
      });

    // Raised by our own functions when a meal is not reachable.
    case 'P0002':
      return appError('not_found', 'That meal is no longer in your journal.', {
        detail,
      });

    // JWT expired / invalid.
    case 'PGRST301':
    case 'PGRST302':
      return appError('unauthorized', 'Your session expired. Sign in again.', {
        detail,
        retryable: false,
      });

    default:
      return appError('unknown', 'Something went wrong. Try again.', { detail });
  }
}

/** Turns a thrown value from a Supabase call into an AppError. */
export function mapThrownError(cause: unknown, context: string): AppError {
  const message = cause instanceof Error ? cause.message : String(cause);
  const detail = `${context}: ${message}`;

  // supabase-js surfaces a failed fetch as a TypeError.
  if (cause instanceof TypeError || /network|fetch|timeout/i.test(message)) {
    return appError('network', 'No connection. Check your internet and try again.', {
      detail,
    });
  }

  return appError('unknown', 'Something went wrong. Try again.', { detail });
}
