-- Enumerated types for the recipe creator.
--
-- In its own migration because `alter type ... add value` and the first use of
-- that new value cannot share a transaction. Supabase wraps each migration
-- file in one, so the value is added here and used in the next file.

-- The recipe creator produces recipes, so the origin needs a value for that.
-- 'ai_suggested' is kept for any row already written with it.
alter type public.recipe_origin add value if not exists 'ai_generated';

/**
 * Cuisines the recipe creator can target.
 *
 * A closed set rather than free text, so a cuisine can be stored, filtered
 * and remembered by Food Memory without normalising spellings. 'other'
 * carries a free-text note alongside it.
 */
create type public.cuisine_id as enum (
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
  'other'
);

/**
 * How a recipe image was obtained.
 *
 * This drives the label shown beside the image. An illustrative image must
 * never be presented as a photograph of the user's own cooking, so the
 * distinction is stored rather than inferred.
 */
create type public.recipe_image_kind as enum (
  'ai_generated',
  'stock_library',
  'user_photo',
  'placeholder'
);
