-- Row Level Security and constraint tests for saved recipes and shopping lists.
--
-- Runs after 10_rls_tests.sql, which created the tests schema, its helpers and
-- the two fixture users. It re-seeds its own users because that file deletes
-- Bob at the end.

\set ON_ERROR_STOP on

do $$
declare
  cara uuid := '33333333-3333-3333-3333-333333333333';
  dan  uuid := '44444444-4444-4444-4444-444444444444';
begin
  insert into auth.users (id, email) values
    (cara, 'cara@example.test'),
    (dan, 'dan@example.test')
  on conflict (id) do nothing;
end;
$$;

-- Seed one recipe and one list for each user, as the owner.
do $$
declare
  cara uuid := '33333333-3333-3333-3333-333333333333';
  dan  uuid := '44444444-4444-4444-4444-444444444444';
  cara_recipe uuid;
  dan_recipe uuid;
  cara_list uuid;
  dan_list uuid;
begin
  insert into public.saved_recipes (user_id, title, ingredients, steps, tags)
  values (
    cara, 'Cara lentil dal',
    '[{"name": "Red lentils", "quantity": 200, "unit": "g"}]'::jsonb,
    '["Rinse the lentils", "Simmer for 20 minutes"]'::jsonb,
    array['quick', 'vegan']
  )
  returning id into cara_recipe;

  insert into public.saved_recipes (user_id, title, ingredients)
  values (
    dan, 'Dan roast chicken',
    '[{"name": "Chicken", "quantity": 1.4, "unit": "piece"}]'::jsonb
  )
  returning id into dan_recipe;

  insert into public.shopping_lists (user_id, name)
  values (cara, 'Cara weekly shop') returning id into cara_list;

  insert into public.shopping_lists (user_id, name)
  values (dan, 'Dan weekly shop') returning id into dan_list;

  insert into public.shopping_list_items (list_id, user_id, name, quantity, unit, source_recipe_id)
  values (cara_list, cara, 'Red lentils', 200, 'g', cara_recipe);

  insert into public.shopping_list_items (list_id, user_id, name)
  values (dan_list, dan, 'Chicken');

  create temporary table recipe_ids (label text primary key, id uuid);
  insert into recipe_ids values
    ('cara_recipe', cara_recipe), ('dan_recipe', dan_recipe),
    ('cara_list', cara_list), ('dan_list', dan_list);
end;
$$;

grant select on recipe_ids to anon, authenticated;

-- ===========================================================================
-- RLS: saved_recipes
-- ===========================================================================

set role authenticated;
select tests.sign_in_as('33333333-3333-3333-3333-333333333333');

select tests.assert(
  (select count(*) from public.saved_recipes) = 1,
  'a user sees only their own recipes'
);

select tests.assert(
  (select title from public.saved_recipes) = 'Cara lentil dal',
  'the recipe a user sees is their own'
);

select tests.assert_rejected(
  $stmt$
    insert into public.saved_recipes (user_id, title, ingredients)
    values ('44444444-4444-4444-4444-444444444444', 'Forged for Dan',
            '[{"name": "x"}]'::jsonb)
  $stmt$,
  'a user cannot create a recipe owned by another user'
);

select tests.assert_no_rows_affected(
  $stmt$ update public.saved_recipes set title = 'Stolen' where title = 'Dan roast chicken' $stmt$,
  'a user cannot rename another user''s recipe'
);

select tests.assert_no_rows_affected(
  $stmt$ delete from public.saved_recipes where title = 'Dan roast chicken' $stmt$,
  'a user cannot delete another user''s recipe'
);

-- Two users may each have a recipe with the same title; the uniqueness rule
-- is per user, not global.
do $$
begin
  insert into public.saved_recipes (user_id, title, ingredients)
  values ('33333333-3333-3333-3333-333333333333', 'Dan roast chicken',
          '[{"name": "Chicken"}]'::jsonb);
  perform tests.assert(true, 'a title taken by another user is still available to you');

  delete from public.saved_recipes
  where user_id = '33333333-3333-3333-3333-333333333333'
    and title = 'Dan roast chicken';
end;
$$;

select tests.assert_rejected(
  $stmt$
    insert into public.saved_recipes (user_id, title, ingredients)
    values ('33333333-3333-3333-3333-333333333333', 'CARA LENTIL DAL',
            '[{"name": "x"}]'::jsonb)
  $stmt$,
  'the same title in a different case is rejected as a duplicate'
);

-- ===========================================================================
-- Constraints: saved_recipes
-- ===========================================================================

select tests.assert_rejected(
  $stmt$
    insert into public.saved_recipes (user_id, title, ingredients)
    values ('33333333-3333-3333-3333-333333333333', 'No ingredients', '[]'::jsonb)
  $stmt$,
  'a recipe with no ingredients is rejected'
);

select tests.assert_rejected(
  $stmt$
    insert into public.saved_recipes (user_id, title, ingredients)
    values ('33333333-3333-3333-3333-333333333333', 'Bad shape',
            '{"name": "not an array"}'::jsonb)
  $stmt$,
  'ingredients must be an array'
);

-- The rule that keeps recipe nutrition attributable.
select tests.assert_rejected(
  $stmt$
    insert into public.saved_recipes (user_id, title, ingredients, calories_kcal)
    values ('33333333-3333-3333-3333-333333333333', 'Unattributed numbers',
            '[{"name": "x"}]'::jsonb, 450)
  $stmt$,
  'recipe nutrition without a stated source is rejected'
);

select tests.assert_rejected(
  $stmt$
    insert into public.saved_recipes
      (user_id, title, ingredients, calories_kcal, nutrition_source)
    values ('33333333-3333-3333-3333-333333333333', 'Unattributed lookup',
            '[{"name": "x"}]'::jsonb, 450, 'database')
  $stmt$,
  'a database-sourced recipe figure must name the database'
);

do $$
begin
  insert into public.saved_recipes
    (user_id, title, ingredients, calories_kcal, protein_g, carbs_g, fat_g,
     nutrition_source, nutrition_provider_label)
  values ('33333333-3333-3333-3333-333333333333', 'Attributed estimate',
          '[{"name": "x"}]'::jsonb, 450, 30, 40, 15, 'ai_estimate', 'claude-opus-5-5');
  perform tests.assert(true, 'an attributed recipe estimate is accepted');

  delete from public.saved_recipes where title = 'Attributed estimate';
end;
$$;

do $$
begin
  insert into public.saved_recipes (user_id, title, ingredients)
  values ('33333333-3333-3333-3333-333333333333', 'Nutrition unknown',
          '[{"name": "x"}]'::jsonb);
  perform tests.assert(
    (select calories_kcal from public.saved_recipes where title = 'Nutrition unknown') is null,
    'a recipe with unknown nutrition stores null, not zero'
  );

  delete from public.saved_recipes where title = 'Nutrition unknown';
end;
$$;

select tests.assert_rejected(
  $stmt$
    insert into public.saved_recipes (user_id, title, ingredients, servings)
    values ('33333333-3333-3333-3333-333333333333', 'Zero servings',
            '[{"name": "x"}]'::jsonb, 0)
  $stmt$,
  'a recipe must serve at least one'
);

-- ===========================================================================
-- RLS: shopping lists
-- ===========================================================================

select tests.assert(
  (select count(*) from public.shopping_lists) = 1,
  'a user sees only their own shopping lists'
);

select tests.assert(
  (select count(*) from public.shopping_list_items) = 1,
  'a user sees only the items on their own lists'
);

select tests.assert(
  (select name from public.shopping_list_items) = 'Red lentils',
  'the item a user sees is on their own list'
);

select tests.assert_rejected(
  format(
    $stmt$
      insert into public.shopping_list_items (list_id, user_id, name)
      values (%L, '33333333-3333-3333-3333-333333333333', 'Injected')
    $stmt$,
    (select id from recipe_ids where label = 'dan_list')
  ),
  'a user cannot add an item to another user''s list'
);

select tests.assert_no_rows_affected(
  $stmt$ update public.shopping_list_items set is_checked = true where name = 'Chicken' $stmt$,
  'a user cannot tick off an item on another user''s list'
);

-- The owner trigger corrects a wrong user_id instead of storing it.
do $$
declare
  cara_list uuid := (select id from recipe_ids where label = 'cara_list');
  stored_owner uuid;
begin
  insert into public.shopping_list_items (list_id, user_id, name)
  values (cara_list, '44444444-4444-4444-4444-444444444444', 'Owner gets fixed')
  returning user_id into stored_owner;

  perform tests.assert(
    stored_owner = '33333333-3333-3333-3333-333333333333',
    'a list item''s owner is forced to the parent list''s owner'
  );

  delete from public.shopping_list_items where name = 'Owner gets fixed';
end;
$$;

-- ===========================================================================
-- Constraints: shopping list items
-- ===========================================================================

do $$
declare
  cara_list uuid := (select id from recipe_ids where label = 'cara_list');
begin
  insert into public.shopping_list_items (list_id, user_id, name)
  values (cara_list, '33333333-3333-3333-3333-333333333333', 'Bread');
  perform tests.assert(true, 'an item with no quantity is allowed');

  delete from public.shopping_list_items where name = 'Bread';
end;
$$;

select tests.assert_rejected(
  format(
    $stmt$
      insert into public.shopping_list_items (list_id, user_id, name, unit)
      values (%L, '33333333-3333-3333-3333-333333333333', 'Flour', 'g')
    $stmt$,
    (select id from recipe_ids where label = 'cara_list')
  ),
  'a unit with no quantity is rejected'
);

select tests.assert_rejected(
  format(
    $stmt$
      insert into public.shopping_list_items (list_id, user_id, name, quantity)
      values (%L, '33333333-3333-3333-3333-333333333333', 'Flour', 0)
    $stmt$,
    (select id from recipe_ids where label = 'cara_list')
  ),
  'a zero quantity is rejected'
);

-- ===========================================================================
-- Cascades
-- ===========================================================================

reset role;

-- Deleting a recipe must NOT remove the ingredient you still have to buy.
do $$
declare
  cara_recipe uuid := (select id from recipe_ids where label = 'cara_recipe');
  surviving_name text;
  surviving_source uuid;
begin
  delete from public.saved_recipes where id = cara_recipe;

  select name, source_recipe_id into surviving_name, surviving_source
  from public.shopping_list_items
  where list_id = (select id from recipe_ids where label = 'cara_list');

  perform tests.assert(
    surviving_name = 'Red lentils' and surviving_source is null,
    'deleting a recipe keeps its shopping item but clears the recipe link'
  );
end;
$$;

-- Deleting a list does remove its items: they have nowhere to live.
do $$
declare
  cara_list uuid := (select id from recipe_ids where label = 'cara_list');
  remaining bigint;
begin
  delete from public.shopping_lists where id = cara_list;

  select count(*) into remaining
  from public.shopping_list_items
  where shopping_list_items.list_id = cara_list;

  perform tests.assert(remaining = 0, 'deleting a list deletes its items');
end;
$$;

do $$
declare
  dan uuid := '44444444-4444-4444-4444-444444444444';
begin
  delete from auth.users where id = dan;

  perform tests.assert(
    (select count(*) from public.saved_recipes where user_id = dan) = 0
      and (select count(*) from public.shopping_lists where user_id = dan) = 0
      and (select count(*) from public.shopping_list_items where user_id = dan) = 0,
    'deleting the auth user removes their recipes and lists'
  );
end;
$$;

-- Re-checks the blanket rule now that four more tables exist.
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
    'every table in the public schema still has row level security enabled'
  );
end;
$$;

select 'RECIPE AND SHOPPING LIST TESTS PASSED' as result;

-- ===========================================================================
-- Scan usage and limits
-- ===========================================================================

do $$
declare
  erin uuid := '55555555-5555-5555-5555-555555555555';
begin
  insert into auth.users (id, email) values (erin, 'erin@example.test')
  on conflict (id) do nothing;
end;
$$;

select tests.assert(
  (select allowed from public.check_scan_allowance('55555555-5555-5555-5555-555555555555')),
  'a new user is allowed to scan'
);

select tests.assert(
  (select allowance from public.check_scan_allowance('55555555-5555-5555-5555-555555555555')) = 5,
  'the free tier allows 5 scans per day'
);

-- Spend the whole free allowance.
do $$
declare
  erin uuid := '55555555-5555-5555-5555-555555555555';
begin
  insert into public.scan_events (user_id, outcome, provider_label)
  select erin, 'succeeded', 'claude-opus-5-5'
  from generate_series(1, 5);
end;
$$;

select tests.assert(
  not (select allowed from public.check_scan_allowance('55555555-5555-5555-5555-555555555555')),
  'the free allowance is refused once it is spent'
);

select tests.assert(
  (select used from public.check_scan_allowance('55555555-5555-5555-5555-555555555555')) = 5,
  'spent scans are counted'
);

-- A failed attempt still consumes allowance: it cost a provider request, and
-- counting only successes would let a client retry past the limit.
do $$
declare
  frank uuid := '66666666-6666-6666-6666-666666666666';
begin
  insert into auth.users (id, email) values (frank, 'frank@example.test')
  on conflict (id) do nothing;

  insert into public.scan_events (user_id, outcome)
  select frank, 'provider_error' from generate_series(1, 5);

  perform tests.assert(
    not (select allowed from public.check_scan_allowance(frank)),
    'failed attempts count against the allowance too'
  );
end;
$$;

-- Attempts older than the rolling window no longer count.
do $$
declare
  erin uuid := '55555555-5555-5555-5555-555555555555';
begin
  update public.scan_events
  set created_at = now() - interval '25 hours'
  where scan_events.user_id = erin;

  perform tests.assert(
    (select allowed from public.check_scan_allowance(erin))
      and (select used from public.check_scan_allowance(erin)) = 0,
    'attempts older than 24 hours fall out of the window'
  );
end;
$$;

-- A verified premium entitlement raises the limit.
do $$
declare
  erin uuid := '55555555-5555-5555-5555-555555555555';
begin
  insert into public.subscription_entitlements
    (user_id, tier, status, store, product_id, verified_at)
  values (erin, 'premium', 'active', 'app_store', 'premium.monthly', now());

  perform tests.assert(
    (select allowance from public.check_scan_allowance(erin)) = 100
      and (select tier from public.check_scan_allowance(erin)) = 'premium',
    'a verified premium entitlement raises the scan allowance'
  );
end;
$$;

-- The client must not be able to reset its own quota.
set role authenticated;
select tests.sign_in_as('55555555-5555-5555-5555-555555555555');

select tests.assert_rejected(
  $stmt$
    insert into public.scan_events (user_id, outcome)
    values ('55555555-5555-5555-5555-555555555555', 'succeeded')
  $stmt$,
  'a client cannot record its own scan events'
);

select tests.assert_no_rows_affected(
  $stmt$ delete from public.scan_events $stmt$,
  'a client cannot delete its scan history to reset the quota'
);

do $$
begin
  perform tests.assert(
    (select count(*) from public.scan_events) >= 1,
    'a client can read its own scan history'
  );
end;
$$;

select tests.assert(
  (select count(*) from public.scan_events
   where scan_events.user_id = '66666666-6666-6666-6666-666666666666') = 0,
  'a client cannot read another user''s scan history'
);

reset role;
