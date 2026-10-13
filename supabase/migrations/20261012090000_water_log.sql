-- Water intake.
--
-- One row per drink rather than a running daily total. A total would be a
-- single mutable number that two devices could clobber, and it could not
-- answer "I tapped that by mistake" - which is the most common thing anyone
-- does with a water button. Rows are cheap, and deleting the last one is an
-- undo that needs no extra machinery.
--
-- The amount is stored in millilitres whatever the user's measurement
-- system. Display units are a presentation choice; storing them would mean
-- every query had to know which unit each row was written in.

create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- When it was drunk, not when the row was written: a glass logged at
  -- midnight for the day before belongs to that day.
  consumed_at timestamptz not null default now(),
  amount_ml integer not null,

  created_at timestamptz not null default now(),

  -- A glass is ~250 ml and a large bottle ~1 l. Five litres in one entry is
  -- a typo, and water intoxication is real, so the cap is deliberate.
  constraint water_entries_amount_range
    check (amount_ml between 1 and 5000),
  -- The same bounds the journal uses, for the same reason: a date far in the
  -- future or before this app existed is a bug, not a drink.
  constraint water_entries_consumed_at_not_future
    check (consumed_at <= now() + interval '1 day'),
  constraint water_entries_consumed_at_not_ancient
    check (consumed_at >= timestamptz '2020-01-01')
);

comment on table public.water_entries is
  'One row per drink. Daily totals are summed from these, never stored.';

-- The only query the app makes: this user's drinks within a day range.
create index water_entries_user_consumed_idx
  on public.water_entries (user_id, consumed_at desc);

alter table public.water_entries enable row level security;

-- Owner-only, all four operations. Unlike scan_events this is the user's own
-- record of their own day, so they may add to it and take back a mistake.
-- `with check` on insert and update is what stops a client writing a row
-- under someone else's id.
create policy "water_entries: read own"
  on public.water_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "water_entries: insert own"
  on public.water_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "water_entries: update own"
  on public.water_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "water_entries: delete own"
  on public.water_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);
