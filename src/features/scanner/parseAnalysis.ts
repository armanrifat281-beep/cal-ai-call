import { appError, err, ok, type Result } from '@/lib/result';
import {
  MEAL_TYPES,
  type ConfidenceLevel,
  type MealType,
  type Nutrients,
  type Portion,
  type PortionUnit,
} from '@/types/domain';

import type { FoodCandidate, MealAnalysis, RecognizedFood } from './types';

/**
 * Validator for an analysis response.
 *
 * A model's output is untrusted input: fields go missing, numbers arrive as
 * strings, and nothing guarantees the shape. Rather than letting a malformed
 * response crash a screen or, worse, write nonsense into the journal, every
 * field is checked here and anything unusable is dropped with the reason.
 *
 * This is pure and has no network dependency, so it is fully unit tested.
 */

const PORTION_UNITS: readonly PortionUnit[] = [
  'g',
  'ml',
  'oz',
  'piece',
  'slice',
  'cup',
  'tbsp',
  'tsp',
  'serving',
];

const CONFIDENCE_LEVELS: readonly ConfidenceLevel[] = ['high', 'medium', 'low'];

/** Rejects anything beyond a plausible single-meal figure. */
const LIMITS = {
  caloriesKcal: 10_000,
  proteinG: 1_000,
  carbsG: 2_000,
  fatG: 1_000,
  grams: 5_000,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A finite non-negative number, accepting a numeric string. */
function readNumber(value: unknown, max: number): number | null {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > max) return null;
  return parsed;
}

function readString(value: unknown, maxLength = 200): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}

function readStringArray(value: unknown, maxItems = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => readString(entry, 80))
    .filter((entry): entry is string => entry !== null)
    .slice(0, maxItems);
}

function readConfidence(value: unknown): ConfidenceLevel {
  // An unrecognized or missing confidence is treated as the lowest, never the
  // highest: an unlabeled guess must not be presented as a sure thing.
  return typeof value === 'string' && (CONFIDENCE_LEVELS as readonly string[]).includes(value)
    ? (value as ConfidenceLevel)
    : 'low';
}

function readMealType(value: unknown, fallback: MealType): MealType {
  return typeof value === 'string' && (MEAL_TYPES as readonly string[]).includes(value)
    ? (value as MealType)
    : fallback;
}

function readPortion(value: unknown): Portion | null {
  if (!isRecord(value)) return null;
  const quantity = readNumber(value.quantity, LIMITS.grams);
  const unit = value.unit;
  if (quantity === null || quantity <= 0) return null;
  if (typeof unit !== 'string' || !(PORTION_UNITS as readonly string[]).includes(unit)) {
    return null;
  }
  return { quantity, unit: unit as PortionUnit };
}

/**
 * Read a nutrient set.
 *
 * The four core macros are required: an item without them cannot be shown or
 * summed. Optional nutrients stay `null` when absent, never 0.
 */
function readNutrients(value: unknown): Nutrients | null {
  if (!isRecord(value)) return null;

  const caloriesKcal = readNumber(value.caloriesKcal, LIMITS.caloriesKcal);
  const proteinG = readNumber(value.proteinG, LIMITS.proteinG);
  const carbsG = readNumber(value.carbsG, LIMITS.carbsG);
  const fatG = readNumber(value.fatG, LIMITS.fatG);

  if (caloriesKcal === null || proteinG === null || carbsG === null || fatG === null) {
    return null;
  }

  return {
    caloriesKcal,
    proteinG,
    carbsG,
    fatG,
    fiberG: readNumber(value.fiberG, LIMITS.carbsG),
    sugarG: readNumber(value.sugarG, LIMITS.carbsG),
    saturatedFatG: readNumber(value.saturatedFatG, LIMITS.fatG),
    sodiumMg: readNumber(value.sodiumMg, 100_000),
  };
}

function readCandidate(value: unknown): FoodCandidate | null {
  if (!isRecord(value)) return null;

  const foodRecordId = readString(value.foodRecordId, 120);
  const name = readString(value.name);
  const providerLabel = readString(value.providerLabel, 80);
  const nutrientsPer100g = readNutrients(value.nutrientsPer100g);

  if (!foodRecordId || !name || !providerLabel || !nutrientsPer100g) return null;

  return {
    foodRecordId,
    name,
    brand: readString(value.brand, 120),
    providerLabel,
    nutrientsPer100g,
    matchScore: readNumber(value.matchScore, 1) ?? 0,
  };
}

function readFood(value: unknown): RecognizedFood | null {
  if (!isRecord(value)) return null;

  const name = readString(value.name);
  if (!name) return null;

  const candidates = Array.isArray(value.candidates)
    ? value.candidates
        .map(readCandidate)
        .filter((candidate): candidate is FoodCandidate => candidate !== null)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 8)
    : [];

  const estimatedNutrients = readNutrients(value.estimatedNutrients);

  // A food with neither a database match nor usable estimated nutrients gives
  // the user nothing to review, so it is dropped rather than shown as blank.
  if (candidates.length === 0 && estimatedNutrients === null) return null;

  return {
    name,
    possibleIngredients: readStringArray(value.possibleIngredients),
    confidence: readConfidence(value.confidence),
    estimatedPortion: readPortion(value.estimatedPortion),
    estimatedGrams: readNumber(value.estimatedGrams, LIMITS.grams),
    estimatedNutrients,
    candidates,
  };
}

export interface ParseOptions {
  /** Used when the response omits a meal type. */
  fallbackMealType: MealType;
}

/**
 * Validate a raw analysis response.
 *
 * @returns the analysis, or an error when nothing usable could be recovered.
 */
export function parseMealAnalysis(
  raw: unknown,
  options: ParseOptions,
): Result<MealAnalysis> {
  if (!isRecord(raw)) {
    return err(
      appError('provider_error', 'The analysis service returned something unreadable.', {
        detail: `expected an object, got ${typeof raw}`,
      }),
    );
  }

  const foods = Array.isArray(raw.foods)
    ? raw.foods
        .map(readFood)
        .filter((food): food is RecognizedFood => food !== null)
        .slice(0, 20)
    : [];

  if (foods.length === 0) {
    return err(
      appError(
        'provider_error',
        'We could not identify any food in that photo. Try a clearer shot, or add the meal by hand.',
        { detail: 'no usable foods in response', retryable: true },
      ),
    );
  }

  const providerLabel = readString(raw.providerLabel, 80) ?? 'AI vision model';

  // Low confidence anywhere means the user must confirm before saving, whatever
  // the response claims about itself.
  const hasLowConfidence = foods.some((food) => food.confidence === 'low');
  const hasUnmatchedFood = foods.some((food) => food.candidates.length === 0);

  return ok({
    foods,
    suggestedMealType: readMealType(raw.suggestedMealType, options.fallbackMealType),
    suggestedTitle: readString(raw.suggestedTitle, 120) ?? foods[0]?.name ?? 'Meal',
    needsUserConfirmation:
      raw.needsUserConfirmation === true || hasLowConfidence || hasUnmatchedFood,
    caveats: readStringArray(raw.caveats, 8),
    providerLabel,
    photoPath: readString(raw.photoPath, 300),
  });
}
