-- Phase 2c: changing plan, trial reminders and key rotation.
-- See docs/rewrite-plan.md §4, §6.12 (PLAN-*) and §6.13 (KEY-01).

create type public.plan_change_kind as enum (
  'trial_switch', 'start_paid', 'upgrade', 'downgrade_scheduled', 'admin_change'
);
create type public.plan_change_status as enum ('done', 'scheduled', 'cancelled', 'failed');
create type public.plan_change_actor as enum ('owner', 'admin');

-- Every plan change: who, from, to, when and the amount (PLAN-10).
create table public.plan_changes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_kind public.plan_change_actor not null,
  stripe_subscription_id text not null,
  from_price_id text not null,
  to_price_id text not null,
  kind public.plan_change_kind not null,
  -- When the change takes effect: now, or the end of the period for a downgrade.
  effective_at timestamptz not null,
  stripe_schedule_id text,
  -- What was charged straight away, in the smallest currency unit (pence).
  amount_due_now integer,
  currency text,
  status public.plan_change_status not null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plan_changes is
  'History of plan changes (plan §6.12, PLAN-10). Owners read their organisation''s; admins read all. Written only by the server.';

create index plan_changes_org_idx on public.plan_changes (org_id, created_at desc);

-- One pending scheduled change at a time per organisation (plan §6.12 rules).
create unique index plan_changes_one_scheduled_idx
  on public.plan_changes (org_id)
  where status = 'scheduled';

create trigger plan_changes_set_updated_at
  before update on public.plan_changes
  for each row execute function public.set_updated_at();

alter table public.plan_changes enable row level security;

create policy "plan_changes: owners read their organisation's"
  on public.plan_changes for select
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) = 'owner'
  );

create policy "plan_changes: admins read all"
  on public.plan_changes for select
  to authenticated
  using ((select public.is_mintly_admin()));

revoke all on public.plan_changes from anon, authenticated;
grant select on public.plan_changes to authenticated;

-- Trial-ending reminders (PLAN-08): which reminders (days before the end)
-- have been sent, and for which trial end, so an extended trial starts
-- its reminders again.
alter table public.subscriptions
  add column trial_reminders_sent integer[] not null default '{}',
  add column trial_reminders_for timestamptz;

-- Key rotation with an overlap (KEY-01): the old key keeps working until
-- this time, then the hourly job turns it off.
alter table public.api_keys add column retire_at timestamptz;

create index api_keys_retire_idx on public.api_keys (retire_at) where retire_at is not null and enabled;

-- Records a key rotation (KEY-01) in one transaction, after the server has
-- created the new key in API Gateway: the old key is marked to retire at
-- p_retire_at (now, or after a 24-hour overlap) and loses its link to the
-- subscription item, the new key takes it, the subscription points at the
-- new key, and the rotation is audited. The hourly job, or the server
-- straight away, turns the old key off when its time comes.
create or replace function public.record_key_rotation(
  p_old_key_id text,
  p_new_key_id text,
  p_retire_at timestamptz,
  p_actor_id uuid,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_key public.api_keys%rowtype;
begin
  select * into old_key from public.api_keys where id = p_old_key_id for update;
  if old_key.id is null then
    raise exception 'key % not found', p_old_key_id using errcode = 'P0002';
  end if;
  if not old_key.enabled or old_key.retire_at is not null then
    raise exception 'key % is already retired or being retired', p_old_key_id using errcode = 'P0001';
  end if;

  update public.api_keys
  set stripe_subscription_item_id = null, retire_at = p_retire_at
  where id = p_old_key_id;

  insert into public.api_keys (id, org_id, product, stripe_subscription_item_id, enabled, usage_plan_id, rotated_from)
  values (p_new_key_id, old_key.org_id, old_key.product, old_key.stripe_subscription_item_id, true, old_key.usage_plan_id, p_old_key_id);

  update public.subscriptions set api_key_id = p_new_key_id where api_key_id = p_old_key_id;

  insert into public.admin_audit (actor_id, target_org_id, action, before, after, details)
  values (
    p_actor_id,
    old_key.org_id,
    'key.rotate',
    jsonb_build_object('api_key_id', p_old_key_id),
    jsonb_build_object('api_key_id', p_new_key_id),
    coalesce(p_details, '{}'::jsonb) || jsonb_build_object('old_key_retires_at', p_retire_at)
  );
end;
$$;

revoke execute on function public.record_key_rotation(text, text, timestamptz, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_key_rotation(text, text, timestamptz, uuid, jsonb)
  to service_role;
