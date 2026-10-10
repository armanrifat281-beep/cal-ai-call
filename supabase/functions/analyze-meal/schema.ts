/**
 * The JSON schema Claude's response is constrained to, and the validator that
 * checks the result anyway.
 *
 * Both exist on purpose. The schema makes a malformed response unlikely;
 * the validator makes a malformed response harmless. Structured outputs
 * constrain shape, not truthfulness - a schema cannot stop a model from
 * returning 50,000 calories for an apple, so the ranges below do.
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export const PORTION_UNITS = [
  'g',
  'ml',
  'oz',
  'piece',
  'slice',
  'cup',
  'tbsp',
  'tsp',
  'serving',
] as const;

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

/** Caps no single meal portion can plausibly exceed. */
export const LIMITS = {
  caloriesKcal: 10_000,
  proteinG: 1_000,
  carbsG: 2_000,
  fatG: 1_000,
  grams: 5_000,
  sodiumMg: 100_000,
} as const;

/**
 * The schema passed to `output_config.format`.
 *
 * Every property is required and `additionalProperties` is false, because a
 * partially-filled object is harder to reason about than an explicit null.
 */
export const MEAL_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['foods', 'suggestedMealType', 'suggestedTitle', 'caveats'],
  properties: {
    foods: {
      type: 'array',
      minItems: 0,
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'possibleIngredients',
          'confidence',
          'estimatedPortion',
          'estimatedGrams',
          'estimatedNutrients',
        ],
        properties: {
          name: {
            type: 'string',
            description: 'Short everyday name of the food, e.g. "Grilled chicken thigh".',
          },
          possibleIngredients: {
            type: 'array',
            maxItems: 20,
            items: { type: 'string' },
            description:
              'Ingredients that are probably present. Informational only; do not assert hidden ingredients you cannot see.',
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description:
              'How sure you are this food is in the photo. Use "low" freely; it is better than a confident mistake.',
          },
          estimatedPortion: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['quantity', 'unit'],
            properties: {
              quantity: { type: 'number', exclusiveMinimum: 0 },
              unit: { type: 'string', enum: [...PORTION_UNITS] },
            },
            description:
              'Null unless the photo contains a size reference good enough to judge portion. A plate alone is usually not.',
          },
          estimatedGrams: {
            type: ['number', 'null'],
            description: 'Weight estimate in grams, or null if you cannot judge it.',
          },
          estimatedNutrients: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['caloriesKcal', 'proteinG', 'carbsG', 'fatG'],
            properties: {
              caloriesKcal: { type: 'number', minimum: 0 },
              proteinG: { type: 'number', minimum: 0 },
              carbsG: { type: 'number', minimum: 0 },
              fatG: { type: 'number', minimum: 0 },
            },
            description:
              'Nutrients for the portion you estimated, not per 100 g. Null if you could not estimate a portion.',
          },
        },
      },
    },
    suggestedMealType: { type: 'string', enum: [...MEAL_TYPES] },
    suggestedTitle: {
      type: 'string',
      description: 'A short name for the whole meal, e.g. "Chicken rice bowl".',
    },
    caveats: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' },
      description:
        'Plain-language notes on what you could not determine, e.g. "the sauce could not be identified", "cooking oil is not visible".',
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidatedNutrients {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: null;
  sugarG: null;
  saturatedFatG: null;
  sodiumMg: null;
}

export interface ValidatedFood {
  name: string;
  possibleIngredients: string[];
  confidence: ConfidenceLevel;
  estimatedPortion: { quantity: number; unit: string } | null;
  estimatedGrams: number | null;
  estimatedNutrients: ValidatedNutrients | null;
  candidates: never[];
}

export interface ValidatedAnalysis {
  foods: ValidatedFood[];
  suggestedMealType: (typeof MEAL_TYPES)[number];
  suggestedTitle: string;
  needsUserConfirmation: boolean;
  caveats: string[];
  providerLabel: string;
  photoPath: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, max: number): number | null {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > max) return null;
  return parsed;
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

function confidence(value: unknown): ConfidenceLevel {
  // An unrecognised confidence becomes the LOWEST, never the highest: an
  // unlabelled guess must not be presented to the user as a sure thing.
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

function nutrients(value: unknown): ValidatedNutrients | null {
  if (!isRecord(value)) return null;

  const caloriesKcal = num(value.caloriesKcal, LIMITS.caloriesKcal);
  const proteinG = num(value.proteinG, LIMITS.proteinG);
  const carbsG = num(value.carbsG, LIMITS.carbsG);
  const fatG = num(value.fatG, LIMITS.fatG);

  if (caloriesKcal === null || proteinG === null || carbsG === null || fatG === null) {
    return null;
  }

  return {
    caloriesKcal,
    proteinG,
    carbsG,
    fatG,
    // The model is not asked for these, and we do not invent them.
    fiberG: null,
    sugarG: null,
    saturatedFatG: null,
    sodiumMg: null,
  };
}

function portion(value: unknown): { quantity: number; unit: string } | null {
  if (!isRecord(value)) return null;
  const quantity = num(value.quantity, LIMITS.grams);
  const unit = value.unit;
  if (quantity === null || quantity <= 0) return null;
  if (typeof unit !== 'string' || !(PORTION_UNITS as readonly string[]).includes(unit)) {
    return null;
  }
  return { quantity, unit };
}

function food(value: unknown): ValidatedFood | null {
  if (!isRecord(value)) return null;

  const name = str(value.name, 200);
  if (!name) return null;

  const estimatedNutrients = nutrients(value.estimatedNutrients);
  // A food with no usable nutrients gives the user nothing to review or
  // correct, so it is dropped rather than shown as a blank row.
  if (!estimatedNutrients) return null;

  return {
    name,
    possibleIngredients: strArray(value.possibleIngredients, 20, 80),
    confidence: confidence(value.confidence),
    estimatedPortion: portion(value.estimatedPortion),
    estimatedGrams: num(value.estimatedGrams, LIMITS.grams),
    estimatedNutrients,
    // Food database matching is not implemented yet, so there is never a
    // verified candidate. Every item therefore stays an AI estimate in the
    // app, and the user is always asked to confirm.
    candidates: [],
  };
}

export type ValidationResult =
  | { ok: true; analysis: ValidatedAnalysis }
  | { ok: false; reason: string };

/**
 * Validates a parsed model response.
 *
 * @param raw          The JSON the model returned.
 * @param providerLabel Which model produced it, recorded as provenance.
 * @param fallbackMealType Used when the response omits a usable meal type.
 */
export function validateAnalysis(
  raw: unknown,
  providerLabel: string,
  fallbackMealType: (typeof MEAL_TYPES)[number],
): ValidationResult {
  if (!isRecord(raw)) {
    return { ok: false, reason: 'response was not a JSON object' };
  }

  const foods = Array.isArray(raw.foods)
    ? raw.foods
        .map(food)
        .filter((entry): entry is ValidatedFood => entry !== null)
        .slice(0, 20)
    : [];

  if (foods.length === 0) {
    return { ok: false, reason: 'no identifiable food in the response' };
  }

  const mealType =
    typeof raw.suggestedMealType === 'string' &&
    (MEAL_TYPES as readonly string[]).includes(raw.suggestedMealType)
      ? (raw.suggestedMealType as (typeof MEAL_TYPES)[number])
      : fallbackMealType;

  return {
    ok: true,
    analysis: {
      foods,
      suggestedMealType: mealType,
      suggestedTitle: str(raw.suggestedTitle, 120) ?? foods[0]?.name ?? 'Meal',
      // Always true while there is no verified database match to compare
      // against: the user confirms every scanned item.
      needsUserConfirmation: true,
      caveats: strArray(raw.caveats, 8, 300),
      providerLabel,
      photoPath: null,
    },
  };
}
