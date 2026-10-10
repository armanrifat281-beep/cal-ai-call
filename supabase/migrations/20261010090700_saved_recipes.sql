-- Saved recipes.
--
-- Distinct from `saved_meals`, and the names are worth keeping straight:
--
--   saved_meals    a snapshot of a meal already logged, for one-tap re-logging.
--                  It holds finished nutrient numbers and no instructions.
--   saved_recipes  something you cook: ingredients, steps and servings. Its
--                  nutrition is per serving and is often unknown.
--
-- A recipe can be written by the user or suggested by the app. Where a
-- suggestion came from a model, `nutrition_source` records that, so a
-- suggested recipe's numbers are never shown as looked-up values.

create type public.recipe_origin as enum ('user_created', 'ai_suggested', 'imported');

create table public.saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  title text not null,
  description text,
  origin public.recipe_origin not null default 'user_created',

  servings integer not null default 1,
  prep_minutes integer,
  cook_minutes integer,

  -- [{ "name": "Chicken thigh", "quantity": 400, "unit": "g", "note": null }]
  ingredients jsonb not null,
  -- ["Heat the oil", "Add the onion", ...]
  steps jsonb not null default '[]'::jsonb,

  tags text[] not null default '{}',
  is_favorite boolean not null default false,

  -- Nutrition PER SERVING. Null means unknown, which is the common case for a
  -- hand-written recipe, and is never displayed as zero.
  calories_kcal numeric(10, 2),
  protein_g numeric(10, 2),
  carbs_g numeric(10, 2),
  fat_g numeric(10, 2),
  -- Where those four numbers came from. Required whenever any of them is set.
  nutrition_source public.nutrient_source,
  nutrition_provider_label text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint saved_recipes_title_length check (char_length(title) between 1 and 200),
  constraint saved_recipes_description_length
    check (description is null or char_length(description) <= 4000),
  constraint saved_recipes_servings_range check (servings between 1 and 100),
  constraint saved_recipes_prep_range
    check (prep_minutes is null or prep_minutes between 0 and 10000),
  constraint saved_recipes_cook_range
    check (cook_minutes is null or cook_minutes between 0 and 10000),

  constraint saved_recipes_ingredients_is_array check (jsonb_typeof(ingredients) = 'array'),
  constraint saved_recipes_ingredients_size
    check (jsonb_array_length(ingredients) between 1 and 100),
  constraint saved_recipes_steps_is_array check (jsonb_typeof(steps) = 'array'),
  constraint saved_recipes_steps_size check (jsonb_array_length(steps) <= 100),
  constraint saved_recipes_tags_size
    check (coalesce(array_length(tags, 1), 0) <= 20),

  constraint saved_recipes_calories_range
    check (calories_kcal is null or calories_kcal between 0 and 20000),
  constraint saved_recipes_protein_range
    check (protein_g is null or protein_g between 0 and 2000),
  constraint saved_recipes_carbs_range
    check (carbs_g is null or carbs_g between 0 and 5000),
  constraint saved_recipes_fat_range check (fat_g is null or fat_g between 0 and 2000),

  -- Any nutrition figure must say where it came from. Otherwise the app would
  -- be showing a number it cannot attribute.
  constraint saved_recipes_nutrition_requires_source
    check (
      (calories_kcal is null and protein_g is null and carbs_g is null and fat_g is null)
      or nutrition_source is not null
    ),
  -- A database-sourced figure must also name the database.
  constraint saved_recipes_database_source_has_provider
    check (nutrition_source is distinct from 'database' or nutrition_provider_label is not null)
);

comment on table public.saved_recipes is
  'Something the user cooks: ingredients, steps, servings. Nutrition is per serving and may be unknown.';
comment on column public.saved_recipes.nutrition_source is
  'Required whenever any nutrition figure is set, so a figure is never unattributed.';

create trigger saved_recipes_set_updated_at
  before update on public.saved_recipes
  for each row execute function public.set_updated_at();

-- One title per user, case-insensitively: a duplicate "Chicken Curry" and
-- "chicken curry" in the same list is confusing rather than useful.
create unique index saved_recipes_unique_title_per_user_idx
  on public.saved_recipes (user_id, lower(title));

create index saved_recipes_user_updated_idx
  on public.saved_recipes (user_id, updated_at desc);

create index saved_recipes_user_favorites_idx
  on public.saved_recipes (user_id, updated_at desc)
  where is_favorite;

-- Tag filtering ("show me my quick dinners").
create index saved_recipes_tags_idx on public.saved_recipes using gin (tags);

alter table public.saved_recipes enable row level security;

create policy "saved_recipes: read own"
  on public.saved_recipes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "saved_recipes: insert own"
  on public.saved_recipes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "saved_recipes: update own"
  on public.saved_recipes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "saved_recipes: delete own"
  on public.saved_recipes for delete
  to authenticated
  using ((select auth.uid()) = user_id);
