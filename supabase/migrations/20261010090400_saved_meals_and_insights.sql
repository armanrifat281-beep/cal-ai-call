-- Saved meals (quick re-logging) and Food Memory insights.

create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  name text not null,
  -- Null when the meal suits any time of day.
  meal_type public.meal_type,

  -- The foods are stored as a JSON snapshot rather than rows: a saved meal is
  -- a template, and it must keep the numbers it had when it was saved even if
  -- the original journal entry is later edited or deleted.
  items jsonb not null,

  use_count integer not null default 0,
  last_used_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint saved_meals_name_length check (char_length(name) between 1 and 160),
  constraint saved_meals_items_is_array check (jsonb_typeof(items) = 'array'),
  constraint saved_meals_items_not_empty check (jsonb_array_length(items) between 1 and 50),
  constraint saved_meals_use_count_non_negative check (use_count >= 0),
  -- One name per user, so the quick-log list has no confusing duplicates.
  constraint saved_meals_unique_name_per_user unique (user_id, name)
);

comment on table public.saved_meals is
  'A meal template the user can re-log in one tap. Items are a frozen snapshot.';
comment on column public.saved_meals.items is
  'JSON array of food items, shaped like FoodEntryItem in src/types/domain.ts.';

create table public.food_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  kind public.insight_kind not null,
  -- Local calendar dates, inclusive.
  period_start date not null,
  period_end date not null,

  headline text not null,
  detail text not null,

  -- Which entries this was computed from, and how. Required, not optional:
  -- an insight that cannot point at its evidence must not be stored.
  evidence jsonb not null,

  created_at timestamptz not null default now(),

  constraint food_insights_headline_length check (char_length(headline) between 1 and 200),
  constraint food_insights_detail_length check (char_length(detail) between 1 and 1000),
  constraint food_insights_period_ordered check (period_start <= period_end),
  constraint food_insights_period_bounded check (period_end - period_start <= 400),
  constraint food_insights_evidence_is_object check (jsonb_typeof(evidence) = 'object'),

  -- Enforces the shape the app relies on, so a malformed insight cannot be
  -- rendered as an unsupported claim.
  --
  -- Each check asserts the key EXISTS before inspecting it: for a missing key
  -- `evidence -> 'key'` is NULL, jsonb_typeof(NULL) is NULL, and a CHECK that
  -- evaluates to NULL passes. Testing the type alone would let an insight with
  -- no evidence at all into the table.
  constraint food_insights_evidence_has_entry_ids
    check (evidence ? 'entryIds' and jsonb_typeof(evidence -> 'entryIds') = 'array'),
  constraint food_insights_evidence_has_method
    check (evidence ? 'method' and jsonb_typeof(evidence -> 'method') = 'string'),
  constraint food_insights_evidence_not_empty
    check (coalesce(jsonb_array_length(evidence -> 'entryIds'), 0) >= 1),

  -- Regenerating a period replaces its insight rather than adding a duplicate.
  constraint food_insights_unique_per_period
    unique (user_id, kind, period_start, period_end)
);

comment on table public.food_insights is
  'Cached Food Memory insights. Every row must cite the entries it came from.';

create trigger saved_meals_set_updated_at
  before update on public.saved_meals
  for each row execute function public.set_updated_at();

create index saved_meals_user_use_count_idx
  on public.saved_meals (user_id, use_count desc, last_used_at desc nulls last);

create index food_insights_user_period_idx
  on public.food_insights (user_id, period_end desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.saved_meals enable row level security;
alter table public.food_insights enable row level security;

create policy "saved_meals: read own"
  on public.saved_meals for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "saved_meals: insert own"
  on public.saved_meals for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "saved_meals: update own"
  on public.saved_meals for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "saved_meals: delete own"
  on public.saved_meals for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Insights are computed, so the client may read and clear them but not write
-- them: a client-written insight would be an unverifiable claim about history.
create policy "food_insights: read own"
  on public.food_insights for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "food_insights: delete own"
  on public.food_insights for delete
  to authenticated
  using ((select auth.uid()) = user_id);
