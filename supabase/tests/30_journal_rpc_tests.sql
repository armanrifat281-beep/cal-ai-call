-- Tests for the transactional journal functions.
--
-- Two things matter here. The functions must be ATOMIC, so a bad item cannot
-- leave an entry with no foods. And because they are SECURITY INVOKER, they
-- must still be governed by Row Level Security - a function that quietly
-- bypassed RLS would undo every policy in the schema.

\set ON_ERROR_STOP on

do $$
declare
  gail uuid := '77777777-7777-7777-7777-777777777777';
  hugo uuid := '88888888-8888-8888-8888-888888888888';
begin
  insert into auth.users (id, email) values
    (gail, 'gail@example.test'),
    (hugo, 'hugo@example.test')
  on conflict (id) do nothing;
end;
$$;

/** A valid two-food payload. */
create or replace function tests.sample_items()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(
    jsonb_build_object(
      'name', 'Basmati rice', 'portion_quantity', 180, 'portion_unit', 'g',
      'grams_resolved', 180, 'calories_kcal', 234, 'protein_g', 4.9,
      'carbs_g', 50.4, 'fat_g', 0.5, 'source', 'database',
      'confidence', 'high', 'provider_label', 'USDA FoodData Central',
      'provider_ref', '169704'
    ),
    jsonb_build_object(
      'name', 'Chicken curry', 'portion_quantity', 1, 'portion_unit', 'serving',
      'calories_kcal', 410, 'protein_g', 32, 'carbs_g', 9, 'fat_g', 27,
      'source', 'ai_estimate', 'confidence', 'low',
      'provider_label', 'claude-opus-5-5'
    )
  );
$$;

grant execute on all functions in schema tests to anon, authenticated;

set role authenticated;
select tests.sign_in_as('77777777-7777-7777-7777-777777777777');

-- ===========================================================================
-- create_food_entry
-- ===========================================================================

do $$
declare
  target_entry uuid;
  item_count integer;
  owner uuid;
begin
  target_entry := public.create_food_entry(
    'dinner', 'Chicken curry and rice', tests.sample_items(),
    now() - interval '1 hour'
  );

  select count(*) into item_count
  from public.food_entry_items
  where food_entry_items.entry_id = target_entry;

  select user_id into owner from public.food_entries where id = target_entry;

  perform tests.assert(item_count = 2, 'create_food_entry writes the meal and both foods');
  perform tests.assert(
    owner = '77777777-7777-7777-7777-777777777777',
    'the new meal is owned by the caller, not by any argument'
  );
end;
$$;

do $$
declare
  target_entry uuid := (
    select id from public.food_entries where title = 'Chicken curry and rice'
  );
  first_name text;
  second_name text;
begin
  select name into first_name
  from public.food_entry_items
  where food_entry_items.entry_id = target_entry and position = 0;

  select name into second_name
  from public.food_entry_items
  where food_entry_items.entry_id = target_entry and position = 1;

  perform tests.assert(
    first_name = 'Basmati rice' and second_name = 'Chicken curry',
    'food order from the payload is preserved'
  );
end;
$$;

do $$
declare
  target_entry uuid := (
    select id from public.food_entries where title = 'Chicken curry and rice'
  );
  estimate public.food_entry_items;
begin
  select * into estimate
  from public.food_entry_items
  where food_entry_items.entry_id = target_entry and source = 'ai_estimate';

  perform tests.assert(
    estimate.confidence = 'low' and estimate.provider_label = 'claude-opus-5-5',
    'per-item provenance survives the round trip'
  );
  perform tests.assert(
    estimate.grams_resolved is null and estimate.fiber_g is null,
    'an unknown weight or nutrient is stored as null, not zero'
  );
end;
$$;

-- Atomicity: the second food breaks a constraint, so NOTHING may be written.
do $$
declare
  entries_before bigint;
  entries_after bigint;
  items_after bigint;
begin
  select count(*) into entries_before from public.food_entries;

  begin
    perform public.create_food_entry(
      'lunch', 'Should not exist',
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Fine food', 'portion_quantity', 100, 'portion_unit', 'g',
          'calories_kcal', 100, 'protein_g', 1, 'carbs_g', 1, 'fat_g', 1,
          'source', 'user_entered'
        ),
        -- Negative calories violate a check constraint.
        jsonb_build_object(
          'name', 'Broken food', 'portion_quantity', 100, 'portion_unit', 'g',
          'calories_kcal', -500, 'protein_g', 1, 'carbs_g', 1, 'fat_g', 1,
          'source', 'user_entered'
        )
      )
    );
    raise exception 'FAILED: the invalid payload was accepted';
  exception
    when check_violation then
      null; -- expected
  end;

  select count(*) into entries_after from public.food_entries;
  select count(*) into items_after
  from public.food_entry_items
  join public.food_entries e on e.id = food_entry_items.entry_id
  where e.title = 'Should not exist';

  perform tests.assert(
    entries_after = entries_before and items_after = 0,
    'a bad food rolls back the whole meal, leaving no empty entry behind'
  );
end;
$$;

select tests.assert_rejected(
  $stmt$ select public.create_food_entry('lunch', 'No foods', '[]'::jsonb) $stmt$,
  'create_food_entry refuses a meal with no foods'
);

select tests.assert_rejected(
  $stmt$ select public.create_food_entry('lunch', 'Not an array', '{}'::jsonb) $stmt$,
  'create_food_entry refuses a payload that is not an array'
);

-- ===========================================================================
-- update_food_entry
-- ===========================================================================

do $$
declare
  target_entry uuid := (
    select id from public.food_entries where title = 'Chicken curry and rice'
  );
  item_count integer;
  new_title text;
begin
  perform public.update_food_entry(
    target_entry, 'lunch', 'Corrected title',
    jsonb_build_array(
      jsonb_build_object(
        'name', 'Just rice', 'portion_quantity', 200, 'portion_unit', 'g',
        'calories_kcal', 260, 'protein_g', 5, 'carbs_g', 56, 'fat_g', 0.6,
        'source', 'user_entered'
      )
    ),
    now()
  );

  select count(*) into item_count
  from public.food_entry_items
  where food_entry_items.entry_id = target_entry;

  select title into new_title from public.food_entries where id = target_entry;

  perform tests.assert(
    item_count = 1 and new_title = 'Corrected title',
    'update_food_entry replaces the foods wholesale'
  );
end;
$$;

-- Atomicity on update: a bad replacement must not destroy the old foods.
do $$
declare
  target_entry uuid := (select id from public.food_entries where title = 'Corrected title');
  surviving_name text;
begin
  begin
    perform public.update_food_entry(
      target_entry, 'lunch', 'Should not stick',
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Broken', 'portion_quantity', 100, 'portion_unit', 'g',
          'calories_kcal', 100, 'protein_g', 1, 'carbs_g', 1, 'fat_g', 1,
          -- Saturated fat above total fat violates a check constraint.
          'saturated_fat_g', 50, 'source', 'user_entered'
        )
      ),
      now()
    );
    raise exception 'FAILED: the invalid update was accepted';
  exception
    when check_violation then
      null; -- expected
  end;

  select name into surviving_name
  from public.food_entry_items
  where food_entry_items.entry_id = target_entry;

  perform tests.assert(
    surviving_name = 'Just rice'
      and (select title from public.food_entries where id = target_entry) = 'Corrected title',
    'a failed update leaves the original meal and foods untouched'
  );
end;
$$;

-- ===========================================================================
-- duplicate_food_entry
-- ===========================================================================

do $$
declare
  original_id uuid := (select id from public.food_entries where title = 'Corrected title');
  copy_id uuid;
  copy_row public.food_entries;
  copy_items bigint;
begin
  update public.food_entries set photo_path = '77777777-7777-7777-7777-777777777777/a.jpg'
  where id = original_id;

  copy_id := public.duplicate_food_entry(original_id, now(), 'dinner');

  select * into copy_row from public.food_entries where id = copy_id;
  select count(*) into copy_items
  from public.food_entry_items where food_entry_items.entry_id = copy_id;

  perform tests.assert(copy_id <> original_id, 'the copy is a new entry');
  perform tests.assert(copy_row.meal_type = 'dinner', 'the copy takes the requested meal type');
  perform tests.assert(copy_items = 1, 'the copy carries the foods across');
  perform tests.assert(
    copy_row.photo_path is null,
    'the copy inherits no photo: the photo documented the original analysis'
  );
  perform tests.assert(
    (select count(*) from public.food_entry_items
     where food_entry_items.entry_id = original_id) = 1,
    'the original keeps its own foods'
  );

  -- Remove the copy: it shares the original's title, which would make the
  -- next block's lookup-by-title ambiguous.
  delete from public.food_entries where id = copy_id;
end;
$$;

do $$
declare
  original_id uuid := (select id from public.food_entries where title = 'Corrected title');
  copy_id uuid;
begin
  copy_id := public.duplicate_food_entry(original_id);
  perform tests.assert(
    (select meal_type from public.food_entries where id = copy_id) = 'lunch',
    'a copy with no meal type given keeps the original''s'
  );
  delete from public.food_entries where id = copy_id;
end;
$$;

-- ===========================================================================
-- The functions are still governed by RLS
-- ===========================================================================

-- Hugo creates his own meal, then Gail tries to reach it through each function.
select tests.sign_in_as('88888888-8888-8888-8888-888888888888');

do $$
begin
  perform public.create_food_entry('dinner', 'Hugo private meal', tests.sample_items());
end;
$$;

select tests.sign_in_as('77777777-7777-7777-7777-777777777777');

select tests.assert(
  (select count(*) from public.food_entries where title = 'Hugo private meal') = 0,
  'another user''s meal is invisible even after being created through the RPC'
);

do $$
declare
  hugo_entry uuid;
begin
  -- Find Hugo's entry id with RLS off, to attack it with RLS on.
  reset role;
  select id into hugo_entry from public.food_entries where title = 'Hugo private meal';
  set role authenticated;
  perform tests.sign_in_as('77777777-7777-7777-7777-777777777777');

  begin
    perform public.update_food_entry(
      hugo_entry, 'lunch', 'Hijacked', tests.sample_items(), now()
    );
    raise exception 'FAILED: update_food_entry reached another user''s meal';
  exception
    when no_data_found then
      perform tests.assert(true, 'update_food_entry cannot reach another user''s meal');
  end;

  begin
    perform public.duplicate_food_entry(hugo_entry);
    raise exception 'FAILED: duplicate_food_entry reached another user''s meal';
  exception
    when no_data_found then
      perform tests.assert(true, 'duplicate_food_entry cannot reach another user''s meal');
  end;
end;
$$;

-- And an unauthenticated caller gets nowhere at all.
select tests.sign_out();
reset role;
set role anon;

select tests.assert_rejected(
  $stmt$ select public.create_food_entry('lunch', 'Anonymous', tests.sample_items()) $stmt$,
  'an unauthenticated caller cannot create a meal through the RPC'
);

reset role;

select 'JOURNAL RPC TESTS PASSED' as result;
