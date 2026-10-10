import type { DietaryPattern, NutritionGoalKind } from '@/types/domain';

/**
 * Choices offered during onboarding.
 *
 * Kept as data so the same lists drive onboarding and Settings, and so adding a
 * region or a dietary pattern is a one-line change.
 */

export interface Option<T extends string> {
  value: T;
  label: string;
  /** Short clarification shown under the label where it helps. */
  description?: string;
}

/**
 * Languages the interface is offered in.
 *
 * Only English is translated today. The others are listed because the setting
 * also tells the food database which regional names to prefer, and the picker
 * states clearly that the interface itself stays in English for now.
 */
export const LANGUAGE_OPTIONS: Option<string>[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Espanol' },
  { value: 'fr', label: 'Francais' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Portugues' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ar', label: 'Arabic' },
  { value: 'bn', label: 'Bangla' },
];

/**
 * Food regions, used to bias food matching toward local dishes and names.
 *
 * This is a short starter list rather than every country: each entry needs a
 * regional food dataset behind it to be worth offering.
 */
export const REGION_OPTIONS: Option<string>[] = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'IN', label: 'India' },
  { value: 'BD', label: 'Bangladesh' },
  { value: 'PK', label: 'Pakistan' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'JP', label: 'Japan' },
  { value: 'CN', label: 'China' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'EG', label: 'Egypt' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'TR', label: 'Turkiye' },
];

export const DIETARY_PATTERN_OPTIONS: Option<DietaryPattern>[] = [
  { value: 'no_restriction', label: 'No restrictions' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'gluten_free', label: 'Gluten free' },
  { value: 'dairy_free', label: 'Dairy free' },
  { value: 'low_carb', label: 'Lower carb' },
  { value: 'high_protein', label: 'Higher protein' },
];

export const CUISINE_OPTIONS: string[] = [
  'South Asian',
  'East Asian',
  'Southeast Asian',
  'Middle Eastern',
  'Mediterranean',
  'West African',
  'East African',
  'Latin American',
  'Caribbean',
  'North American',
  'Central European',
  'Nordic',
];

export const GOAL_OPTIONS: Option<NutritionGoalKind>[] = [
  {
    value: 'understand_eating',
    label: 'Understand what I eat',
    description: 'Just log meals and see patterns. No targets.',
  },
  {
    value: 'more_protein',
    label: 'Get more protein',
    description: 'Highlights protein in your daily summary.',
  },
  {
    value: 'more_vegetables',
    label: 'Eat more vegetables',
    description: 'Tracks how often plants show up in your meals.',
  },
  {
    value: 'manage_weight',
    label: 'Manage my weight',
    description: 'Shows calories against a target you set yourself.',
  },
  {
    value: 'steady_energy',
    label: 'Keep energy steady',
    description: 'Looks at how your meals are spread across the day.',
  },
  {
    value: 'none',
    label: 'I would rather not say',
    description: 'The app works the same, with no goal shown.',
  },
];

/**
 * Common allergens, offered as quick picks.
 *
 * These match the major regulated allergen groups in the EU and US so the list
 * is familiar, and the user can add anything else as free text.
 */
export const COMMON_ALLERGEN_SUGGESTIONS: string[] = [
  'Peanuts',
  'Tree nuts',
  'Milk',
  'Eggs',
  'Fish',
  'Shellfish',
  'Soy',
  'Wheat / gluten',
  'Sesame',
  'Celery',
  'Mustard',
  'Sulphites',
  'Lupin',
  'Molluscs',
];
