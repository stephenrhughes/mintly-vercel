-- SSO tenants (plan §6.1): the provider lookup, linking SSO users to their
-- organisation, and RLS. Run with `npm run db:test`.
begin;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', 'olivia@acme.test', '{}', '{"provider": "email"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'sam@acme.test', '{}', '{"provider": "sso:20000000-0000-0000-0000-00000000000a"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'pat@acme.test', '{}', '{"provider": "email"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'eve@acme.test', '{}', '{"provider": "sso:20000000-0000-0000-0000-0000000000ff"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'gil@globex.test', '{}', '{"provider": "sso:20000000-0000-0000-0000-00000000000b"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'ada@mintly.test', '{}', '{"provider": "email"}');

update public.profiles set is_mintly_admin = true where id = '00000000-0000-0000-0000-0000000000d1';

insert into public.organisations (id, name, review_status)
values
  ('10000000-0000-0000-0000-00000000000a', 'Acme', 'approved'),
  ('10000000-0000-0000-0000-00000000000b', 'Globex', 'approved');

insert into public.memberships (org_id, user_id, role)
values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner');

insert into public.subscriptions (org_id, stripe_subscription_id, stripe_price_id, status, expired)
values
  ('10000000-0000-0000-0000-00000000000a', 'sub_acme', 'price_x', 'active', false),
  ('10000000-0000-0000-0000-00000000000b', 'sub_globex', 'price_x', 'canceled', true);

insert into public.sso_domains (domain, org_id, supabase_sso_provider_id, default_role)
values
  ('acme.test', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'developer'),
  ('globex.test', '10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'member');

select is(
  public.sso_provider_for_email('Someone@ACME.test'),
  '20000000-0000-0000-0000-00000000000a'::uuid,
  'the provider is found from the email domain'
);
select is(public.sso_provider_for_email('x@other.test'), null, 'other domains have no provider');

select is(
  public.link_sso_user('00000000-0000-0000-0000-0000000000a2'),
  '10000000-0000-0000-0000-00000000000a'::uuid,
  'an SSO user joins their tenant''s organisation (SSO-05)'
);
select is(
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a2'),
  'developer',
  'with the tenant''s default role'
);
select is(public.link_sso_user('00000000-0000-0000-0000-0000000000a3'), null, 'password users are not linked');
select is(public.link_sso_user('00000000-0000-0000-0000-0000000000a4'), null, 'nor users of another provider');
select is(public.link_sso_user('00000000-0000-0000-0000-0000000000b2'), null, 'nobody joins an organisation without a live subscription');

-- Removed by the owner: not added back at the next sign-in.
delete from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a2';
select is(public.link_sso_user('00000000-0000-0000-0000-0000000000a2'), null, 'a removed SSO user is not linked again');

update public.sso_domains set enabled = false where domain = 'acme.test';
select is(public.sso_provider_for_email('sam@acme.test'), null, 'a disabled tenant is ignored');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select is((select count(*)::integer from public.sso_domains), 0, 'customers do not read SSO tenants');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}', true);
select is((select count(*)::integer from public.sso_domains), 2, 'admins read SSO tenants');

select * from finish();
rollback;
