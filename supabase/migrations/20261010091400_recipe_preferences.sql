-- Recipe preferences the creator remembers.
--
-- Part of Food Memory: the serving count and cuisine the user last chose, so
-- they do not retype them every time. Both are things the user picked
-- explicitly; nothing here is inferred from their history.

alter table public.user_preferences
  add column preferred_servings integer not null default 4,
  add column favorite_cuisine_id public.cuisine_id;

alter table public.user_preferences
  add constraint user_preferences_preferred_servings_range
    check (preferred_servings between 1 and 24);

comment on column public.user_preferences.preferred_servings is
  'Default serving count for the recipe creator. Chosen by the user, not inferred.';
comment on column public.user_preferences.favorite_cuisine_id is
  'Default cuisine for the recipe creator. Chosen by the user, not inferred.';
