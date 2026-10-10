-- Transactional writes for the food journal.
--
-- A meal is two tables: `food_entries` and its `food_entry_items`. Writing
-- them as two separate requests is not safe - if the second fails, the journal
-- keeps an entry with no foods in it, which shows as a 0 kcal meal the user
-- cannot explain. These functions do both in one statement, so a meal either
-- saves completely or not at all.
--
-- All of them are SECURITY INVOKER (the default), deliberately: they run with
-- the caller's privileges, so every Row Level Security policy still applies.
-- A SECURITY DEFINER function here would bypass RLS and make the policies
-- decorative. The ownership column is taken from auth.uid(), never from the
-- caller's arguments.

/**
 * Reads one food item out of a JSON payload element.
 *
 * Returning a row lets the insert statements below treat the JSON array like
 * a table, and keeps the column mapping in exactly one place.
 */
create or replace function public.parse_food_entry_item(item jsonb, item_position integer)
returns table (
  name text,
  brand text,
  portion_quantity numeric,
  portion_unit public.portion_unit,
  grams_resolved numeric,
  calories_kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  saturated_fat_g numeric,
  sodium_mg numeric,
  source public.nutrient_source,
  confidence public.confidence_level,
  provider_label text,
  provider_ref text,
  food_record_id text,
  notes text,
  item_position integer
)
language sql
immutable
set search_path = ''
as $$
  select
    item ->> 'name',
    item ->> 'brand',
    (item ->> 'portion_quantity')::numeric,
    (item ->> 'portion_unit')::public.portion_unit,
    (item ->> 'grams_resolved')::numeric,
    (item ->> 'calories_kcal')::numeric,
    (item ->> 'protein_g')::numeric,
    (item ->> 'carbs_g')::numeric,
    (item ->> 'fat_g')::numeric,
    (item ->> 'fiber_g')::numeric,
    (item ->> 'sugar_g')::numeric,
    (item ->> 'saturated_fat_g')::numeric,
    (item ->> 'sodium_mg')::numeric,
    (item ->> 'source')::public.nutrient_source,
    coalesce((item ->> 'confidence')::public.confidence_level, 'low'),
    item ->> 'provider_label',
    item ->> 'provider_ref',
    item ->> 'food_record_id',
    item ->> 'notes',
    item_position;
$$;

/**
 * Creates a meal and its foods in one transaction.
 *
 * @param p_items A JSON array of food items. Must hold at least one.
 * @returns The new entry's id.
 */
create or replace function public.create_food_entry(
  p_meal_type public.meal_type,
  p_title text,
  p_items jsonb,
  p_consumed_at timestamptz default now(),
  p_photo_path text default null,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_entry_id uuid;
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'a meal needs at least one food' using errcode = 'check_violation';
  end if;

  -- The owner comes from the session, never from an argument, so a caller
  -- cannot create a meal in someone else's journal.
  insert into public.food_entries
    (user_id, consumed_at, meal_type, title, photo_path, notes)
  values (caller, p_consumed_at, p_meal_type, p_title, p_photo_path, p_notes)
  returning id into new_entry_id;

  -- user_id is also set by the table's own trigger; supplying it here keeps
  -- the NOT NULL constraint satisfied before the trigger runs.
  insert into public.food_entry_items (
    entry_id, user_id, name, brand, portion_quantity, portion_unit,
    grams_resolved, calories_kcal, protein_g, carbs_g, fat_g, fiber_g,
    sugar_g, saturated_fat_g, sodium_mg, source, confidence, provider_label,
    provider_ref, food_record_id, notes, position
  )
  select
    new_entry_id, caller, parsed.name, parsed.brand, parsed.portion_quantity,
    parsed.portion_unit, parsed.grams_resolved, parsed.calories_kcal,
    parsed.protein_g, parsed.carbs_g, parsed.fat_g, parsed.fiber_g,
    parsed.sugar_g, parsed.saturated_fat_g, parsed.sodium_mg, parsed.source,
    parsed.confidence, parsed.provider_label, parsed.provider_ref,
    parsed.food_record_id, parsed.notes, parsed.item_position
  from jsonb_array_elements(p_items) with ordinality as element(value, ordinality)
  cross join lateral public.parse_food_entry_item(
    element.value, (element.ordinality - 1)::integer
  ) as parsed;

  return new_entry_id;
end;
$$;

comment on function public.create_food_entry is
  'Creates a meal and its foods atomically. Runs as the caller, so RLS applies.';

/**
 * Updates a meal, replacing its foods wholesale.
 *
 * Replacement rather than a diff: the editor hands us the full list the user
 * wants, and reconciling item identities would be complexity with no benefit.
 */
create or replace function public.update_food_entry(
  p_entry_id uuid,
  p_meal_type public.meal_type,
  p_title text,
  p_items jsonb,
  p_consumed_at timestamptz,
  p_photo_path text default null,
  p_notes text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'a meal needs at least one food' using errcode = 'check_violation';
  end if;

  -- No user_id predicate is needed: RLS already restricts this UPDATE to the
  -- caller's own rows, so someone else's entry simply matches nothing.
  update public.food_entries
  set consumed_at = p_consumed_at,
      meal_type = p_meal_type,
      title = p_title,
      photo_path = p_photo_path,
      notes = p_notes
  where id = p_entry_id;

  get diagnostics affected = row_count;
  if affected = 0 then
    raise exception 'entry % not found', p_entry_id using errcode = 'no_data_found';
  end if;

  delete from public.food_entry_items where entry_id = p_entry_id;

  insert into public.food_entry_items (
    entry_id, user_id, name, brand, portion_quantity, portion_unit,
    grams_resolved, calories_kcal, protein_g, carbs_g, fat_g, fiber_g,
    sugar_g, saturated_fat_g, sodium_mg, source, confidence, provider_label,
    provider_ref, food_record_id, notes, position
  )
  select
    p_entry_id, auth.uid(), parsed.name, parsed.brand, parsed.portion_quantity,
    parsed.portion_unit, parsed.grams_resolved, parsed.calories_kcal,
    parsed.protein_g, parsed.carbs_g, parsed.fat_g, parsed.fiber_g,
    parsed.sugar_g, parsed.saturated_fat_g, parsed.sodium_mg, parsed.source,
    parsed.confidence, parsed.provider_label, parsed.provider_ref,
    parsed.food_record_id, parsed.notes, parsed.item_position
  from jsonb_array_elements(p_items) with ordinality as element(value, ordinality)
  cross join lateral public.parse_food_entry_item(
    element.value, (element.ordinality - 1)::integer
  ) as parsed;
end;
$$;

comment on function public.update_food_entry is
  'Updates a meal and replaces its foods atomically. Runs as the caller.';

/**
 * Copies a meal to a new time.
 *
 * The copy gets fresh item ids and no photo: the photo documented the original
 * analysis, not this new meal.
 */
create or replace function public.duplicate_food_entry(
  p_entry_id uuid,
  p_consumed_at timestamptz default now(),
  p_meal_type public.meal_type default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_entry_id uuid;
  caller uuid := auth.uid();
  source_row public.food_entries;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- RLS restricts this SELECT to the caller's rows, so another user's entry
  -- is simply not found.
  select * into source_row from public.food_entries where id = p_entry_id;
  if source_row.id is null then
    raise exception 'entry % not found', p_entry_id using errcode = 'no_data_found';
  end if;

  insert into public.food_entries
    (user_id, consumed_at, meal_type, title, photo_path, notes)
  values (
    caller,
    p_consumed_at,
    coalesce(p_meal_type, source_row.meal_type),
    source_row.title,
    null,
    source_row.notes
  )
  returning id into new_entry_id;

  insert into public.food_entry_items (
    entry_id, user_id, name, brand, portion_quantity, portion_unit,
    grams_resolved, calories_kcal, protein_g, carbs_g, fat_g, fiber_g,
    sugar_g, saturated_fat_g, sodium_mg, source, confidence, provider_label,
    provider_ref, food_record_id, notes, position
  )
  select
    new_entry_id, caller, name, brand, portion_quantity, portion_unit,
    grams_resolved, calories_kcal, protein_g, carbs_g, fat_g, fiber_g,
    sugar_g, saturated_fat_g, sodium_mg, source, confidence, provider_label,
    provider_ref, food_record_id, notes, position
  from public.food_entry_items
  where entry_id = p_entry_id;

  return new_entry_id;
end;
$$;

comment on function public.duplicate_food_entry is
  'Copies a meal to a new time with fresh item ids and no photo.';

-- PostgREST will not expose a function the API roles cannot execute.
grant execute on function public.create_food_entry(
  public.meal_type, text, jsonb, timestamptz, text, text
) to authenticated;
grant execute on function public.update_food_entry(
  uuid, public.meal_type, text, jsonb, timestamptz, text, text
) to authenticated;
grant execute on function public.duplicate_food_entry(
  uuid, timestamptz, public.meal_type
) to authenticated;
grant execute on function public.current_subscription_tier(uuid) to authenticated;
