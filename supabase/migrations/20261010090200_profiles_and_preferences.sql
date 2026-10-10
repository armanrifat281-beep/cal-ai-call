-- Profiles and preferences.
--
-- One row per user in each table, keyed by the Supabase auth user id. Both are
-- created automatically when a user signs up, so the app never has to handle a
-- "profile missing" state.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  -- Null until the user finishes onboarding. The app reads this to decide the
  -- first screen after sign-in.
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 80),
  constraint profiles_avatar_url_length
    check (avatar_url is null or char_length(avatar_url) <= 2048)
);

comment on table public.profiles is
  'Per-user profile. Deliberately minimal: we do not collect age, sex, height or weight.';

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- BCP-47 language tag, e.g. "en", "pt-BR".
  language text not null default 'en',
  -- ISO 3166-1 alpha-2, used to prefer regional food datasets. Null = unset.
  country_code text,
  measurement_system public.measurement_system not null default 'metric',

  dietary_patterns public.dietary_pattern[] not null default '{}',

  -- Free text, because allergens are not a closed set. Only stored when the
  -- user opted in, and used solely to filter meal suggestions.
  allergens text[] not null default '{}',
  allergy_awareness_enabled boolean not null default false,

  disliked_foods text[] not null default '{}',
  favorite_cuisines text[] not null default '{}',

  goal public.nutrition_goal not null default 'none',

  -- Daily targets. Null means the user set no target for that nutrient; the
  -- app must not substitute a computed value, because we do not compute them.
  target_calories_kcal integer,
  target_protein_g integer,
  target_carbs_g integer,
  target_fat_g integer,

  -- The user allowed meal history to power Food Memory.
  food_memory_enabled boolean not null default true,
  -- The user allowed uploaded photos to be kept after analysis. Off by default.
  retain_photos boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_preferences_language_format
    check (language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  constraint user_preferences_country_format
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),

  -- Bounds that reject obvious data-entry errors without being prescriptive.
  constraint user_preferences_calorie_target_range
    check (target_calories_kcal is null or target_calories_kcal between 500 and 10000),
  constraint user_preferences_protein_target_range
    check (target_protein_g is null or target_protein_g between 0 and 500),
  constraint user_preferences_carb_target_range
    check (target_carbs_g is null or target_carbs_g between 0 and 1500),
  constraint user_preferences_fat_target_range
    check (target_fat_g is null or target_fat_g between 0 and 500),

  -- Keep the arrays from growing without bound.
  constraint user_preferences_allergens_size check (array_length(allergens, 1) is null or array_length(allergens, 1) <= 50),
  constraint user_preferences_disliked_size check (array_length(disliked_foods, 1) is null or array_length(disliked_foods, 1) <= 100),
  constraint user_preferences_cuisines_size check (array_length(favorite_cuisines, 1) is null or array_length(favorite_cuisines, 1) <= 30),

  -- Allergy filtering without any allergens listed is a contradiction that
  -- would silently do nothing, so it is rejected.
  --
  -- The coalesce is load-bearing: array_length('{}', 1) is NULL, and a CHECK
  -- that evaluates to NULL PASSES. Without it this constraint would accept
  -- exactly the state it exists to forbid.
  constraint user_preferences_allergy_awareness_requires_allergens
    check (
      not allergy_awareness_enabled
      or coalesce(array_length(allergens, 1), 0) >= 1
    )
);

comment on table public.user_preferences is
  'Per-user preferences, goals and privacy choices. One row per user.';
comment on column public.user_preferences.retain_photos is
  'Off by default: meal photos are deleted after analysis unless the user opts in.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Automatic provisioning on sign-up
-- ---------------------------------------------------------------------------

-- Creates the profile and preference rows for a new auth user.
-- SECURITY DEFINER is required: the trigger runs during sign-up, before the
-- new user has a session, so it cannot rely on the caller's privileges.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user is
  'Creates the profile and user_preferences rows for a newly signed-up user.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;

-- `(select auth.uid())` rather than a bare call: wrapping it lets Postgres
-- evaluate it once per statement instead of once per row.

create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No INSERT policy: rows are created by the sign-up trigger only.
-- No DELETE policy: a profile goes away with its auth user, via the cascade.

create policy "user_preferences: read own"
  on public.user_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_preferences: insert own"
  on public.user_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_preferences: update own"
  on public.user_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_preferences: delete own"
  on public.user_preferences for delete
  to authenticated
  using ((select auth.uid()) = user_id);
