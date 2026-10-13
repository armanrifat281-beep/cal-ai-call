import type {
  ConfidenceLevel,
  MealType,
  Nutrients,
  Portion,
} from '@/types/domain';

/**
 * The contract between the app and whatever analyses a food photo.
 *
 * Defining this separately from any provider is what makes the vision model
 * swappable: the server adapts a provider's raw response into these shapes, and
 * the app only ever sees this.
 */

/** A food the analyser believes it saw. */
export interface RecognizedFood {
  /** Display name, e.g. "Grilled chicken thigh". */
  name: string;
  /** Ingredients the analyser thinks are present. Informational only. */
  possibleIngredients: string[];
  /** How sure it is that this food is in the photo. */
  confidence: ConfidenceLevel;
  /**
   * The portion it estimated, or null when it could not judge size. A photo
   * with no size reference often cannot support a portion estimate at all.
   */
  estimatedPortion: Portion | null;
  /** Weight estimate in grams, when it could make one. */
  estimatedGrams: number | null;
  /**
   * Nutrients FOR THE ESTIMATED PORTION, from the model. Null when the server
   * matched this food to a database record instead, in which case `candidates`
   * carries the looked-up values.
   */
  estimatedNutrients: Nutrients | null;
  /**
   * Database records the server matched to this food, best first. The user
   * picks one, or keeps the estimate.
   */
  candidates: FoodCandidate[];
}

/** A verified food database record offered as a match. */
export interface FoodCandidate {
  /** Provider-scoped record id, e.g. "usda:1750340". */
  foodRecordId: string;
  name: string;
  brand: string | null;
  providerLabel: string;
  /** Nutrients per 100 g from the database. */
  nutrientsPer100g: Nutrients;
  /** How closely the name matched, 0..1. Not a nutrition confidence. */
  matchScore: number;
}

export interface MealAnalysis {
  /** Foods found, in the order they should be shown. */
  foods: RecognizedFood[];
  /** Meal type guessed from the time of day, as a starting point only. */
  suggestedMealType: MealType;
  /** A short suggested meal name the user can accept or replace. */
  suggestedTitle: string;
  /**
   * True when the analyser could not confidently identify the photo's contents
   * and the user must choose or correct before saving.
   */
  needsUserConfirmation: boolean;
  /** Plain-language notes to show, e.g. "the sauce could not be identified". */
  caveats: string[];
  /** Which model produced this, for the provenance badge. */
  providerLabel: string;
  /** Storage path of the uploaded photo, when it was retained. */
  photoPath: string | null;
}

/** What the app sends for analysis. */
export interface AnalyzeMealInput {
  /** Local file URI of the prepared (validated, resized) image. */
  imageUri: string;
  /**
   * MIME type, already validated against the allowed list.
   *
   * Not put on the wire: the upload part carries the file's own type, and
   * the server re-checks the bytes themselves rather than trusting any
   * declared type. This is kept because it is the result of validation the
   * app did, and callers hold it either way.
   */
  mimeType: string;
  /** Local hour, so the server can suggest a meal type. Not identifying. */
  localHour: number;
  /**
   * Region hint for food matching, e.g. "IN". Sent only when the user chose
   * one; nothing else about the profile is included.
   */
  regionHint?: string | null;
  /** Keep the photo in storage after analysis. Defaults to false. */
  retainPhoto: boolean;
}
