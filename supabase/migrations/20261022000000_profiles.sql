-- Foundations: user profiles and the first RLS helper.
-- See docs/rewrite-plan.md §4 (data model) and §9 (authorisation).

-- Keeps updated_at current on any table that has one.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  phone text,
  company_name text,
  marketing_opt_out boolean not null default false,
  terms_accepted_at timestamptz,
  terms_version text,
  privacy_version text,
  is_mintly_admin boolean not null default false,
  legacy_cognito_sub text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. is_mintly_admin is written only by the server (service role).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile when the auth user is created, copying the fields
-- the sign-up form passes as user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone, company_name, marketing_opt_out)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'company_name',
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_out')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- True when the signed-in user is a Mintly admin. security definer so
-- policies on other tables can call it without granting read on profiles.
create or replace function public.is_mintly_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_mintly_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.is_mintly_admin() from public, anon;
grant execute on function public.is_mintly_admin() to authenticated;

-- RLS: a user reads and updates their own row; admins read every row.
alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: admins read all"
  on public.profiles for select
  to authenticated
  using ((select public.is_mintly_admin()));

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Column privileges: users may only change their own contact details and
-- marketing choice. Admin status, email and terms are server-only.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone, company_name, marketing_opt_out)
  on public.profiles to authenticated;
