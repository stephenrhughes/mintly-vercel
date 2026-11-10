-- Phase 4a: team invitations and seats.
-- See docs/rewrite-plan.md §3 (roles and seats), §4 (invitations) and §6.6
-- (team), and requirements TEAM-*, JOIN-*.
--
-- Invitations are written only by server code using the service role, after
-- the owner check (TEAM-04, TEAM-08, TEAM-09). The seat check and the join
-- happen inside the functions below, under a per-organisation lock, so two
-- invites or two joins at once can't overfill a team.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  -- The owner is made at checkout; invites are for developers and members (plan §6.6).
  role public.org_role not null check (role in ('developer', 'member')),
  -- SHA-256 of the token in the link. The token itself is never stored.
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Null while held for an organisation pending review (plan §6.11): the
  -- invite is sent, and its 14 days start, when the organisation is approved.
  sent_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  check ((sent_at is null) = (expires_at is null))
);

comment on table public.invitations is
  'Team invites (TEAM-07). Written only by the server. Owners read their organisation''s; token_hash is never readable with a user session.';

create index invitations_org_id_idx on public.invitations (org_id);

-- One open invite per address per organisation.
create unique index invitations_one_open_idx
  on public.invitations (org_id, email)
  where accepted_at is null and revoked_at is null;

-- Partners and contractors: an admin may let an organisation invite people
-- from other email domains (plan §6.6). Set from the admin area (phase 5).
alter table public.organisations
  add column allow_external_invites boolean not null default false;

grant select (allow_external_invites) on public.organisations to authenticated;

-- RLS: owners read their organisation's invitations (plan §4); admins read all.
alter table public.invitations enable row level security;

create policy "invitations: owners read their organisation's"
  on public.invitations for select
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) = 'owner'
  );

create policy "invitations: admins read all"
  on public.invitations for select
  to authenticated
  using ((select public.is_mintly_admin()));

revoke all on public.invitations from anon, authenticated;
grant select (
  id, org_id, email, role, invited_by, created_at, sent_at, expires_at,
  accepted_at, accepted_by, revoked_at
) on public.invitations to authenticated;

-- An invite still holding a seat (TEAM-03): not accepted or withdrawn, and
-- either held for review or not yet expired.
create or replace function public.invitation_is_open(i public.invitations)
returns boolean
language sql
stable
set search_path = ''
as $$
  select i.accepted_at is null
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now());
$$;

-- The seat limit for an organisation: maxTeamSize plus extraUsers from its
-- live subscription (TEAM-03, PROV-09), Bank Account Checker first. Null
-- when no live subscription records a limit, which lets invites through
-- (TEAM-05).
create or replace function public.org_seat_limit(p_org uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select s.max_team_size + s.extra_users
  from public.subscriptions s
  where s.org_id = p_org and not s.expired and s.max_team_size is not null
  order by (s.product = 'bank_checker') desc
  limit 1;
$$;

revoke execute on function public.org_seat_limit(uuid) from public, anon, authenticated;
grant execute on function public.org_seat_limit(uuid) to service_role;

-- Seats for the team page and the plan-change rules (TEAM-03, PLAN-05):
-- the limit, members (owner included) and invites holding a seat. For the
-- caller's own organisation, admins, or the service role.
create or replace function public.org_seat_usage(p_org uuid)
returns table (seat_limit integer, members integer, pending_invites integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and p_org is distinct from public.auth_org_id()
    and not public.is_mintly_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  select
    public.org_seat_limit(p_org),
    (select count(*)::integer from public.memberships m where m.org_id = p_org),
    (select count(*)::integer from public.invitations i
      where i.org_id = p_org and public.invitation_is_open(i));
end;
$$;

revoke execute on function public.org_seat_usage(uuid) from public, anon;
grant execute on function public.org_seat_usage(uuid) to authenticated, service_role;

-- Creates an invite after the seat check (TEAM-05), for the owner's invite
-- action. The caller has checked the owner and the email domain. With
-- p_send false (organisation pending review) the invite is held. Errors
-- carry a hint the server maps to a message.
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

revoke execute on function public.create_invitation(uuid, text, public.org_role, text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.create_invitation(uuid, text, public.org_role, text, uuid, boolean)
  to service_role;

-- Accepts an invite for a signed-in user (JOIN-01 to JOIN-05, plan §6.6).
-- The caller has checked the session. A user in another organisation is
-- moved only with p_move (their consent); an owner of another organisation
-- can't be moved (ownership changes go through Mintly, plan §3).
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
  -- Re-read under the lock: another tab may have just accepted it.
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
  -- JOIN-02: the signed-in email must match the invite.
  if user_email is distinct from inv.email then
    raise exception 'wrong email' using errcode = 'P0001', hint = 'wrong_email';
  end if;
  if current_org = inv.org_id then
    raise exception 'already joined' using errcode = 'P0001', hint = 'already_member';
  end if;
  -- JOIN-03: the organisation must still be subscribed.
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

  -- JOIN-04: the invite already holds its seat, so only accepted members
  -- count here. This only refuses when the limit has come down.
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

revoke execute on function public.accept_invitation(text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.accept_invitation(text, uuid, boolean) to service_role;
