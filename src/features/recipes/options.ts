import type { CuisineId } from '@/types/recipe';

/**
 * Choices the recipe creator offers.
 *
 * Data, so the same lists drive the create form, the saved-recipe filters and
 * Food Memory's "favourite cuisines" without drifting apart.
 */

export interface CuisineOption {
  value: CuisineId;
  label: string;
}

/**
 * Cuisines, ordered so the ones most likely to be picked by this app's early
 * users come first rather than alphabetically.
 */
export const CUISINE_OPTIONS: CuisineOption[] = [
  { value: 'bangladeshi', label: 'Bangladeshi' },
  { value: 'indian', label: 'Indian' },
  { value: 'pakistani', label: 'Pakistani' },
  { value: 'sri_lankan', label: 'Sri Lankan' },
  { value: 'italian', label: 'Italian' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'thai', label: 'Thai' },
  { value: 'vietnamese', label: 'Vietnamese' },
  { value: 'indonesian', label: 'Indonesian' },
  { value: 'mexican', label: 'Mexican' },
  { value: 'middle_eastern', label: 'Middle Eastern' },
  { value: 'turkish', label: 'Turkish' },
  { value: 'north_african', label: 'North African' },
  { value: 'west_african', label: 'West African' },
  { value: 'ethiopian', label: 'Ethiopian' },
  { value: 'french', label: 'French' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'greek', label: 'Greek' },
  { value: 'german', label: 'German' },
  { value: 'british', label: 'British' },
  { value: 'nordic', label: 'Nordic' },
  { value: 'caribbean', label: 'Caribbean' },
  { value: 'brazilian', label: 'Brazilian' },
  { value: 'peruvian', label: 'Peruvian' },
  { value: 'american', label: 'American' },
  { value: 'other', label: 'Something else' },
];

const CUISINE_LABELS = new Map(
  CUISINE_OPTIONS.map((option) => [option.value, option.label]),
);

export function cuisineLabel(cuisine: CuisineId | null): string | null {
  return cuisine ? (CUISINE_LABELS.get(cuisine) ?? null) : null;
}

/**
 * Equipment the form offers as quick picks.
 *
 * Kept to things that genuinely change what a recipe can be, rather than
 * every utensil in a kitchen.
 */
export const EQUIPMENT_OPTIONS: string[] = [
  'Oven',
  'Hob only',
  'Microwave',
  'Air fryer',
  'Pressure cooker',
  'Slow cooker',
  'Blender',
  'Food processor',
  'Rice cooker',
  'Wok',
  'Barbecue',
];

/** Time limits the form offers, in minutes. */
export const TIME_OPTIONS: { value: number | null; label: string }[] = [
  { value: 20, label: 'Under 20 min' },
  { value: 40, label: 'Under 40 min' },
  { value: 90, label: 'Under 1.5 hours' },
  { value: null, label: 'No limit' },
];

/** Serving counts offered as quick picks, with the stepper for anything else. */
export const SERVING_PRESETS = [1, 2, 4, 6] as const;
