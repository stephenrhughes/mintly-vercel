-- Phase 4b: SAML SSO tenants and linking SSO users to their organisation.
-- See docs/rewrite-plan.md §4 (sso_domains) and §6.1 (SSO-01 to SSO-07).
--
-- The identity provider itself is registered with the Supabase CLI
-- (`supabase sso add`, docs/supabase-setup.md); this table maps an email
-- domain to that provider and to the organisation its users join.

create table public.sso_domains (
  domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  org_id uuid not null references public.organisations (id) on delete cascade,
  -- The provider's ID from `supabase sso list`.
  supabase_sso_provider_id uuid not null,
  -- SSO users join as members unless the tenant says otherwise (plan §3).
  default_role public.org_role not null default 'member' check (default_role in ('developer', 'member')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sso_domains is
  'SSO tenants: email domain -> Supabase SSO provider and organisation (SSO-05, SSO-07). Admin only; sign-in looks it up through the server.';

create index sso_domains_org_id_idx on public.sso_domains (org_id);

create trigger sso_domains_set_updated_at
  before update on public.sso_domains
  for each row execute function public.set_updated_at();

alter table public.sso_domains enable row level security;

create policy "sso_domains: admins read"
  on public.sso_domains for select
  to authenticated
  using ((select public.is_mintly_admin()));

revoke all on public.sso_domains from anon, authenticated;
grant select on public.sso_domains to authenticated;

-- Set when an SSO user was first linked to their tenant's organisation, so
-- someone the owner later removes isn't added back at their next sign-in.
-- Written only by link_sso_user (not in the profiles update grant).
alter table public.profiles add column sso_linked_at timestamptz;

-- The SSO provider for an email's domain, if it has an enabled tenant
-- (SSO-01, SSO-03). Service role only: the sign-in form asks the server,
-- which checks the captcha first (SSO-02).
create or replace function public.sso_provider_for_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.supabase_sso_provider_id
  from public.sso_domains d
  where d.enabled and d.domain = public.email_domain(p_email);
$$;

revoke execute on function public.sso_provider_for_email(text) from public, anon, authenticated;
grant execute on function public.sso_provider_for_email(text) to service_role;

-- SSO-05: on an SSO user's first sign-in, add them to the organisation
-- their email domain is mapped to, with the tenant's default role, while
-- that organisation has a live subscription. Seat limits are not enforced
-- for SSO users; the admin view flags teams over their limit. Returns the
-- organisation joined, or null. Service role only (the auth callback).
create or replace function public.link_sso_user(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_email text;
  user_provider text;
  tenant public.sso_domains;
begin
  select u.email, u.raw_app_meta_data ->> 'provider'
  into user_email, user_provider
  from auth.users u where u.id = p_user_id;

  -- Only users who signed in through SSO, and only once.
  if user_provider is null or user_provider not like 'sso:%' then
    return null;
  end if;
  if exists (select 1 from public.profiles p where p.id = p_user_id and p.sso_linked_at is not null) then
    return null;
  end if;
  if exists (select 1 from public.memberships m where m.user_id = p_user_id) then
    return null;
  end if;

  select * into tenant
  from public.sso_domains d
  where d.enabled and d.domain = public.email_domain(user_email);
  -- The user must have come through this domain's own provider.
  if tenant.domain is null or user_provider <> 'sso:' || tenant.supabase_sso_provider_id::text then
    return null;
  end if;
  if not exists (
    select 1 from public.subscriptions s where s.org_id = tenant.org_id and not s.expired
  ) then
    return null;
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (tenant.org_id, p_user_id, tenant.default_role)
  on conflict (user_id) do nothing;

  update public.profiles set sso_linked_at = now() where id = p_user_id;
  return tenant.org_id;
end;
$$;

revoke execute on function public.link_sso_user(uuid) from public, anon, authenticated;
grant execute on function public.link_sso_user(uuid) to service_role;
