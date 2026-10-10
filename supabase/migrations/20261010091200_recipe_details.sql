-- Extends saved_recipes for the recipe creator.
--
-- Adds columns rather than replacing the table: the existing shape already
-- held title, servings, times, ingredients, steps and per-serving nutrition
-- with its provenance.

alter table public.saved_recipes
  add column cuisine public.cuisine_id,
  -- Free text, only meaningful when cuisine is 'other'.
  add column cuisine_note text,
  add column equipment text[] not null default '{}',
  -- Practical tips shown under the method.
  add column tips text[] not null default '{}',

  -- Image. `image_kind` is what the UI labels it with, so it is required
  -- whenever there is a URI: an unlabelled image could be mistaken for a
  -- photo of the user's own finished dish.
  add column image_uri text,
  add column image_kind public.recipe_image_kind,
  add column image_attribution text,

  -- Set when the user says they do not want this recipe. Food Memory stops
  -- suggesting it, but the row stays so they can still find it.
  add column rejected_at timestamptz,

  add column last_cooked_at timestamptz,
  add column cook_count integer not null default 0,

  -- The request that produced the recipe, kept so it can be regenerated or
  -- tweaked without the user retyping everything.
  add column source_request jsonb;

alter table public.saved_recipes
  add constraint saved_recipes_cuisine_note_length
    check (cuisine_note is null or char_length(cuisine_note) <= 80),
  add constraint saved_recipes_equipment_size
    check (coalesce(array_length(equipment, 1), 0) <= 15),
  add constraint saved_recipes_tips_size
    check (coalesce(array_length(tips, 1), 0) <= 12),
  add constraint saved_recipes_image_uri_length
    check (image_uri is null or char_length(image_uri) <= 2048),
  add constraint saved_recipes_image_attribution_length
    check (image_attribution is null or char_length(image_attribution) <= 300),
  -- An image must say what kind it is, so the UI can label it honestly.
  add constraint saved_recipes_image_requires_kind
    check (image_uri is null or image_kind is not null),
  add constraint saved_recipes_cook_count_non_negative
    check (cook_count >= 0),
  -- A cook count above zero implies it was cooked at some point.
  add constraint saved_recipes_cook_count_implies_timestamp
    check (cook_count = 0 or last_cooked_at is not null),
  add constraint saved_recipes_source_request_is_object
    check (source_request is null or jsonb_typeof(source_request) = 'object');

comment on column public.saved_recipes.image_kind is
  'Drives the UI label. Required whenever image_uri is set.';
comment on column public.saved_recipes.rejected_at is
  'Set when the user rejects a suggestion. Food Memory then skips it, and the row is kept.';
comment on column public.saved_recipes.source_request is
  'The generation request, so a recipe can be regenerated without retyping.';

-- Food Memory suggests from recipes the user has NOT rejected, newest first.
create index saved_recipes_suggestable_idx
  on public.saved_recipes (user_id, updated_at desc)
  where rejected_at is null;

-- "Cook it again": the recipes they actually return to.
create index saved_recipes_cooked_idx
  on public.saved_recipes (user_id, last_cooked_at desc)
  where last_cooked_at is not null;

-- Filtering saved recipes by cuisine.
create index saved_recipes_cuisine_idx
  on public.saved_recipes (user_id, cuisine)
  where cuisine is not null;
