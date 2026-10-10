-- Scan usage accounting.
--
-- This table is what makes the free-tier scan limit real rather than a
-- client-side suggestion. Only the analysis Edge Function writes to it, using
-- the service role; the client may read its own rows so the app can show how
-- many scans are left, and can write nothing.
--
-- One row per analysis attempt, including failures: a failed provider call
-- still cost us a request, and counting only successes would let a client
-- retry its way past the limit.

create type public.scan_outcome as enum (
  'succeeded',
  'provider_error',
  'invalid_response',
  'rejected_media',
  'refused'
);

create table public.scan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  outcome public.scan_outcome not null,
  -- Which model produced (or failed to produce) the analysis.
  provider_label text,
  -- Rough size of what we sent, for cost attribution.
  image_bytes integer,
  -- Provider tokens, when the response reported them.
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,

  created_at timestamptz not null default now(),

  constraint scan_events_provider_label_length
    check (provider_label is null or char_length(provider_label) <= 80),
  constraint scan_events_image_bytes_range
    check (image_bytes is null or image_bytes between 0 and 50000000),
  constraint scan_events_tokens_range
    check (
      (input_tokens is null or input_tokens between 0 and 10000000)
      and (output_tokens is null or output_tokens between 0 and 10000000)
    ),
  constraint scan_events_duration_range
    check (duration_ms is null or duration_ms between 0 and 600000)
);

comment on table public.scan_events is
  'One row per photo analysis attempt. Written only by the server; drives scan limits.';

-- The limit query: how many attempts has this user made since a cutoff.
create index scan_events_user_created_idx
  on public.scan_events (user_id, created_at desc);

alter table public.scan_events enable row level security;

-- Read-only for the user. No INSERT, UPDATE or DELETE policy for
-- `authenticated`: a client that could write here could reset its own quota.
create policy "scan_events: read own"
  on public.scan_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Daily scan limits
-- ---------------------------------------------------------------------------

/**
 * Scans allowed per rolling 24 hours for a tier.
 *
 * Kept in the database so the limit can be changed without shipping an app
 * update, and so the server is the only thing that decides it.
 */
create or replace function public.scan_limit_for_tier(tier public.subscription_tier)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case tier
    when 'premium' then 100
    else 5
  end;
$$;

comment on function public.scan_limit_for_tier is
  'Scans allowed per rolling 24 hours. Free: 5, premium: 100.';

/**
 * Whether a user may run another scan, and what to tell them if not.
 *
 * SECURITY DEFINER so the Edge Function can call it for the authenticated
 * user; it only ever reads that user's own rows.
 */
create or replace function public.check_scan_allowance(target_user_id uuid)
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
  limit_value := public.scan_limit_for_tier(user_tier);

  select count(*)::integer, min(created_at)
  into used_count, oldest_in_window
  from public.scan_events
  where scan_events.user_id = target_user_id
    and scan_events.created_at >= window_start;

  return query
  select
    used_count < limit_value,
    used_count,
    limit_value,
    user_tier,
    -- When the oldest attempt in the window ages out, one slot frees up.
    coalesce(oldest_in_window, now()) + interval '24 hours';
end;
$$;

comment on function public.check_scan_allowance is
  'Rolling 24-hour scan allowance for a user. Read-only; called by the analysis function.';
