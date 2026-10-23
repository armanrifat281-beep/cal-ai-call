/**
 * The limit for the new kind.
 *
 * Separate migration from the enum value: Postgres will not let a new
 * enum value be used in the same transaction that added it, and a
 * migration file is one transaction.
 */

create or replace function public.ai_request_limit(
  tier public.subscription_tier,
  kind public.ai_request_kind
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when kind = 'photo_scan' and tier = 'premium' then 200
    when kind = 'photo_scan' then 50
    when kind = 'recipe_generation' and tier = 'premium' then 200
    when kind = 'recipe_generation' then 25
    -- A plan is something a person needs a few times a year. Ten a day is
    -- already far more than anybody writing a real programme would use.
    when kind = 'workout_generation' and tier = 'premium' then 30
    else 10
  end;
$$;

comment on function public.ai_request_limit is
  'Requests per rolling 24 hours. Free: 50 scans, 25 recipes, 10 plans. Premium: 200/200/30.';
