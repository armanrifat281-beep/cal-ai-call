-- Generalizes usage accounting to cover recipe generation.
--
-- `scan_events` was built for photo scans. Recipe generation is a second kind
-- of paid AI request that needs the same per-user limit, so the table gains a
-- `kind` column rather than being duplicated. The table name is kept for
-- continuity; think of it as "AI usage events".

create type public.ai_request_kind as enum ('photo_scan', 'recipe_generation');

alter table public.scan_events
  add column kind public.ai_request_kind not null default 'photo_scan';

comment on column public.scan_events.kind is
  'Which kind of paid AI request this was. Limits are counted per kind.';

-- The limit query is per user AND per kind.
drop index if exists public.scan_events_user_created_idx;
create index scan_events_user_kind_created_idx
  on public.scan_events (user_id, kind, created_at desc);

/**
 * Requests allowed per rolling 24 hours, by tier and kind.
 *
 * Recipe generation is allowed more often than photo scanning: it is cheaper
 * per request and people browse recipes more than they photograph meals.
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
    when kind = 'photo_scan' and tier = 'premium' then 100
    when kind = 'photo_scan' then 5
    when kind = 'recipe_generation' and tier = 'premium' then 150
    else 10
  end;
$$;

comment on function public.ai_request_limit is
  'Requests per rolling 24 hours. Free: 5 scans, 10 recipes. Premium: 100 and 150.';

/**
 * Whether a user may make another AI request of this kind.
 *
 * Replaces check_scan_allowance, which assumed photo scans. SECURITY DEFINER
 * so an Edge Function can call it for the authenticated user; it only ever
 * reads that user's own rows.
 */
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

  select count(*)::integer, min(created_at)
  into used_count, oldest_in_window
  from public.scan_events
  where scan_events.user_id = target_user_id
    and scan_events.kind = request_kind
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
  'Rolling 24-hour allowance for one kind of AI request. Read-only.';

-- Superseded by check_ai_allowance. Dropped rather than left as a trap: a
-- caller using it would silently count scans and recipes together.
drop function if exists public.check_scan_allowance(uuid);
drop function if exists public.scan_limit_for_tier(public.subscription_tier);

grant execute on function public.check_ai_allowance(uuid, public.ai_request_kind)
  to authenticated;
grant execute on function public.ai_request_limit(
  public.subscription_tier, public.ai_request_kind
) to authenticated;
