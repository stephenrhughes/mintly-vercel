-- Phase 1: sign-up rules.
--   AUTH-04  work emails only, through a "before user created" Auth hook
--   AUTH-05  terms acceptance, LEGAL-01 terms and privacy versions
--   AUTH-06  marketing opt-out
-- See docs/rewrite-plan.md §6.1.

-- Free and disposable email domains that can't be used to sign up.
-- This migration seeds the most common ones. The full list from mintly-web
-- (about 4,800 domains) is loaded with scripts/import-email-denylist.mjs.
create table public.email_domain_denylist (
  domain text primary key check (domain = lower(domain) and domain !~ '\s'),
  added_at timestamptz not null default now()
);

comment on table public.email_domain_denylist is
  'AUTH-04: sign-up is refused for these domains. Read only by the sign-up rules; no user access.';

-- Exceptions to the denylist, per environment (replaces the hard-coded test
-- bypass in AUTH-04). An entry is a full email address or a bare domain.
create table public.signup_allowlist (
  entry text primary key check (entry = lower(entry) and entry !~ '\s'),
  note text,
  added_at timestamptz not null default now()
);

comment on table public.signup_allowlist is
  'Emails or domains allowed to sign up even if their domain is on the denylist. Set per environment by the service role.';

alter table public.email_domain_denylist enable row level security;
alter table public.signup_allowlist enable row level security;
revoke all on public.email_domain_denylist from anon, authenticated;
revoke all on public.signup_allowlist from anon, authenticated;

-- The domain is taken after the last @ (AUTH-04), lower-cased, without a
-- trailing dot.
create or replace function public.email_domain(email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(rtrim(lower(trim(split_part(email, '@', -1))), '.'), '')
  where position('@' in coalesce(email, '')) > 0;
$$;

-- Null when the email may sign up, otherwise the message to show. The sign-up
-- form calls this first for a friendly error; the Auth hook below enforces it.
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
  return null;
end;
$$;

revoke execute on function public.signup_email_error(text) from public;
grant execute on function public.signup_email_error(text) to anon, authenticated, service_role;

-- Supabase Auth "before user created" hook. Enable it in the dashboard
-- (Authentication → Hooks) pointing at this function; supabase/config.toml
-- enables it for local development. Returning an error object rejects the
-- sign-up with that message.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  message text := public.signup_email_error(event -> 'user' ->> 'email');
begin
  if message is not null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', message));
  end if;
  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- Record terms acceptance and versions (AUTH-05, LEGAL-01) as well as the
-- contact details from the sign-up form. The form sends terms_accepted,
-- terms_version and privacy_version as user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  -- Compared as text, so malformed metadata can't make sign-up fail.
  accepted boolean := (meta ->> 'terms_accepted') is not distinct from 'true';
begin
  insert into public.profiles (
    id, email, first_name, last_name, phone, company_name, marketing_opt_out,
    terms_accepted_at, terms_version, privacy_version
  )
  values (
    new.id,
    new.email,
    nullif(trim(meta ->> 'first_name'), ''),
    nullif(trim(meta ->> 'last_name'), ''),
    nullif(trim(meta ->> 'phone'), ''),
    nullif(trim(meta ->> 'company_name'), ''),
    (meta ->> 'marketing_opt_out') is not distinct from 'true',
    case when accepted then now() end,
    case when accepted then nullif(meta ->> 'terms_version', '') end,
    case when accepted then nullif(meta ->> 'privacy_version', '') end
  );
  return new;
end;
$$;

-- Keep profiles.email in step when a user changes their email address.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- The most common free and disposable providers. Kept in step with the
-- mintly-web list by scripts/import-email-denylist.mjs.
insert into public.email_domain_denylist (domain) values
  ('0815.ru'), ('10minutemail.com'), ('20minutemail.com'), ('33mail.com'), ('aim.com'),
  ('aol.co.uk'), ('aol.com'), ('att.net'), ('bellsouth.net'), ('bigpond.com'),
  ('blueyonder.co.uk'), ('btinternet.com'), ('btopenworld.com'), ('charter.net'), ('comcast.net'),
  ('cox.net'), ('discard.email'), ('dispostable.com'), ('duck.com'), ('earthlink.net'),
  ('email.com'), ('emailondeck.com'), ('fastmail.com'), ('fastmail.fm'), ('free.fr'),
  ('freenet.de'), ('getnada.com'), ('gmail.com'), ('gmx.co.uk'), ('gmx.com'),
  ('gmx.de'), ('gmx.net'), ('googlemail.com'), ('guerrillamail.biz'), ('guerrillamail.com'),
  ('guerrillamail.de'), ('guerrillamail.net'), ('guerrillamail.org'), ('guerrillamailblock.com'), ('hey.com'),
  ('hotmail.co.uk'), ('hotmail.com'), ('hotmail.de'), ('hotmail.es'), ('hotmail.fr'),
  ('hotmail.it'), ('hush.com'), ('hushmail.com'), ('icloud.com'), ('inbox.com'),
  ('laposte.net'), ('libero.it'), ('live.co.uk'), ('live.com'), ('live.fr'),
  ('lycos.com'), ('mac.com'), ('mail.com'), ('mail.ru'), ('mailinator.com'),
  ('mailinator.net'), ('mailnesia.com'), ('maildrop.cc'), ('me.com'), ('mintemail.com'),
  ('msn.com'), ('mytemp.email'), ('ntlworld.com'), ('orange.fr'), ('outlook.co.uk'),
  ('outlook.com'), ('outlook.de'), ('outlook.fr'), ('pm.me'), ('proton.me'),
  ('protonmail.ch'), ('protonmail.com'), ('qq.com'), ('rediffmail.com'), ('rocketmail.com'),
  ('sharklasers.com'), ('sky.com'), ('spamgourmet.com'), ('t-online.de'), ('talktalk.net'),
  ('temp-mail.org'), ('tempail.com'), ('tempmail.com'), ('tempmailo.com'), ('tempr.email'),
  ('throwawaymail.com'), ('tiscali.co.uk'), ('trashmail.com'), ('tutanota.com'), ('tuta.io'),
  ('verizon.net'), ('virginmedia.com'), ('web.de'), ('yahoo.co.in'), ('yahoo.co.uk'),
  ('yahoo.com'), ('yahoo.de'), ('yahoo.es'), ('yahoo.fr'), ('yahoo.it'),
  ('yandex.com'), ('yandex.ru'), ('yopmail.com'), ('yopmail.fr'), ('ymail.com'),
  ('zoho.com'), ('zohomail.com')
on conflict do nothing;
