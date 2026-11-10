-- Phase 2b: trial review (plan §6.11, APPR-01 to APPR-08).
--   admin_audit                 every admin write and review decision (plan §4, §6.8)
--   trusted_domains             sign-ups approved automatically (APPR-02)
--   blocked_domains             sign-ups refused (APPR-05)
--   apply_review_decision()     the review state machine, audited in the same transaction
--   approved_org_for_domain()   the "existing approved organisation" auto-approve rule

-- Admin audit log. Admins read it; only the server writes it. actor_id is
-- null for the system (for example a review that expired).
create table public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  target_org_id uuid references public.organisations (id) on delete set null,
  action text not null,
  before jsonb,
  after jsonb,
  details jsonb not null default '{}'::jsonb
);

comment on table public.admin_audit is
  'Every admin write and review decision (plan §4). Admins read it; written only by the server.';

create index admin_audit_target_idx on public.admin_audit (target_org_id, at desc);
create index admin_audit_at_idx on public.admin_audit (at desc);

alter table public.admin_audit enable row level security;

create policy "admin_audit: admins read"
  on public.admin_audit for select
  to authenticated
  using ((select public.is_mintly_admin()));

revoke all on public.admin_audit from anon, authenticated;
grant select on public.admin_audit to authenticated;

-- Trusted and blocked email domains (plan §4, §6.11).
create table public.trusted_domains (
  domain text primary key check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  reason text,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now()
);

comment on table public.trusted_domains is
  'Trial sign-ups from these domains are approved automatically (APPR-02). Admin only.';

create table public.blocked_domains (
  domain text primary key check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  reason text,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now()
);

comment on table public.blocked_domains is
  'Sign-up and checkout are refused for these domains (APPR-05). Admin only.';

alter table public.trusted_domains enable row level security;
alter table public.blocked_domains enable row level security;

create policy "trusted_domains: admins read"
  on public.trusted_domains for select
  to authenticated
  using ((select public.is_mintly_admin()));

create policy "blocked_domains: admins read"
  on public.blocked_domains for select
  to authenticated
  using ((select public.is_mintly_admin()));

revoke all on public.trusted_domains from anon, authenticated;
revoke all on public.blocked_domains from anon, authenticated;
grant select on public.trusted_domains to authenticated;
grant select on public.blocked_domains to authenticated;

-- When admins were last reminded about this pending review (plan §6.11
-- safety nets). Not in the authenticated column grant, so customers can't
-- read it.
alter table public.organisations add column review_reminder_sent_at timestamptz;

-- Blocked domains are refused at sign-up, after the allow-list (which is
-- per environment and wins) and with a message that invites contact
-- rather than suggesting another address.
create or replace function public.signup_email_error(email text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalised text := lower(trim(coalesce(email, '')));
  email_dom text := public.email_domain(normalised);
begin
  if email_dom is null then
    return 'Enter a valid email address';
  end if;
  if exists (select 1 from public.signup_allowlist a where a.entry in (normalised, email_dom)) then
    return null;
  end if;
  if exists (select 1 from public.email_domain_denylist d where d.domain = email_dom) then
    return format('Invalid email domain (%s), please use a work email address', email_dom);
  end if;
  if exists (select 1 from public.blocked_domains b where b.domain = email_dom) then
    return 'We can''t accept sign-ups from this email domain. Email info@mintly.uk if you think this is a mistake.';
  end if;
  return null;
end;
$$;

-- The review state machine (plan §6.11). Changes the organisation's status
-- and writes the audit entry in one transaction, and refuses any change the
-- current status doesn't allow, so two admins can't act on the same review
-- at once. Stripe, the API key and email are handled by the server around it.
--
--   approve    pending_review -> approved
--   ask_info   pending_review -> pending_review (the request is recorded)
--   decline    pending_review -> rejected
--   expire     pending_review -> rejected       (the system, after 7 days)
--   suspend    approved       -> suspended
--   reinstate  suspended      -> approved
create or replace function public.apply_review_decision(
  p_org_id uuid,
  p_actor_id uuid,
  p_action text,
  p_note text default null,
  p_details jsonb default '{}'::jsonb
)
returns public.org_review_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.org_review_status;
  next_status public.org_review_status;
begin
  select o.review_status into current_status
  from public.organisations o
  where o.id = p_org_id
  for update;

  if current_status is null then
    raise exception 'organisation % not found', p_org_id using errcode = 'P0002';
  end if;

  next_status := case
    when p_action = 'approve' and current_status = 'pending_review' then 'approved'
    when p_action = 'ask_info' and current_status = 'pending_review' then 'pending_review'
    when p_action in ('decline', 'expire') and current_status = 'pending_review' then 'rejected'
    when p_action = 'suspend' and current_status = 'approved' then 'suspended'
    when p_action = 'reinstate' and current_status = 'suspended' then 'approved'
  end::public.org_review_status;

  if next_status is null then
    raise exception 'cannot % an organisation that is %', p_action, current_status
      using errcode = 'P0001', hint = 'invalid_transition';
  end if;

  update public.organisations
  set review_status = next_status,
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_note = coalesce(nullif(trim(p_note), ''), review_note)
  where id = p_org_id;

  insert into public.admin_audit (actor_id, target_org_id, action, before, after, details)
  values (
    p_actor_id,
    p_org_id,
    'review.' || p_action,
    jsonb_build_object('review_status', current_status),
    jsonb_build_object('review_status', next_status),
    coalesce(p_details, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('note', nullif(trim(p_note), '')))
  );

  return next_status;
end;
$$;

revoke execute on function public.apply_review_decision(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_review_decision(uuid, uuid, text, text, jsonb)
  to service_role;

-- An approved organisation whose owner signs in from this email domain, if
-- any (APPR-02: "the domain of an existing approved organisation").
create or replace function public.approved_org_for_domain(p_domain text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id
  from public.organisations o
  join public.memberships m on m.org_id = o.id and m.role = 'owner'
  join public.profiles p on p.id = m.user_id
  where o.review_status = 'approved'
    and public.email_domain(p.email) = lower(trim(p_domain))
  order by o.created_at
  limit 1;
$$;

revoke execute on function public.approved_org_for_domain(text) from public, anon, authenticated;
grant execute on function public.approved_org_for_domain(text) to service_role;
