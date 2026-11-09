-- Phase 2a: subscriptions, API keys and Stripe webhook events.
-- See docs/rewrite-plan.md §4 (data model), §6.3 (subscription), §6.5
-- (checkout and webhook) and §9 (idempotency).
--
-- Everything here is written only by server code using the service role:
-- the Stripe webhook (PROV-*) and, later, admin actions. Signed-in users can
-- only read their own organisation's rows, through RLS. Stripe is the source
-- of truth; these tables are a cache that a resync can rebuild.

create type public.product as enum ('bank_checker', 'eiscd');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  product public.product not null default 'bank_checker',
  stripe_subscription_id text not null unique,
  stripe_subscription_item_id text,
  stripe_price_id text not null,
  -- Stripe's subscription status, as received (trialing, active, past_due, ...).
  status text not null,
  trialing boolean not null default false,
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  -- Ended in Stripe (canceled, unpaid, incomplete_expired): the key is off.
  expired boolean not null default false,
  -- Seats: the price's maxTeamSize metadata plus extraUsers on the
  -- subscription (PROV-09). Null until the price has the metadata.
  max_team_size integer check (max_team_size > 0),
  extra_users integer not null default 0 check (extra_users >= 0),
  usage_plan_id text,
  api_key_id text,
  -- BILL-08: a returning customer was given a new key. Shown until dismissed.
  key_notice_at timestamptz,
  key_notice_dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_from_stripe_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'One row per Stripe subscription, derived from Stripe (deriveSubscriptionRecord). Written only by the server.';

-- One live subscription per organisation and product (BUY-05, requirements §10.2).
create unique index subscriptions_one_live_idx
  on public.subscriptions (org_id, product)
  where not expired;

create index subscriptions_org_id_idx on public.subscriptions (org_id);

create table public.api_keys (
  -- The API Gateway key ID. The key value is never stored (plan §4, §6.2).
  id text primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  product public.product not null default 'bank_checker',
  -- Key creation is keyed on the subscription item, so a webhook retry
  -- reuses the key instead of minting another (NFR-04, plan §9).
  stripe_subscription_item_id text unique,
  enabled boolean not null default true,
  usage_plan_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rotated_from text references public.api_keys (id) on delete set null
);

comment on table public.api_keys is
  'API Gateway keys by ID and state only; owners and developers read the value from API Gateway on demand. Written only by the server.';

create index api_keys_org_id_idx on public.api_keys (org_id);

create trigger api_keys_set_updated_at
  before update on public.api_keys
  for each row execute function public.set_updated_at();

-- The subscription's current key. Added here because api_keys is created
-- after subscriptions.
alter table public.subscriptions
  add constraint subscriptions_api_key_id_fkey
  foreign key (api_key_id) references public.api_keys (id) on delete set null;

create table public.stripe_events (
  -- The Stripe event ID. Recording it first makes the webhook idempotent (NFR-04).
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

comment on table public.stripe_events is
  'Stripe webhook events received, for idempotency and failure tracking. No user access.';

-- RLS: subscriptions.
alter table public.subscriptions enable row level security;

create policy "subscriptions: members read their organisation's"
  on public.subscriptions for select
  to authenticated
  using (org_id = (select public.auth_org_id()));

create policy "subscriptions: admins read all"
  on public.subscriptions for select
  to authenticated
  using ((select public.is_mintly_admin()));

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

-- RLS: api_keys. Every role may see the key's ID and state (the menu and
-- the subscription page need it); the value itself is never in the database.
alter table public.api_keys enable row level security;

create policy "api_keys: members read their organisation's"
  on public.api_keys for select
  to authenticated
  using (org_id = (select public.auth_org_id()));

create policy "api_keys: admins read all"
  on public.api_keys for select
  to authenticated
  using ((select public.is_mintly_admin()));

revoke all on public.api_keys from anon, authenticated;
grant select on public.api_keys to authenticated;

-- RLS: stripe_events. Enabled with no policies: the service role only.
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

-- Short-lived locks so two webhook events for the same subscription (for
-- example checkout.session.completed and customer.subscription.created,
-- which Stripe sends together) never provision at the same time. The loser
-- returns an error and Stripe retries it later (NFR-04). A lock older than
-- a minute is taken to be left by a crashed run and is taken over.
create table public.provision_locks (
  key text primary key,
  locked_at timestamptz not null default now()
);

comment on table public.provision_locks is
  'Per-subscription provisioning locks for the Stripe webhook. No user access.';

alter table public.provision_locks enable row level security;
revoke all on public.provision_locks from anon, authenticated;

create or replace function public.try_provision_lock(p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  got text;
begin
  insert into public.provision_locks as l (key) values (p_key)
  on conflict (key) do update set locked_at = now()
    where l.locked_at < now() - interval '60 seconds'
  returning l.key into got;
  return got is not null;
end;
$$;

revoke execute on function public.try_provision_lock(text) from public, anon, authenticated;
grant execute on function public.try_provision_lock(text) to service_role;

-- Creates an organisation and makes the buyer its owner in one transaction
-- (PROV-01), for the Stripe webhook. If the customer's organisation already
-- exists (a retried or concurrent event), returns it unchanged. Service role
-- only: the webhook has already verified the event came from Stripe.
create or replace function public.provision_organisation(
  p_name text,
  p_stripe_customer_id text,
  p_owner_id uuid,
  p_review_status public.org_review_status,
  p_signup_signals jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  -- Serialise concurrent events for the same customer.
  perform pg_advisory_xact_lock(hashtext('provision_organisation:' || p_stripe_customer_id));

  select o.id into org from public.organisations o where o.stripe_customer_id = p_stripe_customer_id;
  if org is not null then
    return org;
  end if;

  insert into public.organisations (name, stripe_customer_id, review_status, signup_signals)
  values (p_name, p_stripe_customer_id, p_review_status, coalesce(p_signup_signals, '{}'::jsonb))
  returning id into org;

  -- One organisation per user (plan §3): raises unique_violation if the
  -- buyer already belongs to one, which rolls back the organisation too.
  insert into public.memberships (org_id, user_id, role) values (org, p_owner_id, 'owner');

  return org;
end;
$$;

revoke execute on function public.provision_organisation(text, text, uuid, public.org_review_status, jsonb)
  from public, anon, authenticated;
grant execute on function public.provision_organisation(text, text, uuid, public.org_review_status, jsonb)
  to service_role;
