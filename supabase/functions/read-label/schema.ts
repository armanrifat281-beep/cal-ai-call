/**
 * The shape a label reading must fit, and the check that it does.
 *
 * A nutrition label is a primary source: it says what it says, and what it
 * does not say nobody knows. So every figure here is nullable and a missing
 * one stays missing - the one thing this must never do is fill a gap with a
 * plausible number, because the result looks exactly like a fact.
 *
 * Pure: no Deno, no npm. The project's ordinary Jest setup tests it.
 */

/** What the printed panel's figures are per. Labels differ by country. */
export const BASIS_VALUES = ['per_100g', 'per_serving'] as const;
export type NutritionBasis = (typeof BASIS_VALUES)[number];

export interface LabelNutrients {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  saturatedFatG: number | null;
  /** Total sugars, as the panel prints them. */
  sugarG: number | null;
  /**
   * Added sugars, printed separately on some labels and not on others.
   *
   * Never derived from total sugar. The difference between the two is the
   * whole question a sugar scanner exists to answer, and guessing it would
   * answer it wrongly while looking authoritative.
   */
  addedSugarG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
}

export interface LabelReading {
  /** False when the photo could not be read as a nutrition panel. */
  readable: boolean;
  productName: string | null;
  brand: string | null;
  /** As printed, e.g. "1 bar (45 g)". */
  servingSize: string | null;
  servingGrams: number | null;
  basis: NutritionBasis;
  nutrients: LabelNutrients;
  ingredients: string[];
  /** Only what the packaging itself declares. Never inferred. */
  declaredAllergens: string[];
  /** Fields the model says it could not read with confidence. */
  uncertain: string[];
}

export const LABEL_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['readable', 'basis', 'nutrients'],
  properties: {
    readable: {
      type: 'boolean',
      description: 'False if this is not a readable nutrition panel.',
    },
    productName: { type: ['string', 'null'] },
    brand: { type: ['string', 'null'] },
    servingSize: {
      type: ['string', 'null'],
      description: 'Exactly as printed, e.g. "1 bar (45 g)".',
    },
    servingGrams: { type: ['number', 'null'] },
    basis: {
      type: 'string',
      enum: BASIS_VALUES,
      description: 'Whether the figures below are per 100 g or per serving.',
    },
    nutrients: {
      type: 'object',
      properties: {
        caloriesKcal: { type: ['number', 'null'] },
        proteinG: { type: ['number', 'null'] },
        carbsG: { type: ['number', 'null'] },
        fatG: { type: ['number', 'null'] },
        saturatedFatG: { type: ['number', 'null'] },
        sugarG: { type: ['number', 'null'], description: 'Total sugars.' },
        addedSugarG: {
          type: ['number', 'null'],
          description:
            'Added sugars ONLY if the label prints them separately. Never calculated from total sugar.',
        },
        fiberG: { type: ['number', 'null'] },
        sodiumMg: {
          type: ['number', 'null'],
          description:
            'In milligrams. If the label gives salt in grams, convert: sodium mg = salt g x 400.',
        },
      },
    },
    ingredients: { type: 'array', items: { type: 'string' } },
    declaredAllergens: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Only allergens the packaging declares itself, e.g. "Contains: milk". Never read off the ingredient list.',
    },
    uncertain: {
      type: 'array',
      items: { type: 'string' },
      description: 'Names of fields that were blurred, cut off or hard to read.',
    },
  },
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * A number from the model, or null.
 *
 * Negatives and absurd magnitudes are dropped rather than clamped: a label
 * figure is either read or not read, and a clamped value is a made-up one
 * wearing the clothes of a measurement.
 */
function amount(value: unknown, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0 || value > max) return null;
  return Math.round(value * 10) / 10;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(text)
    .filter((entry): entry is string => entry !== null)
    .slice(0, 40);
}

export type LabelValidation =
  | { ok: true; value: LabelReading }
  | { ok: false; reason: string };

/**
 * Checks a model's answer.
 *
 * A reading with no figure at all on it is rejected, not returned empty: a
 * result screen listing nine dashes is a failure that looks like a success,
 * and the user cannot tell whether the label had nothing on it or the photo
 * was unreadable.
 */
export function validateLabel(value: unknown): LabelValidation {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, reason: 'the answer was not an object' };
  }

  const raw = value as Record<string, unknown>;

  const nutrientSource = (raw.nutrients ?? {}) as Record<string, unknown>;
  const nutrients: LabelNutrients = {
    caloriesKcal: amount(nutrientSource.caloriesKcal, 2000),
    proteinG: amount(nutrientSource.proteinG, 200),
    carbsG: amount(nutrientSource.carbsG, 200),
    fatG: amount(nutrientSource.fatG, 200),
    saturatedFatG: amount(nutrientSource.saturatedFatG, 200),
    sugarG: amount(nutrientSource.sugarG, 200),
    addedSugarG: amount(nutrientSource.addedSugarG, 200),
    fiberG: amount(nutrientSource.fiberG, 100),
    sodiumMg: amount(nutrientSource.sodiumMg, 50_000),
  };

  /*
    What was read decides, not what the model called the photograph.

    `readable: false` alone used to be enough to throw the answer away, and
    a model that is merely unsure sets that flag while still reporting every
    figure on the panel - so a perfectly good reading of a real label was
    being discarded. A photo that genuinely is not a label has nothing in
    these fields, which the check below catches anyway.
  */
  const anyFigure = Object.values(nutrients).some((figure) => figure !== null);
  if (!anyFigure) {
    return {
      ok: false,
      reason:
        raw.readable === false
          ? 'the model said this is not a nutrition panel'
          : 'no nutrition figures could be read',
    };
  }

  const basis: NutritionBasis =
    raw.basis === 'per_serving' ? 'per_serving' : 'per_100g';

  return {
    ok: true,
    value: {
      readable: true,
      productName: text(raw.productName),
      brand: text(raw.brand),
      servingSize: text(raw.servingSize),
      servingGrams: amount(raw.servingGrams, 5000),
      basis,
      nutrients,
      ingredients: strings(raw.ingredients),
      declaredAllergens: strings(raw.declaredAllergens),
      uncertain: strings(raw.uncertain),
    },
  };
}

/**
 * Converts a per-serving panel to per 100 g, when that is possible.
 *
 * Returns null when it is not - no serving weight, or a nonsense one - and
 * the caller then keeps the per-serving figures and says which they are.
 * Scaling by a guessed serving weight would silently change every number on
 * the screen.
 */
export function toPer100g(
  nutrients: LabelNutrients,
  servingGrams: number | null,
): LabelNutrients | null {
  if (servingGrams === null || servingGrams <= 0) return null;

  const factor = 100 / servingGrams;
  const scale = (value: number | null): number | null =>
    value === null ? null : Math.round(value * factor * 10) / 10;

  return {
    caloriesKcal: scale(nutrients.caloriesKcal),
    proteinG: scale(nutrients.proteinG),
    carbsG: scale(nutrients.carbsG),
    fatG: scale(nutrients.fatG),
    saturatedFatG: scale(nutrients.saturatedFatG),
    sugarG: scale(nutrients.sugarG),
    addedSugarG: scale(nutrients.addedSugarG),
    fiberG: scale(nutrients.fiberG),
    sodiumMg: scale(nutrients.sodiumMg),
  };
}
