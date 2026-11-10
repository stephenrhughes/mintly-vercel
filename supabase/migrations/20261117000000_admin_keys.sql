-- Phase 5a: the admin area (plan §6.8).
--
-- An admin can switch an API key off on purpose (plan §6.8, "API key
-- operations"). Provisioning and the resync then leave it off, instead of
-- turning it back on at the next Stripe event, until an admin switches it
-- on again. Written by the server only, like the rest of api_keys.

alter table public.api_keys
  add column disabled_by_admin boolean not null default false;

comment on column public.api_keys.disabled_by_admin is
  'An admin turned this key off; provisioning keeps it off until an admin turns it on (plan §6.8).';
