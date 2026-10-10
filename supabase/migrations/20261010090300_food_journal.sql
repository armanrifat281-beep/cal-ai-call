-- The food journal: entries and the items inside them.

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- When the food was eaten. The app buckets this into the user's LOCAL day.
  consumed_at timestamptz not null default now(),
  meal_type public.meal_type not null,
  title text not null,

  -- Path inside the private `meal-photos` storage bucket, or null when the
  -- photo was not retained (the default).
  photo_path text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint food_entries_title_length check (char_length(title) between 1 and 160),
  constraint food_entries_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint food_entries_photo_path_length
    check (photo_path is null or char_length(photo_path) <= 400),

  -- A meal cannot be eaten in the future. A day of slack absorbs clock skew
  -- and time-zone edges without allowing nonsense dates.
  constraint food_entries_consumed_at_not_future
    check (consumed_at <= now() + interval '1 day'),
  -- Nor before this app existed.
  constraint food_entries_consumed_at_not_ancient
    check (consumed_at >= timestamptz '2020-01-01')
);

comment on table public.food_entries is
  'One logged meal. Nutrient values live in food_entry_items, not here.';

create table public.food_entry_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.food_entries (id) on delete cascade,

  -- Denormalized owner. It makes every RLS policy on this table a single
  -- indexed comparison instead of a join back to food_entries, and a trigger
  -- below guarantees it always matches the parent entry.
  user_id uuid not null references auth.users (id) on delete cascade,

  name text not null,
  brand text,

  portion_quantity numeric(10, 3) not null,
  portion_unit public.portion_unit not null,
  -- The portion converted to grams, when a conversion was possible. Null means
  -- the nutrients below are a per-serving figure with no known weight.
  grams_resolved numeric(10, 3),

  -- Nutrients FOR THIS PORTION, already scaled. Not per 100 g.
  calories_kcal numeric(10, 2) not null,
  protein_g numeric(10, 2) not null,
  carbs_g numeric(10, 2) not null,
  fat_g numeric(10, 2) not null,
  -- Null means unknown, which is NOT the same as zero. The app shows these as
  -- a dash and marks any total containing one as incomplete.
  fiber_g numeric(10, 2),
  sugar_g numeric(10, 2),
  saturated_fat_g numeric(10, 2),
  sodium_mg numeric(10, 2),

  source public.nutrient_source not null,
  confidence public.confidence_level not null default 'low',
  provider_label text,
  provider_ref text,
  -- Provider-scoped food record id, e.g. 'usda:1750340'.
  food_record_id text,

  notes text,
  -- Display order within the meal.
  position integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint food_entry_items_name_length check (char_length(name) between 1 and 200),
  constraint food_entry_items_brand_length check (brand is null or char_length(brand) <= 160),
  constraint food_entry_items_notes_length check (notes is null or char_length(notes) <= 1000),

  constraint food_entry_items_portion_positive check (portion_quantity > 0),
  constraint food_entry_items_portion_sane check (portion_quantity <= 100000),
  constraint food_entry_items_grams_positive
    check (grams_resolved is null or (grams_resolved > 0 and grams_resolved <= 50000)),

  -- Nutrients are never negative, and are capped at values no single food
  -- portion can exceed, so a bad model response cannot poison a daily total.
  constraint food_entry_items_calories_range check (calories_kcal between 0 and 20000),
  constraint food_entry_items_protein_range check (protein_g between 0 and 2000),
  constraint food_entry_items_carbs_range check (carbs_g between 0 and 5000),
  constraint food_entry_items_fat_range check (fat_g between 0 and 2000),
  constraint food_entry_items_fiber_range check (fiber_g is null or fiber_g between 0 and 1000),
  constraint food_entry_items_sugar_range check (sugar_g is null or sugar_g between 0 and 5000),
  constraint food_entry_items_satfat_range
    check (saturated_fat_g is null or saturated_fat_g between 0 and 2000),
  constraint food_entry_items_sodium_range
    check (sodium_mg is null or sodium_mg between 0 and 500000),

  -- Saturated fat cannot exceed total fat.
  constraint food_entry_items_satfat_within_fat
    check (saturated_fat_g is null or saturated_fat_g <= fat_g + 0.01),

  -- A database-sourced value must say which database it came from, so the
  -- app's "From food database" badge is never an unverifiable claim.
  constraint food_entry_items_database_source_has_provider
    check (source <> 'database' or provider_label is not null),

  constraint food_entry_items_position_range check (position between 0 and 1000)
);

comment on table public.food_entry_items is
  'One food within a logged meal, with nutrients already scaled to its portion.';
comment on column public.food_entry_items.user_id is
  'Denormalized from food_entries so RLS needs no join. Enforced by trigger.';
comment on column public.food_entry_items.fiber_g is
  'Null means unknown, not zero.';

-- ---------------------------------------------------------------------------
-- Keep the denormalized owner correct
-- ---------------------------------------------------------------------------

-- Forces food_entry_items.user_id to the parent entry's owner. Without this, a
-- client could insert an item whose user_id passes RLS but whose entry belongs
-- to someone else.
create or replace function public.sync_food_entry_item_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_user_id uuid;
begin
  select user_id into parent_user_id
  from public.food_entries
  where id = new.entry_id;

  if parent_user_id is null then
    raise exception 'food_entry_items.entry_id % does not exist', new.entry_id
      using errcode = 'foreign_key_violation';
  end if;

  new.user_id := parent_user_id;
  return new;
end;
$$;

comment on function public.sync_food_entry_item_owner is
  'Sets food_entry_items.user_id from its parent entry, so it can never diverge.';

create trigger food_entry_items_sync_owner
  before insert or update of entry_id, user_id on public.food_entry_items
  for each row execute function public.sync_food_entry_item_owner();

create trigger food_entries_set_updated_at
  before update on public.food_entries
  for each row execute function public.set_updated_at();

create trigger food_entry_items_set_updated_at
  before update on public.food_entry_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- The journal's main query: one user's entries for a day or a date range,
-- newest first.
create index food_entries_user_consumed_at_idx
  on public.food_entries (user_id, consumed_at desc);

-- "Recently logged" on the dashboard.
create index food_entries_user_created_at_idx
  on public.food_entries (user_id, created_at desc);

-- Loading the items of the entries just fetched.
create index food_entry_items_entry_id_idx
  on public.food_entry_items (entry_id, position);

-- RLS predicate support, and per-user item scans used by Food Memory.
create index food_entry_items_user_id_idx
  on public.food_entry_items (user_id);

-- Food Memory counts how many days each food name appears on.
create index food_entry_items_user_name_idx
  on public.food_entry_items (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.food_entries enable row level security;
alter table public.food_entry_items enable row level security;

create policy "food_entries: read own"
  on public.food_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "food_entries: insert own"
  on public.food_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "food_entries: update own"
  on public.food_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "food_entries: delete own"
  on public.food_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Items are checked against BOTH the denormalized owner and the parent entry's
-- owner. The trigger already guarantees they agree; the policy not relying on
-- the trigger means a future change to either cannot open a hole on its own.
create policy "food_entry_items: read own"
  on public.food_entry_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "food_entry_items: insert into own entry"
  on public.food_entry_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.food_entries e
      where e.id = entry_id
        and e.user_id = (select auth.uid())
    )
  );

create policy "food_entry_items: update own"
  on public.food_entry_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    exists (
      select 1
      from public.food_entries e
      where e.id = entry_id
        and e.user_id = (select auth.uid())
    )
  );

create policy "food_entry_items: delete own"
  on public.food_entry_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);
