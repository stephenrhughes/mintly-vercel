-- Phase 5b: admin operations that must happen in one transaction with their
-- audit entry (plan §6.8). Both are for the service role only: the server
-- checks for an admin who has completed MFA (SEC-01) before calling them.

-- Transfer ownership (plan §3: only through an admin, audited). The current
-- owner becomes a developer, so they keep the key, and the chosen member
-- becomes the owner. Locks the organisation's memberships so two transfers
-- can't race, and respects the one-owner index by demoting first.
create or replace function public.transfer_ownership(
  p_org_id uuid,
  p_new_owner_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_owner uuid;
  new_role public.org_role;
begin
  perform 1 from public.organisations where id = p_org_id for update;
  if not found then
    raise exception 'organisation % not found', p_org_id using errcode = 'P0002';
  end if;

  select user_id into old_owner
  from public.memberships
  where org_id = p_org_id and role = 'owner';

  select role into new_role
  from public.memberships
  where org_id = p_org_id and user_id = p_new_owner_id;
  if new_role is null then
    raise exception 'the new owner must already be in the team' using errcode = 'P0001';
  end if;
  if new_role = 'owner' then
    raise exception 'they are already the owner' using errcode = 'P0001';
  end if;

  update public.memberships set role = 'developer'
  where org_id = p_org_id and role = 'owner';
  update public.memberships set role = 'owner'
  where org_id = p_org_id and user_id = p_new_owner_id;

  insert into public.admin_audit (actor_id, target_org_id, action, before, after, details)
  values (
    p_actor_id,
    p_org_id,
    'team.transfer_owner',
    jsonb_build_object('owner_id', old_owner),
    jsonb_build_object('owner_id', p_new_owner_id),
    jsonb_build_object('previous_owner_role', case when old_owner is null then null else 'developer' end)
  );
end;
$$;

revoke execute on function public.transfer_ownership(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_ownership(uuid, uuid, uuid) to service_role;

-- Grant or revoke Mintly admin (plan §6.8, "Admins"). Never removes the
-- last admin: the admin profiles are locked first, so two admins revoking
-- each other at once can't leave nobody.
create or replace function public.set_mintly_admin(
  p_user_id uuid,
  p_is_admin boolean,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_admin boolean;
  admins integer;
begin
  perform 1 from public.profiles where is_mintly_admin for update;

  select is_mintly_admin into was_admin from public.profiles where id = p_user_id for update;
  if was_admin is null then
    raise exception 'user % not found', p_user_id using errcode = 'P0002';
  end if;
  if was_admin = p_is_admin then
    return;
  end if;

  if not p_is_admin then
    select count(*) into admins from public.profiles where is_mintly_admin;
    if admins <= 1 then
      raise exception 'there must always be at least one Mintly admin' using errcode = 'P0001';
    end if;
  end if;

  update public.profiles set is_mintly_admin = p_is_admin where id = p_user_id;

  insert into public.admin_audit (actor_id, target_org_id, action, before, after, details)
  values (
    p_actor_id,
    null,
    case when p_is_admin then 'admin.grant' else 'admin.revoke' end,
    jsonb_build_object('is_mintly_admin', was_admin),
    jsonb_build_object('is_mintly_admin', p_is_admin),
    jsonb_build_object('user_id', p_user_id)
  );
end;
$$;

revoke execute on function public.set_mintly_admin(uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.set_mintly_admin(uuid, boolean, uuid) to service_role;
