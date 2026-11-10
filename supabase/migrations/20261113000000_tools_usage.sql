-- Phase 3: tools and usage.
-- See docs/rewrite-plan.md §4 (data model), §6.2 (Tools proxy, Q2) and
-- §6.4 (usage, Q3).
--   usage_daily    daily API usage per key, copied nightly from DynamoDB
--   check_log      one row per check made through the Tools proxy
--   check_counts() checks per person, for the Tools page

-- Daily usage per API key, copied from DynamoDB ApiDailyUsageStats by the
-- nightly job (/api/cron/usage-sync). The charts read only this (MON-05).
create table public.usage_daily (
  api_key_id text not null references public.api_keys (id) on delete cascade,
  date date not null,
  success integer not null default 0 check (success >= 0),
  not_found integer not null default 0 check (not_found >= 0),
  synced_at timestamptz not null default now(),
  primary key (api_key_id, date)
);

comment on table public.usage_daily is
  'Daily API usage per key, synced nightly from DynamoDB (plan §6.4). Members read their organisation''s keys; written only by the server.';

create index usage_daily_date_idx on public.usage_daily (date);

alter table public.usage_daily enable row level security;

-- MON-06: a user reads usage for their own organisation's keys only.
create policy "usage_daily: members read their organisation's keys"
  on public.usage_daily for select
  to authenticated
  using (
    api_key_id in (
      select k.id from public.api_keys k where k.org_id = (select public.auth_org_id())
    )
  );

create policy "usage_daily: admins read all"
  on public.usage_daily for select
  to authenticated
  using ((select public.is_mintly_admin()));

revoke all on public.usage_daily from anon, authenticated;
grant select on public.usage_daily to authenticated;

-- When the nightly job last backfilled this key's history. Null means the
-- next run reads the last two years (plan §6.4: "On first run, backfill").
alter table public.api_keys add column usage_backfilled_at timestamptz;

-- The check log (plan §4, §6.2). It never stores sort codes, account
-- numbers, IBANs or BICs: only who checked, when, what kind and the outcome.
create type public.check_kind as enum ('sortcode', 'account', 'iban', 'swift');
create type public.check_mode as enum ('single', 'bulk');
create type public.check_outcome as enum ('valid', 'invalid', 'rate_limited', 'error');

create table public.check_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  kind public.check_kind not null,
  mode public.check_mode not null,
  outcome public.check_outcome not null,
  -- Made against the sandbox while the organisation awaited review (APPR-03).
  sandbox boolean not null default false
);

comment on table public.check_log is
  'One row per Tools check (plan §6.2). No bank details. Users read their own, owners their organisation''s; written only by the server.';

create index check_log_org_at_idx on public.check_log (org_id, at desc);
create index check_log_user_at_idx on public.check_log (user_id, at desc);
create index check_log_at_idx on public.check_log (at);

alter table public.check_log enable row level security;

create policy "check_log: users read their own"
  on public.check_log for select
  to authenticated
  using (user_id = (select auth.uid()) and org_id = (select public.auth_org_id()));

-- The per-person breakdown is for owners only (plan §13.6).
create policy "check_log: owners read their organisation's"
  on public.check_log for select
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) = 'owner'
  );

create policy "check_log: admins read all"
  on public.check_log for select
  to authenticated
  using ((select public.is_mintly_admin()));

revoke all on public.check_log from anon, authenticated;
grant select on public.check_log to authenticated;

-- Checks per person since a time, for the Tools page (plan §6.4). Security
-- invoker, so RLS decides whose rows count: a user sees their own count, an
-- owner sees everyone in their organisation. Admins see their own
-- organisation's here too; their cross-organisation views read check_log
-- directly.
create or replace function public.check_counts(p_since timestamptz)
returns table (user_id uuid, checks bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.user_id, count(*)::bigint
  from public.check_log c
  where c.at >= p_since
    and c.org_id = (select public.auth_org_id())
  group by c.user_id;
$$;

revoke execute on function public.check_counts(timestamptz) from public, anon;
grant execute on function public.check_counts(timestamptz) to authenticated;
