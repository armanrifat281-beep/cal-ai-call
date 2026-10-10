/**
 * The JSON schema Claude's recipe response is constrained to, plus the
 * validator that checks the result anyway.
 *
 * Both, for the same reason as the meal scanner: a schema constrains shape,
 * not sense. It cannot stop a recipe calling for 50 kg of salt, so the ranges
 * below do. The app validates a third time on the device, because a bad
 * recipe reaching someone's kitchen is expensive and checking costs nothing.
 */

export const RECIPE_UNITS = [
  'g',
  'kg',
  'oz',
  'lb',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'fl_oz',
  'piece',
  'slice',
  'clove',
  'can',
  'packet',
  'bunch',
  'handful',
  'pinch',
  'to_taste',
] as const;

export const CUISINES = [
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
] as const;

export const LIMITS = {
  title: 200,
  description: 2000,
  instruction: 1200,
  ingredients: 60,
  steps: 60,
  tips: 12,
  equipment: 15,
  quantity: 100_000,
  minutes: 1_440,
  temperatureC: 400,
  caloriesKcal: 10_000,
  proteinG: 1_000,
  carbsG: 2_000,
  fatG: 1_000,
} as const;

export const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'description',
    'cuisine',
    'servings',
    'prepMinutes',
    'cookMinutes',
    'equipment',
    'ingredients',
    'steps',
    'tips',
    'nutritionPerServing',
    'caveats',
  ],
  properties: {
    title: { type: 'string', description: 'The dish name, as a cook would say it.' },
    description: {
      type: ['string', 'null'],
      description: 'One or two sentences on what this dish is.',
    },
    cuisine: { type: ['string', 'null'], enum: [...CUISINES, null] },
    servings: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      description: 'How many people the quantities below feed.',
    },
    prepMinutes: { type: ['number', 'null'], minimum: 0 },
    cookMinutes: { type: ['number', 'null'], minimum: 0 },
    equipment: {
      type: 'array',
      maxItems: LIMITS.equipment,
      items: { type: 'string' },
      description: 'Equipment genuinely needed, e.g. "Large heavy pot".',
    },
    ingredients: {
      type: 'array',
      minItems: 1,
      maxItems: LIMITS.ingredients,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'quantity', 'unit', 'scalesWithServings'],
        properties: {
          id: {
            type: 'string',
            description:
              'A short unique id for this ingredient, e.g. "rice". Steps refer to it.',
          },
          name: {
            type: 'string',
            description: 'The food only, e.g. "Basmati rice". No amount, no preparation.',
          },
          quantity: {
            type: ['number', 'null'],
            description: 'Amount for the stated servings. Null only for to_taste.',
          },
          unit: { type: ['string', 'null'], enum: [...RECIPE_UNITS, null] },
          preparation: {
            type: ['string', 'null'],
            description: 'e.g. "finely chopped". Keep it out of the name.',
          },
          group: {
            type: ['string', 'null'],
            description: 'Section heading, e.g. "For the marinade". Null otherwise.',
          },
          substitution: {
            type: ['string', 'null'],
            description: 'A realistic swap, if there is one.',
          },
          scalesWithServings: {
            type: 'boolean',
            description:
              'True for almost everything. False only when the amount depends on equipment rather than eaters, such as oil for deep frying.',
          },
        },
      },
    },
    steps: {
      type: 'array',
      minItems: 1,
      maxItems: LIMITS.steps,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['instruction', 'durationMinutes', 'temperatureC', 'ingredientIds'],
        properties: {
          instruction: {
            type: 'string',
            description: 'One action, written plainly. No step numbers in the text.',
          },
          durationMinutes: { type: ['number', 'null'], minimum: 0 },
          temperatureC: {
            type: ['integer', 'null'],
            description: 'Oven or pan temperature in Celsius, when it matters.',
          },
          ingredientIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ids of the ingredients used in this step.',
          },
        },
      },
    },
    tips: { type: 'array', maxItems: LIMITS.tips, items: { type: 'string' } },
    nutritionPerServing: {
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
        'Estimate for ONE serving, not the whole dish. Null if you cannot estimate it.',
    },
    caveats: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' },
      description:
        'What is uncertain: an ingredient that varies a lot, a technique that needs judgement, or a nutrition figure that is a rough guess.',
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidatedIngredient {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  preparation: string | null;
  group: string | null;
  substitution: string | null;
  scalesWithServings: boolean;
}

export interface ValidatedStep {
  number: number;
  instruction: string;
  durationMinutes: number | null;
  temperatureC: number | null;
  ingredientIds: string[];
}

export interface ValidatedRecipe {
  title: string;
  description: string | null;
  cuisine: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  equipment: string[];
  ingredients: ValidatedIngredient[];
  steps: ValidatedStep[];
  tips: string[];
  nutritionPerServing: {
    caloriesKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  } | null;
  caveats: string[];
  providerLabel: string;
}

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
  return parsed >= 0 && parsed <= max ? parsed : null;
}

function positive(value: unknown, max: number): number | null {
  const parsed = num(value, max);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function readIngredient(value: unknown, index: number): ValidatedIngredient | null {
  if (!isRecord(value)) return null;

  const name = str(value.name, 160);
  if (!name) return null;

  const unitRaw = value.unit;
  const unit =
    typeof unitRaw === 'string' && (RECIPE_UNITS as readonly string[]).includes(unitRaw)
      ? unitRaw
      : null;

  return {
    id: str(value.id, 64) ?? `ing-${index}`,
    name,
    quantity: unit === 'to_taste' ? null : positive(value.quantity, LIMITS.quantity),
    unit,
    preparation: str(value.preparation, 160),
    group: str(value.group, 80),
    substitution: str(value.substitution, 240),
    // Default true: treating a scalable ingredient as fixed silently
    // under-feeds a doubled recipe.
    scalesWithServings: value.scalesWithServings !== false,
  };
}

function readStep(
  value: unknown,
  index: number,
  knownIds: ReadonlySet<string>,
): ValidatedStep | null {
  if (!isRecord(value)) return null;

  const instruction = str(value.instruction, LIMITS.instruction);
  if (!instruction) return null;

  const temperature = value.temperatureC;
  const temperatureC =
    typeof temperature === 'number' &&
    Number.isInteger(temperature) &&
    temperature >= 0 &&
    temperature <= LIMITS.temperatureC
      ? temperature
      : null;

  return {
    number: index + 1,
    instruction,
    durationMinutes: positive(value.durationMinutes, LIMITS.minutes),
    temperatureC,
    ingredientIds: Array.isArray(value.ingredientIds)
      ? value.ingredientIds
          .map((id) => str(id, 64))
          .filter((id): id is string => id !== null && knownIds.has(id))
      : [],
  };
}

export type ValidationResult =
  | { ok: true; recipe: ValidatedRecipe }
  | { ok: false; reason: string };

export function validateGeneratedRecipe(
  raw: unknown,
  providerLabel: string,
  requestedServings: number,
): ValidationResult {
  if (!isRecord(raw)) {
    return { ok: false, reason: 'response was not a JSON object' };
  }

  const title = str(raw.title, LIMITS.title);
  if (!title) return { ok: false, reason: 'no recipe title' };

  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients
        .map((entry, index) => readIngredient(entry, index))
        .filter((entry): entry is ValidatedIngredient => entry !== null)
        .slice(0, LIMITS.ingredients)
    : [];
  if (ingredients.length === 0) return { ok: false, reason: 'no usable ingredients' };

  const knownIds = new Set(ingredients.map((entry) => entry.id));
  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((entry, index) => readStep(entry, index, knownIds))
        .filter((entry): entry is ValidatedStep => entry !== null)
        .slice(0, LIMITS.steps)
        // Renumber after filtering, so a dropped step leaves no gap.
        .map((entry, index) => ({ ...entry, number: index + 1 }))
    : [];
  if (steps.length === 0) return { ok: false, reason: 'no usable steps' };

  const nutritionRaw = raw.nutritionPerServing;
  let nutritionPerServing: ValidatedRecipe['nutritionPerServing'] = null;
  if (isRecord(nutritionRaw)) {
    const caloriesKcal = num(nutritionRaw.caloriesKcal, LIMITS.caloriesKcal);
    const proteinG = num(nutritionRaw.proteinG, LIMITS.proteinG);
    const carbsG = num(nutritionRaw.carbsG, LIMITS.carbsG);
    const fatG = num(nutritionRaw.fatG, LIMITS.fatG);
    // All four or none: a partial set renders as "0g protein", which reads as
    // a measurement of zero rather than an absence.
    if (caloriesKcal !== null && proteinG !== null && carbsG !== null && fatG !== null) {
      nutritionPerServing = { caloriesKcal, proteinG, carbsG, fatG };
    }
  }

  const cuisineRaw = raw.cuisine;
  const cuisine =
    typeof cuisineRaw === 'string' && (CUISINES as readonly string[]).includes(cuisineRaw)
      ? cuisineRaw
      : null;

  const servingsRaw = raw.servings;
  const servings =
    typeof servingsRaw === 'number' &&
    Number.isInteger(servingsRaw) &&
    servingsRaw >= 1 &&
    servingsRaw <= 100
      ? servingsRaw
      : Math.max(1, Math.min(100, Math.round(requestedServings)));

  return {
    ok: true,
    recipe: {
      title,
      description: str(raw.description, LIMITS.description),
      cuisine,
      servings,
      prepMinutes: positive(raw.prepMinutes, LIMITS.minutes),
      cookMinutes: positive(raw.cookMinutes, LIMITS.minutes),
      equipment: strArray(raw.equipment, LIMITS.equipment, 80),
      ingredients,
      steps,
      tips: strArray(raw.tips, LIMITS.tips, 400),
      nutritionPerServing,
      caveats: strArray(raw.caveats, 8, 300),
      providerLabel,
    },
  };
}
