/**
 * Makes the daily AI allowance usable, and stops failures spending it.
 *
 * Two faults, found by the app's owner being locked out of his own app after
 * five photographs - four of which had failed.
 *
 * 1. Five scans a day is not a trial, it is a wall. It was set to protect a
 *    paid provider's bill; the deployment runs on a free tier whose own
 *    daily quota is the real ceiling, and a limit this low stops anyone -
 *    including whoever is testing the build - reaching the feature at all.
 *
 * 2. A failed request spent one. `check_ai_allowance` counted every row in
 *    `scan_events`, and the function records a row for a provider error, an
 *    unreadable answer and a rejected photograph too. So a run of faults on
 *    OUR side - a wrong model name, a schema the model would not follow -
 *    locked the user out for twenty-four hours having given them nothing.
 *
 *    Now only outcomes the user actually got something from count:
 *    `succeeded`, and `refused` where the model looked and declined. Server
 *    and provider faults are free, which is the only fair reading of whose
 *    fault they are.
 *
 *    This is deliberately not "count only successes": that would let a
 *    client retry its way past the limit by making every call fail, and a
 *    refusal still costs a real provider call.
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
    else 25
  end;
$$;

comment on function public.ai_request_limit is
  'Requests per rolling 24 hours. Free: 50 scans, 25 recipes. Premium: 200 each.';

create or replace function public.check_ai_allowance(
  target_user_id uuid,
  request_kind public.ai_request_kind
)
returns table (
  allowed boolean,
  used integer,
  allowance integer,
  tier public.subscription_tier,
  resets_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  user_tier public.subscription_tier;
  limit_value integer;
  used_count integer;
  window_start timestamptz := now() - interval '24 hours';
  oldest_in_window timestamptz;
begin
  user_tier := public.current_subscription_tier(target_user_id);
  limit_value := public.ai_request_limit(user_tier, request_kind);

  -- Only what the user got something out of. A provider error, an
  -- unreadable answer or a photograph we rejected before sending are all
  -- our side of the line, and charging for them locked people out of a
  -- feature that had never worked for them.
  select count(*)::integer, min(created_at)
  into used_count, oldest_in_window
  from public.scan_events
  where scan_events.user_id = target_user_id
    and scan_events.kind = request_kind
    and scan_events.outcome in ('succeeded', 'refused')
    and scan_events.created_at >= window_start;

  return query
  select
    used_count < limit_value,
    used_count,
    limit_value,
    user_tier,
    coalesce(oldest_in_window, now()) + interval '24 hours';
end;
$$;

comment on function public.check_ai_allowance is
  'Rolling 24-hour allowance for one kind of AI request. Counts only requests the user got an answer from. Read-only.';
