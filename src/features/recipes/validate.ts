import { appError, err, ok, type Result } from '@/lib/result';
import type { NutrientSource } from '@/types/domain';
import type {
  CuisineId,
  RecipeIngredient,
  RecipeNutrition,
  RecipeStep,
  RecipeUnit,
} from '@/types/recipe';

import { isRecipeUnit } from './units';

/**
 * Validator for a generated recipe.
 *
 * A generated recipe is untrusted input. The server validates too, but this
 * runs again on the device because the cost of a bad recipe reaching the
 * kitchen is high and the cost of checking is nothing.
 *
 * The rules are chosen so a flawed response degrades rather than misleads:
 * an unusable ingredient is dropped, a missing step number is assigned, an
 * absurd quantity is rejected, and nothing is invented to fill a gap.
 */

/** Caps beyond which a value is a bug rather than a big recipe. */
export const RECIPE_LIMITS = {
  titleLength: 200,
  descriptionLength: 2000,
  ingredients: 60,
  steps: 60,
  tips: 12,
  equipment: 15,
  instructionLength: 1200,
  quantity: 100_000,
  minutes: 10_000,
  temperatureC: 400,
  caloriesKcal: 10_000,
  proteinG: 1_000,
  carbsG: 2_000,
  fatG: 1_000,
} as const;

const CUISINES = new Set<string>([
  'bangladeshi',
  'indian',
  'pakistani',
  'sri_lankan',
  'thai',
  'vietnamese',
  'chinese',
  'japanese',
  'korean',
  'indonesian',
  'middle_eastern',
  'turkish',
  'north_african',
  'west_african',
  'ethiopian',
  'italian',
  'french',
  'spanish',
  'greek',
  'german',
  'british',
  'nordic',
  'mexican',
  'caribbean',
  'brazilian',
  'peruvian',
  'american',
  'other',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, maxLength);
}

function strArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => str(entry, maxLength))
    .filter((entry): entry is string => entry !== null)
    .slice(0, maxItems);
}

function num(value: unknown, max: number): number | null {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > max) return null;
  return parsed;
}

function positiveNum(value: unknown, max: number): number | null {
  const parsed = num(value, max);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function intInRange(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (typeof parsed !== 'number' || !Number.isInteger(parsed)) return null;
  return parsed >= min && parsed <= max ? parsed : null;
}

export function toCuisineId(value: unknown): CuisineId | null {
  return typeof value === 'string' && CUISINES.has(value) ? (value as CuisineId) : null;
}

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

/**
 * Reads one ingredient.
 *
 * @param index Position, used to generate a stable id when the response
 *              omits one. Steps reference ingredients by id, so every
 *              ingredient must have one.
 */
function readIngredient(value: unknown, index: number): RecipeIngredient | null {
  if (!isRecord(value)) return null;

  const name = str(value.name, 160);
  // An ingredient with no name cannot be shopped for or ticked off.
  if (!name) return null;

  const unitRaw = value.unit;
  const unit: RecipeUnit | null = isRecipeUnit(unitRaw) ? unitRaw : null;

  // `to_taste` carries no quantity by definition.
  const quantity =
    unit === 'to_taste' ? null : positiveNum(value.quantity, RECIPE_LIMITS.quantity);

  return {
    id: str(value.id, 64) ?? `ing-${index}`,
    name,
    quantity,
    unit,
    preparation: str(value.preparation, 160),
    group: str(value.group, 80),
    substitution: str(value.substitution, 240),
    // Default TRUE: most ingredients scale, and treating a scalable one as
    // fixed silently under-feeds a doubled recipe. The model opts out
    // explicitly for things like oil for frying.
    scalesWithServings: value.scalesWithServings !== false,
    // Never inferred. The user ticks this themselves; assuming an ingredient
    // is in their cupboard is how a shopping list ends up missing something.
    isOwned: false,
  };
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function readStep(
  value: unknown,
  index: number,
  knownIngredientIds: ReadonlySet<string>,
): RecipeStep | null {
  if (!isRecord(value)) return null;

  const instruction = str(value.instruction, RECIPE_LIMITS.instructionLength);
  if (!instruction) return null;

  const referenced = Array.isArray(value.ingredientIds)
    ? value.ingredientIds
        .map((id) => str(id, 64))
        .filter((id): id is string => id !== null && knownIngredientIds.has(id))
    : [];

  return {
    // Renumbered from position, so the displayed order always matches the
    // numbering even if the response numbered them badly.
    number: index + 1,
    instruction,
    durationMinutes: positiveNum(value.durationMinutes, RECIPE_LIMITS.minutes),
    temperatureC: intInRange(value.temperatureC, 0, RECIPE_LIMITS.temperatureC),
    ingredientIds: referenced,
  };
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

function readNutrition(
  value: unknown,
  source: NutrientSource,
  providerLabel: string,
): RecipeNutrition | null {
  if (!isRecord(value)) return null;

  const caloriesKcal = num(value.caloriesKcal, RECIPE_LIMITS.caloriesKcal);
  const proteinG = num(value.proteinG, RECIPE_LIMITS.proteinG);
  const carbsG = num(value.carbsG, RECIPE_LIMITS.carbsG);
  const fatG = num(value.fatG, RECIPE_LIMITS.fatG);

  // All four or none. A partial set would render as "620 kcal, 0g protein",
  // which reads as a measurement of zero rather than an absence.
  if (caloriesKcal === null || proteinG === null || carbsG === null || fatG === null) {
    return null;
  }

  return { caloriesKcal, proteinG, carbsG, fatG, source, providerLabel };
}

// ---------------------------------------------------------------------------
// The recipe
// ---------------------------------------------------------------------------

/**
 * A validated recipe, without the fields the storage layer owns.
 */
export interface ValidatedRecipeDraft {
  title: string;
  description: string | null;
  cuisine: CuisineId | null;
  cuisineNote: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  equipment: string[];
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tips: string[];
  tags: string[];
  nutritionPerServing: RecipeNutrition | null;
  /** Notes on what the generator could not determine. */
  caveats: string[];
}

export interface ValidateRecipeOptions {
  /** Provenance for the nutrition figures. */
  nutritionSource: NutrientSource;
  /** Model or dataset label, recorded with the figures. */
  providerLabel: string;
  /** Serving count the user asked for, used when the response omits one. */
  requestedServings: number;
}

/**
 * Validates a generated recipe.
 *
 * Rejects outright only when the result would be unusable: no title, no
 * ingredients, or no steps. Anything else degrades.
 */
export function validateRecipe(
  raw: unknown,
  options: ValidateRecipeOptions,
): Result<ValidatedRecipeDraft> {
  if (!isRecord(raw)) {
    return err(
      appError('provider_error', 'The recipe came back unreadable. Try again.', {
        detail: `expected an object, got ${typeof raw}`,
      }),
    );
  }

  const title = str(raw.title, RECIPE_LIMITS.titleLength);
  if (!title) {
    return err(
      appError('provider_error', 'The recipe came back without a name. Try again.', {
        detail: 'missing title',
      }),
    );
  }

  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients
        .map((entry, index) => readIngredient(entry, index))
        .filter((entry): entry is RecipeIngredient => entry !== null)
        .slice(0, RECIPE_LIMITS.ingredients)
    : [];

  if (ingredients.length === 0) {
    return err(
      appError(
        'provider_error',
        'The recipe came back with no ingredients. Try rephrasing what you want to cook.',
        { detail: 'no usable ingredients', retryable: true },
      ),
    );
  }

  const ingredientIds = new Set(ingredients.map((entry) => entry.id));

  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((entry, index) => readStep(entry, index, ingredientIds))
        .filter((entry): entry is RecipeStep => entry !== null)
        .slice(0, RECIPE_LIMITS.steps)
        // Renumber after filtering, so dropping a bad step leaves no gap.
        .map((entry, index) => ({ ...entry, number: index + 1 }))
    : [];

  if (steps.length === 0) {
    return err(
      appError(
        'provider_error',
        'The recipe came back with no cooking steps. Try again.',
        { detail: 'no usable steps', retryable: true },
      ),
    );
  }

  return ok({
    title,
    description: str(raw.description, RECIPE_LIMITS.descriptionLength),
    cuisine: toCuisineId(raw.cuisine),
    cuisineNote: str(raw.cuisineNote, 80),
    servings:
      intInRange(raw.servings, 1, 100) ?? Math.max(1, Math.round(options.requestedServings)),
    prepMinutes: positiveNum(raw.prepMinutes, RECIPE_LIMITS.minutes),
    cookMinutes: positiveNum(raw.cookMinutes, RECIPE_LIMITS.minutes),
    equipment: strArray(raw.equipment, RECIPE_LIMITS.equipment, 80),
    ingredients,
    steps,
    tips: strArray(raw.tips, RECIPE_LIMITS.tips, 400),
    tags: strArray(raw.tags, 12, 40),
    nutritionPerServing: readNutrition(
      raw.nutritionPerServing,
      options.nutritionSource,
      options.providerLabel,
    ),
    caveats: strArray(raw.caveats, 8, 300),
  });
}
