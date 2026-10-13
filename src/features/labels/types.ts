import type { Nutrients } from '@/types/domain';

/**
 * A packaged product, as its own label states it.
 *
 * Every field is nullable, and that is the point of the type. A label is a
 * primary source: what it does not say, nobody knows. An app that fills the
 * gaps - a plausible fibre figure, an allergen it assumes from the
 * ingredients - turns a fact into a guess while still looking like a fact,
 * and the user has no way to tell which they are reading.
 *
 * So: null means "the label did not say", and the screens draw that
 * explicitly rather than hiding the row.
 */
export interface ProductLabel {
  /** The scanned code, kept so a correction can be reported back. */
  barcode: string;
  name: string | null;
  brand: string | null;
  /** e.g. "100 g" or "1 bar (45 g)", exactly as printed. */
  servingSize: string | null;
  /** Grams in one serving, when the label gives a figure to parse. */
  servingGrams: number | null;

  /**
   * Per 100 g, which is how packaged food is published.
   *
   * Per-serving figures are derived from this and `servingGrams`, never
   * stored separately: two sets of numbers that can disagree is a bug
   * waiting to be found by a user.
   */
  per100g: Nutrients;

  /** Ingredients as printed, in order. Empty when the label was not read. */
  ingredients: string[];
  /**
   * Allergens the packaging itself declares.
   *
   * Never inferred from the ingredient list. "Contains milk" is a legal
   * statement by the manufacturer; "I saw whey in the ingredients" is this
   * app guessing, and someone with an allergy could be harmed by the
   * difference.
   */
  declaredAllergens: string[];

  /** Where this came from, so a screen can say so. */
  source: ProductSource;
  /** When the record was last edited in the source database. */
  updatedAt: string | null;
}

export type ProductSource =
  /** Open Food Facts, the public product database. */
  | 'open_food_facts'
  /** Read from a photograph of the label by a vision model. */
  | 'label_photo'
  /** Typed or corrected by the user. */
  | 'user_entered';

/**
 * What a lookup could not establish.
 *
 * Returned alongside the product rather than thrown, because a partial
 * record is still useful - a name and calories with no fibre figure beats
 * nothing - as long as the screen says what is missing.
 */
export interface LabelGaps {
  /** True when the database has the product but no nutrition at all. */
  missingNutrition: boolean;
  /** True when no ingredient list is recorded. */
  missingIngredients: boolean;
  /** True when no allergen statement is recorded. */
  missingAllergens: boolean;
  /** Nutrient keys the source left blank. */
  missingNutrients: (keyof Nutrients)[];
}

export interface LabelLookup {
  product: ProductLabel;
  gaps: LabelGaps;
}
