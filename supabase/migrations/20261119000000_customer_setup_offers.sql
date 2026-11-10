-- Phase 5c: admin customer set-up (ADM-12, plan §6.7) and offers (ADM-11,
-- plan §4).

-- 1. Owner invitations. An organisation an admin sets up has no owner until
-- the invited owner accepts (ADM-12): the invite carries the owner role.
-- Only one owner, so an owner invite is allowed only while the organisation
-- has neither an owner nor another open owner invite.
alter table public.invitations drop constraint invitations_role_check;
alter table public.invitations
  add constraint invitations_role_check check (role in ('owner', 'developer', 'member'));

create unique index invitations_one_owner_invite_idx
  on public.invitations (org_id)
  where role = 'owner' and accepted_at is null and revoked_at is null;

create or replace function public.create_invitation(
  p_org uuid,
  p_email text,
  p_role public.org_role,
  p_token_hash text,
  p_invited_by uuid,
  p_send boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  address text := lower(trim(p_email));
  seat_cap integer;
  used integer;
  invite uuid;
begin
  perform pg_advisory_xact_lock(hashtext('team:' || p_org::text));

  if exists (
    select 1 from public.memberships m join public.profiles p on p.id = m.user_id
    where m.org_id = p_org and lower(p.email) = address
  ) then
    raise exception 'already a member' using errcode = 'P0001', hint = 'already_member';
  end if;

  -- An expired invite to the same address no longer holds a seat; close it
  -- so the new one can take its place.
  update public.invitations i
  set revoked_at = now()
  where i.org_id = p_org and i.email = address
    and i.accepted_at is null and i.revoked_at is null
    and not public.invitation_is_open(i);

  if exists (
    select 1 from public.invitations i
    where i.org_id = p_org and i.email = address and public.invitation_is_open(i)
  ) then
    raise exception 'already invited' using errcode = 'P0001', hint = 'already_invited';
  end if;

  if p_role = 'owner' then
    if exists (select 1 from public.memberships m where m.org_id = p_org and m.role = 'owner') then
      raise exception 'has an owner' using errcode = 'P0001', hint = 'has_owner';
    end if;
    -- An expired owner invite gives way to the new one.
    update public.invitations i
    set revoked_at = now()
    where i.org_id = p_org and i.role = 'owner'
      and i.accepted_at is null and i.revoked_at is null;
  end if;

  seat_cap := public.org_seat_limit(p_org);
  if seat_cap is not null then
    select
      (select count(*) from public.memberships m where m.org_id = p_org)
      + (select count(*) from public.invitations i
          where i.org_id = p_org and public.invitation_is_open(i))
    into used;
    if used >= seat_cap then
      raise exception 'team full' using errcode = 'P0001', hint = 'team_full',
        detail = format('%s/%s', used, seat_cap);
    end if;
  end if;

  insert into public.invitations (org_id, email, role, token_hash, invited_by, sent_at, expires_at)
  values (
    p_org, address, p_role, p_token_hash, p_invited_by,
    case when p_send then now() end,
    case when p_send then now() + interval '14 days' end
  )
  returning id into invite;

  return invite;
end;
$$;

-- accept_invitation: the same as before, plus the owner role. An owner
-- invite fails if someone became the owner in the meantime.
create or replace function public.accept_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_move boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  user_email text;
  current_org uuid;
  member_role public.org_role;
  seat_cap integer;
  members integer;
begin
  select * into inv from public.invitations i where i.token_hash = p_token_hash;
  if inv.id is null then
    raise exception 'invite not found' using errcode = 'P0001', hint = 'not_found';
  end if;

  perform pg_advisory_xact_lock(hashtext('team:' || inv.org_id::text));
  select * into inv from public.invitations i where i.id = inv.id for update;

  select lower(p.email) into user_email from public.profiles p where p.id = p_user_id;
  select m.org_id, m.role into current_org, member_role
  from public.memberships m where m.user_id = p_user_id;

  if inv.accepted_at is not null then
    if current_org = inv.org_id then
      raise exception 'already joined' using errcode = 'P0001', hint = 'already_member';
    end if;
    raise exception 'invite used' using errcode = 'P0001', hint = 'accepted';
  end if;
  if inv.revoked_at is not null then
    raise exception 'invite withdrawn' using errcode = 'P0001', hint = 'revoked';
  end if;
  if inv.sent_at is null then
    raise exception 'invite held' using errcode = 'P0001', hint = 'held';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invite expired' using errcode = 'P0001', hint = 'expired';
  end if;
  if user_email is distinct from inv.email then
    raise exception 'wrong email' using errcode = 'P0001', hint = 'wrong_email';
  end if;
  if current_org = inv.org_id then
    raise exception 'already joined' using errcode = 'P0001', hint = 'already_member';
  end if;
  if not exists (
    select 1 from public.subscriptions s where s.org_id = inv.org_id and not s.expired
  ) then
    raise exception 'not subscribed' using errcode = 'P0001', hint = 'not_subscribed';
  end if;
  if current_org is not null and member_role = 'owner' then
    raise exception 'owns another organisation' using errcode = 'P0001', hint = 'owner_elsewhere';
  end if;
  if current_org is not null and not p_move then
    raise exception 'needs consent' using errcode = 'P0001', hint = 'needs_consent';
  end if;
  if inv.role = 'owner' and exists (
    select 1 from public.memberships m where m.org_id = inv.org_id and m.role = 'owner'
  ) then
    raise exception 'has an owner' using errcode = 'P0001', hint = 'has_owner';
  end if;

  seat_cap := public.org_seat_limit(inv.org_id);
  select count(*) into members from public.memberships m where m.org_id = inv.org_id;
  if seat_cap is not null and members >= seat_cap then
    raise exception 'team full' using errcode = 'P0001', hint = 'team_full',
      detail = format('%s/%s', members, seat_cap);
  end if;

  if current_org is not null then
    delete from public.memberships m where m.user_id = p_user_id;
  end if;
  insert into public.memberships (org_id, user_id, role) values (inv.org_id, p_user_id, inv.role);

  update public.invitations
  set accepted_at = now(), accepted_by = p_user_id
  where id = inv.id;

  return inv.org_id;
end;
$$;

-- 2. An organisation an admin sets up (ADM-12): approved straight away,
-- with its Stripe customer, and audited. Its owner joins through an owner
-- invite once the subscription exists.
create or replace function public.create_admin_organisation(
  p_name text,
  p_stripe_customer_id text,
  p_actor_id uuid,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name required' using errcode = 'P0001';
  end if;

  -- A retry with the same Stripe customer returns the same organisation.
  select id into org from public.organisations where stripe_customer_id = p_stripe_customer_id;
  if org is not null then
    return org;
  end if;

  insert into public.organisations (name, stripe_customer_id, review_status, reviewed_by, reviewed_at, signup_signals)
  values (
    trim(p_name), p_stripe_customer_id, 'approved', p_actor_id, now(),
    jsonb_build_object('decision', 'admin_setup')
  )
  returning id into org;

  insert into public.admin_audit (actor_id, target_org_id, action, after, details)
  values (
    p_actor_id, org, 'customer.create',
    jsonb_build_object('name', trim(p_name), 'stripe_customer_id', p_stripe_customer_id),
    coalesce(p_details, '{}'::jsonb)
  );
  return org;
end;
$$;

revoke execute on function public.create_admin_organisation(text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_admin_organisation(text, text, uuid, jsonb) to service_role;

-- 3. Offers (plan §4, ADM-11, OFF-01): one model for the admin and the
-- customer. An offer is for an organisation or, before one exists, an email
-- address. Admins create and withdraw them here; customers accept them in
-- phase 7. Written by the server only.
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organisations (id) on delete cascade,
  email text check (email is null or (email = lower(trim(email)) and position('@' in email) > 1)),
  stripe_price_id text not null,
  headline text not null check (length(headline) between 1 and 200),
  message text check (message is null or length(message) <= 2000),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((org_id is null) <> (email is null))
);

comment on table public.offers is
  'Bespoke offers (ADM-11, OFF-01). Written only by the server; admins read all, owners their organisation''s open offers.';

create index offers_org_id_idx on public.offers (org_id);
create index offers_email_idx on public.offers (email);

alter table public.offers enable row level security;
revoke all on public.offers from anon, authenticated;
grant select on public.offers to authenticated;

create policy "Admins read all offers"
  on public.offers for select to authenticated
  using ((select public.is_mintly_admin()));

-- OFF-02: a customer reads only their own organisation's open offers; only
-- the owner can accept one (plan §3).
create policy "Owners read their organisation's open offers"
  on public.offers for select to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) = 'owner'
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  );
