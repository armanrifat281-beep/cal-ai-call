-- Subscription entitlements.
--
-- Written only by the server after it has verified a receipt with Apple or
-- Google. The client can read its own row and nothing else, so premium access
-- can never be granted by a client-side flag.
--
-- Nothing in the MVP depends on this table: the app is fully usable on 'free'.

create table public.subscription_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,

  tier public.subscription_tier not null default 'free',
  status public.entitlement_status not null default 'none',
  store public.purchase_store not null default 'none',

  -- Store product identifier, e.g. 'com.example.foodlensai.premium.monthly'.
  product_id text,
  -- Null for the free tier, or for a lifetime grant.
  expires_at timestamptz,

  -- Hash of the last verified receipt or purchase token. We keep a hash rather
  -- than the token itself: it is enough to detect replays without storing a
  -- credential that could be stolen.
  latest_receipt_hash text,
  -- When the server last confirmed this with the store.
  verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscription_entitlements_product_id_length
    check (product_id is null or char_length(product_id) <= 200),
  constraint subscription_entitlements_receipt_hash_format
    check (latest_receipt_hash is null or latest_receipt_hash ~ '^[a-f0-9]{64}$'),
  -- A paid tier has to say where it came from and what was bought.
  constraint subscription_entitlements_premium_requires_store
    check (tier = 'free' or (store <> 'none' and product_id is not null)),
  -- An active paid entitlement needs a verification timestamp behind it.
  constraint subscription_entitlements_active_requires_verification
    check (status <> 'active' or tier = 'free' or verified_at is not null)
);

comment on table public.subscription_entitlements is
  'Server-verified entitlements. Client-readable, never client-writable.';
comment on column public.subscription_entitlements.latest_receipt_hash is
  'SHA-256 of the verified receipt, stored instead of the receipt itself.';

create trigger subscription_entitlements_set_updated_at
  before update on public.subscription_entitlements
  for each row execute function public.set_updated_at();

create index subscription_entitlements_expires_at_idx
  on public.subscription_entitlements (expires_at)
  where status = 'active';

alter table public.subscription_entitlements enable row level security;

-- Read-only for the user. There are deliberately no INSERT, UPDATE or DELETE
-- policies for `authenticated`: only the service role, used by the receipt
-- verification function, can write here.
create policy "subscription_entitlements: read own"
  on public.subscription_entitlements for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Effective tier for a user, defaulting to free when there is no row or the
-- entitlement has lapsed. The app and server both read access through this so
-- the expiry rule exists in exactly one place.
create or replace function public.current_subscription_tier(target_user_id uuid)
returns public.subscription_tier
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select e.tier
      from public.subscription_entitlements e
      where e.user_id = target_user_id
        and e.status in ('active', 'in_grace_period', 'in_billing_retry')
        and (e.expires_at is null or e.expires_at > now())
      limit 1
    ),
    'free'::public.subscription_tier
  );
$$;

comment on function public.current_subscription_tier is
  'The tier a user is actually entitled to right now, honouring status and expiry.';
