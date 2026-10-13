-- Body weight.
--
-- One row per reading, like water and like the journal. A single mutable
-- "current weight" column could not answer "what did I weigh a month ago",
-- which is the only question this data is kept for: a single number today
-- tells you nothing, and a direction over weeks tells you everything.
--
-- Stored in kilograms whatever the user's measurement system. Pounds are a
-- presentation choice; storing the unit per row would mean every query had
-- to know which unit each row was written in before it could compare two.

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- When they stood on the scales, not when the row was written.
  measured_at timestamptz not null default now(),
  weight_kg numeric(5, 2) not null,

  created_at timestamptz not null default now(),

  -- Wide enough for any adult and for most children, narrow enough that a
  -- slipped decimal point is caught rather than stored and charted.
  constraint weight_entries_range check (weight_kg between 20 and 400),
  constraint weight_entries_measured_at_not_future
    check (measured_at <= now() + interval '1 day'),
  constraint weight_entries_measured_at_not_ancient
    check (measured_at >= timestamptz '2020-01-01')
);

comment on table public.weight_entries is
  'One row per weigh-in. The trend is read from these; no current value is stored.';

-- The only query the app makes: this user's readings, newest first.
create index weight_entries_user_measured_idx
  on public.weight_entries (user_id, measured_at desc);

alter table public.weight_entries enable row level security;

-- Owner-only, all four operations: this is the user's own record of their
-- own body, so they may add to it and take back a mistyped number. The
-- `with check` clauses are what stop a client writing a row under someone
-- else's id.
create policy "weight_entries: read own"
  on public.weight_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "weight_entries: insert own"
  on public.weight_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "weight_entries: update own"
  on public.weight_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "weight_entries: delete own"
  on public.weight_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);
