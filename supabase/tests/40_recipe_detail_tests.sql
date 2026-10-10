-- Tests for the recipe creator's added columns and constraints.

\set ON_ERROR_STOP on

do $$
declare
  iris uuid := '99999999-9999-9999-9999-999999999999';
begin
  insert into auth.users (id, email) values (iris, 'iris@example.test')
  on conflict (id) do nothing;
end;
$$;

set role authenticated;
select tests.sign_in_as('99999999-9999-9999-9999-999999999999');

-- ===========================================================================
-- A complete generated recipe round-trips
-- ===========================================================================

do $$
declare
  iris uuid := '99999999-9999-9999-9999-999999999999';
  stored public.saved_recipes;
begin
  insert into public.saved_recipes (
    user_id, title, description, origin, cuisine, servings,
    prep_minutes, cook_minutes, equipment, tips, ingredients, steps,
    calories_kcal, protein_g, carbs_g, fat_g,
    nutrition_source, nutrition_provider_label,
    image_uri, image_kind, source_request
  )
  values (
    iris, 'Chicken biryani', 'A fragrant layered rice dish.',
    'ai_generated', 'bangladeshi', 4,
    25, 45,
    array['Large heavy pot', 'Sieve'],
    array['Soaking the rice keeps the grains separate.'],
    '[{"id": "rice", "name": "Basmati rice", "quantity": 400, "unit": "g", "scalesWithServings": true}]'::jsonb,
    '[{"number": 1, "instruction": "Rinse the rice.", "ingredientIds": ["rice"]}]'::jsonb,
    620, 34, 72, 21,
    'ai_estimate', 'claude-opus-5-5',
    'https://example.test/biryani.jpg', 'ai_generated',
    '{"mode": "dish_name", "prompt": "chicken biryani", "servings": 4}'::jsonb
  )
  returning * into stored;

  perform tests.assert(
    stored.cuisine = 'bangladeshi' and stored.origin = 'ai_generated',
    'a generated recipe stores its cuisine and origin'
  );
  perform tests.assert(
    array_length(stored.equipment, 1) = 2 and array_length(stored.tips, 1) = 1,
    'equipment and tips round-trip as arrays'
  );
  perform tests.assert(
    stored.nutrition_source = 'ai_estimate',
    'generated nutrition is recorded as an estimate'
  );
  perform tests.assert(
    stored.cook_count = 0 and stored.rejected_at is null,
    'a new recipe starts uncooked and unrejected'
  );
  perform tests.assert(
    stored.source_request ->> 'mode' = 'dish_name',
    'the generation request is kept so the recipe can be regenerated'
  );
end;
$$;

-- ===========================================================================
-- Image honesty
-- ===========================================================================

select tests.assert_rejected(
  $stmt$
    insert into public.saved_recipes (user_id, title, ingredients, image_uri)
    values ('99999999-9999-9999-9999-999999999999', 'Unlabelled image',
            '[{"name": "x"}]'::jsonb, 'https://example.test/a.jpg')
  $stmt$,
  'an image with no stated kind is rejected, so it cannot be mislabelled'
);

do $$
begin
  insert into public.saved_recipes (user_id, title, ingredients, image_uri, image_kind)
  values ('99999999-9999-9999-9999-999999999999', 'Labelled image',
          '[{"name": "x"}]'::jsonb, 'https://example.test/a.jpg', 'stock_library');
  perform tests.assert(true, 'an image with a stated kind is accepted');

  delete from public.saved_recipes where title = 'Labelled image';
end;
$$;

do $$
begin
  insert into public.saved_recipes (user_id, title, ingredients)
  values ('99999999-9999-9999-9999-999999999999', 'No image at all',
          '[{"name": "x"}]'::jsonb);
  perform tests.assert(
    (select image_kind from public.saved_recipes where title = 'No image at all') is null,
    'a recipe with no image stores no image kind'
  );
  delete from public.saved_recipes where title = 'No image at all';
end;
$$;

-- ===========================================================================
-- Cook count consistency
-- ===========================================================================

select tests.assert_rejected(
  $stmt$
    insert into public.saved_recipes (user_id, title, ingredients, cook_count)
    values ('99999999-9999-9999-9999-999999999999', 'Cooked but never',
            '[{"name": "x"}]'::jsonb, 3)
  $stmt$,
  'a cook count above zero without a cooked timestamp is rejected'
);

select tests.assert_rejected(
  $stmt$
    insert into public.saved_recipes (user_id, title, ingredients, cook_count, last_cooked_at)
    values ('99999999-9999-9999-9999-999999999999', 'Negative cooks',
            '[{"name": "x"}]'::jsonb, -1, now())
  $stmt$,
  'a negative cook count is rejected'
);

do $$
begin
  update public.saved_recipes
  set cook_count = 1, last_cooked_at = now()
  where title = 'Chicken biryani';

  perform tests.assert(
    (select cook_count from public.saved_recipes where title = 'Chicken biryani') = 1,
    'cooking a recipe records the count and the time together'
  );
end;
$$;

-- ===========================================================================
-- Rejection keeps the row but removes it from suggestions
-- ===========================================================================

do $$
declare
  iris uuid := '99999999-9999-9999-9999-999999999999';
  suggestable bigint;
begin
  insert into public.saved_recipes (user_id, title, ingredients, rejected_at)
  values (iris, 'Not for me', '[{"name": "x"}]'::jsonb, now());

  select count(*) into suggestable
  from public.saved_recipes
  where saved_recipes.user_id = iris and rejected_at is null;

  perform tests.assert(
    suggestable = 1,
    'a rejected recipe is excluded from suggestions'
  );
  perform tests.assert(
    (select count(*) from public.saved_recipes where saved_recipes.user_id = iris) = 2,
    'but the rejected recipe is kept, so the user can still find it'
  );
end;
$$;

-- ===========================================================================
-- Size limits
-- ===========================================================================

select tests.assert_rejected(
  $stmt$
    insert into public.saved_recipes (user_id, title, ingredients, equipment)
    values ('99999999-9999-9999-9999-999999999999', 'Too much kit',
            '[{"name": "x"}]'::jsonb,
            (select array_agg('item ' || generate_series) from generate_series(1, 30)))
  $stmt$,
  'an absurd equipment list is rejected'
);

select tests.assert_rejected(
  $stmt$
    insert into public.saved_recipes (user_id, title, ingredients, source_request)
    values ('99999999-9999-9999-9999-999999999999', 'Bad request shape',
            '[{"name": "x"}]'::jsonb, '"not an object"'::jsonb)
  $stmt$,
  'a malformed generation request is rejected'
);

-- ===========================================================================
-- RLS still holds on the new columns
-- ===========================================================================

reset role;
insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'jack@example.test')
on conflict (id) do nothing;

insert into public.saved_recipes (user_id, title, ingredients, cuisine)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Jack private recipe',
        '[{"name": "x"}]'::jsonb, 'italian');

set role authenticated;
select tests.sign_in_as('99999999-9999-9999-9999-999999999999');

select tests.assert(
  (select count(*) from public.saved_recipes where title = 'Jack private recipe') = 0,
  'another user''s recipe stays invisible, new columns included'
);

select tests.assert_no_rows_affected(
  $stmt$ update public.saved_recipes set rejected_at = now() where title = 'Jack private recipe' $stmt$,
  'a user cannot reject another user''s recipe'
);

reset role;

select 'RECIPE DETAIL TESTS PASSED' as result;
