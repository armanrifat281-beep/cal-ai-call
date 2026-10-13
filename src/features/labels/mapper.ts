import type { Nutrients } from '@/types/domain';

import type { LabelGaps, LabelLookup, ProductLabel } from './types';

/**
 * Open Food Facts, turned into something this app will stand behind.
 *
 * The database is crowdsourced, so a record can carry anything: a product
 * with no nutrition at all, a name that is an empty string, a sodium figure
 * recorded in the salt field instead. This translates what is there and
 * refuses to fill what is not.
 *
 * The one transformation worth naming is salt to sodium. Labels in most of
 * the world print salt in grams; the app stores sodium in milligrams. The
 * conversion is a fixed ratio from the molar masses, not an estimate, so it
 * is safe - but only in that direction, and only when the sodium field is
 * genuinely absent.
 */

/** Sodium is 39.34% of salt by mass. Chemistry, not a guess. */
const SODIUM_FRACTION_OF_SALT = 0.3934;

interface OffNutriments {
  [key: string]: unknown;
}

interface OffProduct {
  product_name?: unknown;
  brands?: unknown;
  serving_size?: unknown;
  serving_quantity?: unknown;
  nutriments?: OffNutriments;
  ingredients_text?: unknown;
  allergens_tags?: unknown;
  last_modified_t?: unknown;
}

export interface OffResponse {
  status?: number;
  product?: OffProduct;
}

/** A finite number, or null. Never NaN, never a string that looked numeric. */
function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Allergens the packaging declares, as plain words.
 *
 * Open Food Facts stores these as language-prefixed tags, e.g. `en:milk`.
 * Only the declared list is read - the ingredient text is never scanned for
 * allergens, because inferring one and being wrong is the failure mode that
 * actually hurts somebody.
 */
export function readAllergens(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];

  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => {
      const withoutLanguage = tag.includes(':') ? tag.slice(tag.indexOf(':') + 1) : tag;
      return withoutLanguage.replace(/[-_]/g, ' ').trim();
    })
    .filter((tag) => tag.length > 0);
}

/** The ingredient list, split on commas, with bracketed sub-lists kept whole. */
export function readIngredients(text: unknown): string[] {
  const value = textOrNull(text);
  if (value === null) return [];

  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const character of value) {
    if (character === '(' || character === '[') depth += 1;
    if (character === ')' || character === ']') depth = Math.max(0, depth - 1);

    // A comma inside brackets belongs to the sub-list, e.g.
    // "chocolate (sugar, cocoa butter)" is one ingredient, not three.
    if (character === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  parts.push(current);

  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function readNutrients(nutriments: OffNutriments | undefined): {
  nutrients: Nutrients;
  missing: (keyof Nutrients)[];
} {
  const source = nutriments ?? {};
  const missing: (keyof Nutrients)[] = [];

  const read = (key: string): number | null => numberOrNull(source[`${key}_100g`]);

  // Energy may be published in kilojoules only, which is a unit change, not
  // a guess: 1 kcal = 4.184 kJ exactly.
  const kcal = read('energy-kcal');
  const kj = read('energy-kj') ?? read('energy');
  const calories = kcal ?? (kj === null ? null : kj / 4.184);

  const protein = read('proteins');
  const carbs = read('carbohydrates');
  const fat = read('fat');

  const sodiumMg = (() => {
    const sodium = read('sodium');
    if (sodium !== null) return sodium * 1000;
    const salt = read('salt');
    return salt === null ? null : salt * SODIUM_FRACTION_OF_SALT * 1000;
  })();

  for (const [key, value] of [
    ['caloriesKcal', calories],
    ['proteinG', protein],
    ['carbsG', carbs],
    ['fatG', fat],
  ] as const) {
    if (value === null) missing.push(key);
  }

  const fiber = read('fiber');
  const sugar = read('sugars');
  const saturated = read('saturated-fat');
  if (fiber === null) missing.push('fiberG');
  if (sugar === null) missing.push('sugarG');
  if (saturated === null) missing.push('saturatedFatG');
  if (sodiumMg === null) missing.push('sodiumMg');

  return {
    nutrients: {
      // The four core figures are non-nullable in `Nutrients`, so an absent
      // one becomes 0 here - and is listed in `missing`, which is what the
      // screen reads to say "not stated" instead of showing a zero.
      caloriesKcal: calories ?? 0,
      proteinG: protein ?? 0,
      carbsG: carbs ?? 0,
      fatG: fat ?? 0,
      fiberG: fiber,
      sugarG: sugar,
      saturatedFatG: saturated,
      sodiumMg,
    },
    missing,
  };
}

/** Grams in one serving, when the label states a parsable figure. */
export function readServingGrams(product: OffProduct): number | null {
  const quantity = numberOrNull(product.serving_quantity);
  if (quantity !== null && quantity > 0) return quantity;

  // Fall back to the printed text, e.g. "1 bar (45 g)".
  const printed = textOrNull(product.serving_size);
  if (printed === null) return null;

  const grams = /(\d+(?:[.,]\d+)?)\s*g\b/i.exec(printed);
  if (!grams?.[1]) return null;

  const parsed = Number(grams[1].replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Translate a response, or return null when there is no usable product.
 *
 * Null rather than an empty product: a record with no name and no nutrition
 * is not a thing the user can do anything with, and showing it as a
 * successful scan would be worse than saying it was not found.
 */
export function toProductLabel(
  barcode: string,
  response: OffResponse,
): LabelLookup | null {
  if (response.status !== 1 || !response.product) return null;

  const product = response.product;
  const { nutrients, missing } = readNutrients(product.nutriments);
  const ingredients = readIngredients(product.ingredients_text);
  const declaredAllergens = readAllergens(product.allergens_tags);
  const name = textOrNull(product.product_name);

  const CORE: (keyof Nutrients)[] = ['caloriesKcal', 'proteinG', 'carbsG', 'fatG'];
  const missingAllCore = CORE.every((key) => missing.includes(key));

  // Nothing to show: no name and no nutrition is a database stub, not a
  // product.
  if (name === null && missingAllCore) return null;

  const label: ProductLabel = {
    barcode,
    name,
    brand: textOrNull(product.brands),
    servingSize: textOrNull(product.serving_size),
    servingGrams: readServingGrams(product),
    per100g: nutrients,
    ingredients,
    declaredAllergens,
    source: 'open_food_facts',
    updatedAt:
      typeof product.last_modified_t === 'number'
        ? new Date(product.last_modified_t * 1000).toISOString()
        : null,
  };

  const gaps: LabelGaps = {
    missingNutrition: missingAllCore,
    missingIngredients: ingredients.length === 0,
    missingAllergens: declaredAllergens.length === 0,
    missingNutrients: missing,
  };

  return { product: label, gaps };
}
