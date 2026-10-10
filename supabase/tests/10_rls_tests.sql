-- Row Level Security and constraint tests.
--
-- Run against a throwaway Postgres instance that has the shim plus every
-- migration applied: see scripts/test-db.sh.
--
-- The point of these tests is that client-side filtering is NOT a security
-- boundary. Each test impersonates a real signed-in user by setting the same
-- `request.jwt.claims` that PostgREST sets, switching to the `authenticated`
-- role, and then trying to reach another user's data.

\set ON_ERROR_STOP on
\timing off

create schema if not exists tests;

-- Fails the run with a clear message unless `condition` holds.
create or replace function tests.assert(condition boolean, description text)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'FAILED: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

-- Asserts that a statement is rejected. Used for every "must not be allowed"
-- case: a test that merely checks a row is absent would also pass if the
-- statement silently did nothing.
create or replace function tests.assert_rejected(statement text, description text)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
  exception
    when others then
      raise notice 'ok - % (rejected: %)', description, sqlerrm;
      return;
  end;
  raise exception 'FAILED: % (the statement was allowed)', description;
end;
$$;

-- Asserts a statement affected no rows, which is how RLS blocks UPDATE and
-- DELETE: the rows are simply invisible rather than an error.
create or replace function tests.assert_no_rows_affected(statement text, description text)
returns void
language plpgsql
as $$
declare
  affected bigint;
begin
  execute statement;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAILED: % (% rows were affected)', description, affected;
  end if;
  raise notice 'ok - %', description;
end;
$$;

-- Impersonates a signed-in user exactly as a real API request does.
create or replace function tests.sign_in_as(target_user_id uuid)
returns void
language plpgsql
as $$
begin
  -- `false` makes this session-scoped. A real request sets it per transaction,
  -- but psql commits after every statement, which would discard it.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', target_user_id::text, 'role', 'authenticated')::text,
    false
  );
end;
$$;

create or replace function tests.sign_out()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', false);
end;
$$;

-- The helpers must be callable while impersonating a signed-in user, so the
-- test roles need access to this schema too.
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ===========================================================================
-- Fixtures
-- ===========================================================================

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  bob   uuid := '22222222-2222-2222-2222-222222222222';
begin
  insert into auth.users (id, email) values
    (alice, 'alice@example.test'),
    (bob, 'bob@example.test');
end;
$$;

-- ---------------------------------------------------------------------------
-- Sign-up provisioning
-- ---------------------------------------------------------------------------

select tests.assert(
  (select count(*) from public.profiles) = 2,
  'signing up creates a profile row automatically'
);

select tests.assert(
  (select count(*) from public.user_preferences) = 2,
  'signing up creates a user_preferences row automatically'
);

select tests.assert(
  (select retain_photos from public.user_preferences
   where user_id = '11111111-1111-1111-1111-111111111111') = false,
  'photo retention is off by default'
);

select tests.assert(
  (select food_memory_enabled from public.user_preferences
   where user_id = '11111111-1111-1111-1111-111111111111') = true,
  'food memory is on by default'
);

-- Seed one meal for each user, as the owner would.
do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  bob   uuid := '22222222-2222-2222-2222-222222222222';
  alice_entry uuid;
  bob_entry uuid;
begin
  insert into public.food_entries (id, user_id, meal_type, title, consumed_at)
  values (gen_random_uuid(), alice, 'breakfast', 'Alice porridge', now() - interval '2 hours')
  returning id into alice_entry;

  insert into public.food_entries (id, user_id, meal_type, title, consumed_at)
  values (gen_random_uuid(), bob, 'lunch', 'Bob sandwich', now() - interval '1 hour')
  returning id into bob_entry;

  insert into public.food_entry_items
    (entry_id, user_id, name, portion_quantity, portion_unit, grams_resolved,
     calories_kcal, protein_g, carbs_g, fat_g, source, confidence, provider_label)
  values
    (alice_entry, alice, 'Oats', 80, 'g', 80, 300, 10, 54, 6, 'database', 'high', 'USDA FoodData Central'),
    (bob_entry, bob, 'Bread', 60, 'g', 60, 160, 6, 30, 2, 'database', 'high', 'USDA FoodData Central');

  -- Record the ids for later tests.
  create temporary table test_ids (label text primary key, id uuid);
  insert into test_ids values ('alice_entry', alice_entry), ('bob_entry', bob_entry);
end;
$$;

-- The test roles read these ids while impersonating a user.
grant select on test_ids to anon, authenticated;

-- ===========================================================================
-- RLS: food_entries
-- ===========================================================================

set role authenticated;

select tests.sign_in_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from public.food_entries) = 1,
  'a signed-in user sees only their own entries'
);

select tests.assert(
  (select title from public.food_entries) = 'Alice porridge',
  'the entry a user sees is their own'
);

select tests.assert(
  (select count(*) from public.food_entries where title = 'Bob sandwich') = 0,
  'another user''s entry is invisible even when queried by name'
);

-- Writing a row owned by someone else must be refused, not silently re-owned.
select tests.assert_rejected(
  $stmt$
    insert into public.food_entries (user_id, meal_type, title)
    values ('22222222-2222-2222-2222-222222222222', 'dinner', 'Forged for Bob')
  $stmt$,
  'a user cannot create an entry owned by another user'
);

select tests.assert_no_rows_affected(
  $stmt$ update public.food_entries set title = 'Hijacked' where title = 'Bob sandwich' $stmt$,
  'a user cannot update another user''s entry'
);

select tests.assert_no_rows_affected(
  $stmt$ delete from public.food_entries where title = 'Bob sandwich' $stmt$,
  'a user cannot delete another user''s entry'
);

-- Reassigning one's own row to another user would move data out of reach.
select tests.assert_rejected(
  $stmt$
    update public.food_entries
    set user_id = '22222222-2222-2222-2222-222222222222'
    where title = 'Alice porridge'
  $stmt$,
  'a user cannot hand their entry to another user'
);

-- ===========================================================================
-- RLS: food_entry_items
-- ===========================================================================

select tests.assert(
  (select count(*) from public.food_entry_items) = 1,
  'a user sees only the items of their own entries'
);

select tests.assert(
  (select name from public.food_entry_items) = 'Oats',
  'the item a user sees belongs to their own meal'
);

select tests.assert_rejected(
  format(
    $stmt$
      insert into public.food_entry_items
        (entry_id, user_id, name, portion_quantity, portion_unit,
         calories_kcal, protein_g, carbs_g, fat_g, source)
      values (%L, '11111111-1111-1111-1111-111111111111', 'Injected',
              100, 'g', 100, 1, 1, 1, 'user_entered')
    $stmt$,
    (select id from test_ids where label = 'bob_entry')
  ),
  'a user cannot add an item to another user''s meal'
);

-- The spoof that the denormalized owner column invites: claim your own uid
-- while pointing at someone else's entry.
select tests.assert_rejected(
  format(
    $stmt$
      insert into public.food_entry_items
        (entry_id, user_id, name, portion_quantity, portion_unit,
         calories_kcal, protein_g, carbs_g, fat_g, source)
      values (%L, '11111111-1111-1111-1111-111111111111', 'Spoofed owner',
              100, 'g', 100, 1, 1, 1, 'user_entered')
    $stmt$,
    (select id from test_ids where label = 'bob_entry')
  ),
  'claiming your own uid does not grant access to another user''s meal'
);

-- An item inserted with a wrong-but-own-looking user_id gets corrected by the
-- trigger rather than stored inconsistently.
do $$
declare
  alice_entry uuid := (select id from test_ids where label = 'alice_entry');
  inserted_owner uuid;
begin
  insert into public.food_entry_items
    (entry_id, user_id, name, portion_quantity, portion_unit,
     calories_kcal, protein_g, carbs_g, fat_g, source)
  values (alice_entry, '22222222-2222-2222-2222-222222222222', 'Owner gets fixed',
          50, 'g', 50, 1, 1, 1, 'user_entered')
  returning user_id into inserted_owner;

  perform tests.assert(
    inserted_owner = '11111111-1111-1111-1111-111111111111',
    'the item owner is forced to the parent entry''s owner, whatever was sent'
  );

  delete from public.food_entry_items where name = 'Owner gets fixed';
end;
$$;

-- ===========================================================================
-- RLS: saved meals, insights, entitlements
-- ===========================================================================

reset role;
insert into public.saved_meals (user_id, name, meal_type, items)
values (
  '22222222-2222-2222-2222-222222222222',
  'Bob usual',
  'lunch',
  '[{"name": "Bread"}]'::jsonb
);
insert into public.food_insights
  (user_id, kind, period_start, period_end, headline, detail, evidence)
values (
  '22222222-2222-2222-2222-222222222222',
  'weekly_summary', current_date - 6, current_date,
  'Bob headline', 'Bob detail',
  json_build_object(
    'entryCount', 1,
    'entryIds', json_build_array((select id from test_ids where label = 'bob_entry')),
    'method', 'counted saved meals'
  )::jsonb
);
insert into public.subscription_entitlements
  (user_id, tier, status, store, product_id, verified_at)
values (
  '22222222-2222-2222-2222-222222222222',
  'premium', 'active', 'app_store', 'com.example.foodlensai.premium.monthly', now()
);

set role authenticated;
select tests.sign_in_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from public.saved_meals) = 0,
  'a user cannot see another user''s saved meals'
);

select tests.assert(
  (select count(*) from public.food_insights) = 0,
  'a user cannot see another user''s insights'
);

select tests.assert(
  (select count(*) from public.subscription_entitlements) = 0,
  'a user cannot see another user''s entitlement'
);

-- Insights are computed server-side; a client-written one would be an
-- unverifiable claim about the user's own history.
select tests.assert_rejected(
  format(
    $stmt$
      insert into public.food_insights
        (user_id, kind, period_start, period_end, headline, detail, evidence)
      values ('11111111-1111-1111-1111-111111111111', 'variety',
              current_date - 6, current_date, 'Made up', 'Made up',
              '{"entryCount": 1, "entryIds": ["%s"], "method": "invented"}'::jsonb)
    $stmt$,
    (select id from test_ids where label = 'alice_entry')
  ),
  'a client cannot write its own insights'
);

-- The whole point of server-verified entitlements.
select tests.assert_rejected(
  $stmt$
    insert into public.subscription_entitlements (user_id, tier, status, store, product_id, verified_at)
    values ('11111111-1111-1111-1111-111111111111', 'premium', 'active', 'app_store', 'free.lunch', now())
  $stmt$,
  'a client cannot grant itself a premium entitlement'
);

select tests.assert_no_rows_affected(
  $stmt$ update public.subscription_entitlements set tier = 'premium' $stmt$,
  'a client cannot upgrade an existing entitlement'
);

-- ===========================================================================
-- RLS: anonymous requests
-- ===========================================================================

select tests.sign_out();
reset role;
set role anon;

select tests.assert(
  (select count(*) from public.food_entries) = 0,
  'an unauthenticated request sees no entries'
);
select tests.assert(
  (select count(*) from public.food_entry_items) = 0,
  'an unauthenticated request sees no items'
);
select tests.assert(
  (select count(*) from public.profiles) = 0,
  'an unauthenticated request sees no profiles'
);
select tests.assert(
  (select count(*) from public.saved_meals) = 0,
  'an unauthenticated request sees no saved meals'
);

select tests.assert_rejected(
  $stmt$
    insert into public.food_entries (user_id, meal_type, title)
    values ('11111111-1111-1111-1111-111111111111', 'dinner', 'Anonymous write')
  $stmt$,
  'an unauthenticated request cannot create an entry'
);

-- ===========================================================================
-- Storage policies
-- ===========================================================================

reset role;
insert into storage.objects (bucket_id, name, owner)
values ('meal-photos', '22222222-2222-2222-2222-222222222222/photo.jpg',
        '22222222-2222-2222-2222-222222222222');

set role authenticated;
select tests.sign_in_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from storage.objects) = 0,
  'a user cannot list photos in another user''s folder'
);

select tests.assert_rejected(
  $stmt$
    insert into storage.objects (bucket_id, name)
    values ('meal-photos', '22222222-2222-2222-2222-222222222222/sneaky.jpg')
  $stmt$,
  'a user cannot upload into another user''s folder'
);

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('meal-photos', '11111111-1111-1111-1111-111111111111/mine.jpg');
  perform tests.assert(true, 'a user can upload into their own folder');
end;
$$;

select tests.assert(
  (select count(*) from storage.objects) = 1,
  'a user sees exactly their own photos'
);

select tests.assert(
  (select public from storage.buckets where id = 'meal-photos') = false,
  'the meal-photos bucket is private'
);

-- ===========================================================================
-- Data integrity constraints
-- ===========================================================================

reset role;

select tests.assert_rejected(
  $stmt$
    insert into public.food_entry_items
      (entry_id, user_id, name, portion_quantity, portion_unit,
       calories_kcal, protein_g, carbs_g, fat_g, source)
    select id, user_id, 'Negative calories', 100, 'g', -50, 1, 1, 1, 'user_entered'
    from public.food_entries where title = 'Alice porridge'
  $stmt$,
  'negative calories are rejected'
);

select tests.assert_rejected(
  $stmt$
    insert into public.food_entry_items
      (entry_id, user_id, name, portion_quantity, portion_unit,
       calories_kcal, protein_g, carbs_g, fat_g, source)
    select id, user_id, 'Zero portion', 0, 'g', 100, 1, 1, 1, 'user_entered'
    from public.food_entries where title = 'Alice porridge'
  $stmt$,
  'a zero portion is rejected'
);

select tests.assert_rejected(
  $stmt$
    insert into public.food_entry_items
      (entry_id, user_id, name, portion_quantity, portion_unit,
       calories_kcal, protein_g, carbs_g, fat_g, saturated_fat_g, source)
    select id, user_id, 'Impossible fat', 100, 'g', 300, 1, 1, 10, 25, 'user_entered'
    from public.food_entries where title = 'Alice porridge'
  $stmt$,
  'saturated fat above total fat is rejected'
);

select tests.assert_rejected(
  $stmt$
    insert into public.food_entry_items
      (entry_id, user_id, name, portion_quantity, portion_unit,
       calories_kcal, protein_g, carbs_g, fat_g, source, provider_label)
    select id, user_id, 'Unattributed lookup', 100, 'g', 300, 1, 1, 10, 'database', null
    from public.food_entries where title = 'Alice porridge'
  $stmt$,
  'a database-sourced value must name its provider'
);

select tests.assert_rejected(
  $stmt$
    insert into public.food_entries (user_id, meal_type, title, consumed_at)
    values ('11111111-1111-1111-1111-111111111111', 'dinner', 'Tomorrow',
            now() + interval '10 days')
  $stmt$,
  'a meal eaten in the future is rejected'
);

select tests.assert_rejected(
  $stmt$
    update public.user_preferences
    set allergy_awareness_enabled = true, allergens = '{}'
    where user_id = '11111111-1111-1111-1111-111111111111'
  $stmt$,
  'allergy filtering cannot be enabled with no allergens listed'
);

select tests.assert_rejected(
  $stmt$
    update public.user_preferences set target_calories_kcal = 50
    where user_id = '11111111-1111-1111-1111-111111111111'
  $stmt$,
  'an implausible calorie target is rejected'
);

select tests.assert_rejected(
  $stmt$
    insert into public.food_insights
      (user_id, kind, period_start, period_end, headline, detail, evidence)
    values ('11111111-1111-1111-1111-111111111111', 'variety',
            current_date - 6, current_date, 'No evidence', 'No evidence',
            '{"entryCount": 0, "entryIds": [], "method": "none"}'::jsonb)
  $stmt$,
  'an insight with no supporting entries is rejected'
);

-- A CHECK that evaluates to NULL passes, so each of these omits a key rather
-- than supplying a wrong-typed one: that is the case a naive type check misses.
select tests.assert_rejected(
  $stmt$
    insert into public.food_insights
      (user_id, kind, period_start, period_end, headline, detail, evidence)
    values ('11111111-1111-1111-1111-111111111111', 'variety',
            current_date - 6, current_date, 'No key', 'No key', '{}'::jsonb)
  $stmt$,
  'an insight whose evidence omits entryIds entirely is rejected'
);

select tests.assert_rejected(
  $stmt$
    insert into public.food_insights
      (user_id, kind, period_start, period_end, headline, detail, evidence)
    values ('11111111-1111-1111-1111-111111111111', 'macro_balance',
            current_date - 6, current_date, 'No method', 'No method',
            '{"entryCount": 1, "entryIds": ["x"]}'::jsonb)
  $stmt$,
  'an insight whose evidence omits the method is rejected'
);

select tests.assert_rejected(
  $stmt$
    insert into public.saved_meals (user_id, name, items)
    values ('11111111-1111-1111-1111-111111111111', 'Empty', '[]'::jsonb)
  $stmt$,
  'a saved meal with no foods is rejected'
);

select tests.assert_rejected(
  $stmt$
    insert into public.subscription_entitlements (user_id, tier, status, store, product_id)
    values ('11111111-1111-1111-1111-111111111111', 'premium', 'active', 'app_store', 'p1')
  $stmt$,
  'an active premium entitlement must carry a verification timestamp'
);

-- ---------------------------------------------------------------------------
-- Cascades and helper behaviour
-- ---------------------------------------------------------------------------

do $$
declare
  -- Not named `entry_id`: that would shadow the column of the same name and
  -- make the WHERE clause ambiguous.
  target_entry uuid := (select id from public.food_entries where title = 'Alice porridge');
  remaining bigint;
begin
  delete from public.food_entries where id = target_entry;

  select count(*) into remaining
  from public.food_entry_items
  where food_entry_items.entry_id = target_entry;

  perform tests.assert(remaining = 0, 'deleting an entry deletes its items');
end;
$$;

select tests.assert(
  public.current_subscription_tier('11111111-1111-1111-1111-111111111111') = 'free',
  'a user with no entitlement row is on the free tier'
);

select tests.assert(
  public.current_subscription_tier('22222222-2222-2222-2222-222222222222') = 'premium',
  'a verified active entitlement reports premium'
);

do $$
begin
  update public.subscription_entitlements
  set expires_at = now() - interval '1 day'
  where user_id = '22222222-2222-2222-2222-222222222222';

  perform tests.assert(
    public.current_subscription_tier('22222222-2222-2222-2222-222222222222') = 'free',
    'an expired entitlement falls back to free'
  );
end;
$$;

do $$
declare
  user_to_delete uuid := '22222222-2222-2222-2222-222222222222';
begin
  delete from auth.users where id = user_to_delete;

  perform tests.assert(
    (select count(*) from public.profiles where id = user_to_delete) = 0
      and (select count(*) from public.food_entries where user_id = user_to_delete) = 0
      and (select count(*) from public.saved_meals where user_id = user_to_delete) = 0
      and (select count(*) from public.food_insights where user_id = user_to_delete) = 0
      and (select count(*) from public.subscription_entitlements where user_id = user_to_delete) = 0,
    'deleting the auth user removes every row they owned'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Every public table must have RLS on. A new table without it is a data leak.
-- ---------------------------------------------------------------------------

do $$
declare
  unprotected text;
begin
  select string_agg(c.relname, ', ')
  into unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  perform tests.assert(
    unprotected is null,
    'every table in the public schema has row level security enabled'
  );
end;
$$;

select 'ALL RLS AND CONSTRAINT TESTS PASSED' as result;
