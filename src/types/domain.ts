/**
 * Core domain types for FoodLens AI.
 *
 * These mirror the database schema in `supabase/migrations`. Keeping them in one
 * place means the nutrition engine, the UI, and the API layer agree on shapes.
 */

// ---------------------------------------------------------------------------
// Nutrients
// ---------------------------------------------------------------------------

/**
 * A nutrient set for a single food item or a daily total.
 *
 * Units are fixed and encoded in the field names so they can never be
 * misread: energy in kilocalories, macros in grams, sodium in milligrams.
 * `null` means "we do not know", which is different from `0`.
 */
export interface Nutrients {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  saturatedFatG: number | null;
  sodiumMg: number | null;
}

/** The four values we always show. Everything else is optional detail. */
export type CoreNutrientKey = 'caloriesKcal' | 'proteinG' | 'carbsG' | 'fatG';

export const EMPTY_NUTRIENTS: Nutrients = {
  caloriesKcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: null,
  sugarG: null,
  saturatedFatG: null,
  sodiumMg: null,
};

// ---------------------------------------------------------------------------
// Portions
// ---------------------------------------------------------------------------

/**
 * Units a user can pick for a portion.
 *
 * `g` and `ml` are absolute. The rest are household measures whose gram weight
 * depends on the food, so they can only be converted when the food record
 * supplies a gram weight for that measure.
 */
export type PortionUnit =
  | 'g'
  | 'ml'
  | 'oz'
  | 'piece'
  | 'slice'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'serving';

export interface Portion {
  quantity: number;
  unit: PortionUnit;
}

/** A household measure a food record knows the gram weight of. */
export interface PortionOption {
  unit: PortionUnit;
  /** Human label, e.g. "medium apple", "1 cup, chopped". */
  label: string;
  /** Grams for ONE of this unit. */
  gramsPerUnit: number;
}

// ---------------------------------------------------------------------------
// Provenance: where a number came from, and how sure we are
// ---------------------------------------------------------------------------

/**
 * Where a nutrient value came from. This is shown in the UI so a user can
 * always tell a looked-up value from a model's guess.
 */
export type NutrientSource =
  /** Matched to a record in a verified food database (e.g. USDA FDC). */
  | 'database'
  /** Produced by the vision/language model with no database match. */
  | 'ai_estimate'
  /** The user typed or corrected the value themselves. */
  | 'user_entered'
  /** Bundled sample data used in clearly labeled demo mode. */
  | 'demo_sample';

/**
 * How confident we are in an identification or a portion estimate.
 * `low` must trigger a correction prompt rather than a silent save.
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Provenance {
  source: NutrientSource;
  confidence: ConfidenceLevel;
  /** Name of the dataset or model, e.g. "USDA FoodData Central". */
  providerLabel: string | null;
  /** Stable id in that provider, e.g. an FDC id. */
  providerRef: string | null;
}

// ---------------------------------------------------------------------------
// Food database records
// ---------------------------------------------------------------------------

/** A food as returned by a nutrition database provider. */
export interface FoodRecord {
  /** Provider-scoped id, e.g. `usda:1750340`. */
  id: string;
  name: string;
  brand: string | null;
  /** Nutrients per 100 g (or per 100 ml for liquids). */
  nutrientsPer100g: Nutrients;
  /** Household measures this record can convert, if the provider supplies any. */
  portionOptions: PortionOption[];
  providerLabel: string;
  providerRef: string;
  /** True when this record is a generic ("raw apple") rather than branded. */
  isGeneric: boolean;
}

// ---------------------------------------------------------------------------
// Journal entries
// ---------------------------------------------------------------------------

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * How each meal type is written in the interface.
 *
 * Defined once rather than capitalised at each call site, so a chart legend
 * and a form label can never drift apart.
 */
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export interface FoodEntryItem {
  id: string;
  /** Display name, e.g. "Grilled chicken thigh". */
  name: string;
  brand: string | null;
  portion: Portion;
  /**
   * Portion converted to grams, when a conversion was possible.
   * `null` means the portion could not be resolved to a weight, and the
   * nutrients below are therefore a per-serving estimate.
   */
  gramsResolved: number | null;
  /** Nutrients for THIS portion (already scaled). */
  nutrients: Nutrients;
  provenance: Provenance;
  /** Matched food database record id, when there was a match. */
  foodRecordId: string | null;
  notes: string | null;
}

export interface FoodEntry {
  id: string;
  userId: string;
  /** ISO 8601 instant the food was eaten. */
  consumedAt: string;
  mealType: MealType;
  /** Short label for the whole entry, e.g. "Chicken salad bowl". */
  title: string;
  items: FoodEntryItem[];
  /** Storage path of the photo in the private bucket, if one was kept. */
  photoPath: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A meal the user saved for quick re-logging. */
export interface SavedMeal {
  id: string;
  userId: string;
  name: string;
  mealType: MealType | null;
  items: FoodEntryItem[];
  /** How many times the user has logged this meal. Drives suggestions. */
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Preferences and goals
// ---------------------------------------------------------------------------

export type MeasurementSystem = 'metric' | 'imperial';

export type DietaryPattern =
  | 'no_restriction'
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'halal'
  | 'kosher'
  | 'gluten_free'
  | 'dairy_free'
  | 'low_carb'
  | 'high_protein';

export type NutritionGoalKind =
  | 'none'
  | 'understand_eating'
  | 'more_protein'
  | 'more_vegetables'
  | 'manage_weight'
  | 'steady_energy';

export interface DailyTargets {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface UserPreferences {
  userId: string;
  /** BCP-47 tag, e.g. "en", "en-GB". */
  language: string;
  /** ISO 3166-1 alpha-2, used to pick regional food datasets. */
  countryCode: string | null;
  measurementSystem: MeasurementSystem;
  dietaryPatterns: DietaryPattern[];
  /**
   * Free-text allergens the user chose to tell us about. Optional, and only
   * asked for once the user opts into allergy-aware suggestions.
   */
  allergens: string[];
  /** Whether the user agreed to allergy-aware filtering of suggestions. */
  allergyAwarenessEnabled: boolean;
  dislikedFoods: string[];
  favoriteCuisines: string[];
  goal: NutritionGoalKind;
  dailyTargets: DailyTargets;
  /**
   * Serving count the recipe creator defaults to, remembered from last time.
   * Part of Food Memory, and editable in Profile.
   */
  preferredServings: number;
  /**
   * Cuisine the recipe creator defaults to. Remembered, not inferred from
   * anything the user did not choose.
   */
  favoriteCuisineId: string | null;

  /** The user let us keep meal history to power Food Memory. */
  foodMemoryEnabled: boolean;
  /** The user let us keep uploaded photos after analysis. */
  retainPhotos: boolean;
  updatedAt: string;
}

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Food Memory insights
// ---------------------------------------------------------------------------

export type InsightKind =
  | 'weekly_summary'
  | 'repeat_meal'
  | 'macro_balance'
  | 'logging_streak'
  | 'variety';

/**
 * An insight generated from stored records only.
 *
 * `evidence` is required: every insight must be able to point at the entries it
 * was computed from, so the user can check it.
 */
export interface FoodInsight {
  id: string;
  userId: string;
  kind: InsightKind;
  /** Start of the window this covers, as a date-only string (YYYY-MM-DD). */
  periodStart: string;
  periodEnd: string;
  headline: string;
  detail: string;
  evidence: InsightEvidence;
  createdAt: string;
}

export interface InsightEvidence {
  /** How many journal entries this was computed from. */
  entryCount: number;
  /** Ids of the entries used, so the UI can link to them. */
  entryIds: string[];
  /** Plain-language note on what was counted, shown under "Why you see this". */
  method: string;
}
