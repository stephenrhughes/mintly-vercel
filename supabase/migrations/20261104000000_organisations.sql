-- Phase 1: organisations, memberships and the RLS helpers.
-- See docs/rewrite-plan.md §3 (roles), §4 (data model) and §9 (authorisation).
--
-- Organisations and memberships are written only by server code using the
-- service role (checkout, invites, admin actions), after an explicit
-- permission check. Signed-in users can only read them, through RLS.

create type public.org_role as enum ('owner', 'developer', 'member');

create type public.org_review_status as enum ('pending_review', 'approved', 'rejected', 'suspended');

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Trial approval (plan §6.11, APPR-*). Migrated and admin-created
  -- organisations start approved; new trials start pending_review.
  review_status public.org_review_status not null default 'pending_review',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  signup_signals jsonb not null default '{}'::jsonb,
  -- Billing contacts and cancellation (plan §6.13, BILL-07, CANC-01, RET-01).
  billing_emails text[] not null default '{}',
  po_reference text,
  ended_at timestamptz,
  cancellation_reason text,
  purge_after timestamptz,
  purge_notice_sent_at timestamptz
);

comment on table public.organisations is
  'One per Stripe customer. Written only by the server. review_note and signup_signals are admin-only (read through the server).';

create trigger organisations_set_updated_at
  before update on public.organisations
  for each row execute function public.set_updated_at();

create table public.memberships (
  org_id uuid not null references public.organisations (id) on delete cascade,
  -- One organisation per user (plan §3).
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.org_role not null,
  joined_at timestamptz not null default now()
);

comment on table public.memberships is
  'A user''s role in their one organisation. Written only by the server.';

create index memberships_org_id_idx on public.memberships (org_id);

-- At most one owner per organisation (plan §3: exactly one owner; the
-- server creates the owner with the organisation).
create unique index memberships_one_owner_idx on public.memberships (org_id) where role = 'owner';

-- RLS helpers. security definer so policies can call them without granting
-- read on memberships; stable so Postgres evaluates them once per query
-- when wrapped in (select ...).

-- The signed-in user's organisation, or null.
create or replace function public.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m where m.user_id = (select auth.uid());
$$;

-- The signed-in user's role in their organisation, or null.
create or replace function public.auth_role()
returns public.org_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.memberships m where m.user_id = (select auth.uid());
$$;

revoke execute on function public.auth_org_id() from public, anon;
revoke execute on function public.auth_role() from public, anon;
grant execute on function public.auth_org_id() to authenticated;
grant execute on function public.auth_role() to authenticated;

-- RLS: organisations.
alter table public.organisations enable row level security;

create policy "organisations: members read their own"
  on public.organisations for select
  to authenticated
  using (id = (select public.auth_org_id()));

create policy "organisations: admins read all"
  on public.organisations for select
  to authenticated
  using ((select public.is_mintly_admin()));

-- Column privileges: review_note and signup_signals are never readable with
-- a user session, so customers can't see why they were reviewed. Admin pages
-- read them through the server after checking is_mintly_admin.
revoke all on public.organisations from anon, authenticated;
grant select (
  id, name, stripe_customer_id, created_at, updated_at,
  review_status, reviewed_by, reviewed_at,
  billing_emails, po_reference, ended_at, cancellation_reason, purge_after, purge_notice_sent_at
) on public.organisations to authenticated;

-- RLS: memberships.
alter table public.memberships enable row level security;

create policy "memberships: members read their organisation's"
  on public.memberships for select
  to authenticated
  using (org_id = (select public.auth_org_id()));

create policy "memberships: admins read all"
  on public.memberships for select
  to authenticated
  using ((select public.is_mintly_admin()));

revoke all on public.memberships from anon, authenticated;
grant select on public.memberships to authenticated;

-- Teammates can see each other's profile (the team page, TEAM-01; plan §3
-- "View the team" for every role). Column privileges on profiles already
-- stop them changing anything but their own row.
create policy "profiles: read teammates"
  on public.profiles for select
  to authenticated
  using (
    (select public.auth_org_id()) is not null
    and id in (select m.user_id from public.memberships m where m.org_id = (select public.auth_org_id()))
  );
